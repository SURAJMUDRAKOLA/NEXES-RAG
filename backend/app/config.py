# app/config.py
# NEXUS RAG Backend — settings aligned with BACKEND UPGRADED RAG PLAN.js + api_operation_mapping.html
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Supabase (required) ────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    DATABASE_URL: str = ""

    # ── Free AI Providers — NO OpenAI ─────────────────────────────────────
    GROQ_API_KEY: str = ""      # console.groq.com — free, no billing
    GEMINI_API_KEY: str = ""    # aistudio.google.com — keep billing DISABLED

    # ── Model Routing (plan §3.2 + api_operation_mapping) ─────────────────
    # DO NOT change EMBED_DIM after first document indexed — breaks search
    LLM_PROVIDER: str = "groq/llama-3.3-70b-versatile"      # final answers
    LLM_FAST_PROVIDER: str = "groq/llama-3.1-8b-instant"    # classify/enrich/check
    LLM_LONG_PROVIDER: str = "groq/mixtral-8x7b-32768"      # cross-doc 32K ctx
    EMBED_MODEL: str = "gemini-embedding-001"      # 768-dim (outputDimensionality=768)
    EMBED_DIM: int = 768
    RERANK_PROVIDER: str = "flashrank"

    # ── Safety caps (api_operation_mapping billing-safe rules) ─────────────
    MAX_FILE_PAGES: int = 50              # Rule 6: cap at 50 pages for demo
    ENABLE_RELATED_QUESTIONS: bool = True # Rule 7: toggle to save ~300 tok/query
    EMBED_BATCH_SIZE: int = 50            # Rule 3: always batch, never 1-by-1
    CHAT_RATE_LIMIT: str = "5/minute"    # Rule 5: per-user slowapi limit
    UPLOAD_RATE_LIMIT: str = "10/hour"   # per-user upload limit

    # ── Infrastructure ─────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = False
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_FILE_SIZE_MB: int = 100
    DEFAULT_MONTHLY_TOKEN_BUDGET: int = 500000
    STORAGE_BUCKET: str = "Documents"   # Supabase Storage bucket name (case-sensitive)

    # ── Observability (optional) ───────────────────────────────────────────
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
