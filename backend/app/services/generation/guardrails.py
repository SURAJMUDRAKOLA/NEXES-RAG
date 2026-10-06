# app/services/generation/guardrails.py
# Citation validation + response quality — upgraded for RAG Upgrade PDF
# Feature 10: Better failure detection | Feature 16: RAG quality
from __future__ import annotations

import re
import logging

logger = logging.getLogger(__name__)

# Phrases that indicate the response is a proper refusal (not hallucination)
_REFUSAL_PHRASES = [
    "don't see that in the document",
    "doesn't seem to be covered",
    "searched through the document",
    "document doesn't go into",
    "i'd rather not guess",
    "not mentioned directly",
    "couldn't find",
    "do not contain information",
    "not found in",
    "not covered in",
    "document does not",
    "i can't find",
    "unable to find",
]

# Filler phrases that are NOT key points (too generic)
_FILLER_PATTERNS = re.compile(
    r"^(in conclusion|to summarize|in summary|as mentioned|"
    r"it is important to note|it should be noted|"
    r"therefore|furthermore|moreover|additionally|"
    r"in addition|as a result|this means that)\b",
    re.IGNORECASE,
)


def validate_response(response: str, source_count: int) -> bool:
    """
    Validate that the response:
    1. Is not empty
    2. Either contains valid citations [N] or is a proper refusal/general response
    3. Does not reference out-of-range source numbers
    """
    if not response or len(response.strip()) < 10:
        return False

    # Proper refusal/failure message → valid
    response_lower = response.lower()
    if any(phrase in response_lower for phrase in _REFUSAL_PHRASES):
        return True

    # No sources available (GENERAL_CHAT, capability mode) → skip citation check
    if source_count == 0:
        return True

    # Check citations exist and are in range
    citations = re.findall(r"\[(\d+)\]", response)
    if not citations:
        # Allow responses without citations if they're clearly capability output
        # (quiz, flashcard, notes format detected)
        has_structured_format = any(marker in response for marker in [
            "**Q", "**Front:", "**Back:", "## ", "✅", "💡", "📋", "🃏",
        ])
        if has_structured_format:
            return True
        return False  # Regular Q&A without citations = likely hallucination

    for c in citations:
        n = int(c)
        if n < 1 or n > max(source_count, 1):
            return False

    return True


def is_failure_response(response: str) -> bool:
    """Check if the response is a failure/no-answer message."""
    if not response:
        return True
    response_lower = response.lower()
    return any(phrase in response_lower for phrase in _REFUSAL_PHRASES)


def extract_key_points(text: str, max_points: int = 5) -> list[str]:
    """
    Extract meaningful key points from response text for the insights panel.
    - Filters out filler phrases and overly short sentences
    - Prefers sentences with citations (more factual)
    - Returns 3-5 substantive points
    """
    if not text:
        return []

    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())

    scored: list[tuple[float, str]] = []
    for s in sentences:
        s = s.strip()
        # Skip too-short sentences
        if len(s) < 40:
            continue
        # Skip bullet markers and headers
        if s.startswith(("#", "-", "*", "•", "|", "**Q")):
            continue
        # Skip obvious filler
        if _FILLER_PATTERNS.match(s):
            continue

        score = 0.0
        # Prefer sentences with citations
        if re.search(r"\[\d+\]", s):
            score += 2.0
        # Prefer sentences with key markers
        if any(w in s.lower() for w in ["important", "key", "main", "critical", "significant", "primary"]):
            score += 1.0
        # Slightly prefer longer sentences (more content)
        score += min(len(s) / 200, 1.0)

        scored.append((score, s))

    # Sort by score, take top N
    scored.sort(key=lambda x: x[0], reverse=True)
    points = [s for _, s in scored[:max_points]]

    # Return minimum 3 if available
    if len(points) < 3 and len(sentences) >= 3:
        # Fallback: take first 3 non-trivial sentences
        fallback = [s.strip() for s in sentences if len(s.strip()) > 40][:3]
        return fallback or points

    return points
