# app/services/memory/conversation_context.py
# Per-session conversation context tracker — Feature 4 (Conversation Memory)
# Stores in Redis: active document names, current topic/entity, last Q&A pairs
# Used by query_rewriter to expand follow-up questions intelligently
from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

_CONTEXT_TTL = 3600        # 1 hour per session
_PREFIX = "ctx:session:v1:"
_MAX_PAIRS = 3             # keep last 3 Q&A pairs


def _redis():
    """Get Redis client — gracefully returns None if unavailable."""
    try:
        from app.services.embedding.cache import _get_redis
        return _get_redis()
    except Exception:
        return None


def _key(session_id: str) -> str:
    return f"{_PREFIX}{session_id}"


def get_session_context(session_id: str) -> dict:
    """
    Fetch conversation context for a session.
    Returns empty dict if Redis unavailable or session not found.
    Schema: {doc_names: [], topic: str, entity: str, page: int, pairs: [{q, a}]}
    """
    r = _redis()
    if not r:
        return {}
    try:
        raw = r.get(_key(session_id))
        return json.loads(raw) if raw else {}
    except Exception as e:
        logger.debug(f"Context get error: {e}")
        return {}


def update_session_context(
    session_id: str,
    *,
    doc_names: list[str] | None = None,
    topic: str | None = None,
    entity: str | None = None,
    page: int | None = None,
    last_query: str | None = None,
    last_answer: str | None = None,
) -> None:
    """
    Partial-update conversation context in Redis.
    Only provided fields are changed — everything else is preserved.
    """
    r = _redis()
    if not r:
        return
    try:
        ctx = get_session_context(session_id)

        if doc_names is not None:
            ctx["doc_names"] = list(doc_names)
        if topic is not None:
            ctx["topic"] = topic[:100]
        if entity is not None:
            ctx["entity"] = entity[:100]
        if page is not None:
            ctx["page"] = int(page)

        # Append Q&A pair to rolling log
        if last_query:
            pairs: list[dict] = ctx.get("pairs", [])
            entry: dict = {"q": last_query[:200]}
            if last_answer:
                entry["a"] = last_answer[:400]
            pairs.append(entry)
            ctx["pairs"] = pairs[-_MAX_PAIRS:]

        r.setex(_key(session_id), _CONTEXT_TTL, json.dumps(ctx))
    except Exception as e:
        logger.debug(f"Context update error: {e}")


def get_doc_names_for_session(session_id: str) -> list[str]:
    """Quick helper — returns active document names for a session."""
    return get_session_context(session_id).get("doc_names", [])


def get_last_pairs(session_id: str) -> list[dict]:
    """Return last Q&A pairs for context injection into query rewriter."""
    return get_session_context(session_id).get("pairs", [])


def clear_session_context(session_id: str) -> None:
    """Delete session context from Redis (e.g. when session is deleted)."""
    r = _redis()
    if r:
        try:
            r.delete(_key(session_id))
        except Exception:
            pass
