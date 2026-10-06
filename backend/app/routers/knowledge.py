"""
app/routers/knowledge.py
NER knowledge graph — uses Supabase REST (HTTPS)
Section 10: relationship map from chunk content
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/knowledge/graph")
async def get_knowledge_graph(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns NER-based knowledge graph nodes + edges.
    Fetches chunk content via REST, extracts entities with spaCy.
    """
    user_id = str(current_user["id"])

    # Fetch sample chunks (max 200 for performance)
    result = await asyncio.to_thread(
        lambda: db._sb.table("chunks")
        .select("id, doc_id, content, modality")
        .eq("user_id", user_id)
        .neq("modality", "image")
        .limit(200)
        .execute()
    )
    chunks = result.data or []

    if not chunks:
        return {"nodes": [], "edges": []}

    # Run NER graph extraction
    try:
        from app.services.knowledge.ner_graph import build_knowledge_graph
        texts = [(c["content"] or "") for c in chunks]
        graph = build_knowledge_graph(texts)
        return graph
    except Exception as e:
        logger.warning(f"NER graph failed: {e}")
        return {"nodes": [], "edges": [], "error": str(e)}


@router.get("/knowledge/topics")
async def get_topics(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Return auto-topics from all ready documents."""
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("documents")
        .select("id, name, auto_topics, doc_type")
        .eq("user_id", user_id)
        .eq("status", "ready")
        .execute()
    )
    return {"documents": result.data or []}
