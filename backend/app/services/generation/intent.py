# app/services/generation/intent.py
# 13-class intent classifier — RAG Upgrade Feature 2
# Uses Groq 8B fast model with JSON output (~80ms)
# GENERAL_CHAT has a fast-path regex to skip LLM cost entirely
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# ── All supported intents ─────────────────────────────────────────────────────
INTENTS = {
    "GENERAL_CHAT",           # Hi, thanks, who are you → NO vector search
    "DOCUMENT_CHAT",          # Specific question about document content
    "DOCUMENT_SUMMARY",       # Summarize the document
    "DOCUMENT_COMPARISON",    # Compare documents or concepts
    "DOCUMENT_SEARCH",        # Find specific info in document
    "DOCUMENT_EXPLANATION",   # Explain a concept from the document
    "DOCUMENT_QUIZ",          # Generate quiz/MCQ questions
    "FLASHCARD_GENERATION",   # Generate flashcards
    "NOTE_GENERATION",        # Generate notes / study notes
    "INTERVIEW_PREPARATION",  # Generate interview questions
    "TRANSLATION",            # Translate or localize content
    "SIMPLIFICATION",         # ELI5 / beginner explanation
    "FOLLOW_UP",              # Follow-up to a previous answer
    "UNKNOWN",                # Fallback → treated as DOCUMENT_CHAT
}

# Intents that skip vector retrieval entirely
NO_RETRIEVAL_INTENTS = {"GENERAL_CHAT"}

# Intents routed to the document capabilities engine
CAPABILITY_INTENTS = {
    "DOCUMENT_SUMMARY",
    "DOCUMENT_QUIZ",
    "FLASHCARD_GENERATION",
    "NOTE_GENERATION",
    "INTERVIEW_PREPARATION",
    "SIMPLIFICATION",
    "DOCUMENT_EXPLANATION",
    "DOCUMENT_COMPARISON",
}

# ── Fast-path regex — catches obvious GENERAL_CHAT without LLM cost ───────────
_GENERAL_PATTERN = re.compile(
    r"^\s*(hi+|hey+|hello+|howdy|hola|greetings?|"
    r"thanks?(\s+you)?|thank you|thx|ty|cheers|"
    r"bye+|goodbye|see\s+you|cya|"
    r"good\s+(morning|evening|afternoon|night|day)|"
    r"who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|"
    r"what\s+is\s+your\s+name|tell\s+me\s+about\s+yourself|"
    r"you.?re\s+welcome|no\s+problem|np|"
    r"awesome|amazing|great|ok(ay)?|cool|nice|wow|perfect|"
    r"lol|haha|😊|👍|❤️)\W*$",
    re.IGNORECASE,
)

INTENT_PROMPT = """Classify the user's intent for an AI Document Assistant.

Conversation history (last 3 turns):
{history}

User query: "{query}"
Documents available: {doc_names}

Choose the SINGLE best intent:
- GENERAL_CHAT: greetings, thanks, identity questions, small talk (NO document lookup needed)
- DOCUMENT_CHAT: specific question about document content
- DOCUMENT_SUMMARY: wants a summary or overview of the document
- DOCUMENT_COMPARISON: comparing concepts, approaches, or multiple documents
- DOCUMENT_SEARCH: searching for specific information/facts
- DOCUMENT_EXPLANATION: wants something explained in depth
- DOCUMENT_QUIZ: wants MCQ or quiz questions generated
- FLASHCARD_GENERATION: wants flashcards created
- NOTE_GENERATION: wants notes or study notes generated
- INTERVIEW_PREPARATION: wants interview questions generated
- TRANSLATION: wants content translated or simplified by language
- SIMPLIFICATION: wants ELI5 / beginner-friendly explanation
- FOLLOW_UP: clearly continues previous answer ("why?", "how?", "explain more", "give example", "what about X?")
- UNKNOWN: ambiguous — default to DOCUMENT_CHAT

Respond in JSON only, no explanation:
{{"intent": "INTENT_NAME", "confidence": 0.0}}"""


async def classify_intent(
    query: str,
    history: list[dict] | None = None,
    doc_names: list[str] | None = None,
) -> str:
    """
    Classify user intent into one of 13 categories.
    Fast-path: regex for obvious GENERAL_CHAT (no LLM cost).
    Slow-path: Groq 8B JSON classification (~80ms).
    Falls back to DOCUMENT_CHAT on any error.
    """
    query = query.strip()

    # ── Fast-path: obvious general chat ──────────────────────────────────────
    if _GENERAL_PATTERN.match(query):
        logger.debug(f"Intent fast-path GENERAL_CHAT: '{query[:40]}'")
        return "GENERAL_CHAT"

    # ── Slow-path: LLM classification ────────────────────────────────────────
    from app.config import settings
    if not settings.GROQ_API_KEY:
        return "DOCUMENT_CHAT"

    # Build compact history string (last 3 turns)
    hist_lines: list[str] = []
    for msg in (history or [])[-3:]:
        role = msg.get("role", "")
        content = str(msg.get("content", ""))[:100]
        hist_lines.append(f"{role}: {content}")
    hist_str = "\n".join(hist_lines) or "none"

    doc_str = ", ".join(doc_names or []) or "no documents uploaded"

    try:
        from app.services.generation.llm import call_llm_fast
        raw = await call_llm_fast(
            INTENT_PROMPT.format(query=query, history=hist_str, doc_names=doc_str),
            max_tokens=60,
        )
        match = re.search(r"\{.*?\}", raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            intent = str(data.get("intent", "DOCUMENT_CHAT")).upper().strip()
            if intent in INTENTS:
                logger.debug(f"Intent: {intent} (conf={data.get('confidence', '?')}) for '{query[:40]}'")
                return intent
    except Exception as e:
        logger.debug(f"Intent classification failed: {e}")

    return "DOCUMENT_CHAT"
