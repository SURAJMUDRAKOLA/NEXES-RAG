# app/services/pipeline/sync_pipeline.py
# In-process document ingestion pipeline — runs as FastAPI BackgroundTask.
# Plan §7: parse → chunk → contextual enrich → embed → store
# Uses Groq for enrichment, Gemini for embeddings, Redis cache, Supabase REST.
from __future__ import annotations
import asyncio
import hashlib
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def _update_status(sb, doc_id: str, status: str, progress: int, error: str = None):
    payload = {"status": status, "progress": progress}
    if error:
        payload["error_message"] = error[:500]
    if status == "ready":
        payload["indexed_at"] = datetime.now(timezone.utc).isoformat()
    try:
        await asyncio.to_thread(
            lambda: sb.table("documents").update(payload).eq("id", doc_id).execute()
        )
    except Exception as e:
        logger.error(f"[{doc_id}] status update failed: {e}")


async def run_ingestion_pipeline(
    doc_id: str,
    storage_path: str,
    doc_type: str,
    user_id: str,
    doc_name: str,
    sb,  # Supabase client (service role)
) -> None:
    """
    Full ingestion pipeline — plan §7:
    Phase 1 (10%):  Download + Parse
    Phase 2 (35%):  Chunk
    Phase 3 (55%):  Contextual enrichment (Groq fast model)
    Phase 4 (75%):  Embed (Gemini text-embedding-004 + Redis cache)
    Phase 5 (90%):  Store chunks to Supabase
    Phase 6 (100%): Generate doc summary, mark ready
    """
    from app.config import settings

    logger.info(f"[{doc_id}] Pipeline start: {doc_name} ({doc_type})")

    # ── PHASE 1: Download + Parse ────────────────────────────────────────────
    await _update_status(sb, doc_id, "parsing", 10)
    try:
        from app.services.storage_utils import storage_from
        file_bytes = await asyncio.to_thread(
            lambda: storage_from(sb).download(storage_path)
        )
        if not file_bytes:
            raise RuntimeError("Empty file downloaded from storage")

        from app.services.parsing import get_parser
        parser = get_parser(doc_type)
        parsed_items = await asyncio.to_thread(parser.parse, file_bytes)
        logger.info(f"[{doc_id}] Parsed: {len(parsed_items)} items")
    except Exception as e:
        logger.error(f"[{doc_id}] Parse failed: {e}")
        await _update_status(sb, doc_id, "error", 0, f"Parse error: {e}")
        return


    # ── PHASE 2: Chunk ───────────────────────────────────────────────────────
    await _update_status(sb, doc_id, "chunking", 35)
    try:
        from app.services.chunking.chunker import chunk_document
        chunks = chunk_document(parsed_items, doc_type)
        if not chunks:
            raise RuntimeError("No chunks produced")
        logger.info(f"[{doc_id}] Chunked: {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"[{doc_id}] Chunk failed: {e}")
        await _update_status(sb, doc_id, "error", 0, f"Chunk error: {e}")
        return

    # Update page_count
    page_nums = [c.page_num for c in chunks if getattr(c, "page_num", None)]
    slide_nums = [c.slide_num for c in chunks if getattr(c, "slide_num", None)]
    page_count = max(page_nums or slide_nums or [len(chunks)])
    try:
        await asyncio.to_thread(
            lambda: sb.table("documents").update({"page_count": page_count}).eq("id", doc_id).execute()
        )
    except Exception:
        pass

    # ── PHASE 3: Contextual Enrichment ──────────────────────────────────────
    await _update_status(sb, doc_id, "chunking", 55)
    try:
        from app.services.chunking.contextual import enrich_chunks
        chunks = await enrich_chunks(chunks, doc_name)
        logger.info(f"[{doc_id}] Enrichment done")
    except Exception as e:
        logger.warning(f"[{doc_id}] Enrichment skipped: {e}")
        # Fallback: enriched_text = content
        for c in chunks:
            if not getattr(c, "enriched_text", None):
                c.enriched_text = getattr(c, "content", "")

    # ── PHASE 4: Embed with Redis Cache ─────────────────────────────────────
    await _update_status(sb, doc_id, "embedding", 70)
    try:
        from app.services.embedding.embedder import batch_embed
        from app.services.embedding.cache import get_cached, set_cached

        # Hash each chunk, check cache
        to_embed_idx = []
        for i, c in enumerate(chunks):
            text = getattr(c, "enriched_text", "") or getattr(c, "content", "")
            h = hashlib.sha256(text.encode()).hexdigest()
            c.content_hash = h
            cached = get_cached(h)
            if cached:
                c.embedding = cached
            else:
                c.embedding = None
                to_embed_idx.append(i)

        if to_embed_idx:
            texts = [
                (getattr(chunks[i], "enriched_text", "") or getattr(chunks[i], "content", ""))
                for i in to_embed_idx
            ]
            vectors = await batch_embed(texts)
            for i, vec in zip(to_embed_idx, vectors):
                chunks[i].embedding = vec
                set_cached(chunks[i].content_hash, vec)

        has_embed = sum(1 for c in chunks if getattr(c, "embedding", None))
        logger.info(f"[{doc_id}] Embedded: {has_embed}/{len(chunks)} chunks")
    except Exception as e:
        logger.warning(f"[{doc_id}] Embedding skipped: {e}")
        for c in chunks:
            c.embedding = None

    # ── PHASE 5: Store chunks ────────────────────────────────────────────────
    await _update_status(sb, doc_id, "embedding", 90)
    try:
        records = []
        for i, c in enumerate(chunks):
            content = getattr(c, "content", "") or ""
            enriched = getattr(c, "enriched_text", "") or content
            embedding = getattr(c, "embedding", None)
            records.append({
                "doc_id": doc_id,
                "user_id": user_id,
                "content": content,
                "enriched_content": enriched,
                "embedding": embedding,
                "modality": getattr(c, "modality", "text") or "text",
                "chunk_index": i,
                "page_num": getattr(c, "page_num", None),
                "slide_num": getattr(c, "slide_num", None),
                "bbox": getattr(c, "bbox", None),
                "content_hash": getattr(c, "content_hash", ""),
                "chunk_type": getattr(c, "chunk_type", "body") or "body",
                "token_count": len(content.split()),
            })

        # Insert in batches of 50
        BATCH = 50
        for i in range(0, len(records), BATCH):
            batch = records[i:i + BATCH]
            await asyncio.to_thread(
                lambda b=batch: sb.table("chunks").insert(b).execute()
            )
        logger.info(f"[{doc_id}] Stored {len(records)} chunks")
    except Exception as e:
        logger.error(f"[{doc_id}] Store failed: {e}")
        await _update_status(sb, doc_id, "error", 0, f"Store error: {e}")
        return

    # ── PHASE 6: Summary + Topics + Suggested Questions + Done ────────────────────────
    doc_summary = ""
    try:
        # Build richer sample from first 12 chunks
        sample_text = "\n\n".join(
            (getattr(c, "content", "") or "")[:350]
            for c in chunks[:12]
        )
        from app.services.generation.llm import call_llm_fast

        # 6a: Generate document summary (4-5 sentences for suggested Qs)
        summary = await call_llm_fast(
            f"Summarize this document in 4-5 sentences covering: main topic, key concepts, methods/approaches, and conclusions:\n\n{sample_text}",
            max_tokens=180,
        )
        doc_summary = summary or ""
        if doc_summary:
            await asyncio.to_thread(
                lambda: sb.table("documents").update({"summary": doc_summary}).eq("id", doc_id).execute()
            )
            logger.info(f"[{doc_id}] Summary stored")
    except Exception as e:
        logger.warning(f"[{doc_id}] Summary generation failed: {e}")

    # 6b: Extract topics/keywords
    try:
        import json as _json, re as _re
        from app.services.generation.llm import call_llm_fast
        from app.services.generation.prompt import TOPIC_EXTRACTION_PROMPT

        content_sample = "\n\n".join(
            (getattr(c, "content", "") or "")[:200] for c in chunks[:15]
        )
        topics_raw = await call_llm_fast(
            TOPIC_EXTRACTION_PROMPT.format(content=content_sample),
            max_tokens=120,
        )
        topics: list[str] = []
        match = _re.search(r"\{.*?\}", topics_raw, _re.DOTALL)
        if match:
            data = _json.loads(match.group())
            topics = [str(t).strip() for t in data.get("topics", []) if t][:8]
        logger.info(f"[{doc_id}] Topics: {topics}")
    except Exception as e:
        logger.warning(f"[{doc_id}] Topic extraction failed: {e}")
        topics = []

    # 6c: Generate suggested questions for this document
    suggested_qs: list[str] = []
    try:
        import json as _json2, re as _re2
        from app.services.generation.prompt import SUGGESTED_QUESTIONS_PROMPT
        if doc_summary:
            qs_raw = await call_llm_fast(
                SUGGESTED_QUESTIONS_PROMPT.format(summary=doc_summary[:600]),
                max_tokens=350,
            )
            match2 = _re2.search(r"\{.*?\}", qs_raw, _re2.DOTALL)
            if match2:
                data2 = _json2.loads(match2.group())
                suggested_qs = [str(q).strip() for q in data2.get("questions", []) if q][:8]
            logger.info(f"[{doc_id}] Suggested questions: {len(suggested_qs)}")
    except Exception as e:
        logger.warning(f"[{doc_id}] Suggested questions failed: {e}")

    # 6d: Store topics + suggested questions in auto_topics
    # (questions are distinguishable by ending with '?' or starting with a question word)
    all_auto_topics = topics + suggested_qs  # combine: topics first, questions second
    if all_auto_topics:
        try:
            await asyncio.to_thread(
                lambda: sb.table("documents").update({"auto_topics": all_auto_topics}).eq("id", doc_id).execute()
            )
            logger.info(f"[{doc_id}] auto_topics stored: {len(all_auto_topics)} items")
        except Exception as e:
            logger.warning(f"[{doc_id}] auto_topics store failed: {e}")

    await _update_status(sb, doc_id, "ready", 100)
    logger.info(f"[{doc_id}] Pipeline complete ✓ (topics={len(topics)}, qs={len(suggested_qs)})")
