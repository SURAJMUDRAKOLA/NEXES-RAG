# app/services/generation/query_rewriter.py
# Query rewriting — Feature 3 from RAG Upgrade PDF
# Makes vague / ambiguous queries retrieval-friendly BEFORE vector search
# Uses Groq 8B fast model (~80ms). Falls back to original query on any error.
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

REWRITE_PROMPT = """You are a search query optimizer for a document AI assistant.

Rewrite the user's vague query into a clear, specific, retrieval-friendly question.

Rules:
- Replace "this", "it", "here", "there" with the actual document/topic name if known
- Expand short follow-up queries using conversation context
- Make implicit subjects explicit (e.g. "the algorithm" → "the KMeans algorithm")
- If the query is already clear and specific (>8 words, no vague pronouns), return it UNCHANGED
- Keep it as a single question, max 25 words
- Do NOT answer the question — only rewrite it

Conversation context (last 4 turns):
{history}

Active documents: {doc_names}
Original query: "{query}"

Respond with ONLY the rewritten query. No explanation, no quotes."""

FOLLOWUP_EXPAND_PROMPT = """A user is in a conversation about a document.
Their short follow-up question needs to be expanded with context.

Previous assistant answer (excerpt):
{prev_answer}

User's follow-up: "{query}"

Write a single expanded question (max 20 words) that makes the follow-up self-contained:"""

# Words that signal a vague query needing rewriting
_VAGUE_WORDS = frozenset({
    "this", "it", "that", "there", "here", "thing", "stuff",
    "those", "these", "them", "they", "what", "huh"
})


def _is_vague(query: str) -> bool:
    """Heuristic: is the query too short or contains vague pronouns?"""
    words = query.strip().split()
    if len(words) <= 4:
        return True
    lowered = {w.lower().rstrip("?.,!") for w in words}
    vague_count = len(lowered & _VAGUE_WORDS)
    return vague_count >= 2 or (len(words) <= 7 and vague_count >= 1)


async def rewrite_query(
    query: str,
    intent: str,
    history: list[dict] | None = None,
    doc_names: list[str] | None = None,
) -> str:
    """
    Rewrite a vague query into retrieval-friendly form.
    - Clear specific queries (>8 words, no vague pronouns) returned unchanged
    - FOLLOW_UP intent: expanded using the previous assistant answer
    - Vague queries: rewritten for better vector + BM25 retrieval
    Returns original query on failure — never crashes.
    """
    query = query.strip()

    # Fast-path: already a good query
    if not _is_vague(query) and intent not in ("FOLLOW_UP",):
        return query

    from app.config import settings
    if not settings.GROQ_API_KEY:
        return query

    # Build history strings
    hist_lines: list[str] = []
    prev_answer = ""
    for msg in (history or [])[-4:]:
        role = msg.get("role", "")
        content = str(msg.get("content", ""))[:150]
        hist_lines.append(f"{role}: {content}")
        if role == "assistant":
            prev_answer = content  # keep last assistant message

    hist_str = "\n".join(hist_lines) or "none"
    doc_str = ", ".join(doc_names or []) or "the uploaded document"

    try:
        from app.services.generation.llm import call_llm_fast

        if intent == "FOLLOW_UP" and prev_answer:
            prompt = FOLLOWUP_EXPAND_PROMPT.format(
                prev_answer=prev_answer[:400],
                query=query,
            )
        else:
            prompt = REWRITE_PROMPT.format(
                query=query,
                history=hist_str,
                doc_names=doc_str,
            )

        rewritten = await call_llm_fast(prompt, max_tokens=80)
        rewritten = rewritten.strip().strip('"').strip("'").rstrip(".")

        # Sanity checks
        if rewritten and 5 < len(rewritten) < 250:
            logger.debug(f"Query rewritten: '{query[:40]}' → '{rewritten[:60]}'")
            return rewritten
    except Exception as e:
        logger.debug(f"Query rewriting failed: {e}")

    return query
