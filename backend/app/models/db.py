# app/models/db.py
# SQLAlchemy ORM models — Phase 2 will connect to asyncpg/Supabase
from sqlalchemy import (
    Column, String, Integer, BigInteger, Text, ARRAY,
    DateTime, SmallInteger, Numeric, ForeignKey, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, VECTOR
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True)
    display_name = Column(Text)
    ai_provider = Column(Text, default="groq")
    llm_model = Column(Text, default="groq/llama-3.3-70b-versatile")
    embed_model = Column(Text, default="gemini-embedding-001")
    monthly_token_budget = Column(Integer, default=500000)
    tokens_used_this_month = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    original_name = Column(Text, nullable=False)
    doc_type = Column(Text, nullable=False)     # 'pdf'|'pptx'|'docx'|'image'|'audio'|'xlsx'
    storage_path = Column(Text, nullable=False)
    file_size_bytes = Column(BigInteger)
    page_count = Column(Integer)
    status = Column(Text, default="queued")    # 'queued'|'parsing'|'chunking'|'embedding'|'ready'|'error'
    progress = Column(Integer, default=0)
    error_message = Column(Text)
    embed_model = Column(Text)
    embed_dim = Column(Integer)
    summary = Column(Text)
    auto_topics = Column(ARRAY(Text))
    user_tags = Column(ARRAY(Text))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    indexed_at = Column(DateTime(timezone=True))


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("public.documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # denormalised for fast RLS filtering
    content = Column(Text, nullable=False)          # original chunk (shown to user)
    enriched_content = Column(Text)                 # contextually enriched (embedded only, never shown)
    # embedding stored in pgvector — handled via raw asyncpg for vector type
    modality = Column(Text, default="text")         # 'text'|'table'|'image'|'audio'
    chunk_index = Column(Integer, nullable=False)
    page_num = Column(Integer)
    slide_num = Column(Integer)
    bbox = Column(JSONB)                            # {x,y,w,h} for citation highlighting
    content_hash = Column(Text, nullable=False)     # SHA-256 of enriched_content
    chunk_type = Column(Text, default="body")       # 'body'|'table'|'summary'|'caption'
    token_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, default="New Session")
    doc_ids = Column(ARRAY(UUID(as_uuid=True)))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("public.sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(Text, nullable=False)             # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    sources = Column(JSONB)                         # [{chunk_id, doc_name, page, snippet, score}]
    model_used = Column(Text)
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    latency_ms = Column(Integer)
    feedback = Column(SmallInteger)                 # 1 | -1 | NULL
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UsageLog(Base):
    __tablename__ = "usage_logs"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    event_type = Column(Text)                       # 'embed'|'generate'|'rerank'
    model = Column(Text)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
