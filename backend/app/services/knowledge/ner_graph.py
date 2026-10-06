"""
app/services/knowledge/ner_graph.py
Section 6 (Phase 6) — Knowledge Graph extraction using spaCy NER
Extracts entities (PERSON, ORG, GPE, PRODUCT, EVENT, WORK_OF_ART) from chunks
and builds a lightweight adjacency graph for the 3D knowledge map.

Usage:
    from app.services.knowledge.ner_graph import build_knowledge_graph
    graph = await build_knowledge_graph(chunks, user_id, db)
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
#  Entity types we extract — aligned with Section 3.5 blueprint
# ─────────────────────────────────────────────────────────────────
ENTITY_TYPES = {"PERSON", "ORG", "GPE", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW", "NORP"}

# Co-occurrence window: entities in same chunk are connected
COOCCURRENCE_THRESHOLD = 2  # min times two entities co-occur to form an edge


def _load_nlp():
    """Lazy load spaCy model — only when actually needed."""
    try:
        import spacy
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy en_core_web_sm not found. Run: python -m spacy download en_core_web_sm")
            return None
    except ImportError:
        logger.warning("spaCy not installed. Run: pip install spacy")
        return None


def extract_entities_from_text(text: str, nlp=None) -> list[dict[str, str]]:
    """
    Extract named entities from text using spaCy NER.
    Returns list of {text, label} dicts.
    Rule 5: Only use 'content' field (not enriched_content) here — this is for display.
    """
    if nlp is None:
        nlp = _load_nlp()
    if nlp is None:
        return []

    doc = nlp(text[:10000])  # Cap at 10k chars for performance
    entities = []
    seen = set()

    for ent in doc.ents:
        if ent.label_ in ENTITY_TYPES:
            key = (ent.text.strip(), ent.label_)
            if key not in seen and len(ent.text.strip()) > 1:
                seen.add(key)
                entities.append({"text": ent.text.strip(), "label": ent.label_})

    return entities


def build_cooccurrence_graph(
    chunks: list[dict[str, Any]],
    nlp=None,
) -> dict[str, Any]:
    """
    Build a co-occurrence graph from document chunks.
    
    Returns:
        {
            nodes: [{id, label, type, doc_name, count}],
            edges: [{source, target, weight}],
        }
    
    Each node = a unique entity. Each edge = co-occurrence in same chunk.
    """
    if nlp is None:
        nlp = _load_nlp()

    # entity_id → {label, type, count, docs}
    entity_map: dict[str, dict] = {}
    # (ent_a, ent_b) → co-occurrence count
    cooccurrence: dict[tuple, int] = defaultdict(int)

    for chunk in chunks:
        # Use 'content' for display (Rule 5: never use enriched_content for UI)
        text = chunk.get("content", "")
        doc_name = chunk.get("doc_name", "unknown")

        entities = extract_entities_from_text(text, nlp)
        entity_ids = []

        for ent in entities:
            ent_id = f"{ent['text'].lower()}::{ent['label']}"
            if ent_id not in entity_map:
                entity_map[ent_id] = {
                    "id": ent_id,
                    "label": ent["text"],
                    "type": ent["label"],
                    "count": 0,
                    "docs": set(),
                }
            entity_map[ent_id]["count"] += 1
            entity_map[ent_id]["docs"].add(doc_name)
            entity_ids.append(ent_id)

        # Build co-occurrence pairs from this chunk
        for i in range(len(entity_ids)):
            for j in range(i + 1, len(entity_ids)):
                pair = tuple(sorted([entity_ids[i], entity_ids[j]]))
                cooccurrence[pair] += 1

    # Build nodes list
    nodes = []
    for ent_id, data in entity_map.items():
        nodes.append({
            "id": ent_id,
            "label": data["label"],
            "type": data["type"],
            "count": data["count"],
            "docs": list(data["docs"]),
        })

    # Build edges (only above threshold)
    edges = []
    for (src, tgt), weight in cooccurrence.items():
        if weight >= COOCCURRENCE_THRESHOLD:
            edges.append({
                "source": src,
                "target": tgt,
                "weight": weight,
            })

    # Sort by count descending, cap nodes at 200 for UI performance
    nodes.sort(key=lambda n: n["count"], reverse=True)
    top_node_ids = {n["id"] for n in nodes[:200]}
    nodes = nodes[:200]
    edges = [e for e in edges if e["source"] in top_node_ids and e["target"] in top_node_ids]

    return {"nodes": nodes, "edges": edges}


async def build_knowledge_graph_from_db(
    user_id: str,
    doc_ids: list[str] | None,
    db,  # asyncpg.Connection
) -> dict[str, Any]:
    """
    Fetch chunks from DB and build knowledge graph.
    Rule 2: Always filter by user_id.
    """
    nlp = await asyncio.to_thread(_load_nlp)

    # Fetch chunks — Rule 2: filter by user_id, use content (not enriched_content)
    if doc_ids:
        rows = await db.fetch(
            """
            SELECT c.content, d.name as doc_name
            FROM public.chunks c
            JOIN public.documents d ON c.doc_id = d.id
            WHERE c.user_id = $1 AND c.doc_id = ANY($2::uuid[])
            ORDER BY c.created_at DESC
            LIMIT 500
            """,
            user_id,
            doc_ids,
        )
    else:
        rows = await db.fetch(
            """
            SELECT c.content, d.name as doc_name
            FROM public.chunks c
            JOIN public.documents d ON c.doc_id = d.id
            WHERE c.user_id = $1
            ORDER BY c.created_at DESC
            LIMIT 500
            """,
            user_id,
        )

    chunks = [dict(r) for r in rows]
    if not chunks:
        return {"nodes": [], "edges": []}

    # Run CPU-bound NER in thread pool
    graph = await asyncio.to_thread(build_cooccurrence_graph, chunks, nlp)
    return graph
