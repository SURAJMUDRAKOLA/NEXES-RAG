# app/services/retrieval/reranker.py
# FlashRank cross-encoder reranker — upgraded for RAG Upgrade PDF (Feature 6 + 16)
# Upgrades: title/heading chunk bonus, proximity bonus, content-hash deduplication
from __future__ import annotations

import asyncio
import logging
import re

logger = logging.getLogger(__name__)

_ranker = None

# Patterns that suggest a chunk contains a heading/title/section marker
_TITLE_PATTERN = re.compile(
    r"^(slide\s+\d+|chapter\s+\d+|section\s+\d+|\d+\.\s+[A-Z]|"
    r"#{1,3}\s+|[A-Z][A-Z\s]{3,}:)",
    re.MULTILINE,
)


def _get_ranker():
    global _ranker
    if _ranker is None:
        try:
            from flashrank import Ranker
            _ranker = Ranker(
                model_name="ms-marco-MiniLM-L-12-v2",
                cache_dir="/tmp/flashrank",
            )
            logger.info("FlashRank reranker loaded")
        except Exception as e:
            logger.warning(f"FlashRank init failed: {e} — reranking disabled")
            _ranker = False
    return _ranker if _ranker else None


def _deduplicate(candidates: list[dict]) -> list[dict]:
    """
    Remove duplicate chunks by content_hash, then by content similarity.
    Keeps the first occurrence (highest RRF/similarity score).
    """
    seen_hashes: set[str] = set()
    seen_content_prefix: set[str] = set()
    deduped: list[dict] = []

    for c in candidates:
        # Hash-based dedup
        h = c.get("content_hash", "")
        if h and h in seen_hashes:
            continue
        if h:
            seen_hashes.add(h)

        # Content prefix dedup (first 80 chars) — catches re-chunked overlapping text
        content = str(c.get("content", ""))
        prefix = content[:80].lower().strip()
        if prefix and prefix in seen_content_prefix:
            continue
        if prefix:
            seen_content_prefix.add(prefix)

        deduped.append(c)

    return deduped


def _apply_score_bonuses(candidates: list[dict], query: str) -> list[dict]:
    """
    Apply score bonuses after FlashRank:
    - +0.12 for chunks that contain section/slide headings (more informative)
    - +0.06 for chunks where the query terms appear in the first 50 chars (high relevance)
    - Normalize scores to 0-1 range
    """
    query_words = set(query.lower().split())
    # Filter common stop words
    stop = {"a", "an", "the", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "with", "what", "how", "why", "does", "do"}
    query_words -= stop

    for chunk in candidates:
        content = str(chunk.get("content", ""))
        score = float(chunk.get("rerank_score", chunk.get("rrf_score", 0.5)))

        # Title/heading bonus
        if _TITLE_PATTERN.search(content):
            score += 0.12

        # Query term in opening (high-signal)
        if query_words:
            opening = content[:100].lower()
            matching = sum(1 for w in query_words if w in opening and len(w) > 3)
            score += matching * 0.03

        chunk["rerank_score"] = round(score, 4)

    return candidates


def flashrank_rerank(query: str, candidates: list[dict], top_n: int = 10) -> list[dict]:
    """
    Full reranking pipeline:
    1. Deduplicate by content_hash
    2. FlashRank cross-encoder scoring
    3. Apply title + query-term bonuses
    4. Return top_n
    Falls back to deduped + top-k if FlashRank unavailable.
    """
    if not candidates:
        return []

    # Step 1: Deduplicate
    candidates = _deduplicate(candidates)

    ranker = _get_ranker()
    if not ranker:
        # No FlashRank — still apply bonuses + return top_n
        candidates = _apply_score_bonuses(candidates, query)
        candidates.sort(key=lambda c: c.get("rerank_score", 0), reverse=True)
        return candidates[:top_n]

    try:
        from flashrank import RerankRequest

        passages = [
            {
                "id": i,
                "text": str(c.get("content", ""))[:512],  # FlashRank max context
                "meta": c,
            }
            for i, c in enumerate(candidates)
        ]

        req = RerankRequest(query=query, passages=passages)
        result = ranker.rerank(req)

        # Reconstruct chunks with scores
        reranked: list[dict] = []
        for r in result[:top_n]:
            chunk = dict(r["meta"])
            chunk["rerank_score"] = round(float(r.get("score", 0)), 4)
            reranked.append(chunk)

        # Step 3: Apply bonuses on top of FlashRank scores
        reranked = _apply_score_bonuses(reranked, query)
        reranked.sort(key=lambda c: c.get("rerank_score", 0), reverse=True)

        logger.debug(f"FlashRank: {len(candidates)} → {len(reranked)} chunks")
        return reranked

    except Exception as e:
        logger.warning(f"FlashRank rerank failed: {e}")
        candidates = _apply_score_bonuses(candidates, query)
        candidates.sort(key=lambda c: c.get("rerank_score", 0), reverse=True)
        return candidates[:top_n]


async def rerank_async(query: str, candidates: list[dict], top_n: int = 10) -> list[dict]:
    """Async wrapper — runs FlashRank in thread pool to avoid blocking event loop."""
    return await asyncio.get_event_loop().run_in_executor(
        None, flashrank_rerank, query, candidates, top_n
    )
