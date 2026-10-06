"""
app/routers/embeddings.py
UMAP 3D projection for Knowledge Map — uses Supabase REST (HTTPS)
Section 11.3
"""
from __future__ import annotations

import asyncio
import logging

import numpy as np
from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/embeddings/umap")
async def get_umap_projection(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns 3D UMAP coordinates per document.
    Fetches embeddings via Supabase REST, projects with UMAP/PCA.
    """
    user_id = str(current_user["id"])

    # Fetch one chunk per doc (prefer summary chunks) via REST
    result = await asyncio.to_thread(
        lambda: db._sb.table("chunks")
        .select("doc_id, content, modality")
        .eq("user_id", user_id)
        .eq("chunk_type", "summary")
        .limit(100)
        .execute()
    )
    rows = result.data or []

    # Fallback: use first chunk per doc if no summary chunks
    if not rows:
        result = await asyncio.to_thread(
            lambda: db._sb.table("chunks")
            .select("doc_id, content, modality")
            .eq("user_id", user_id)
            .limit(100)
            .execute()
        )
        rows = result.data or []

    if len(rows) < 2:
        return []

    # Deduplicate to one chunk per doc
    seen_docs = set()
    unique_rows = []
    for row in rows:
        if row["doc_id"] not in seen_docs:
            seen_docs.add(row["doc_id"])
            unique_rows.append(row)
    rows = unique_rows

    if len(rows) < 2:
        return []

    # Get doc names
    doc_ids = list(seen_docs)
    doc_result = await asyncio.to_thread(
        lambda: db._sb.table("documents")
        .select("id, name, doc_type")
        .in_("id", doc_ids)
        .execute()
    )
    doc_map = {d["id"]: d for d in (doc_result.data or [])}

    # Embed chunk texts to get coordinates
    try:
        from app.services.embedding.embedder import batch_embed
        texts = [r["content"][:500] for r in rows]
        embeddings = await batch_embed(texts)
        embeddings_np = np.array(embeddings, dtype=np.float32)
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return []

    if embeddings_np.shape[0] < 2:
        return []

    # UMAP 3D projection with PCA fallback
    try:
        from umap import UMAP
        n_neighbors = min(15, len(rows) - 1)
        reducer = UMAP(
            n_components=3,
            n_neighbors=n_neighbors,
            min_dist=0.1,
            metric="cosine",
            random_state=42,
            low_memory=True,
        )
        coords = reducer.fit_transform(embeddings_np)
    except Exception as e:
        logger.warning(f"UMAP failed: {e} — using PCA fallback")
        from sklearn.decomposition import PCA
        n = min(3, embeddings_np.shape[0], embeddings_np.shape[1])
        coords = PCA(n_components=n).fit_transform(embeddings_np)
        if coords.shape[1] < 3:
            pad = np.zeros((coords.shape[0], 3 - coords.shape[1]))
            coords = np.hstack([coords, pad])

    return [
        {
            "id": str(row["doc_id"]),
            "label": doc_map.get(row["doc_id"], {}).get("name", "Unknown"),
            "type": doc_map.get(row["doc_id"], {}).get("doc_type", "pdf"),
            "x": float(coords[i][0]),
            "y": float(coords[i][1]),
            "z": float(coords[i][2]),
        }
        for i, row in enumerate(rows)
    ]
