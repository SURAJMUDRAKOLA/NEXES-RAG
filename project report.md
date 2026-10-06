# 🧠 NEXUS Universal RAG Bot — Comprehensive Project Report
**Audit Date:** 2026-10-06 | **Auditor:** Antigravity AI  
**Stack:** Next.js 14 + FastAPI + Supabase (PostgreSQL + pgvector) + Groq + Gemini

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Database Design & Schema Analysis](#3-database-design--schema-analysis)
4. [Backend Analysis](#4-backend-analysis)
5. [RAG Pipeline Deep Dive](#5-rag-pipeline-deep-dive)
6. [Frontend Analysis](#6-frontend-analysis)
7. [Feature Status Matrix](#7-feature-status-matrix)
8. [Code Quality & Algorithm Audit](#8-code-quality--algorithm-audit)
9. [Critical Bugs & Broken Code](#9-critical-bugs--broken-code)
10. [Scaffold & Incomplete Sections](#10-scaffold--incomplete-sections)
11. [Security Audit](#11-security-audit)
12. [Performance & Latency Analysis](#12-performance--latency-analysis)
13. [Infrastructure & DevOps Review](#13-infrastructure--devops-review)
14. [Prioritized Fix List](#14-prioritized-fix-list)
15. [Recommendations](#15-recommendations)

---

## 1. Executive Summary

**Project:** Universal RAG (Retrieval-Augmented Generation) Bot, branded as **NEXUS** — a multimodal AI document assistant that lets users upload PDFs, PPTX, DOCX, images, audio, and Excel files, then query them using LLMs with full semantic search.

**Overall Status: 🟡 ~65% Complete — Core framework is excellent, but the actual RAG retrieval is broken by missing SQL functions, and several frontend wiring bugs prevent features from working.**

| Layer | Status | Score |
|-------|--------|-------|
| Database Schema | ✅ Excellent | 9/10 |
| Backend API Framework | ✅ Solid | 8/10 |
| RAG Pipeline Logic | ✅ Well-designed | 8/10 |
| Document Ingestion | 🟡 Mostly working | 7/10 |
| Auth System | ✅ Robust | 8/10 |
| Frontend UI | 🟡 Functional | 7/10 |
| Knowledge Graph | 🔴 Broken (wrong function name) | 3/10 |
| UMAP / 3D Map | 🟡 Works but wastes quota | 5/10 |
| PDF Viewer | 🔴 Dependency exists, not wired | 2/10 |
| Chunker (SentenceSplitter) | 🔴 LlamaIndex dep missing | 4/10 |
| Conversation Memory | 🟡 Redis-dependent (optional) | 6/10 |
| Chat Export (PDF) | ✅ Functional | 8/10 |
| Backend Tests | 🔴 Empty /tests directory | 0/10 |
| Docker / Deploy | 🟡 Partial | 6/10 |

---

## 2. System Architecture Overview

### Architecture Pattern

```
FRONTEND (Next.js 14 App Router + TypeScript)
  ├── /                  → Landing page
  ├── /login             → Supabase Auth UI
  ├── /(app)/chat        → Main chat interface (SSE streaming)
  ├── /(app)/workspace   → Document library
  ├── /(app)/map         → 3D Knowledge map (Three.js)
  └── /(app)/settings    → User profile settings

        ↕ REST + SSE (Axios / fetch)

BACKEND (FastAPI + Python 3.11+)
  ├── /api/v1/auth           → JWT verify + profile CRUD
  ├── /api/v1/upload         → Multipart file upload → Background pipeline
  ├── /api/v1/documents      → List / delete / signed-URL
  ├── /api/v1/chat           → SSE streaming RAG chat
  ├── /api/v1/sessions       → Session CRUD
  ├── /api/v1/embeddings     → UMAP 3D projection
  ├── /api/v1/knowledge      → NER knowledge graph
  ├── /api/v1/eval           → Feedback + stats
  └── /api/v1/export         → PDF export

        ↕ Supabase Python SDK (HTTPS REST, port 443)

EXTERNAL SERVICES
  ├── Supabase          → PostgreSQL + pgvector + Auth + Storage + Realtime
  ├── Groq API          → LLM inference (llama-3.3-70b, 8B, vision-preview)
  ├── Gemini API        → Text embeddings (gemini-embedding-001, 768-dim)
  ├── FlashRank (local) → Cross-encoder reranking (MiniLM-L-12-v2)
  └── Redis             → Embedding cache + conversation memory (optional)
```

### Technology Choices

| Technology | Reason | Assessment |
|------------|--------|------------|
| FastAPI + uvicorn | Async, SSE-native, Pydantic validation | ✅ Correct choice |
| Supabase | Postgres + pgvector + Auth + Storage + Realtime in one platform | ✅ Smart for free-tier |
| LangGraph | Stateful directed graph for RAG pipeline with conditional edges | ✅ Well-implemented |
| Groq | Free LLM inference, fastest inference on market | ✅ Smart cost strategy |
| Gemini Embedding | Free 768-dim embeddings via REST API | ✅ Right model/dimension |
| FlashRank | Free local cross-encoder reranker, no API key needed | ✅ Excellent pick |
| Next.js 14 App Router | SSR + file-based routing + RSC | ✅ Good choice |
| Zustand | Lightweight, no-boilerplate state management | ✅ Correct tool |
| sse-starlette | Native SSE support for FastAPI | ✅ Correct |

---

## 3. Database Design & Schema Analysis

### Overall Schema Quality: ✅ 9/10

**File:** `backend/schema.sql` (358 lines)

### Tables

| Table | Purpose | Quality |
|-------|---------|---------|
| `profiles` | Extends `auth.users`, stores LLM preferences + token budget | ✅ Clean |
| `documents` | Document metadata with 6-state status pipeline | ✅ Rich, well-designed |
| `chunks` | Vector store — `embedding vector(768)`, content_hash for dedup | ✅ Correct dimension |
| `sessions` | Chat sessions scoped to specific doc_ids | ✅ Clean design |
| `messages` | Chat history with sources JSONB, model_used, latency_ms, feedback | ✅ Complete |
| `usage_logs` | Token + cost tracking per operation | ✅ Good for quota enforcement |

### Indexing Strategy

```sql
-- HNSW vector index (cosine similarity) - correct choice over IVFFlat
CREATE INDEX idx_chunks_embedding_hnsw
  ON public.chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for BM25 full-text search
CREATE INDEX idx_chunks_fts ON public.chunks
  USING gin(to_tsvector('english', content));

-- Standard B-tree indexes on all foreign keys
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_chunks_user_id ON public.chunks(user_id);
CREATE INDEX idx_sessions_active ON public.sessions(last_active DESC);
```

**Assessment:** HNSW is the correct index type — works immediately without `VACUUM` (IVFFlat requires it). `m=16, ef_construction=64` are solid defaults. 768-dim is safely within Supabase's 2000-dim index limit.

### Row Level Security

All 6 tables have RLS enabled. Backend uses `service_role` key (bypasses RLS). Frontend client uses `anon` key (subject to RLS). This is the **correct dual-layer security pattern**. ✅

### `hybrid_search()` PostgreSQL Function

The function combines pgvector cosine search + BM25 FTS using Reciprocal Rank Fusion at the database level:

```sql
-- Correct RRF formula:
(COALESCE(1.0 / (p_rrf_k + s.rank), 0) + COALESCE(1.0 / (p_rrf_k + b.rank), 0)) AS rrf_score
```

**Assessment:** Mathematically correct RRF implementation with k=60 (standard). FULL OUTER JOIN correctly handles chunks appearing in only one of the two result sets.

### ⚠️ CRITICAL SCHEMA GAP

The Python `hybrid.py` calls two RPCs that **do not exist in schema.sql**:
- `match_chunks` — for pgvector semantic search
- `match_chunks_fts` — for BM25 full-text search

Only `hybrid_search()` (the combined function) is defined. The code calls them separately then merges with Python-level RRF, but the underlying SQL functions are missing. **This breaks all document RAG retrieval.**

### Trigger & Profile Auto-Creation

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

Auto-creates profile on signup. Backend also has a Python fallback in `get_current_user()`. Double-safe. ✅

---

## 4. Backend Analysis

### 4.1 Application Entry Point (`main.py`)

**Quality: ✅ 9/10 — Clean, production-ready**

- Lifespan context manager correctly initializes Supabase client on startup and clears it on shutdown
- CORS configured for `localhost:3000`, `127.0.0.1:3000`, `*.vercel.app`, and `settings.FRONTEND_URL`
- SlowAPI rate limiter attached to app state with `RateLimitExceeded` exception handler
- All 8 routers registered under `/api/v1` prefix
- Health endpoint exposes all service statuses (Supabase, Groq, Gemini, Celery, model config)

**Minor Issue:** `version="2.0.0"` in health endpoint but app declares `version="1.0.0"`. Cosmetic inconsistency.

### 4.2 Configuration (`config.py`)

**Quality: ✅ 8/10 — Well-structured pydantic-settings**

- `@lru_cache` on `get_settings()` prevents re-reading `.env` on every call ✅
- Safety caps configured: `MAX_FILE_PAGES=50`, `CHAT_RATE_LIMIT="5/minute"`, `EMBED_BATCH_SIZE=50`
- Comment warns: "DO NOT change EMBED_DIM after first document indexed — breaks search" ✅

**Critical Issue:** `LLM_LONG_PROVIDER: str = "groq/mixtral-8x7b-32768"` — **Mixtral-8x7b is no longer available on Groq's free tier**. Cross-document queries will throw HTTP 400.

### 4.3 Dependencies & Auth Layer (`dependencies.py`)

**Quality: 🟡 7/10 — Clever design, some risks**

The `SupabaseDB` shim wraps the Supabase client with asyncpg-compatible method names (`fetchrow`, `fetch`, `execute`, `fetchval`). This is clever for backward compatibility but adds complexity.

**`_rpc_sql()` SQL Injection Risk:**
```python
# String replacement approach for parameterized queries:
query = query.replace(placeholder, replacement, 1)
# For string args, only basic quote-escaping:
escaped = arg.replace("'", "''")
replacement = f"'{escaped}'"
```
This is adequate for internal backend use but is not proper parameterization. If any external user input ever reaches `_rpc_sql()`, it would be injectable.

**Auth Flow:**
1. Primary: `supabase.auth.get_user(token)` — delegates verification to Supabase auth server (algorithm-agnostic)
2. Fallback: Manual PyJWT HS256 decode from `SUPABASE_JWT_SECRET`
3. Profile auto-creation via upsert if first login

This dual-verification strategy is robust. ✅

**Performance Note:** `asyncio.to_thread()` is used for every Supabase SDK call (SDK is synchronous). Each call adds ~1-3ms of thread-switching overhead. 10 DB operations per chat request = ~10-30ms extra latency.

### 4.4 Router Analysis

#### Auth Router (`/auth`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/auth/verify` | POST | ✅ Working |
| `/auth/profile` | GET | ✅ Working |
| `/auth/profile` | PATCH | ✅ Working |

#### Documents Router (`/documents`, `/upload`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/upload` | POST | ✅ Working | MIME validation, size cap, signed Storage upload |
| `/documents` | GET | ✅ Working | Sorted by created_at DESC |
| `/documents/{id}` | DELETE | ✅ Working | Cascade deletes storage + DB record |
| `/documents/{id}/signed-url` | GET | ✅ Working | 1-hour expiry |

**Issue:** Large file upload path uses `httpx.put()` synchronously — blocks event loop up to 120s for large files. Should be `await asyncio.to_thread(lambda: httpx.put(...))`.

#### Chat Router (`/chat`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/chat` | POST | 🟡 Partial | Pipeline runs but retrieval returns empty |
| `/chat/{session_id}/messages` | GET | ✅ Working | Backend correct |
| `/chat/{message_id}/feedback` | POST | ✅ Working | |
| `/chat/{session_id}/suggested-questions` | GET | ✅ Working | Generates on-the-fly from summary |

**Token Counting Issue:** `prompt_tokens` is stored as `len(str(assembled_prompt)) // 4`. `tiktoken` is in requirements but unused here. Inaccurate token count stored in `messages` table.

#### Embeddings Router (`/embeddings/umap`)
| Endpoint | Status | Issue |
|----------|--------|-------|
| `/embeddings/umap` | 🟡 Partial | Re-embeds text instead of using stored `embedding` column |

Re-calling `batch_embed()` on chunk text content wastes Gemini API quota on every map visit. The `embedding` column is already stored in the `chunks` table — should be read directly.

#### Knowledge Router (`/knowledge`)
| Endpoint | Status | Issue |
|----------|--------|-------|
| `/knowledge/graph` | 🔴 Broken | Calls `build_knowledge_graph()` — wrong function name |
| `/knowledge/topics` | ✅ Working | Returns `auto_topics` from ready documents |

**Critical Bug:** The router calls `build_knowledge_graph(texts)` but the actual function in `ner_graph.py` is named `build_cooccurrence_graph(chunks, nlp)`. Additionally it receives strings but the function expects chunk dicts. Will crash with `ImportError`/`AttributeError`.

#### Export Router (`/export`)
| Endpoint | Status |
|----------|--------|
| `/sessions/{id}/export/pdf` | ✅ Working (with reportlab installed) |

**Minor Issue:** If `reportlab` not installed, returns UTF-8 text bytes with `media_type="application/pdf"` — browser will fail to render.

#### Eval Router (`/eval`)
| Endpoint | Status |
|----------|--------|
| `/eval/feedback` | ✅ Working |
| `/eval/stats` | ✅ Likely working |

---

## 5. RAG Pipeline Deep Dive

### LangGraph Pipeline (`app/pipeline/graph.py`)

**Overall Quality: ✅ 9/10 — Excellent architecture, brilliant use of LangGraph**

```
[START]
  → intent_classify
  → rewrite_query
  → [conditional on intent]
      ├─ GENERAL_CHAT → direct_generate → [END]
      └─ else
          → classify_type
          → hyde (expand_query_hyde)
          → embed (embed_query)
          → retrieve (hybrid_retrieve)
          → rerank (rerank_chunks)
          → mmr (apply_mmr)
          → check (check_sufficiency)
              ├─ sufficient → generate → [END]
              └─ insufficient → decompose → rerank (loop, max 2x)
```

### Node Analysis

#### Node 1: `classify_intent_node`
- **Algorithm:** Regex fast-path → Groq 8B JSON classification
- **13 intent classes:** GENERAL_CHAT, DOCUMENT_CHAT, DOCUMENT_SUMMARY, DOCUMENT_COMPARISON, DOCUMENT_SEARCH, DOCUMENT_EXPLANATION, DOCUMENT_QUIZ, FLASHCARD_GENERATION, NOTE_GENERATION, INTERVIEW_PREPARATION, TRANSLATION, SIMPLIFICATION, FOLLOW_UP, UNKNOWN
- **Latency:** 0ms (regex) or ~80ms (LLM)
- **Quality:** ✅ Excellent. Fast-path avoids LLM cost for greetings/thanks.
- **Issue:** `TRANSLATION` intent has no specialized capability prompt in `document_modes.py`.

#### Node 2: `rewrite_query_node`
- **Algorithm:** Groq 8B prompt to expand vague follow-up questions using conversation history
- **Latency:** ~80ms
- **Skips:** GENERAL_CHAT (no rewrite needed)
- **Quality:** ✅ Smart optimization
- **Issue:** Depends on `conversation_context.py` which depends on Redis. Without Redis, context is empty and rewrites are less informed.

#### Node 3: `direct_generate` (GENERAL_CHAT path)
- **Algorithm:** `assemble_general_chat_prompt()` → LLM_FAST_PROVIDER (8B)
- **Latency:** TTFT ~300ms (first streaming token)
- **Quality:** ✅ Correct — avoids unnecessary retrieval for small talk.

#### Node 4: `classify_type`
- **Algorithm:** Groq 8B JSON → `ClassifyOutput(type: str, filters: dict)`
- **Types:** lookup / summarise / compare / cross_doc / image
- **Latency:** ~80ms
- **Issue:** `cross_doc` type routes to `LLM_LONG_PROVIDER = "groq/mixtral-8x7b-32768"` which is **deprecated**. Cross-doc queries will fail with HTTP 400.

#### Node 5: `expand_query_hyde`
- **Algorithm:** Hypothetical Document Embedding (HyDE) — generates a "fake ideal answer" and embeds it for retrieval instead of the raw query
- **Only triggers for:** summarise / compare / cross_doc
- **Latency:** ~80ms when active
- **Quality:** ✅ HyDE measurably improves recall for complex queries. Smart conditional activation.

#### Node 6: `embed_query`
- **Algorithm:** Gemini REST API, `gemini-embedding-001`, `outputDimensionality=768`
- **Priority:** HyDE text > rewritten_query > original query
- **Latency:** ~200-500ms (REST call, no SDK)
- **Retry:** 3x with exponential backoff (tenacity) ✅
- **Quality:** ✅ Correct async wrapper using `run_in_executor`

#### Node 7: `hybrid_retrieve`
- **Algorithm:** Parallel pgvector cosine search + BM25 FTS → Python-level RRF merge (k=60)
- **⚠️ CRITICAL BUG:** Calls `sb.rpc("match_chunks", params)` and `sb.rpc("match_chunks_fts", params)` — **neither function exists in schema.sql**. Both return empty results silently.
- **Impact:** ALL document chat returns no context. LLM answers from training data only (no RAG). This is the most critical bug in the entire system.

#### Node 8: `rerank_chunks`
- **Algorithm:** FlashRank cross-encoder (ms-marco-MiniLM-L-12-v2, ~120M params)
  - Step 1: Deduplicate by `content_hash` + first 80 chars prefix
  - Step 2: Cross-encoder forward pass (query ⊕ passage → relevance score)
  - Step 3: Title/heading bonus (+0.12), query-term proximity bonus (+0.03/term)
  - Step 4: Sort by final score, return top_n
- **Latency:** ~2ms/passage → ~15-20ms for 10 passages
- **Quality:** ✅ Excellent. Title bonus is a smart heuristic for headings/slides.
- **Issue:** `cache_dir="/tmp/flashrank"` — Unix path, breaks on Windows. Use `tempfile.gettempdir()`.

#### Node 9: `apply_mmr`
- **Algorithm:** Maximal Marginal Relevance
  - `score_i = λ × sim(query, chunk_i) - (1-λ) × max_j sim(chunk_i, chunk_j)` where λ=0.7
  - O(k × n) cosine operations for k=8 selected, n≤10 candidates → ~80 ops, ~0ms
- **Quality:** ✅ Mathematically correct. λ=0.7 is a good default (relevance-biased).
- **Issue:** Supabase REST responses don't return the `embedding` column unless explicitly selected. If chunks have no `embedding` field, MMR uses query vector as placeholder for all → degrades to returning items in original score order.

#### Node 10: `check_sufficiency`
- **Algorithm:** Groq 8B JSON → `SufficiencyOutput(sufficient: bool, sub_queries: list)`
- **Guard:** Max 2 retries to prevent infinite decompose loop
- **Latency:** ~80ms
- **Quality:** ✅ Important guard against hallucination when context is poor.

#### Node 11: `decompose_and_retry`
- **Algorithm:** Runs `embed_single()` + `pgvector_search()` for each sub-query, deduplicates results by ID
- **Same bug as hybrid_retrieve:** calls the missing `match_chunks` RPC

#### Node 12: `generate`
- **Algorithm:** Routes to capability mode prompt (quiz/flashcard/notes/etc.) OR standard RAG prompt
- **Model selection:** `route_model(query_type)` → correct Groq model per type
- **Quality:** ✅ Well-structured. 18 capability modes in `document_modes.py`.

### Pipeline Latency Budget

| Step | Latency (best case) | Notes |
|------|---------------------|-------|
| Intent classify (regex fast-path) | ~0ms | |
| Intent classify (LLM) | ~80ms | Only for non-obvious cases |
| Query rewrite | ~80ms | Skipped for GENERAL_CHAT |
| Classify type | ~80ms | |
| HyDE expansion | ~80ms | Only for summarise/compare/cross_doc |
| Embed query | ~300ms | Gemini REST |
| Hybrid retrieve | ~50ms | DB RPC call |
| FlashRank rerank | ~20ms | Local inference |
| MMR | ~1ms | In-memory |
| Sufficiency check | ~80ms | |
| Generate (first token) | ~400ms | Groq streaming, 70B model |
| **Total TTFT (Time To First Token)** | **~1,000-1,500ms** | All services up |

### LLM API Call Budget Per Chat Request

| Call | Model | Purpose |
|------|-------|---------|
| 1 | 8B | Intent classify |
| 2 | 8B | Query rewrite |
| 3 | 8B | Type classify |
| 4 | 8B | HyDE (conditional) |
| 5 | 8B | Sufficiency check |
| 6 | 8B | Related questions |
| 7 | 70B | Final answer (streaming) |
| **7-8 total** | | **Risk of 429 rate limit with multiple users** |

---

## 6. Frontend Analysis

### Tech Stack Assessment

| Library | Version | Purpose | Assessment |
|---------|---------|---------|------------|
| Next.js | 14.2.35 | Framework | ✅ Stable release |
| TypeScript | 5.x | Type safety | ✅ |
| TailwindCSS | 3.4.1 | Styling | ✅ |
| Framer Motion | 11.x | Animations | ✅ |
| Three.js + R3F | 0.169 + 8.18 | 3D Knowledge Map | ✅ |
| Zustand | 5.x | State management | ✅ |
| React Query | 5.x | Data fetching | 🟡 Installed but underused |
| @supabase/ssr | 0.10.3 | Supabase SSR auth | ✅ |
| react-markdown | 9.x | Message rendering | ✅ |
| pdfjs-dist | 4.10 | PDF viewer | 🔴 Installed but not wired |
| umap-js | 1.4.0 | JS UMAP (duplicate of backend) | 🟡 Redundant? |
| eventsource-parser | 3.x | SSE parsing | 🟡 Installed but unused (manual parser used) |

### Route Structure

```
/(auth)/         → Supabase auth flow (login, signup, callback)
/login           → Login page redirect
/(app)/
  /chat          → Main chat interface (page.tsx = 32KB - very large)
  /workspace     → Document library (page.tsx = 21KB - large)
  /map           → Knowledge map 3D view
  /settings      → User settings
```

**Issue:** The chat page (`page.tsx` at 32KB) and workspace page (21KB) are both very large single-file components. They should be refactored into smaller composable components.

### Zustand Store Analysis

#### `useChatStore` — Core Store
- Manages: messages, streaming state, sources, related questions, key points, intent, suggested questions
- `sendMessage()` correctly creates optimistic messages → opens SSE stream → appends tokens
- `submitFeedback()` correctly updates local message state after API call

**Bug:** `fetchMessages()` calls `/api/v1/sessions/${sessionId}/messages` but the correct path is `/api/v1/chat/${sessionId}/messages`. This prevents message history from loading.

**Bug:** `fetchSuggestedQuestions()` calls `/api/v1/documents/${docId}/suggested-questions?session_id=...` but the correct path is `/api/v1/chat/${session_id}/suggested-questions?doc_id=...`. Wrong path AND wrong parameter order.

#### `useSessionStore` — Sessions
- Clean implementation for session CRUD operations ✅

#### `useAuthStore` — Auth State
- Minimal, just stores `user` object ✅

#### `useDocumentStore`, `useFileStore`, `useUIStore`
- Basic implementations, appear functional ✅

### SSE Client (`lib/stream.ts`)

**Quality: ✅ 8/10 — Clean manual SSE parser**

- Uses `fetch()` with `Accept: text/event-stream` header ✅
- Manual buffer-based line parsing (correct implementation) ✅
- Handles all event types: `token`, `sources`, `related_questions`, `key_points`, `suggested_questions`, `done`, `error` ✅

**Bug:** `suggested_questions` case handler is empty:
```typescript
case 'suggested_questions':
  // Forwarded to store — will be shown as chips on empty state
  break;  // ← Nothing actually forwarded!
```

### API Client (`lib/api.ts`)

**Quality: ✅ 8/10 — Well-structured with auth interceptor**

- Axios request interceptor: attaches Supabase JWT to every request ✅
- Response interceptor: 401 → sign out only if client session is also gone (smart) ✅
- Complete API method definitions for all endpoints ✅
- Both namespaced (`documentsApi`, `sessionsApi`) and flat convenience exports ✅

**Issue:** Zustand store methods use raw `fetch()` with manual token retrieval instead of the `api.ts` Axios instance. Two separate patterns for the same thing creates maintenance debt.

### Real-time Hook (`hooks/useRealtime.ts`)

**Quality: 🟡 6/10 — Correct logic, incorrect React pattern**

Subscribes to Supabase Realtime `postgres_changes` on `documents` table, filtered by `user_id`. Provides live status updates (queued → parsing → chunking → embedding → ready).

**Bug:** `createClient()` is called outside `useEffect` at the module level of `useDocumentRealtime`. This creates a new Supabase client on every render cycle, potentially creating multiple Realtime subscriptions.

---

## 7. Feature Status Matrix

| Feature | Backend | Frontend | Integration | Working? |
|---------|---------|----------|-------------|----------|
| User signup/login (Supabase Auth) | ✅ | ✅ | ✅ | ✅ Yes |
| JWT verification + auto-profile create | ✅ | ✅ | ✅ | ✅ Yes |
| File upload (PDF/DOCX/PPTX/Image/Audio/XLSX) | ✅ | ✅ | ✅ | ✅ Yes |
| File size + MIME validation | ✅ | ✅ | ✅ | ✅ Yes |
| Document ingestion pipeline (parse→chunk→embed) | ✅ | - | - | 🟡 Partial |
| Sentence-level chunking | 🔴 dep missing | - | - | 🔴 Falls back to naive |
| Contextual chunk enrichment | ✅ | - | - | ✅ Yes |
| Gemini embedding + Redis cache | ✅ | - | - | ✅ Yes |
| Real-time ingestion progress (Supabase Realtime) | ✅ | ✅ | ✅ | ✅ Yes |
| List documents | ✅ | ✅ | ✅ | ✅ Yes |
| Delete document | ✅ | ✅ | ✅ | ✅ Yes |
| PDF signed URL (for viewer) | ✅ | 🔴 not wired | 🔴 | 🔴 Not wired |
| Create / list / delete chat sessions | ✅ | ✅ | ✅ | ✅ Yes |
| SSE streaming chat | ✅ | ✅ | ✅ | 🟡 Works but no RAG |
| Intent classification | ✅ | - | ✅ | ✅ Yes |
| Query rewriting | ✅ | - | ✅ | 🟡 Redis-optional |
| HyDE query expansion | ✅ | - | ✅ | ✅ Yes |
| **RAG retrieval (hybrid search)** | **🔴 RPCs missing** | - | - | **🔴 Broken** |
| FlashRank cross-encoder reranking | ✅ | - | ✅ | 🟡 Windows cache_dir |
| MMR diversity selection | ✅ | - | ✅ | 🟡 No embeddings in response |
| Sufficiency check + query decomposition | ✅ | - | ✅ | ✅ Yes (but retrieves nothing) |
| Document capability modes (quiz/notes/etc.) | ✅ | 🟡 | 🟡 | 🟡 Partial |
| Suggested question chips | ✅ | 🔴 SSE not forwarded | 🔴 | 🔴 Broken |
| Related questions | ✅ | ✅ | ✅ | ✅ Yes |
| Key points extraction | ✅ | 🟡 | 🟡 | 🟡 Partial |
| Message history load on session switch | ✅ | 🔴 wrong URL | 🔴 | 🔴 Broken |
| Thumbs up/down feedback | ✅ | ✅ | ✅ | ✅ Yes |
| Chat export as PDF | ✅ | ✅ | 🟡 | 🟡 Mostly works |
| NER knowledge graph | 🔴 wrong fn name | 🟡 | 🔴 | 🔴 Crashes |
| UMAP 3D visualization | 🟡 re-embeds | 🟡 | 🟡 | 🟡 Works, wastes quota |
| User profile settings (model preferences) | ✅ | ✅ | ✅ | ✅ Yes |
| Token budget tracking | 🟡 tracked only | 🟡 | 🟡 | 🟡 Not enforced |
| Conversation memory (Redis) | ✅ | - | 🟡 | 🟡 Redis-dependent |
| Rate limiting (5/min chat) | 🟡 set up not applied | - | - | 🟡 Not enforced on chat |
| PDF viewer with citation highlighting | - | 🔴 | 🔴 | 🔴 Not built |
| Backend tests | 🔴 empty | - | - | 🔴 None |
| Celery async worker | ✅ | - | 🟡 | 🟡 Disabled by default |

---

## 8. Code Quality & Algorithm Audit

### Python Backend

#### Architecture: ✅ 9/10
- Clean separation: routers → services → pipeline nodes
- Correct `asyncio.to_thread()` wrapping for all sync SDK calls
- Proper FastAPI dependency injection via `Depends()`
- `tenacity` retry decorators on all external API calls (3x exponential backoff)
- Graceful fallbacks throughout (FlashRank → bonus scoring, UMAP → PCA, parsers → pdfplumber)

#### Algorithm Efficiency Review

**Embedding (Gemini REST):**
```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _embed_sync(text: str) -> list:
    response = requests.post(EMBED_URL + f"?key={settings.GEMINI_API_KEY}", ...)
    return response.json()["embedding"]["values"]
```
- Single embed: O(1), ~300ms latency
- Batch: `asyncio.gather()` with `batch_size=50` — correct parallel execution
- Redis SHA-256 hash cache prevents re-embedding identical text ✅

**Hybrid Retrieval (designed algorithm):**
```
pgvector cosine search (HNSW index) ← parallel → BM25 FTS (GIN index)
         ↓ RRF merge (k=60) ↓
    1/(k+rank_semantic) + 1/(k+rank_bm25)
         ↓ sort descending ↓
    top 20 candidates
```
Excellent algorithm. O(log n) for HNSW search. O(n) for BM25 with GIN. **Currently broken by missing RPCs.**

**FlashRank Reranking:**
- Cross-encoder: ms-marco-MiniLM-L-12-v2 (~12 transformer layers)
- O(n) forward passes for n candidates (each pass: 12 attention layers over [query; passage] concat)
- With 512-char truncation: ~2ms per passage → 20ms for 10 passages ✅
- Content-hash deduplication: O(n) set lookup ✅
- Title/heading bonus via regex: O(n) ✅
- Net algorithm quality: **Excellent**

**MMR (Maximal Marginal Relevance):**
```python
score = λ × relevance(query, chunk_i) - (1-λ) × max(similarity(chunk_i, selected_j))
```
- O(k × n) cosine ops: k=8 selected, n≤10 → 80 cosine products → ~0ms ✅
- λ=0.7: favors relevance (70%) over novelty (30%) — correct default
- Correctly handles missing embeddings by using query vector as placeholder

**Chunking Strategy:**
```python
CHUNK_CONFIG = {
    "pdf":   {"chunk_size": 512,  "overlap": 100},  # ~400-token context
    "pptx":  {"chunk_size": 1024, "overlap": 0},    # 1 slide = 1 chunk
    "docx":  {"chunk_size": 512,  "overlap": 100},
    "image": {"chunk_size": 2048, "overlap": 0},    # full caption as chunk
    "audio": {"chunk_size": 768,  "overlap": 50},
    "xlsx":  {"chunk_size": 1024, "overlap": 0},    # 1 table = 1 chunk
}
```
- Per-type config is sensible ✅
- Tiny chunk merging (<30 words) prevents meaningless micro-chunks ✅
- SentenceSplitter from LlamaIndex is the correct algorithm (preserves sentence boundaries)
- **Issue:** LlamaIndex not in requirements.txt → always falls back to naive word-count split

**RRF (Reciprocal Rank Fusion) in Python:**
```python
scores[did] = scores.get(did, 0) + 1.0 / (k + rank)
```
- k=60: standard value from the 2009 Cormack/Clarke/Buettcher paper ✅
- O(n log n) sort per merged list ✅
- Handles asymmetric results (chunk in only one list) correctly ✅

### TypeScript Frontend

#### Code Quality: ✅ 7/10
- Type-safe Zustand stores with full interface definitions
- Consistent async/await throughout
- SSE parser correctly handles partial buffer chunks

**Issues:**
- Large page components (32KB, 21KB) should be decomposed
- Mix of `fetch()` and `axios` for API calls — inconsistent
- `useEffect` dependency arrays sometimes incomplete
- `handleNewChat` and similar handlers defined inside component body — should be `useCallback`

---

## 9. Critical Bugs & Broken Code

### 🔴 BUG 1 — Missing `match_chunks` SQL RPC (CRITICAL)

**Files:** `backend/app/services/retrieval/hybrid.py` lines 26-44  
**Problem:** `pgvector_search()` calls `sb.rpc("match_chunks", params)` — this function does not exist in `schema.sql`. Returns empty results silently.

**Fix — Add to schema.sql:**
```sql
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_doc_ids uuid[],
  match_count int DEFAULT 20,
  match_modality text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, doc_id uuid, content text, page_num int, slide_num int,
  modality text, chunk_type text, bbox jsonb, similarity float
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.doc_id, c.content, c.page_num, c.slide_num, c.modality,
         c.chunk_type, c.bbox,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  WHERE c.user_id = match_user_id
    AND (match_doc_ids IS NULL OR c.doc_id = ANY(match_doc_ids))
    AND (match_modality IS NULL OR c.modality = match_modality)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

### 🔴 BUG 2 — Missing `match_chunks_fts` SQL RPC (CRITICAL)

**Files:** `backend/app/services/retrieval/hybrid.py` lines 47-68  
**Fix — Add to schema.sql:**
```sql
CREATE OR REPLACE FUNCTION public.match_chunks_fts(
  query_text text,
  match_user_id uuid,
  match_doc_ids uuid[],
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid, doc_id uuid, content text, page_num int, slide_num int,
  modality text, chunk_type text, bbox jsonb, rank float
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.doc_id, c.content, c.page_num, c.slide_num, c.modality,
         c.chunk_type, c.bbox,
         ts_rank_cd(to_tsvector('english', c.content),
                    websearch_to_tsquery('english', query_text))::float AS rank
  FROM public.chunks c
  WHERE c.user_id = match_user_id
    AND (match_doc_ids IS NULL OR c.doc_id = ANY(match_doc_ids))
    AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
```

---

### 🔴 BUG 3 — Knowledge Graph Wrong Function Name

**File:** `backend/app/routers/knowledge.py` line 47-48  
**Problem:** Calls `build_knowledge_graph(texts)` — function doesn't exist. Should be `build_cooccurrence_graph(chunks)`.

**Fix:**
```python
# knowledge.py - line 46-51
from app.services.knowledge.ner_graph import build_cooccurrence_graph
chunk_dicts = [{"content": c["content"]} for c in chunks]
graph = build_cooccurrence_graph(chunk_dicts)
return graph
```

---

### 🔴 BUG 4 — Message History Wrong API Path

**File:** `frontend/src/store/useChatStore.ts` line 174  
**Problem:** Calls `/api/v1/sessions/${sessionId}/messages` — should be `/api/v1/chat/${sessionId}/messages`.

**Fix:**
```typescript
// Change:
`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions/${sessionId}/messages`
// To:
`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/${sessionId}/messages`
```

---

### 🔴 BUG 5 — Suggested Questions SSE Event Not Forwarded

**File:** `frontend/src/lib/stream.ts` lines 110-113  
**Problem:** `suggested_questions` event is parsed but the handler body is empty — questions are never stored.

**Fix:**
```typescript
case 'suggested_questions':
  // Need to expose a way to call store from here
  // Option 1: Add a callback parameter to streamChat()
  // Option 2: Import store directly (not ideal in utility files)
  // Best: Pass onSuggestedQuestions callback to streamChat()
  break;
```
Then update `useChatStore.sendMessage()` to pass `setSuggestedQuestions` as callback.

---

### 🔴 BUG 6 — Deprecated Groq Model (`mixtral-8x7b-32768`)

**File:** `backend/app/config.py` line 23  
**Problem:** `LLM_LONG_PROVIDER: str = "groq/mixtral-8x7b-32768"` is no longer on Groq's API.

**Fix:**
```python
LLM_LONG_PROVIDER: str = "groq/llama-3.3-70b-versatile"  # 128K context
```

---

### 🟡 BUG 7 — FlashRank Cache Dir Breaks on Windows

**File:** `backend/app/services/retrieval/reranker.py` line 29  
**Fix:**
```python
import tempfile, os
cache_dir = os.path.join(tempfile.gettempdir(), "flashrank")
_ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=cache_dir)
```

---

### 🟡 BUG 8 — Large File Upload Blocks Event Loop

**File:** `backend/app/routers/documents.py` lines 111-128  
**Fix:**
```python
await asyncio.to_thread(
    lambda: httpx.put(url, content=content, headers=headers, timeout=120)
)
```

---

### 🟡 BUG 9 — UMAP Re-Embeds Instead of Using Stored Embeddings

**File:** `backend/app/routers/embeddings.py` lines 79-86  
**Fix:** Change DB query to `select("doc_id, content, modality, embedding")` and use the stored float array directly for UMAP instead of calling `batch_embed()`.

---

### 🟡 BUG 10 — `suggested-questions` Frontend URL Wrong

**File:** `frontend/src/store/useChatStore.ts` line 192  
**Problem:** Calls `/documents/${docId}/suggested-questions?session_id=...` but backend route is `/chat/${sessionId}/suggested-questions?doc_id=...`

---

### 🟡 BUG 11 — Rate Limit Decorator Not Applied to Chat Route

**File:** `backend/app/routers/chat.py` line 93  
**Problem:** `limiter` is set up in `main.py` but the `@limiter.limit(settings.CHAT_RATE_LIMIT)` decorator is not applied to the `@router.post("/chat")` endpoint. Rate limiting is configured but never enforced.

**Fix:**
```python
from slowapi import Limiter
from app.config import settings

@router.post("/chat")
@limiter.limit(settings.CHAT_RATE_LIMIT)
async def chat(request: Request, body: ChatRequest, ...):
```

---

## 10. Scaffold & Incomplete Sections

### 10.1 Missing SQL Functions (Most Critical)
These RPCs are called in Python but absent from `schema.sql`:
- `match_chunks` ← vector search
- `match_chunks_fts` ← BM25 search
- `nexus_exec_sql` ← raw SQL execution via `SupabaseDB._rpc_sql()` (only needed for raw SQL path)

### 10.2 `llama_index` Not in requirements.txt
`chunker.py` imports `from llama_index.core.node_parser import SentenceSplitter` — library not in `requirements.txt`. Always falls back to naive word-count split.

### 10.3 `spaCy` Not in requirements.txt
`ner_graph.py` imports `spacy` and loads `en_core_web_sm` — neither in `requirements.txt`. Knowledge graph always returns empty results.

### 10.4 Empty Test Directory
`backend/tests/` is empty. No unit tests, integration tests, or mocks for any of the 20+ service modules.

### 10.5 PDF Viewer Not Wired
`pdfjs-dist` is installed. `components/pdf/` directory exists. The signed URL endpoint works. But the PDF viewer component is not wired to display documents clicked from the document library.

### 10.6 `TRANSLATION` Intent Has No Capability Prompt
`intent.py` classifies `TRANSLATION` intent but `document_modes.py` has no `TRANSLATION` mode. Falls through to standard DOCUMENT_CHAT prompt silently.

### 10.7 Token Budget Not Enforced
`profiles.monthly_token_budget` and `tokens_used_this_month` are tracked in the schema and config, but no backend code actually blocks requests when the budget is exceeded. `usage_logs` are also never written to by any current router code.

### 10.8 Workspace → Chat Document Scope Flow
The `/workspace` page allows document selection, and the `/chat` page accepts `doc_ids`. But it's unclear if selecting documents in workspace correctly propagates `doc_ids` when navigating to chat. The cross-page state flow is a likely gap.

### 10.9 Audio Parser Verification
`audio_parser.py` (3.7KB) exists and handles Whisper transcription via Groq. This may be functional but wasn't fully audited. Verify Groq Whisper endpoint is correctly called.

---

## 11. Security Audit

### Authentication: ✅ Strong (8/10)
- JWT verified via Supabase auth server as primary (algorithm-agnostic)
- Manual HS256 fallback only when Supabase is unreachable
- Service role key is backend-only (never exposed to client)
- Profile auto-creation uses upsert (race-condition safe)

### Authorization: ✅ Strong (8/10)
- All queries filter by `user_id` — "Rule 2" enforced consistently
- RLS at DB level as second defense layer
- Storage bucket policies prevent cross-user file access

### Input Validation: 🟡 Partial (7/10)
- File MIME validation ✅
- File size cap ✅
- Filename sanitization (prevents path traversal) ✅
- Chat query max_length=4000 ✅
- `_rpc_sql()` string interpolation instead of true parameterization ⚠️

### CORS: 🟡 Overly Broad (6/10)
`allow_origins=["https://*.vercel.app"]` — wildcard subdomain. Any Vercel app can make authenticated requests. Should be restricted to specific production URL.

### XSS: 🟡 (6/10)
`react-markdown` renders assistant messages. `rehype-sanitize` is NOT installed. If `rehype-raw` is used anywhere, user-controlled content in LLM responses could inject HTML.

---

## 12. Performance & Latency Analysis

### Server Cold Start
- Supabase client init: ~500ms
- FlashRank model load (first chat request): ~1-2s
- LangGraph graph compile: ~100ms
- **Total: ~2-3 seconds before first request is handled**

### Per-Request Latency Budget (all services healthy)

| Scenario | Estimated TTFT |
|----------|----------------|
| GENERAL_CHAT (regex fast-path) | ~400ms |
| GENERAL_CHAT (LLM classify) | ~500ms |
| DOCUMENT_CHAT (standard lookup) | ~1,000-1,500ms |
| DOCUMENT_CHAT (with HyDE) | ~1,200-1,800ms |
| DOCUMENT_SUMMARY / Quiz / Notes | ~1,500-2,000ms |
| **Current (retrieval broken, no RAG context)** | **~500ms** |

### Bottlenecks
1. **Gemini Embedding:** 200-500ms REST call. Mitigated by Redis cache.
2. **Multiple Groq Calls:** 7-8 sequential/parallel 8B model calls (~80ms each = 560ms total for classify/rewrite/hyde/check)
3. **Thread Pool Overhead:** Each `asyncio.to_thread()` adds ~1-5ms context-switching cost
4. **FlashRank Cold Load:** First request pays 1-2s for MiniLM model loading into memory

### Caching Coverage
| Cache Type | Implementation | Status |
|------------|----------------|--------|
| Chunk embeddings | Redis SHA-256 | ✅ |
| Query embeddings | Redis SHA-256, 1h TTL | ✅ |
| Conversation context | Redis session key, 1h TTL | ✅ |
| Session list | None | ❌ |
| Document list | None | ❌ |
| Suggested questions | Stored in `auto_topics` DB col | ✅ |

---

## 13. Infrastructure & DevOps Review

### Docker Compose
```yaml
services:
  api:     FastAPI backend (port 8000)
  worker:  Celery worker for async ingestion
  redis:   Redis 7 Alpine with persistent volume
  ollama:  Offline LLM mode (profile=offline, optional)
```

**Issues:**
- No health checks on `api` or `worker` services
- No CPU/memory resource limits (OOM risk in production)
- `docker-compose version: '3.9'` — version key is deprecated in Compose v2+

### Deployment
- `Procfile` exists for Heroku/Railway deployment
- `backend/.env.example` documents all required environment variables
- `frontend/.env.example` documents frontend variables

### Missing Infrastructure
- No reverse proxy / nginx config
- No SSL termination config
- No log aggregation
- No database backup strategy
- Langfuse keys configured but no active tracing calls in code
- No Prometheus / metrics endpoint

---

## 14. Prioritized Fix List

### 🔴 P0 — CRITICAL (System doesn't work without these)

1. **Add `match_chunks` SQL function to Supabase** (schema.sql) — RAG retrieval returns nothing
2. **Add `match_chunks_fts` SQL function to Supabase** (schema.sql) — BM25 search broken
3. **Fix knowledge graph function name** in `knowledge.py` — crashes on every call
4. **Fix message history URL** in `useChatStore.ts` — history never loads
5. **Forward `suggested_questions` SSE event** in `stream.ts` — chips never appear
6. **Fix deprecated Groq model** (`mixtral-8x7b-32768` → `llama-3.3-70b-versatile`)

### 🟡 P1 — HIGH (Significant UX impairment)

7. **Add `llama-index-core` to requirements.txt** (or replace with nltk/spacy sentence splitting)
8. **Add `spacy>=3.7.0` to requirements.txt** + add `en_core_web_sm` install instruction
9. **Fix FlashRank cache_dir** to use `tempfile.gettempdir()` (Windows compatibility)
10. **Fix UMAP endpoint** to use stored `embedding` column instead of re-embedding
11. **Apply rate limit decorator** to `/chat` endpoint in chat.py
12. **Fix `fetchSuggestedQuestions` URL** in `useChatStore.ts`

### 🟡 P2 — MEDIUM (Quality improvements)

13. **Fix large file upload** to use `asyncio.to_thread` for `httpx.put()`
14. **Add `tiktoken`-based token counting** in chat.py (replace `len()//4` approximation)
15. **Fix `useDocumentRealtime`** — move `createClient()` inside `useEffect`/`useRef`
16. **Wire PDF viewer** to document signed URL for in-app reading
17. **Enforce token budget** — block requests when `tokens_used_this_month >= monthly_token_budget`
18. **Write `usage_logs` entries** when calling Gemini/Groq

### 🟢 P3 — ENHANCEMENT (Production readiness)

19. Write backend tests (`pytest` + `httpx.AsyncClient`)
20. Add `rehype-sanitize` to markdown renderer to prevent XSS
21. Restrict CORS to specific production domain
22. Add Docker health checks
23. Add `TRANSLATION` mode prompt to `document_modes.py`
24. Add citation highlighting to PDF viewer using `bbox` field
25. Document `python -m spacy download en_core_web_sm` in README

---

## 15. Recommendations

### Remove / Simplify
- **Remove `nexus_exec_sql` RPC pattern** — `SupabaseDB._rpc_sql()` is dangerous and unnecessary. All current routers use the safe `.table().select()...` pattern. The raw SQL execution path adds complexity and security risk for zero benefit.
- **Remove `TRANSLATION` intent** OR implement it — having an intent class with no handler is confusing.

### Adjust / Improve
- **Replace LlamaIndex `SentenceSplitter` with `spacy.sentencizer`** — spaCy is already used for NER. Adding the `sentencizer` pipe is one line of code vs. installing a 1GB+ LlamaIndex ecosystem.
- **Use `hybrid_search()` Postgres function directly** in `hybrid.py` instead of two separate RPCs. The function is already written, correct, and returns merged RRF results in one DB round trip.
- **Use React Query** for document/session lists — replace manual `fetch` + Zustand pattern with `useQuery` for automatic caching, background refetching, and loading states.
- **Merge Workspace into Chat sidebar** — The current split between `/workspace` (document list) and `/chat` creates unnecessary navigation friction. The document library should be the chat's left panel.

### Add to Complete the Project
1. The two missing SQL RPC functions (critical path)
2. Backend test suite (`pytest` + `httpx.AsyncClient` test client)
3. `TRANSLATION` mode prompt in `document_modes.py`
4. PDF viewer wiring + citation bbox highlighting
5. Token budget enforcement middleware
6. `usage_logs` write on every LLM/embedding call

---

## Final Scorecard

| Category | Score | Key Issues |
|----------|-------|------------|
| Architecture Design | 9/10 ✅ | Excellent overall structure |
| Database & Schema | 8/10 ✅ | Missing 2 critical SQL RPCs |
| Backend Code Quality | 7/10 🟡 | `_rpc_sql()` injection risk |
| RAG Pipeline Logic | 9/10 ✅ | LangGraph implementation is excellent |
| RAG Pipeline Functionality | 4/10 🔴 | Retrieval RPCs missing → no actual RAG |
| Document Ingestion | 7/10 🟡 | LlamaIndex dep missing, chunker fallback |
| Auth & Security | 8/10 ✅ | Overly broad CORS, XSS risk |
| Frontend Code Quality | 7/10 🟡 | Wrong URL paths, mixed patterns |
| Frontend UX | 7/10 🟡 | Missing state connections, large page files |
| Knowledge Graph | 3/10 🔴 | Wrong function name, crashes |
| UMAP / 3D Map | 5/10 🟡 | Re-embeds expensively on every visit |
| Tests | 0/10 🔴 | Empty test directory |
| DevOps / Deployment | 6/10 🟡 | Missing health checks, no resource limits |
| **OVERALL** | **68/130** | **🟡 FUNCTIONALLY PARTIAL** |

> **The project has excellent architectural bones** — the LangGraph pipeline design, database schema, auth system, and overall service structure are sophisticated and well thought-out. The primary issue is a **small set of critical wiring bugs** (missing SQL RPCs, wrong function names, wrong API paths) that prevent core functionality from working. Fix the 6 P0 bugs and this becomes a solid working RAG application. Complete the P1 items and it's production-ready.

---
*Report generated by Antigravity AI | 2026-10-06 13:12 IST*