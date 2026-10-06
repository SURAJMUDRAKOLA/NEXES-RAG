# NEXUS RAG Backend

> Universal Multimodal RAG Assistant — FastAPI + Celery + Supabase + LangGraph

## What is NEXUS?

NEXUS is a production-grade knowledge platform that allows users to upload any document format (PDF, PPTX, DOCX, images, audio) and interact with it through a streaming conversational AI with full source attribution and anti-hallucination guarantees.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXUS BACKEND                               │
│                                                                     │
│  ┌──────────┐   ┌──────────────────┐   ┌─────────────────────────┐ │
│  │ Next.js  │──▶│  FastAPI (main)  │──▶│    LangGraph Pipeline   │ │
│  │ Frontend │   │  uvicorn :8000   │   │  classify→hyde→embed→   │ │
│  └──────────┘   │                  │   │  retrieve→rerank→mmr→   │ │
│                 │  /api/v1/chat    │   │  check→[decompose]→gen  │ │
│                 │  /api/v1/docs    │   └─────────────────────────┘ │
│                 │  /api/v1/sessions│                               │
│                 │  /api/v1/auth    │   ┌─────────────────────────┐ │
│                 │  /health         │   │      Celery Worker       │ │
│                 └────────┬─────────┘   │  process_document task  │ │
│                          │             │  5-phase ingestion:      │ │
│                 ┌────────▼─────────┐   │  Parse→Chunk→Enrich→    │ │
│                 │   Supabase       │   │  Embed→Store            │ │
│                 │  PostgreSQL +    │◀──│                          │ │
│                 │  pgvector        │   └──────────┬──────────────┘ │
│                 │  Storage         │              │                 │
│                 │  Auth + Realtime │   ┌──────────▼──────────────┐ │
│                 └──────────────────┘   │  Redis (Celery broker)  │ │
│                                        │  + Embedding cache       │ │
│                                        └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Prerequisites

- Python 3.11+
- Redis (local or Docker)
- Supabase project (for database, storage, auth)

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required fields to replace placeholders:
| Variable | Description |
|---|---|
| `SUPABASE_SERVICE_KEY` | From Supabase Dashboard → Settings → API → service_role key |
| `SUPABASE_JWT_SECRET` | From Supabase Dashboard → Settings → API → JWT Secret |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| `OPENAI_API_KEY` | From platform.openai.com (or leave blank to use Ollama) |

### 3. Initialize Database

Run the provided schema against your Supabase project:

```bash
# Via Supabase SQL Editor:
# Copy contents of schema.sql and run in Supabase Dashboard → SQL Editor

# Or via psql:
psql "$DATABASE_URL" -f schema.sql
```

### 4. Install Python Dependencies

```bash
# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Install spaCy language model
python -m spacy download en_core_web_sm
```

### 5. Start the API Server

```bash
# Development (auto-reload)
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 6. Start the Celery Worker

```bash
# Start Redis first (if running locally)
redis-server

# Start Celery worker (in a separate terminal)
celery -A app.workers.celery_app worker -Q ingestion --loglevel=info

# Optional: Celery Flower monitoring UI
pip install flower
celery -A app.workers.celery_app flower --port=5555
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/verify` | Verify Supabase JWT, return profile |
| `GET` | `/api/v1/auth/profile` | Get current user's profile |
| `POST` | `/api/v1/auth/profile` | Update profile settings |

### Documents
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/upload` | Upload a document (triggers Celery ingestion) |
| `GET` | `/api/v1/documents` | List all documents for current user |
| `GET` | `/api/v1/documents/{id}` | Get document status |
| `DELETE` | `/api/v1/documents/{id}` | Delete document and all chunks |

### Chat (SSE Streaming)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/chat` | Stream RAG answer (SSE: token, sources, done events) |
| `GET` | `/api/v1/chat/{session_id}/messages` | Load conversation history |

### Sessions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/sessions` | List all sessions |
| `POST` | `/api/v1/sessions` | Create new session |
| `GET` | `/api/v1/sessions/{id}` | Get session by ID |
| `PATCH` | `/api/v1/sessions/{id}` | Update title / doc scope |
| `DELETE` | `/api/v1/sessions/{id}` | Delete session (cascades messages) |

### Embeddings
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/embeddings/umap` | UMAP 3D coordinates for knowledge map |

### Eval
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/eval/feedback` | Submit thumbs up/down feedback |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server + DB connectivity status |

---

## SSE Chat Stream Events

The `/api/v1/chat` endpoint returns an EventSource stream with these event types:

```json
{"type": "token",             "data": "<token_string>"}
{"type": "sources",           "sources": [{...}]}
{"type": "key_points",        "points": ["...", "..."]}
{"type": "related_questions", "questions": ["...", "..."]}
{"type": "done",              "message_id": "...", "latency_ms": 1234, "model": "gpt-4o"}
{"type": "error",             "message": "..."}
```

---

## Security Rules

| Rule | Description |
|---|---|
| **Rule 2** | Every DB query includes `WHERE user_id = $current_user_id` — no cross-user data leakage |
| **Rule 5** | `enriched_content` is stored for embedding only — never returned to users |
| **Rule 6** | System prompt is immutable — cannot be overridden by user input |

---

## Running Tests

```bash
# All tests
python -m pytest tests/ -v

# Only structural RAGAS tests (no API key needed)
python -m pytest tests/eval_ragas.py -v

# Full RAGAS evaluation (requires ragas + OpenAI key)
pip install ragas datasets
OPENAI_API_KEY=sk-... python -m pytest tests/eval_ragas.py::test_ragas_full_evaluation -v
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | — | Supabase anonymous/publishable key |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key (server-only) |
| `SUPABASE_JWT_SECRET` | — | JWT signing secret for token verification |
| `DATABASE_URL` | — | asyncpg-compatible PostgreSQL connection string |
| `OPENAI_API_KEY` | — | OpenAI API key (leave blank for local Ollama) |
| `COHERE_API_KEY` | — | Cohere API key (for reranking, optional) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama local inference server |
| `LLM_PROVIDER` | `openai/gpt-4o` | Primary LLM (swap to `ollama/mistral-nemo` for local) |
| `LLM_FAST_PROVIDER` | `openai/gpt-4o-mini` | Fast LLM for classify/hyde/sufficiency |
| `EMBED_MODEL` | `openai/text-embedding-3-small` | Embedding model |
| `EMBED_DIM` | `1536` | Embedding dimension (768 for nomic-embed-text) |
| `RERANK_PROVIDER` | `flashrank` | Reranker: `flashrank` (free local) or `cohere` |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for Celery + embedding cache |
| `APP_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |

---

## Docker (optional)

```bash
# Build
docker build -t nexus-backend .

# Run with env file
docker run -p 8000:8000 --env-file .env nexus-backend
```

---

## Offline / Local AI Mode

Set these in `.env` to run with **zero API cost** using Ollama:

```env
LLM_PROVIDER=ollama/mistral-nemo
LLM_FAST_PROVIDER=ollama/llama3.2:3b
EMBED_MODEL=ollama/nomic-embed-text
EMBED_DIM=768
RERANK_PROVIDER=flashrank
```

Pull models: `ollama pull mistral-nemo && ollama pull llama3.2:3b && ollama pull nomic-embed-text`
