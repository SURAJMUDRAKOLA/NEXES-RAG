"""
app/main.py
Section 5.2 — FastAPI application with lifespan, CORS, rate limiting
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.routers import documents, chat, sessions, embeddings, eval, auth, knowledge, export

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup/shutdown lifecycle.
    Initialises the Supabase REST client on startup.
    """
    # ── Startup ──────────────────────────────────────────────────
    from app.dependencies import create_pool, close_pool as _close_pool
    await create_pool()

    yield  # ← App runs here

    # ── Shutdown ──────────────────────────────────────────────────
    try:
        await _close_pool()
    except Exception:
        pass


app = FastAPI(
    title="NEXUS RAG Assistant API",
    version="1.0.0",
    description="Universal Multimodal RAG Backend — Section 5.2",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers — Section 5.2
app.include_router(auth.router,        prefix="/api/v1", tags=["auth"])
app.include_router(documents.router,   prefix="/api/v1", tags=["documents"])
app.include_router(chat.router,        prefix="/api/v1", tags=["chat"])
app.include_router(sessions.router,    prefix="/api/v1", tags=["sessions"])
app.include_router(embeddings.router,  prefix="/api/v1", tags=["embeddings"])
app.include_router(eval.router,        prefix="/api/v1", tags=["eval"])
app.include_router(knowledge.router,   prefix="/api/v1", tags=["knowledge"])
app.include_router(export.router,      prefix="/api/v1", tags=["export"])


@app.get("/health")
async def health_check():
    """Health check — plan §16 Step 2."""
    from app import dependencies
    supabase_configured = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)
    supabase_status = "ready" if dependencies._supabase_client else ("configured" if supabase_configured else "missing")
    return {
        "status": "ok",
        "version": "2.0.0",
        "db": "supabase-rest",
        "supabase": supabase_status,
        "groq": "configured" if settings.GROQ_API_KEY else "missing — add GROQ_API_KEY to .env",
        "gemini": "configured" if settings.GEMINI_API_KEY else "missing — add GEMINI_API_KEY to .env",
        "celery": "enabled" if settings.USE_CELERY else "disabled",
        "llm_provider": settings.LLM_PROVIDER,
        "embed_model": settings.EMBED_MODEL,
        "embed_dim": settings.EMBED_DIM,
    }

