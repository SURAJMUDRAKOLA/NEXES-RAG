# NEXUS Universal RAG Bot — Project Status
**Last Updated:** 2026-06-08
**Status:** BACKEND FULLY OPERATIONAL

---

## VERIFIED WORKING
- Server starts clean: Application startup complete
- Groq API: llama-3.3-70b-versatile + llama-3.1-8b-instant — LIVE
- Gemini API: gemini-embedding-001, dim=3072, nonzero vectors — LIVE
- Zero OpenAI/legacy references in codebase
- 29/29 Python files pass syntax

---

## FIXES APPLIED THIS SESSION

### 1. Large File Upload (15MB PPTX fix — ROOT CAUSE)
- **Problem:** Supabase Python SDK upload() breaks on files >6MB with 413 error
- **Fix:** `documents.py` now uses direct HTTP PUT via httpx for files >5MB
- **Logic:** Files <=5MB use standard SDK upload; >5MB use `httpx.put()` directly to Supabase Storage REST endpoint with service_role key
- Error now returns clean 413 HTTPException instead of crashing with 500

### 2. schema.sql — Completely Rewritten
- **vector(1536) -> vector(3072)** — matches gemini-embedding-001
- **hybrid_search() RPC** — p_query_embedding now vector(3072)
- **profiles defaults** — groq/llama-3.3-70b-versatile + gemini-embedding-001
- **documents table** — added embed_dim=3072, embed_model defaults
- **Comments** — removed all OpenAI references

### 3. db.py SQLAlchemy Models
- Profile defaults: groq/llama-3.3-70b-versatile + gemini-embedding-001

### 4. auth.py
- verify_token fallback defaults: Groq/Gemini instead of OpenAI

### 5. eval_ragas.py
- Removed all OPENAI_API_KEY references
- Now tests Groq LLM + Gemini embed (actual stack)

---

## SUPABASE SCHEMA — IMPORTANT

If you have already run the old schema.sql (with vector(1536)):
You MUST run this migration in Supabase SQL Editor:

```sql
-- 1. Drop the old HNSW index
DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;

-- 2. Change the column dimension
ALTER TABLE public.chunks ALTER COLUMN embedding TYPE vector(3072);

-- 3. Recreate the HNSW index with new dimension
CREATE INDEX idx_chunks_embedding_hnsw
  ON public.chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Update hybrid_search function (paste full STEP 6 from new schema.sql)

-- 5. Update profiles defaults
ALTER TABLE public.profiles
  ALTER COLUMN llm_model SET DEFAULT 'groq/llama-3.3-70b-versatile',
  ALTER COLUMN embed_model SET DEFAULT 'gemini-embedding-001';
```

If you have NOT run the schema yet: just run the full new schema.sql.

---

## HOW TO RUN

```powershell
cd "C:\Universal RAG Bot\backend"
python -m uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health

---

## UPLOAD LIMITS

| File Size | Method Used |
|---|---|
| <= 5 MB | Supabase SDK upload() |
| > 5 MB (e.g. 15MB PPTX) | Direct HTTP PUT to Supabase REST |
| > MAX_FILE_SIZE_MB (100MB default) | 413 error returned |

---

## FREE TIER LIMITS

| Provider | Limit | Per query |
|---|---|---|
| Groq 70B | 500K tok/day | ~2500 tok |
| Groq 8B | Separate pool | ~900 tok |
| Gemini embed | 1000 RPD / 100 RPM | 1 req/query |

---

## REMAINING NEXT STEPS

1. Run schema migration SQL in Supabase (see above)
2. Confirm 'documents' bucket exists in Supabase Storage (private, 100MB limit)
3. Test full upload + parsing + chat flow
4. Frontend SSE wiring to /api/v1/chat
