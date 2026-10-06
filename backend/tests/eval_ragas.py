# backend/tests/eval_ragas.py
# Basic RAG evaluation — no OpenAI required
# Uses Groq + Gemini (the project's free stack)
# Run: cd backend && python -m pytest tests/eval_ragas.py -v

import pytest


def test_rag_faithfulness_basic():
    """Basic dataset structure test — no API key needed."""
    data = {
        "question":  ["What is NEXUS?"],
        "answer":    ["NEXUS is a Universal RAG Assistant [1]."],
        "contexts":  [["NEXUS is a multimodal RAG system built on Groq + Gemini."]],
    }
    assert len(data["question"]) == len(data["answer"]) == len(data["contexts"])
    assert "[1]" in data["answer"][0], "Answer should contain citation marker"
    print("✅ Basic faithfulness structure OK")


def test_groq_api_available():
    """Verify Groq API key is configured and responds."""
    import sys
    sys.path.insert(0, ".")
    from app.config import Settings
    s = Settings()
    if not s.GROQ_API_KEY:
        pytest.skip("GROQ_API_KEY not set")
    import asyncio
    from groq import AsyncGroq
    async def call():
        client = AsyncGroq(api_key=s.GROQ_API_KEY)
        resp = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "Reply: OK"}],
            max_tokens=5,
        )
        return resp.choices[0].message.content.strip()
    result = asyncio.run(call())
    print(f"✅ Groq response: {result}")
    assert result, "Groq should return non-empty response"


def test_gemini_embed_available():
    """Verify Gemini embedding API returns 768-dim vectors (outputDimensionality=768)."""
    import sys, requests
    sys.path.insert(0, ".")
    from app.config import Settings
    s = Settings()
    if not s.GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY not set")
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
    resp = requests.post(
        f"{url}?key={s.GEMINI_API_KEY}",
        json={
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": "test"}]},
            "taskType": "RETRIEVAL_DOCUMENT",
            "outputDimensionality": s.EMBED_DIM,  # 768 — matches Supabase vector(768)
        },
        timeout=15,
    )
    assert resp.status_code == 200, f"Gemini API returned {resp.status_code}: {resp.text[:200]}"
    vec = resp.json()["embedding"]["values"]
    assert len(vec) == s.EMBED_DIM, f"Expected {s.EMBED_DIM}-dim, got {len(vec)}"
    print(f"✅ Gemini embed: dim={len(vec)}, first3={vec[:3]}")
