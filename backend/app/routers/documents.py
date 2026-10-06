"""
app/routers/documents.py
Upload, list, delete documents — Supabase REST + Storage APIs.
- All bucket references go through app.services.storage_utils (no hardcoding)
- Files >5MB use direct HTTP PUT to bypass Supabase SDK 6MB limit
- Returns 202 immediately; processing runs in background
- Rule 6: MAX_FILE_SIZE_MB enforced (default 100MB)
"""
from __future__ import annotations

import asyncio
import logging
import mimetypes
import re
import uuid
from pathlib import PurePosixPath

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.services.storage_utils import get_bucket_name, get_storage_http_url, storage_from

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

LARGE_FILE_THRESHOLD = 5 * 1024 * 1024   # 5 MB — above this, use direct HTTP PUT

ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/png", "image/webp",
    "audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg",
    "video/mp4",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MIME_TO_DOC_TYPE: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.ms-powerpoint": "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "image", "image/png": "image", "image/webp": "image",
    "audio/mpeg": "audio", "audio/wav": "audio", "audio/mp4": "audio", "audio/ogg": "audio",
    "video/mp4": "audio",
    "application/vnd.ms-excel": "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}


def _sanitize_filename(name: str) -> str:
    name = PurePosixPath(name).name
    name = re.sub(r"[^\w\-. ]", "_", name)
    return name[:200]


# ── Storage helpers ────────────────────────────────────────────────────────

def _ensure_bucket(sb) -> None:
    """
    Verify the configured storage bucket exists.
    Bucket name comes from settings.STORAGE_BUCKET (set in .env).
    Only attempts to create if not found — never creates duplicates.
    """
    bucket = get_bucket_name()
    try:
        existing = sb.storage.list_buckets()
        names = {b.name for b in (existing or [])}
        if bucket in names:
            return
    except Exception as e:
        logger.warning(f"Could not list storage buckets: {e} — assuming bucket exists")
        return  # proceed; upload will fail with a clear error if it truly doesn't exist

    try:
        sb.storage.create_bucket(
            bucket,
            options={"public": False, "file_size_limit": 104857600},  # 100 MB limit
        )
        logger.info(f"Created storage bucket '{bucket}'")
    except Exception as e:
        err = str(e).lower()
        if "already exists" in err or "duplicate" in err:
            return
        raise


def _upload_to_storage(sb, storage_path: str, content: bytes, content_type: str) -> None:
    """
    Upload file bytes to Supabase Storage.
    - Files <=5MB: standard Supabase SDK upload()
    - Files >5MB: direct HTTP PUT (bypasses SDK 6MB hard limit)
    Bucket name always comes from storage_utils — never hardcoded.
    """
    if len(content) <= LARGE_FILE_THRESHOLD:
        storage_from(sb).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "false"},
        )
        return

    # Large file path — direct HTTP PUT
    import httpx
    base_url = get_storage_http_url()   # reads SUPABASE_URL + STORAGE_BUCKET from config
    url = f"{base_url}/{storage_path}"
    logger.info(f"Large file ({len(content) // (1024*1024)}MB) — direct HTTP upload")
    resp = httpx.put(
        url,
        content=content,
        headers={
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "false",
        },
        timeout=120,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Storage upload failed {resp.status_code}: {resp.text[:300]}"
        )


def _run_pipeline_background(
    doc_id: str, storage_path: str, doc_type: str,
    user_id: str, doc_name: str, sb,
) -> None:
    """Sync wrapper — called by FastAPI BackgroundTasks (runs in thread pool)."""
    import asyncio as _asyncio
    loop = _asyncio.new_event_loop()
    try:
        from app.services.pipeline.sync_pipeline import run_ingestion_pipeline
        loop.run_until_complete(
            run_ingestion_pipeline(doc_id, storage_path, doc_type, user_id, doc_name, sb)
        )
    except Exception as exc:
        logger.error(f"[{doc_id}] Background pipeline crashed: {exc}", exc_info=True)
    finally:
        loop.close()


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    if background_tasks is None:
        background_tasks = BackgroundTasks()

    user_id = str(current_user["id"])

    # ── Read file ─────────────────────────────────────────────────────────
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read uploaded file: {e}")

    if not content:
        raise HTTPException(400, "Uploaded file is empty")

    # ── Size check ────────────────────────────────────────────────────────
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            413,
            f"File size {len(content) // (1024*1024)}MB exceeds the {settings.MAX_FILE_SIZE_MB}MB limit"
        )

    # ── MIME validation ───────────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        guessed, _ = mimetypes.guess_type(file.filename or "")
        if guessed in ALLOWED_MIME_TYPES:
            content_type = guessed
        else:
            raise HTTPException(
                400,
                f"File type '{content_type or 'unknown'}' is not supported. "
                "Allowed: PDF, PPTX, DOCX, PNG, JPG, MP3, MP4, XLSX"
            )

    # ── Metadata ──────────────────────────────────────────────────────────
    doc_id       = str(uuid.uuid4())
    safe_name    = _sanitize_filename(file.filename or "document")
    storage_path = f"{user_id}/{doc_id}/{safe_name}"
    doc_type     = MIME_TO_DOC_TYPE.get(content_type, "pdf")
    size_mb      = round(len(content) / (1024 * 1024), 2)

    logger.info(f"[{doc_id}] Upload: {safe_name} ({size_mb}MB, {doc_type}, bucket={get_bucket_name()})")

    # ── Verify bucket ─────────────────────────────────────────────────────
    try:
        await asyncio.to_thread(_ensure_bucket, db._sb)
    except Exception as e:
        raise HTTPException(500, f"Storage setup failed: {e}")

    # ── Upload to storage ─────────────────────────────────────────────────
    try:
        await asyncio.to_thread(
            _upload_to_storage, db._sb, storage_path, content, content_type
        )
        logger.info(f"[{doc_id}] Storage upload OK ({size_mb}MB)")
    except HTTPException:
        raise
    except Exception as e:
        err = str(e)
        logger.error(f"[{doc_id}] Storage upload failed: {err}")
        if "413" in err or "too large" in err.lower():
            raise HTTPException(413, f"File too large ({size_mb}MB). Max: {settings.MAX_FILE_SIZE_MB}MB")
        raise HTTPException(500, f"File storage failed: {err[:200]}")

    # ── Create DB record ──────────────────────────────────────────────────
    try:
        await asyncio.to_thread(
            lambda: db._sb.table("documents").insert({
                "id":              doc_id,
                "user_id":         user_id,
                "name":            safe_name,
                "original_name":   file.filename,
                "doc_type":        doc_type,
                "storage_path":    storage_path,
                "file_size_bytes": len(content),
                "status":          "queued",
                "progress":        0,
                "embed_model":     settings.EMBED_MODEL,
                "embed_dim":       settings.EMBED_DIM,
            }).execute()
        )
    except Exception as e:
        logger.error(f"[{doc_id}] DB insert failed: {e}")
        raise HTTPException(500, f"Database record failed: {e}")

    # ── Queue pipeline ────────────────────────────────────────────────────
    celery_queued = False
    if settings.USE_CELERY:
        try:
            from app.workers.tasks import process_document
            process_document.apply_async(
                kwargs=dict(
                    doc_id=doc_id, storage_path=storage_path,
                    doc_type=doc_type, user_id=user_id, doc_name=safe_name,
                ),
                countdown=1,
                queue="ingestion",
            )
            celery_queued = True
            logger.info(f"[{doc_id}] Queued via Celery")
        except Exception as e:
            logger.info(f"[{doc_id}] Celery unavailable ({e}) — using BackgroundTasks")

    if not celery_queued:
        background_tasks.add_task(
            _run_pipeline_background,
            doc_id, storage_path, doc_type, user_id, safe_name, db._sb,
        )
        logger.info(f"[{doc_id}] Queued via BackgroundTasks")

    return JSONResponse(
        status_code=202,
        content={
            "id":              doc_id,
            "name":            safe_name,
            "doc_type":        doc_type,
            "status":          "queued",
            "progress":        0,
            "file_size_bytes": len(content),
            "size_mb":         size_mb,
        },
    )


@router.get("/documents")
async def list_documents(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """List all user documents — Rule 2: filtered by user_id."""
    user_id = str(current_user["id"])
    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select(
                "id, name, original_name, doc_type, file_size_bytes, page_count, "
                "status, progress, error_message, summary, auto_topics, user_tags, "
                "embed_model, embed_dim, created_at, indexed_at"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"documents": result.data or []}
    except Exception as e:
        logger.error(f"list_documents error: {e}")
        raise HTTPException(500, f"Failed to fetch documents: {e}")


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete document + chunks (CASCADE) + storage file — Rule 2: own docs only."""
    user_id = str(current_user["id"])

    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select("storage_path")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "Document not found")

    if not result.data:
        raise HTTPException(404, "Document not found")

    storage_path = result.data["storage_path"]

    try:
        await asyncio.to_thread(
            lambda: storage_from(db._sb).remove([storage_path])
        )
    except Exception as e:
        logger.warning(f"Storage delete failed (non-fatal): {e}")

    await asyncio.to_thread(
        lambda: db._sb.table("documents")
        .delete()
        .eq("id", doc_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"deleted": True, "id": doc_id}


@router.get("/documents/{doc_id}/signed-url")
async def get_signed_url(
    doc_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Generate 1-hour signed URL for PDF viewer — Rule 2: own docs only."""
    user_id = str(current_user["id"])

    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select("storage_path")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "Document not found")

    if not result.data:
        raise HTTPException(404, "Document not found")

    try:
        signed = await asyncio.to_thread(
            lambda: storage_from(db._sb).create_signed_url(
                result.data["storage_path"], expires_in=3600
            )
        )
        url = signed.get("signedURL") or signed.get("signedUrl", "")
        return {"signed_url": url}
    except Exception as e:
        raise HTTPException(500, f"Could not generate signed URL: {e}")
