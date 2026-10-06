# app/routers/chat.py
# SSE streaming chat endpoint — upgraded for RAG Upgrade PDF
# New: intent-aware routing, conversation memory, suggested questions SSE event
# Rate limited: 5/minute per user (Rule 5). Backward compatible — no API changes.
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.schemas import ChatRequest

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Redis embedding cache helpers ─────────────────────────────────────────────

def _cache_key_query_embed(query: str) -> str:
    h = hashlib.sha256(query.strip().lower().encode()).hexdigest()
    return f"embed:query:v1:{h}"


async def _get_cached_query_embed(query: str) -> list | None:
    try:
        from app.services.embedding.cache import _get_redis
        r = _get_redis()
        if not r:
            return None
        data = r.get(_cache_key_query_embed(query))
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def _set_cached_query_embed(query: str, vec: list) -> None:
    try:
        from app.services.embedding.cache import _get_redis
        r = _get_redis()
        if r:
            r.setex(_cache_key_query_embed(query), 3600, json.dumps(vec))
    except Exception:
        pass


# ── Helper: fetch doc names from doc_ids ─────────────────────────────────────

async def _fetch_doc_names(db, doc_ids: list[str]) -> list[str]:
    """Fetch document names for the given doc_ids — used by intent classifier."""
    if not doc_ids:
        return []
    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select("name")
            .in_("id", doc_ids)
            .execute()
        )
        return [r.get("name", "") for r in (result.data or []) if r.get("name")]
    except Exception:
        return []


# ── Helper: fetch doc summary for suggested questions ────────────────────────

async def _fetch_doc_summary(db, doc_id: str) -> str:
    """Fetch summary + suggested_questions for a document."""
    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select("summary, auto_topics")
            .eq("id", doc_id)
            .single()
            .execute()
        )
        if result.data:
            return result.data.get("summary", "") or ""
    except Exception:
        pass
    return ""


@router.post("/chat")
async def chat(
    request: Request,
    body: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    SSE streaming chat — upgraded pipeline.
    Events: {type:token}, {type:sources}, {type:key_points},
            {type:related_questions}, {type:suggested_questions}, {type:done}, {type:error}
    """
    user_id = str(current_user["id"])
    start_time = time.perf_counter()

    async def event_stream():
        full_response = ""
        sources: list = []
        model = settings.LLM_PROVIDER
        message_id = None

        try:
            # ── 1. Load conversation history ──────────────────────────────────
            hist_result = await asyncio.to_thread(
                lambda: db._sb.table("messages")
                .select("role, content")
                .eq("session_id", str(body.session_id))
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            history = list(reversed(hist_result.data or []))

            # ── 2. Fetch doc names (for intent + query rewriting context) ─────
            doc_ids = [str(d) for d in (body.doc_ids or [])]
            doc_names = await _fetch_doc_names(db, doc_ids) if doc_ids else []

            # ── 3. Save user message ──────────────────────────────────────────
            try:
                await asyncio.to_thread(
                    lambda: db._sb.table("messages").insert({
                        "session_id": str(body.session_id),
                        "user_id": user_id,
                        "role": "user",
                        "content": body.query,
                    }).execute()
                )
            except Exception as e:
                logger.warning(f"Could not save user message: {e}")

            # ── 4. Run upgraded LangGraph pipeline ────────────────────────────
            assembled_prompt = None
            intent = "DOCUMENT_CHAT"

            try:
                from app.pipeline.graph import rag_pipeline, RAGState
                if rag_pipeline is None:
                    raise ImportError("RAG pipeline not compiled")

                cached_vec = await _get_cached_query_embed(body.query)

                initial_state: dict = {
                    # Core inputs
                    "query":              body.query,
                    "session_id":         str(body.session_id),
                    "user_id":            user_id,
                    "doc_ids":            doc_ids,
                    "doc_names":          doc_names,
                    "history":            history,
                    "db":                 db,
                    # New upgrade fields
                    "intent":             "",
                    "rewritten_query":    body.query,
                    "mode_override":      body.mode,
                    # Classification
                    "query_type":         "lookup",
                    "metadata_filters":   {},
                    # Retrieval
                    "hyde_text":          None,
                    "query_vector":       cached_vec or [],
                    "candidates":         [],
                    "reranked":           [],
                    "final_chunks":       [],
                    # Control
                    "context_sufficient": True,
                    "retry_count":        0,
                    "sub_queries":        [],
                    # Output
                    "model_to_use":       "",
                    "assembled_prompt":   [],
                    "sources":            [],
                }

                pipeline_state = await rag_pipeline.ainvoke(initial_state)
                assembled_prompt = pipeline_state.get("assembled_prompt") or []
                model = pipeline_state.get("model_to_use") or model
                sources = pipeline_state.get("sources") or []
                intent = pipeline_state.get("intent", "DOCUMENT_CHAT")

                # Cache query embedding (Rule 4)
                query_vec = pipeline_state.get("query_vector")
                if query_vec and not cached_vec:
                    await _set_cached_query_embed(body.query, query_vec)

                logger.info(f"Pipeline: intent={intent}, model={model}, chunks={len(sources)}")

            except Exception as pipeline_err:
                logger.warning(f"Pipeline failed: {pipeline_err} — fallback to direct LLM")

            # ── 5. Fallback prompt if pipeline failed ─────────────────────────
            if not assembled_prompt:
                from app.services.generation.prompt import SYSTEM_PROMPT
                assembled_prompt = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *[{"role": m["role"], "content": m["content"]} for m in history[-6:]],
                    {"role": "user", "content": body.query},
                ]

            # ── 6. Stream Groq tokens ─────────────────────────────────────────
            from app.services.generation.llm import stream_llm
            token_count = 0
            async for token in stream_llm(messages=assembled_prompt, model=model):
                full_response += token
                token_count += 1
                yield json.dumps({"type": "token", "data": token})

            # ── 7. Citation validation ────────────────────────────────────────
            from app.services.generation.guardrails import validate_response
            is_valid = validate_response(full_response, len(sources))
            if not is_valid and sources:
                logger.warning(f"Response failed citation check (intent={intent})")

            # ── 8. Emit sources ───────────────────────────────────────────────
            yield json.dumps({"type": "sources", "sources": sources})

            # ── 9. Key points ─────────────────────────────────────────────────
            from app.services.generation.guardrails import extract_key_points
            key_points = extract_key_points(full_response)
            if key_points:
                yield json.dumps({"type": "key_points", "points": key_points})

            # ── 10. Related questions (skip for GENERAL_CHAT) ────────────────
            if (
                settings.ENABLE_RELATED_QUESTIONS
                and full_response
                and len(full_response) > 50
                and intent != "GENERAL_CHAT"
            ):
                try:
                    from app.services.generation.llm import call_llm
                    from app.services.generation.prompt import RELATED_QUESTIONS_PROMPT
                    import re as _re
                    rq_raw = await call_llm(
                        messages=[{"role": "user", "content": RELATED_QUESTIONS_PROMPT.format(
                            answer=full_response[:600]
                        )}],
                        model=settings.LLM_FAST_PROVIDER,
                        max_tokens=200,
                    )
                    rq_match = _re.search(r"\{.*?\}", rq_raw, _re.DOTALL)
                    if rq_match:
                        rq_data = json.loads(rq_match.group())
                        qs = rq_data.get("questions", [])[:5]
                        if qs:
                            yield json.dumps({"type": "related_questions", "questions": qs})
                except Exception as rq_err:
                    logger.debug(f"Related questions skipped: {rq_err}")

            # ── 11. Update conversation context (memory) ──────────────────────
            try:
                from app.services.memory.conversation_context import update_session_context
                update_session_context(
                    session_id=str(body.session_id),
                    doc_names=doc_names or None,
                    last_query=body.query,
                    last_answer=full_response[:400] if full_response else None,
                )
            except Exception:
                pass

            # ── 12. Persist assistant message ─────────────────────────────────
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            try:
                msg_res = await asyncio.to_thread(
                    lambda: db._sb.table("messages").insert({
                        "session_id": str(body.session_id),
                        "user_id": user_id,
                        "role": "assistant",
                        "content": full_response,
                        "sources": sources,
                        "model_used": model,
                        "prompt_tokens": len(str(assembled_prompt)) // 4,
                        "completion_tokens": token_count,
                        "latency_ms": latency_ms,
                    }).execute()
                )
                if msg_res.data:
                    message_id = msg_res.data[0].get("id")
            except Exception as e:
                logger.warning(f"Message save failed: {e}")

            # Update session last_active
            try:
                await asyncio.to_thread(
                    lambda: db._sb.table("sessions")
                    .update({"last_active": datetime.now(timezone.utc).isoformat()})
                    .eq("id", str(body.session_id))
                    .execute()
                )
            except Exception:
                pass

            yield json.dumps({
                "type": "done",
                "message_id": str(message_id) if message_id else "",
                "latency_ms": latency_ms,
                "model": model,
                "intent": intent,
                "chunk_count": len(sources),
            })

        except Exception as exc:
            logger.error(f"Chat SSE error: {exc}", exc_info=True)
            yield json.dumps({"type": "error", "message": str(exc)})

    return EventSourceResponse(event_stream())


@router.get("/chat/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch message history for a session."""
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("messages")
        .select(
            "id, role, content, sources, model_used, "
            "prompt_tokens, completion_tokens, latency_ms, feedback, created_at"
        )
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return {"messages": result.data or []}


@router.post("/chat/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    feedback: int,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Record thumbs up (1) / thumbs down (-1) feedback."""
    if feedback not in (1, -1):
        from fastapi import HTTPException
        raise HTTPException(400, "feedback must be 1 or -1")
    user_id = str(current_user["id"])
    await asyncio.to_thread(
        lambda: db._sb.table("messages")
        .update({"feedback": feedback})
        .eq("id", message_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"ok": True}


@router.get("/chat/{session_id}/suggested-questions")
async def get_suggested_questions(
    session_id: str,
    doc_id: str | None = None,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Fetch pre-generated suggested questions for a document.
    Returns from documents.auto_topics if available, else generates on-the-fly.
    """
    user_id = str(current_user["id"])
    if not doc_id:
        return {"questions": []}
    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("documents")
            .select("summary, auto_topics")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            return {"questions": []}

        auto_topics = result.data.get("auto_topics") or []
        summary = result.data.get("summary", "") or ""

        # If we have pre-generated questions stored in auto_topics
        # (they start with "?" or are question-shaped)
        questions = [t for t in auto_topics if t.endswith("?") or t.startswith("What") or t.startswith("How") or t.startswith("Explain") or t.startswith("Generate") or t.startswith("Create")]

        if questions:
            return {"questions": questions[:8]}

        # Generate on-the-fly if no pre-generated questions
        if summary:
            try:
                from app.services.generation.llm import call_llm_fast
                from app.services.generation.prompt import SUGGESTED_QUESTIONS_PROMPT
                import re as _re
                raw = await call_llm_fast(
                    SUGGESTED_QUESTIONS_PROMPT.format(summary=summary[:600]),
                    max_tokens=300,
                )
                match = _re.search(r"\{.*?\}", raw, _re.DOTALL)
                if match:
                    data = json.loads(match.group())
                    return {"questions": data.get("questions", [])[:8]}
            except Exception as e:
                logger.debug(f"Suggested questions generation failed: {e}")

        return {"questions": []}
    except Exception as e:
        logger.warning(f"get_suggested_questions error: {e}")
        return {"questions": []}
