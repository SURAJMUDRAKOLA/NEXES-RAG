# app/services/embedding/embedder.py
# Gemini REST API — gemini-embedding-001, outputDimensionality=768
# Supabase pgvector has a 2000-dim limit for ALL indexes (HNSW + IVFFlat)
# 768-dim fits within limit and still gives excellent retrieval quality
# Rule 3: always batch calls with asyncio.gather — never serial loop
from __future__ import annotations
import asyncio
import logging

import requests
from tenacity import retry, stop_after_attempt, wait_exponential
from app.config import settings

logger = logging.getLogger(__name__)

EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
OUTPUT_DIM = 768  # Supabase pgvector max index dim = 2000; 768 is safe + high quality


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _embed_sync(text: str) -> list:
    """Single synchronous embed call — run in executor to keep event loop free."""
    response = requests.post(
        f"{EMBED_URL}?key={settings.GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": text[:8000]}]},
            "taskType": "RETRIEVAL_DOCUMENT",
            "outputDimensionality": OUTPUT_DIM,   # truncate to 768-dim
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini embed API error {response.status_code}: {response.text[:200]}"
        )
    return response.json()["embedding"]["values"]


async def embed_single(text: str) -> list:
    """Embed a single text. Returns 768-float vector."""
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning zero vector")
        return [0.0] * settings.EMBED_DIM
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_sync, text)


async def batch_embed(texts: list, batch_size: int = 50) -> list:
    """
    Embed list of texts using parallel asyncio.gather.
    Rule 3: never call embed_single in a serial loop — use this for bulk.
    Returns list of 768-float vectors in same order as input.
    Graceful fallback: zero-vector per failed chunk (won't crash pipeline).
    """
    if not texts:
        return []
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning zero vectors")
        return [[0.0] * settings.EMBED_DIM for _ in texts]

    all_results: list = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        tasks = [embed_single(t) for t in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"Embed failed for chunk: {r}")
                all_results.append([0.0] * settings.EMBED_DIM)
            else:
                all_results.append(r)
        if i + batch_size < len(texts):
            await asyncio.sleep(0.1)
    return all_results
