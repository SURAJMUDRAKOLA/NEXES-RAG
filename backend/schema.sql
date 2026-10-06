-- ═══════════════════════════════════════════════════════════════════════════
-- NEXUS Universal RAG Assistant — Complete Supabase Setup Script
-- Run ONCE in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- Stack: Groq (LLM + Whisper) + Gemini gemini-embedding-001 (3072-dim)
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Create all tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles (extends Supabase Auth) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name           TEXT,
  ai_provider            TEXT DEFAULT 'groq',
  llm_model              TEXT DEFAULT 'groq/llama-3.3-70b-versatile',
  embed_model            TEXT DEFAULT 'gemini-embedding-001',
  monthly_token_budget   INT  DEFAULT 500000,
  tokens_used_this_month INT  DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Documents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  original_name   TEXT    NOT NULL,
  doc_type        TEXT    NOT NULL,   -- 'pdf'|'pptx'|'docx'|'image'|'audio'|'xlsx'
  storage_path    TEXT    NOT NULL,
  file_size_bytes BIGINT,
  page_count      INT,
  status          TEXT    DEFAULT 'queued',   -- 'queued'|'parsing'|'chunking'|'embedding'|'ready'|'error'
  progress        INT     DEFAULT 0,
  error_message   TEXT,
  embed_model     TEXT    DEFAULT 'gemini-embedding-001',
  embed_dim       INT     DEFAULT 768,
  summary         TEXT,
  auto_topics     TEXT[],
  user_tags       TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  indexed_at      TIMESTAMPTZ
);

-- ── Chunks (vector table) ─────────────────────────────────────────────────
-- embedding dimension = 768 (gemini-embedding-001 with outputDimensionality=768)
-- 768 < 2000 Supabase pgvector limit → HNSW index works fine
CREATE TABLE IF NOT EXISTS public.chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id           UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,
  content          TEXT NOT NULL,
  enriched_content TEXT,
  embedding        vector(768),
  modality         TEXT DEFAULT 'text',
  chunk_index      INT  NOT NULL,
  page_num         INT,
  slide_num        INT,
  bbox             JSONB,
  content_hash     TEXT NOT NULL,
  chunk_type       TEXT DEFAULT 'body',
  token_count      INT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT DEFAULT 'New Session',
  doc_ids     UUID[],
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID      NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           UUID      NOT NULL,
  role              TEXT      NOT NULL,   -- 'user' | 'assistant'
  content           TEXT      NOT NULL,
  sources           JSONB,               -- [{chunk_id, doc_name, page, snippet, score}]
  model_used        TEXT,
  prompt_tokens     INT,
  completion_tokens INT,
  latency_ms        INT,
  feedback          SMALLINT,            -- 1 (up) | -1 (down) | NULL
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  event_type  TEXT,                -- 'embed'|'generate'|'rerank'
  model       TEXT,
  tokens_in   INT  DEFAULT 0,
  tokens_out  INT  DEFAULT 0,
  cost_usd    NUMERIC(10, 6) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status  ON public.documents(status);

-- Chunks — HNSW index (768-dim fits Supabase pgvector 2000-dim limit)
-- gemini-embedding-001 with outputDimensionality=768
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON public.chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_user_id  ON public.chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id   ON public.chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_hash     ON public.chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_type     ON public.chunks(chunk_type);

-- Full-text search GIN index for BM25 hybrid retrieval (plan §9.1)
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON public.chunks
  USING gin(to_tsvector('english', content));

-- Sessions & Messages
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active     ON public.sessions(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id    ON public.messages(user_id);

-- Usage
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON public.usage_logs(user_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Row Level Security — prevents ALL cross-user data leakage (Rule 2)
-- Backend service_role key BYPASSES RLS automatically.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_user_isolation ON public.profiles;
CREATE POLICY profiles_user_isolation ON public.profiles
  FOR ALL USING (id = auth.uid());

-- Documents
DROP POLICY IF EXISTS docs_user_isolation ON public.documents;
CREATE POLICY docs_user_isolation ON public.documents
  FOR ALL USING (user_id = auth.uid());

-- Chunks (Rule 2 + Rule 5: users never see other users' chunks or enriched_content)
DROP POLICY IF EXISTS chunks_user_isolation ON public.chunks;
CREATE POLICY chunks_user_isolation ON public.chunks
  FOR ALL USING (user_id = auth.uid());

-- Sessions
DROP POLICY IF EXISTS sessions_user_isolation ON public.sessions;
CREATE POLICY sessions_user_isolation ON public.sessions
  FOR ALL USING (user_id = auth.uid());

-- Messages
DROP POLICY IF EXISTS messages_user_isolation ON public.messages;
CREATE POLICY messages_user_isolation ON public.messages
  FOR ALL USING (user_id = auth.uid());

-- Usage logs
DROP POLICY IF EXISTS usage_user_isolation ON public.usage_logs;
CREATE POLICY usage_user_isolation ON public.usage_logs
  FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: hybrid_search() RPC — called from Python via supabase.rpc()
-- Combines pgvector cosine + BM25 FTS with Reciprocal Rank Fusion (k=60)
-- plan §9.1 — p_query_embedding must be vector(3072) to match gemini-embedding-001
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_query_embedding vector(768),
  p_query_text      text,
  p_user_id         uuid,
  p_doc_ids         uuid[],
  p_limit           int DEFAULT 20,
  p_rrf_k           int DEFAULT 60
)
RETURNS TABLE (
  chunk_id      uuid,
  doc_id        uuid,
  content       text,
  page_num      int,
  slide_num     int,
  modality      text,
  chunk_type    text,
  bbox          jsonb,
  semantic_rank bigint,
  bm25_rank     bigint,
  rrf_score     float
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Semantic vector search (cosine distance via HNSW)
  semantic AS (
    SELECT
      c.id,
      c.doc_id,
      c.content,
      c.page_num,
      c.slide_num,
      c.modality,
      c.chunk_type,
      c.bbox,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> p_query_embedding) AS rank
    FROM public.chunks c
    WHERE c.user_id = p_user_id
      AND (p_doc_ids IS NULL OR array_length(p_doc_ids, 1) IS NULL OR c.doc_id = ANY(p_doc_ids))
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_limit * 2
  ),
  -- BM25 full-text search
  bm25 AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          to_tsvector('english', c.content),
          websearch_to_tsquery('english', p_query_text)
        ) DESC
      ) AS rank
    FROM public.chunks c
    WHERE c.user_id = p_user_id
      AND (p_doc_ids IS NULL OR array_length(p_doc_ids, 1) IS NULL OR c.doc_id = ANY(p_doc_ids))
      AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', p_query_text)
    LIMIT p_limit * 2
  ),
  -- Reciprocal Rank Fusion (RRF)
  rrf AS (
    SELECT
      COALESCE(s.id, b.id) AS id,
      s.rank AS semantic_rank,
      b.rank AS bm25_rank,
      (COALESCE(1.0 / (p_rrf_k + s.rank), 0) + COALESCE(1.0 / (p_rrf_k + b.rank), 0)) AS rrf_score
    FROM semantic s
    FULL OUTER JOIN bm25 b ON s.id = b.id
  )
  SELECT
    s.id        AS chunk_id,
    s.doc_id,
    s.content,
    s.page_num,
    s.slide_num,
    s.modality,
    s.chunk_type,
    s.bbox,
    rrf.semantic_rank,
    rrf.bm25_rank,
    rrf.rrf_score
  FROM rrf
  JOIN semantic s ON rrf.id = s.id
  ORDER BY rrf.rrf_score DESC
  LIMIT p_limit;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Enable Realtime for documents table
-- (frontend gets live status updates: queued→parsing→chunking→embedding→ready)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN
  -- Already a member — safe to ignore
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: Storage bucket policies
-- After creating 'documents' bucket in Storage UI (private), run this.
-- ═══════════════════════════════════════════════════════════════════════════

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own files
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ DONE — Run this entire script once in Supabase SQL Editor
--
-- Setup checklist:
-- 1. Run this script in Supabase → SQL Editor
-- 2. Go to Storage → New bucket → name: "documents" → Private
-- 3. Set MAX_FILE_SIZE to 100MB in the bucket settings
-- 4. Add your API keys to backend/.env:
--      GROQ_API_KEY=gsk_...       (console.groq.com — free)
--      GEMINI_API_KEY=AQ.Ab8...   (aistudio.google.com — free, billing DISABLED)
-- 5. Run: cd backend && python -m uvicorn app.main:app --reload --port 8000
-- 6. Run: cd frontend && npm run dev
-- 7. Open: http://localhost:3000
-- ═══════════════════════════════════════════════════════════════════════════
