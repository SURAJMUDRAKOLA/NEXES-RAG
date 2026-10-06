# app/services/generation/llm.py
# Direct Groq SDK — NO LiteLLM (removes startup warnings + 300ms import delay)
# Models: llama-3.3-70b-versatile (final), llama-3.1-8b-instant (fast ops)
# Plan §11.1 + api_operation_mapping
from __future__ import annotations

import logging
from typing import AsyncIterator

from groq import AsyncGroq
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)


def _model(name: str) -> str:
    """Strip 'groq/' provider prefix — LiteLLM used it for routing; Groq SDK does not."""
    return name.removeprefix("groq/")


def _client() -> AsyncGroq:
    """Return Groq async client. Raises clear error if key missing."""
    if not settings.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Get a free key at console.groq.com "
            "and add it to backend/.env as: GROQ_API_KEY=gsk_..."
        )
    return AsyncGroq(api_key=settings.GROQ_API_KEY)


def route_model(query_type: str, has_images: bool = False) -> str:
    """
    Select Groq model for query type — api_operation_mapping §9.
    Returns model name WITHOUT 'groq/' prefix (SDK format).
    """
    if has_images:
        return "llama-3.2-11b-vision-preview"
    return _model({
        "lookup":    settings.LLM_PROVIDER,
        "summarise": settings.LLM_PROVIDER,
        "compare":   settings.LLM_PROVIDER,
        "cross_doc": settings.LLM_LONG_PROVIDER,
        "image":     "groq/llama-3.2-11b-vision-preview",
    }.get(query_type, settings.LLM_PROVIDER))


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def call_llm_fast(prompt: str, max_tokens: int = 150) -> str:
    """
    Fast LLM call — llama-3.1-8b-instant (~80ms).
    Used for: classify (200 tok), enrichment (150 tok), related Qs (300 tok).
    Retries 3x with exponential backoff on 429 — plan §13.1.
    """
    resp = await _client().chat.completions.create(
        model=_model(settings.LLM_FAST_PROVIDER),
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0,
    )
    return resp.choices[0].message.content.strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def call_llm_structured(model: str, prompt: str, schema) -> object:
    """
    Structured JSON output call (classify, sufficiency check).
    Returns schema(**parsed_json) or schema defaults on failure.
    """
    import json
    try:
        resp = await _client().chat.completions.create(
            model=_model(model),
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        content = resp.choices[0].message.content
        return schema(**json.loads(content))
    except Exception as e:
        logger.warning(f"call_llm_structured failed: {e} — returning defaults")
        return schema()


async def call_llm(messages: list, model: str, max_tokens: int = 512) -> str:
    """Non-streaming call. Used for related questions, document summary."""
    try:
        resp = await _client().chat.completions.create(
            model=_model(model),
            messages=messages,
            max_tokens=max_tokens,
            temperature=0,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"call_llm failed: {e}")
        return ""


async def stream_llm(messages: list, model: str, max_tokens: int = 2048) -> AsyncIterator[str]:
    """
    Stream tokens from Groq — plan §10.1.
    First token ~400ms with llama-3.3-70b-versatile.
    """
    if not settings.GROQ_API_KEY:
        yield (
            "⚠️ **GROQ_API_KEY not configured.**\n\n"
            "Get your free key at [console.groq.com](https://console.groq.com) "
            "and add it to `backend/.env`:\n```\nGROQ_API_KEY=gsk_...\n```"
        )
        return
    try:
        stream = await _client().chat.completions.create(
            model=_model(model),
            messages=messages,
            stream=True,
            max_tokens=max_tokens,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as e:
        err = str(e)
        if "429" in err:
            yield "\n\n⚠️ **Rate limit reached.** Please wait a moment and try again."
        elif "401" in err or "invalid_api_key" in err.lower():
            yield "\n\n⚠️ **Invalid GROQ_API_KEY.** Please check your key at [console.groq.com](https://console.groq.com)"
        else:
            logger.error(f"stream_llm error: {e}")
            yield f"\n\n⚠️ LLM error: {e}"
