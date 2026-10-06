# app/models/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────
class AuthVerifyRequest(BaseModel):
    token: str


class UserProfile(BaseModel):
    id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    ai_provider: str = "groq"
    llm_model: str = "groq/llama-3.1-70b-versatile"
    embed_model: str = "gemini-embedding-001"
    monthly_token_budget: int = 500000
    tokens_used_this_month: int = 0


# ─────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────
class DocumentStatus(BaseModel):
    id: str
    user_id: str
    name: str
    original_name: str
    doc_type: str          # 'pdf'|'pptx'|'docx'|'image'|'audio'|'xlsx'
    storage_path: str
    file_size_bytes: Optional[int] = None
    page_count: Optional[int] = None
    status: str = "queued" # 'queued'|'parsing'|'chunking'|'embedding'|'ready'|'error'
    progress: int = 0      # 0-100 for progress ring
    error_message: Optional[str] = None
    embed_model: Optional[str] = None
    summary: Optional[str] = None
    auto_topics: Optional[List[str]] = []
    user_tags: Optional[List[str]] = []
    created_at: Optional[datetime] = None
    indexed_at: Optional[datetime] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentStatus]
    total: int


# ─────────────────────────────────────────────
# SESSIONS
# ─────────────────────────────────────────────
class SessionCreate(BaseModel):
    title: str = "New Session"
    doc_ids: Optional[List[str]] = []


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    doc_ids: Optional[List[str]] = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    doc_ids: Optional[List[str]] = []
    created_at: Optional[datetime] = None
    last_active: Optional[datetime] = None


# ─────────────────────────────────────────────
# CHAT
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    session_id: str
    doc_ids: List[str] = []
    # Optional upgrade fields — old clients default to None (backward compatible)
    mode: Optional[str] = None            # "quiz"|"flashcard"|"notes"|"summary"|"explain"|"eli5"
    response_style: Optional[str] = None  # "detailed"|"concise"|"bullets"|"table"


class SourceChunk(BaseModel):
    chunk_id: str
    doc_id: str
    doc_name: str
    page_num: Optional[int] = None
    slide_num: Optional[int] = None
    snippet: str
    score: float
    modality: str = "text"


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str         # 'user' | 'assistant'
    content: str
    sources: Optional[List[SourceChunk]] = []
    model_used: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    feedback: Optional[int] = None  # 1 | -1 | None
    created_at: Optional[datetime] = None


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: int  # 1 (thumbs up) | -1 (thumbs down)


# ─────────────────────────────────────────────
# EMBEDDINGS / KNOWLEDGE MAP
# ─────────────────────────────────────────────
class UMAPNode(BaseModel):
    id: str
    label: str
    type: str
    x: float
    y: float
    z: float


# ─────────────────────────────────────────────
# EVAL
# ─────────────────────────────────────────────
class EvalFeedbackRequest(BaseModel):
    message_id: str
    feedback: int          # 1 | -1
    comment: Optional[str] = None
