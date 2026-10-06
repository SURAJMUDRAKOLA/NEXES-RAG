# app/pipeline/graph.py
# Upgraded LangGraph RAG pipeline — RAG Upgrade PDF
# New flow: intent_classify → rewrite_query → [GENERAL_CHAT → direct_generate → END]
#                                              [else → classify_type → hyde → embed → retrieve
#                                                    → rerank → mmr → check → (decompose|generate) → END]
# All existing nodes preserved. New nodes are additive.
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, List, Optional, TypedDict

from app.config import settings

logger = logging.getLogger(__name__)


# ── State definition ─────────────────────────────────────────────────────────

class RAGState(TypedDict):
    # Input
    query:              str
    session_id:         str
    user_id:            str
    doc_ids:            List[str]
    doc_names:          List[str]       # NEW: for intent + rewrite context
    history:            List[dict]
    db:                 Any
    # Intent + query rewriting (NEW)
    intent:             str             # classified intent (GENERAL_CHAT, DOCUMENT_CHAT, etc.)
    rewritten_query:    str             # query after rewriting (used for retrieval)
    mode_override:      Optional[str]   # explicit mode from ChatRequest.mode
    # Classification (existing)
    query_type:         str
    metadata_filters:   dict
    # Retrieval (existing)
    hyde_text:          Optional[str]
    query_vector:       List[float]
    candidates:         List[dict]
    reranked:           List[dict]
    final_chunks:       List[dict]
    # Control (existing)
    context_sufficient: bool
    retry_count:        int
    sub_queries:        List[str]
    # Output (existing)
    model_to_use:       str
    assembled_prompt:   List[dict]
    sources:            List[dict]


# ── Pydantic schemas for structured LLM outputs ──────────────────────────────

from pydantic import BaseModel

class ClassifyOutput(BaseModel):
    type: str = "lookup"
    filters: dict = {}

class SufficiencyOutput(BaseModel):
    sufficient: bool = True
    sub_queries: List[str] = []


# ── NODE: classify_intent (NEW — first node) ─────────────────────────────────

async def classify_intent_node(state: RAGState) -> dict:
    """
    Classify user intent into 13 categories.
    Sets state['intent']. GENERAL_CHAT bypasses all retrieval.
    """
    try:
        from app.services.generation.intent import classify_intent
        intent = await classify_intent(
            query=state["query"],
            history=state.get("history", []),
            doc_names=state.get("doc_names", []),
        )
        logger.info(f"Intent: {intent} | query: '{state['query'][:50]}'")
        return {"intent": intent}
    except Exception as e:
        logger.warning(f"classify_intent_node failed: {e} — defaulting to DOCUMENT_CHAT")
        return {"intent": "DOCUMENT_CHAT"}


# ── NODE: rewrite_query (NEW — second node) ───────────────────────────────────

async def rewrite_query_node(state: RAGState) -> dict:
    """
    Rewrite vague/ambiguous queries into retrieval-friendly form.
    Skips rewriting for GENERAL_CHAT (not needed).
    Sets state['rewritten_query'].
    """
    intent = state.get("intent", "DOCUMENT_CHAT")
    if intent == "GENERAL_CHAT":
        return {"rewritten_query": state["query"]}  # no rewrite needed
    try:
        from app.services.generation.query_rewriter import rewrite_query
        rewritten = await rewrite_query(
            query=state["query"],
            intent=intent,
            history=state.get("history", []),
            doc_names=state.get("doc_names", []),
        )
        return {"rewritten_query": rewritten}
    except Exception as e:
        logger.warning(f"rewrite_query_node failed: {e}")
        return {"rewritten_query": state["query"]}


# ── NODE: direct_generate (NEW — GENERAL_CHAT path) ──────────────────────────

async def direct_generate(state: RAGState) -> dict:
    """
    Generate a friendly response for GENERAL_CHAT without any retrieval.
    No sources, no citations — just a natural conversation response.
    """
    from app.services.generation.prompt import assemble_general_chat_prompt
    from app.config import settings as cfg
    prompt = assemble_general_chat_prompt(
        query=state["query"],
        history=state.get("history", []),
    )
    model = cfg.LLM_FAST_PROVIDER  # use 8B for chat — faster, cheaper
    return {
        "assembled_prompt": prompt,
        "model_to_use": model,
        "sources": [],
        "final_chunks": [],
    }


# ── NODE: classify_type (was classify_query) ─────────────────────────────────

async def classify_type(state: RAGState) -> dict:
    """Classify retrieval type (lookup/summarise/compare/cross_doc/image)."""
    from app.services.generation.llm import call_llm_structured
    from app.services.generation.prompt import CLASSIFY_PROMPT
    # Use rewritten query for better classification
    query = state.get("rewritten_query") or state["query"]
    try:
        result = await call_llm_structured(
            model=settings.LLM_FAST_PROVIDER,
            prompt=CLASSIFY_PROMPT.format(query=query),
            schema=ClassifyOutput,
        )
        return {"query_type": result.type, "metadata_filters": result.filters}
    except Exception as e:
        logger.warning(f"classify_type failed: {e}")
        return {"query_type": "lookup", "metadata_filters": {}}


# ── NODE: expand_query_hyde ───────────────────────────────────────────────────

async def expand_query_hyde(state: RAGState) -> dict:
    if state.get("query_type") not in ("summarise", "compare", "cross_doc"):
        return {}
    from app.services.generation.llm import call_llm_fast
    from app.services.generation.prompt import HYDE_PROMPT
    query = state.get("rewritten_query") or state["query"]
    try:
        hyde = await call_llm_fast(HYDE_PROMPT.format(query=query), max_tokens=200)
        return {"hyde_text": hyde}
    except Exception as e:
        logger.warning(f"HyDE failed: {e}")
        return {}


# ── NODE: embed_query ────────────────────────────────────────────────────────

async def embed_query(state: RAGState) -> dict:
    from app.services.embedding.embedder import embed_single
    # Prioritize: HyDE text > rewritten query > original query
    text = state.get("hyde_text") or state.get("rewritten_query") or state["query"]
    try:
        vec = await embed_single(text)
        return {"query_vector": vec}
    except Exception as e:
        logger.warning(f"embed_query failed: {e}")
        return {"query_vector": []}


# ── NODE: hybrid_retrieve ────────────────────────────────────────────────────

async def hybrid_retrieve(state: RAGState) -> dict:
    from app.services.retrieval.hybrid import hybrid_retrieve as _retrieve
    db = state.get("db")
    sb = db._sb if db else None
    if not sb or not state.get("doc_ids"):
        logger.warning("No db or doc_ids for retrieval")
        return {"candidates": []}
    # Use rewritten query for BM25 text search
    query_text = state.get("rewritten_query") or state["query"]
    candidates = await _retrieve(
        sb=sb,
        user_id=state["user_id"],
        doc_ids=state["doc_ids"],
        query=query_text,
        query_vector=state.get("query_vector", []),
    )
    return {"candidates": candidates}


# ── NODE: rerank_chunks ──────────────────────────────────────────────────────

async def rerank_chunks(state: RAGState) -> dict:
    from app.services.retrieval.reranker import rerank_async
    candidates = state.get("candidates", [])
    if not candidates:
        return {"reranked": []}
    query = state.get("rewritten_query") or state["query"]
    reranked = await rerank_async(query, candidates, top_n=10)
    return {"reranked": reranked}


# ── NODE: apply_mmr ──────────────────────────────────────────────────────────

async def apply_mmr(state: RAGState) -> dict:
    from app.services.retrieval.mmr import mmr_select
    reranked = state.get("reranked", [])
    if not reranked:
        return {"final_chunks": []}
    final = mmr_select(
        query_vector=state.get("query_vector", []),
        candidates=reranked,
        lambda_param=0.7,
        top_k=8,
    )
    return {"final_chunks": final}


# ── NODE: check_sufficiency ──────────────────────────────────────────────────

async def check_sufficiency(state: RAGState) -> dict:
    if state.get("retry_count", 0) >= 2:
        return {"context_sufficient": True}
    final_chunks = state.get("final_chunks", [])
    if not final_chunks:
        return {"context_sufficient": True, "sub_queries": []}
    from app.services.generation.llm import call_llm_structured
    from app.services.generation.prompt import SUFFICIENCY_PROMPT
    query = state.get("rewritten_query") or state["query"]
    preview = "\n".join(c.get("content", "")[:200] for c in final_chunks)
    try:
        result = await call_llm_structured(
            model=settings.LLM_FAST_PROVIDER,
            prompt=SUFFICIENCY_PROMPT.format(query=query, context=preview),
            schema=SufficiencyOutput,
        )
        return {
            "context_sufficient": result.sufficient,
            "sub_queries": [] if result.sufficient else result.sub_queries,
        }
    except Exception as e:
        logger.warning(f"check_sufficiency failed: {e}")
        return {"context_sufficient": True, "sub_queries": []}


# ── NODE: decompose_and_retry ────────────────────────────────────────────────

async def decompose_and_retry(state: RAGState) -> dict:
    from app.services.embedding.embedder import embed_single
    from app.services.retrieval.hybrid import pgvector_search
    db = state.get("db")
    sb = db._sb if db else None
    all_candidates = list(state.get("candidates", []))
    for sub_q in (state.get("sub_queries") or [])[:3]:
        try:
            sub_vec = await embed_single(sub_q)
            res = await pgvector_search(sb, state["user_id"], state["doc_ids"], sub_vec)
            all_candidates.extend(res)
        except Exception as e:
            logger.warning(f"Sub-query failed: {e}")
    seen, deduped = set(), []
    for c in all_candidates:
        if c.get("id") not in seen:
            seen.add(c.get("id"))
            deduped.append(c)
    return {"candidates": deduped[:20], "retry_count": state.get("retry_count", 0) + 1}


# ── NODE: generate ───────────────────────────────────────────────────────────

async def generate(state: RAGState) -> dict:
    """
    Final generation node.
    - Capability intents → document_modes.py specialized prompt
    - FOLLOW_UP / DOCUMENT_CHAT → standard assemble_prompt
    - Falls back to standard prompt if capability assembly fails
    """
    from app.services.generation.llm import route_model
    from app.services.generation.prompt import assemble_prompt

    intent = state.get("intent", "DOCUMENT_CHAT")
    final_chunks = state.get("final_chunks", [])
    has_images = any(c.get("modality") == "image" for c in final_chunks)
    query_type = state.get("query_type", "lookup")
    model = route_model(query_type, has_images=has_images)

    # Try capability mode prompt first
    assembled_prompt = None
    from app.services.capabilities.document_modes import get_mode_key, assemble_capability_prompt
    mode_key = get_mode_key(intent, state.get("mode_override"))

    if mode_key:
        try:
            # Fetch doc summary for richer capability prompts
            doc_summary = ""
            if state.get("doc_ids") and state.get("db"):
                try:
                    db = state["db"]
                    first_doc_id = state["doc_ids"][0]
                    res = await asyncio.to_thread(
                        lambda: db._sb.table("documents")
                        .select("summary")
                        .eq("id", first_doc_id)
                        .single()
                        .execute()
                    )
                    if res.data:
                        doc_summary = res.data.get("summary", "") or ""
                except Exception:
                    pass

            assembled_prompt = assemble_capability_prompt(
                mode_key=mode_key,
                query=state.get("rewritten_query") or state["query"],
                chunks=final_chunks,
                history=(state.get("history") or [])[-6:],
                doc_summary=doc_summary,
            )
            model = settings.LLM_PROVIDER  # use 70B for capability outputs
            logger.info(f"Using capability mode: {mode_key}")
        except Exception as e:
            logger.warning(f"Capability prompt failed: {e} — falling back")
            assembled_prompt = None

    # Standard prompt fallback
    if assembled_prompt is None:
        assembled_prompt = assemble_prompt(
            chunks=final_chunks,
            history=(state.get("history") or [])[-10:],
            query=state.get("rewritten_query") or state["query"],
        )

    sources = [
        {
            "id": i + 1,
            "doc_id": c.get("doc_id", ""),
            "content": c.get("content", "")[:300],
            "page_num": c.get("page_num"),
            "slide_num": c.get("slide_num"),
            "modality": c.get("modality", "text"),
            "similarity": c.get("rerank_score") or c.get("rrf_score", 0),
        }
        for i, c in enumerate(final_chunks)
    ]
    return {"model_to_use": model, "assembled_prompt": assembled_prompt, "sources": sources}


# ── Edge routers ─────────────────────────────────────────────────────────────

def intent_router(state: RAGState) -> str:
    """Route after rewrite_query: GENERAL_CHAT → direct, all else → classify_type."""
    intent = state.get("intent", "DOCUMENT_CHAT")
    if intent == "GENERAL_CHAT":
        return "direct"
    return "classify"


def sufficiency_router(state: RAGState) -> str:
    return "generate" if state.get("context_sufficient", True) else "decompose"


# ── Build and compile the upgraded graph ──────────────────────────────────────

rag_pipeline = None

try:
    from langgraph.graph import StateGraph, END

    graph = StateGraph(RAGState)

    # Register all nodes
    for name, fn in [
        # New nodes
        ("intent_classify", classify_intent_node),
        ("rewrite_query",   rewrite_query_node),
        ("direct_generate", direct_generate),
        # Existing nodes (renamed classify → classify_type)
        ("classify_type",   classify_type),
        ("hyde",            expand_query_hyde),
        ("embed",           embed_query),
        ("retrieve",        hybrid_retrieve),
        ("rerank",          rerank_chunks),
        ("mmr",             apply_mmr),
        ("check",           check_sufficiency),
        ("decompose",       decompose_and_retry),
        ("generate",        generate),
    ]:
        graph.add_node(name, fn)

    # Entry point
    graph.set_entry_point("intent_classify")

    # intent_classify → rewrite_query (always)
    graph.add_edge("intent_classify", "rewrite_query")

    # rewrite_query → conditional: GENERAL_CHAT → direct_generate, else → classify_type
    graph.add_conditional_edges(
        "rewrite_query",
        intent_router,
        {"direct": "direct_generate", "classify": "classify_type"},
    )

    # GENERAL_CHAT path
    graph.add_edge("direct_generate", END)

    # Document path (all existing edges preserved)
    graph.add_edge("classify_type", "hyde")
    graph.add_edge("hyde", "embed")
    graph.add_edge("embed", "retrieve")
    graph.add_edge("retrieve", "rerank")
    graph.add_edge("rerank", "mmr")
    graph.add_edge("mmr", "check")
    graph.add_conditional_edges(
        "check", sufficiency_router,
        {"generate": "generate", "decompose": "decompose"},
    )
    graph.add_edge("decompose", "rerank")
    graph.add_edge("generate", END)

    rag_pipeline = graph.compile()
    logger.info("Upgraded LangGraph RAG pipeline compiled successfully ✓")

except ImportError as e:
    logger.warning(f"LangGraph not installed — pipeline unavailable: {e}")
except Exception as e:
    logger.error(f"Pipeline compilation failed: {e}", exc_info=True)
