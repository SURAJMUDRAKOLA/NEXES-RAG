# app/services/retrieval/hybrid.py
# pgvector cosine search + BM25 full-text + RRF merge
from __future__ import annotations
import asyncio
import logging

logger = logging.getLogger(__name__)


def reciprocal_rank_fusion(ranked_lists: list, k: int = 60) -> list:
    """RRF merge — plan §9.1."""
    scores, data = {}, {}
    for lst in ranked_lists:
        for rank, doc in enumerate(lst, 1):
            did = doc["id"]
            scores[did] = scores.get(did, 0) + 1.0 / (k + rank)
            data[did] = doc
    return [
        {**data[d], "rrf_score": round(scores[d], 6)}
        for d in sorted(scores, key=scores.get, reverse=True)
    ]


async def pgvector_search(sb, user_id: str, doc_ids: list, query_vector: list,
                           top_k: int = 20, modality: str = None) -> list:
    """Call match_chunks() Supabase RPC for cosine similarity search."""
    if not query_vector or not doc_ids:
        return []
    try:
        params = {
            "query_embedding": query_vector,
            "match_user_id": user_id,
            "match_doc_ids": doc_ids,
            "match_count": top_k,
            "match_modality": modality,
        }
        result = await asyncio.to_thread(
            lambda: sb.rpc("match_chunks", params).execute()
        )
        rows = result.data or []
        logger.debug(f"pgvector returned {len(rows)} results")
        return rows
    except Exception as e:
        logger.warning(f"pgvector_search failed: {e}")
        return []


async def bm25_search(sb, user_id: str, doc_ids: list, query: str,
                       top_k: int = 20) -> list:
    """Call match_chunks_fts() Supabase RPC for BM25 full-text search."""
    if not query or not doc_ids:
        return []
    try:
        params = {
            "query_text": query,
            "match_user_id": user_id,
            "match_doc_ids": doc_ids,
            "match_count": top_k,
        }
        result = await asyncio.to_thread(
            lambda: sb.rpc("match_chunks_fts", params).execute()
        )
        rows = result.data or []
        logger.debug(f"BM25 returned {len(rows)} results")
        return rows
    except Exception as e:
        logger.warning(f"bm25_search failed: {e}")
        return []


async def hybrid_retrieve(sb, user_id: str, doc_ids: list, query: str,
                            query_vector: list, top_k: int = 20) -> list:
    """Run pgvector + BM25 in parallel, merge with RRF."""
    vec_task = pgvector_search(sb, user_id, doc_ids, query_vector, top_k)
    bm25_task = bm25_search(sb, user_id, doc_ids, query, top_k)
    vec_res, bm25_res = await asyncio.gather(vec_task, bm25_task)
    merged = reciprocal_rank_fusion([vec_res, bm25_res])
    return merged[:top_k]
