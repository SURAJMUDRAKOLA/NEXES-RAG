# NEXUS — Universal RAG Assistant

A full-stack, multimodal Retrieval-Augmented Generation (RAG) assistant that lets you upload any document (PDF, PowerPoint, Word, Excel, images, audio) and chat with it using AI. Built with Next.js 14, FastAPI, Supabase, and LangGraph.

---

## ✨ Features

- **Universal Document Support** — PDF, PPTX, DOCX, XLSX, PNG/JPG, MP3/MP4
- **Hybrid Search** — BM25 + HNSW vector search with Reciprocal Rank Fusion
- **Streaming Responses** — Real-time SSE token streaming from LLM
- **Citations** — Every answer has clickable inline citations with source highlighting
- **Multi-Model** — OpenAI GPT-4o, Claude, or local Ollama (offline mode)
- **Knowledge Graph** — 3D NER-based knowledge map with Three.js
- **Export** — Download chat as PDF with sources
- **Privacy Mode** — 100% offline with local Ollama + nomic-embed-text
- **Multi-User** — Full Row Level Security, data isolation per user

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 Frontend                       │
│  Auth → Upload → Chat (SSE) → Knowledge Map → Settings      │
└────────────────────┬────────────────────────────────────────┘
                     │ REST + SSE
┌────────────────────▼────────────────────────────────────────┐
│                   FastAPI Backend                            │
│  /auth /documents /upload /chat /sessions /knowledge        │
│                                                              │
│  LangGraph 9-Node Pipeline:                                  │
│  Query → HyDE → Classify → Embed → Hybrid Search →          │
│  MMR → Rerank → Assemble → Generate (SSE stream)            │
└──────┬──────────────────┬────────────────────────┬──────────┘
       │                  │                        │
┌──────▼──────┐  ┌────────▼──────┐  ┌─────────────▼──────────┐
│  Supabase   │  │  Redis Cache  │  │  Celery Workers         │
│  PostgreSQL │  │  Embeddings   │  │  Document Processing:   │
│  pgvector   │  │  + Broker     │  │  Parse→Chunk→Embed      │
│  Auth + RLS │  └───────────────┘  └────────────────────────┘
└─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Redis (via Docker: `docker run -d -p 6379:6379 redis:7-alpine`)
- Supabase account (free tier works)
- OpenAI API key (or local Ollama for offline mode)

---

### Step 1: Supabase Setup

1. Go to your [Supabase project](https://supabase.com/dashboard/project/qkeesjgupaovbhzfjcrp)
2. Open **SQL Editor** → **New Query**
3. Paste entire contents of `backend/schema.sql` → Click **Run**
4. Go to **Storage** → Create bucket named `documents` (set as **private**)
5. Go to **Database → Replication** → Enable `documents` table for Realtime

---

### Step 2: Backend Setup

```bash
cd backend

# Copy and fill in your credentials
cp .env.example .env
# Edit .env — fill in: SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, DATABASE_URL, OPENAI_API_KEY

# Install dependencies
pip install -r requirements.txt

# Download spaCy model (for knowledge graph)
python -m spacy download en_core_web_sm

# Start the API server
uvicorn app.main:app --reload --port 8000

# Open API docs: http://localhost:8000/docs
```

#### Required .env values

| Key | Where to find |
|-----|---------------|
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard → Settings → API → JWT Secret |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → Connection string (URI format, use `postgresql+asyncpg://...`) |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |

---

### Step 3: Celery Worker (document processing)

```bash
# In a separate terminal (from backend/ directory):
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4
```

---

### Step 4: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Frontend already has Supabase URL configured
# If you need to change it, edit: frontend/.env.local

# Start dev server
npm run dev

# Open: http://localhost:3000
```

---

## 📖 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/verify` | Verify JWT, return profile |
| GET | `/api/v1/auth/profile` | Get user profile |
| PATCH | `/api/v1/auth/profile` | Update profile settings |
| POST | `/api/v1/upload` | Upload document (PDF, PPTX, DOCX, etc.) |
| GET | `/api/v1/documents` | List all user documents |
| DELETE | `/api/v1/documents/{id}` | Delete document + chunks |
| GET | `/api/v1/documents/{id}/signed-url` | Get 1-hour signed download URL |
| POST | `/api/v1/chat` | SSE streaming chat (LangGraph pipeline) |
| GET | `/api/v1/chat/{session_id}/messages` | Get message history |
| GET | `/api/v1/sessions` | List all sessions |
| POST | `/api/v1/sessions` | Create new session |
| PATCH | `/api/v1/sessions/{id}` | Update session title/doc scope |
| DELETE | `/api/v1/sessions/{id}` | Delete session |
| GET | `/api/v1/sessions/{id}/export/pdf` | Export session as PDF |
| GET | `/api/v1/knowledge/graph` | NER knowledge graph |
| GET | `/api/v1/embeddings/umap` | 3D UMAP projection |
| POST | `/api/v1/eval/feedback` | Submit thumbs up/down |
| GET | `/api/v1/eval/stats` | Get satisfaction statistics |
| GET | `/health` | Health check |

---

## 🔒 Security

- **Row Level Security**: Every Supabase table has RLS enabled — users can only access their own data
- **JWT Verification**: Every backend request verifies Supabase JWT using HS256
- **File Validation**: MIME type validation, 100MB size limit, filename sanitization
- **Budget Control**: Monthly token budget per user with auto-tracking
- **Offline Mode**: All data stays local when using Ollama

---

## 🧠 RAG Pipeline (LangGraph)

```
Query Input
    ↓
[1] Classify Query Type (lookup / analysis / summary / code)
    ↓
[2] HyDE Generation (Hypothetical Document Embedding)
    ↓
[3] Embed Query (OpenAI / Ollama)
    ↓
[4] Hybrid Search (BM25 + HNSW → Reciprocal Rank Fusion)
    ↓
[5] MMR Diversity Filter (removes redundant chunks)
    ↓
[6] Rerank (Cohere / FlashRank local)
    ↓
[7] Context Sufficiency Check (retry if insufficient)
    ↓
[8] Prompt Assembly (system + history + context + query)
    ↓
[9] LLM Stream Generation → SSE Events
```

---

## 🌐 Deployment

### Docker (recommended)

```bash
# Build and start all services
docker-compose up -d

# Services:
# - nexus-api: FastAPI on port 8000
# - nexus-worker: Celery worker
# - nexus-redis: Redis on port 6379
```

### Vercel (Frontend)

```bash
cd frontend
vercel deploy

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# NEXT_PUBLIC_API_URL (your Railway/Render backend URL)
```

### Railway (Backend)

1. Connect your GitHub repo to Railway
2. Set `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
3. Add all environment variables from `.env`

---

## 📊 Project Structure

```
Universal RAG Bot/
├── backend/
│   ├── schema.sql              # Supabase schema (run first!)
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py             # FastAPI app + lifespan
│       ├── config.py           # Settings from env
│       ├── dependencies.py     # JWT auth + DB pool
│       ├── routers/            # API endpoints
│       ├── services/
│       │   ├── parsing/        # PDF, PPTX, DOCX, image, audio parsers
│       │   ├── chunking/       # Semantic chunking + contextual enrichment
│       │   ├── embedding/      # Embedder + Redis cache
│       │   ├── retrieval/      # Hybrid search + MMR + rerank
│       │   ├── generation/     # LLM + prompt + guardrails
│       │   ├── pipeline/       # LangGraph 9-node pipeline
│       │   └── knowledge/      # NER knowledge graph (spaCy)
│       └── workers/            # Celery tasks
└── frontend/
    ├── src/
    │   ├── app/                # Next.js app router pages
    │   ├── components/         # React components
    │   ├── store/              # Zustand state management
    │   ├── lib/                # API client, Supabase, utils
    │   ├── hooks/              # useAuth, useRealtime
    │   └── types/              # TypeScript types
    └── .env.local              # Frontend env vars
```

---

## 🛠️ Development

```bash
# Run frontend + backend simultaneously:
# Terminal 1: cd frontend && npm run dev
# Terminal 2: cd backend && uvicorn app.main:app --reload
# Terminal 3: docker run -d -p 6379:6379 redis:7-alpine
# Terminal 4: cd backend && celery -A app.workers.celery_app worker

# Run RAGAS evaluation:
cd backend && python -m pytest tests/eval_ragas.py -v

# Check TypeScript:
cd frontend && npx tsc --noEmit
```

---

## 📄 License

MIT License — See LICENSE file for details.
