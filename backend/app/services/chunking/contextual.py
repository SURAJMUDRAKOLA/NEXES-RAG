# app/services/chunking/contextual.py
# Contextual enrichment — Anthropic contextual retrieval paper (2024)
# Prepends a context sentence to each chunk BEFORE embedding.
# Reduces retrieval failures by ~67%.
# Uses Groq SDK directly — NO LiteLLM.
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

ENRICH_PROMPT = """Document: {doc_name}
Chunk: {chunk_text}

Write ONE sentence (max 25 words) describing where in the document
this chunk appears and what specific topic it covers.
Be concrete. No preamble. No 'This chunk...'.
Output ONLY the sentence."""


async def _call_groq_fast(prompt: str, max_tokens: int = 60) -> str:
    """Call Groq fast model (8B) directly via Groq SDK. Falls back gracefully."""
    from app.config import settings
    if not settings.GROQ_API_KEY:
        return ""
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        # Strip 'groq/' prefix — SDK does not use provider routing prefixes
        model = settings.LLM_FAST_PROVIDER.removeprefix("groq/")
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.debug(f"Contextual enrichment call failed: {e}")
        return ""


async def _enrich_one(chunk, doc_name: str) -> str:
    content = getattr(chunk, "content", "") or ""
    return await _call_groq_fast(
        ENRICH_PROMPT.format(doc_name=doc_name, chunk_text=content[:400]),
        max_tokens=60,
    )


async def enrich_chunks(chunks: list, doc_name: str, batch_size: int = 25) -> list:
    """
    Enrich each chunk with a contextual sentence prepended to enriched_text.
    Falls back to raw content if Groq unavailable or rate-limited.
    """
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        tasks = [_enrich_one(c, doc_name) for c in batch]
        contexts = await asyncio.gather(*tasks, return_exceptions=True)
        for chunk, ctx in zip(batch, contexts):
            content = getattr(chunk, "content", "") or ""
            if isinstance(ctx, Exception) or not ctx:
                chunk.enriched_text = content
            else:
                chunk.enriched_text = f"{ctx}\n\n{content}"
    return chunks
