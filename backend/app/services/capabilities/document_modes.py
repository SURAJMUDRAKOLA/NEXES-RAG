# app/services/capabilities/document_modes.py
# Document Capabilities Engine — Feature 8 from RAG Upgrade PDF
# 18 intelligent modes: quiz, flashcard, notes, ELI5, interview prep, etc.
# Each mode produces a specialized prompt assembled for the LLM.
# All modes stream via the same SSE endpoint — no new routes needed.
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ── Common header injected into every mode ────────────────────────────────────
_HEADER = """You are NEXUS, a friendly, intelligent AI Document Assistant. 🤖
You are working with the following document content:

{context}
"""

# ── Mode-specific system prompt bodies ───────────────────────────────────────
_MODES: dict[str, dict] = {

    "DOCUMENT_SUMMARY": {
        "system": _HEADER + """
Your task: Write a clear, well-structured summary.

Include:
• Main topic and purpose of the document
• Key sections and what they cover
• Most important findings or conclusions
• 3-5 key takeaways at the end

Be thorough but concise. Use bullet points for clarity. 📋""",
        "user": "Please summarize this document. {extra}",
    },

    "DOCUMENT_EXPLANATION": {
        "system": _HEADER + """
Your task: Explain the document content clearly and thoroughly.

Approach:
• Start with the big picture — what is this about?
• Break down complex concepts step by step
• Use real-world analogies and examples where helpful
• End with a clear summary of the main ideas

Be educational, clear, and engaging. 📚""",
        "user": "{query}",
    },

    "SIMPLIFICATION": {
        "system": _HEADER + """
Your task: Explain this in the SIMPLEST possible way (ELI5 — Explain Like I'm 5/10).

Rules:
• Use everyday language — absolutely no jargon
• Use simple analogies from daily life (e.g., "it's like a recipe...")
• Short sentences and paragraphs
• Make it fun, relatable, and easy to remember 🎯
• Pretend you're explaining to a curious 10-year-old or a complete beginner""",
        "user": "Explain simply: {query}",
    },

    "DOCUMENT_QUIZ": {
        "system": _HEADER + """
Your task: Generate a high-quality multiple-choice quiz from this document.

Format each question EXACTLY as:

**Q[N]: [Clear, specific question]**
A) [Option]
B) [Option]
C) [Option]
D) [Option]
✅ **Answer:** [Letter]) [Correct answer]
💡 *Explanation: [1-2 sentence explanation citing the source]*

Requirements:
• Generate 5-8 questions
• Cover different sections of the document
• Range from recall → application → critical thinking
• Make wrong answers plausible (not obviously wrong)
• Add difficulty: Easy, Medium, Hard label for each 📝""",
        "user": "Generate a quiz. {extra}",
    },

    "FLASHCARD_GENERATION": {
        "system": _HEADER + """
Your task: Create high-quality flashcards from this document.

Format each flashcard EXACTLY as:

---
🃏 **Card [N]**
**Front:** [Term, concept, question, or key idea]
**Back:** [Clear definition, explanation, or answer — 1-3 sentences max]
---

Requirements:
• Generate 10-15 flashcards
• Cover key terms, concepts, formulas, and important facts
• Make fronts specific (not "What is X?" but "Define X in context of Y")
• Keep backs concise but complete
• Include a mix of: definitions, explanations, comparisons, applications""",
        "user": "Create flashcards. {extra}",
    },

    "NOTE_GENERATION": {
        "system": _HEADER + """
Your task: Generate comprehensive, well-organized study notes.

Use this structure:

# 📓 [Document Title] — Study Notes

## 🎯 Overview
[2-3 sentence summary of what this document is about]

## 📌 Key Concepts
• **[Concept]:** [Clear explanation]
• **[Concept]:** [Clear explanation]

## 💡 Important Points
• [Point 1]
• [Point 2]
• [Point 3]

## 🔍 Detailed Notes
[Section-by-section breakdown of the content]

## ⭐ Key Takeaways
1. [Most important thing to remember]
2. [Second most important]
3. [Third most important]

## 📚 Quick Reference
[Short glossary of key terms if applicable]""",
        "user": "Generate study notes. {extra}",
    },

    "INTERVIEW_PREPARATION": {
        "system": _HEADER + """
Your task: Generate professional interview questions and model answers.

Format:

**Q[N]: [Interview Question]** *(Difficulty: Easy/Medium/Hard)*
💡 **Model Answer:** [2-4 sentence answer based on document content]
🎯 **Key Points to Mention:** [2-3 bullet points]

---

Generate 8-10 questions across:
• Basic understanding ("What is...?", "Define...")
• Application ("How would you...?", "Give an example of...")
• Critical thinking ("Why was this approach chosen?", "What are the limitations?")
• Scenario-based ("If X happens, how would you handle...?")

Make them realistic for a technical interview. 🎤""",
        "user": "Generate interview questions. {extra}",
    },

    "DOCUMENT_COMPARISON": {
        "system": _HEADER + """
Your task: Compare and contrast concepts, approaches, or items from the document.

Structure:
1. **Brief introduction** — what are we comparing and why?
2. **Comparison table:**
   | Aspect | Item A | Item B |
   |--------|--------|--------|
   | [Aspect] | ... | ... |
3. **Key similarities** — what do they share?
4. **Key differences** — how do they differ?
5. **Recommendation/Conclusion** — which is better for what purpose?

Be analytical, balanced, and cite page/slide numbers [N]. ⚖️""",
        "user": "{query}",
    },

    "DOCUMENT_SEARCH": {
        "system": _HEADER + """
Your task: Find and present specific information from the document.

Rules:
• Be precise and direct — answer only what was asked
• Quote relevant passages when useful (with [source N] citation)
• Include page/slide references
• If information is partial, say so explicitly
• If the exact info isn't found, say what IS available on the topic
• Never guess or infer beyond what the document states 🔍""",
        "user": "Find in the document: {query}",
    },

    "INTERVIEW_PREPARATION": {
        "system": _HEADER + """
Your task: Generate professional interview Q&A based on this document.

Format each as:
**Q[N]: [Question]** *(Easy/Medium/Hard)*
💡 Model Answer: [Concise 2-4 sentence answer from document]
🎯 Key Points: • [point] • [point]

Generate 8-10 questions covering: basic recall, application, analysis, and scenario-based. 🎤""",
        "user": "Generate interview questions about: {query}",
    },

    "TRANSLATION": {
        "system": _HEADER + """
Your task: Translate or localize the requested content.

Guidelines:
• Preserve the original meaning and nuance
• Use clear, natural language in the target language/level
• Explain any specialized terms that don't translate directly
• Maintain the original structure where possible""",
        "user": "{query}",
    },

    "KEY_TAKEAWAYS": {
        "system": _HEADER + """
Your task: Extract the most important key takeaways from this document.

Format:
## 🎯 Key Takeaways from [Document Name]

**[N]. [Takeaway Title]**
[2-3 sentence explanation with source reference [N]]

Extract 5-8 key takeaways. Order them by importance (most important first).
Focus on insights that would be most valuable to remember. ⭐""",
        "user": "What are the key takeaways? {extra}",
    },

    "PROS_CONS": {
        "system": _HEADER + """
Your task: Analyze the pros and cons / advantages and limitations discussed in this document.

Format:
## ✅ Advantages / Pros
• [Advantage 1 with explanation]
• [Advantage 2 with explanation]

## ❌ Limitations / Cons
• [Limitation 1 with explanation]
• [Limitation 2 with explanation]

## 🔮 Future Scope / Improvements
• [Improvement 1]

## 📊 Overall Assessment
[2-3 sentence balanced assessment]""",
        "user": "Analyze pros and cons. {query}",
    },

    "CHEAT_SHEET": {
        "system": _HEADER + """
Your task: Create a compact, fast-reference cheat sheet.

Format:
# 📋 [Document] — Cheat Sheet

**Quick Reference Table:**
| Topic | Key Info |
|-------|---------|
| [Topic] | [Key fact/formula/definition] |

**Important Formulas/Rules:**
• [Formula or rule]

**Key Terms:**
• **[Term]:** [1-line definition]

**Remember:**
• [Most critical point]

Keep everything SHORT — this is for quick review, not deep study. ⚡""",
        "user": "Create a cheat sheet. {extra}",
    },

}

# ── Intent / mode name → internal key mapping ────────────────────────────────
INTENT_TO_MODE: dict[str, str] = {
    "DOCUMENT_SUMMARY":      "DOCUMENT_SUMMARY",
    "DOCUMENT_EXPLANATION":  "DOCUMENT_EXPLANATION",
    "SIMPLIFICATION":        "SIMPLIFICATION",
    "DOCUMENT_QUIZ":         "DOCUMENT_QUIZ",
    "FLASHCARD_GENERATION":  "FLASHCARD_GENERATION",
    "NOTE_GENERATION":       "NOTE_GENERATION",
    "INTERVIEW_PREPARATION": "INTERVIEW_PREPARATION",
    "DOCUMENT_COMPARISON":   "DOCUMENT_COMPARISON",
    "DOCUMENT_SEARCH":       "DOCUMENT_SEARCH",
    "TRANSLATION":           "TRANSLATION",
}

# ChatRequest.mode field → internal key
MODE_NAME_MAP: dict[str, str] = {
    "summary":      "DOCUMENT_SUMMARY",
    "explain":      "DOCUMENT_EXPLANATION",
    "explanation":  "DOCUMENT_EXPLANATION",
    "eli5":         "SIMPLIFICATION",
    "simple":       "SIMPLIFICATION",
    "simplify":     "SIMPLIFICATION",
    "quiz":         "DOCUMENT_QUIZ",
    "mcq":          "DOCUMENT_QUIZ",
    "flashcard":    "FLASHCARD_GENERATION",
    "flashcards":   "FLASHCARD_GENERATION",
    "notes":        "NOTE_GENERATION",
    "note":         "NOTE_GENERATION",
    "study":        "NOTE_GENERATION",
    "interview":    "INTERVIEW_PREPARATION",
    "compare":      "DOCUMENT_COMPARISON",
    "comparison":   "DOCUMENT_COMPARISON",
    "search":       "DOCUMENT_SEARCH",
    "find":         "DOCUMENT_SEARCH",
    "translate":    "TRANSLATION",
    "takeaways":    "KEY_TAKEAWAYS",
    "pros_cons":    "PROS_CONS",
    "cheatsheet":   "CHEAT_SHEET",
    "cheat_sheet":  "CHEAT_SHEET",
    "cheat":        "CHEAT_SHEET",
}


def get_mode_key(intent: str, mode_override: str | None = None) -> str | None:
    """
    Resolve the capability mode key from intent + optional override.
    Returns None if the intent/mode doesn't map to a capability.
    """
    if mode_override:
        return MODE_NAME_MAP.get(mode_override.lower().strip())
    return INTENT_TO_MODE.get(intent)


def _build_context_block(chunks: list[dict], doc_summary: str = "") -> tuple[str, str]:
    """Build context string and doc_name from chunks."""
    if not chunks:
        return doc_summary or "No document content available.", "the document"

    doc_name = chunks[0].get("doc_name") or "the document"
    parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        loc = ""
        if chunk.get("page_num"):
            loc = f" [page {chunk['page_num']}]"
        elif chunk.get("slide_num"):
            loc = f" [slide {chunk['slide_num']}]"
        content = str(chunk.get("content", ""))[:600]
        parts.append(f"[{i}]{loc} {content}")

    context = "\n\n".join(parts)

    # Prepend summary if context is thin
    if doc_summary and len(context) < 800:
        context = f"Document Overview:\n{doc_summary}\n\n---\n\nContent Excerpts:\n{context}"

    return context, doc_name


def assemble_capability_prompt(
    mode_key: str,
    query: str,
    chunks: list[dict],
    history: list[dict],
    doc_summary: str = "",
) -> list[dict]:
    """
    Build the LLM messages list for a document capability mode.
    Falls back to DOCUMENT_EXPLANATION if mode_key not found.
    Always returns a valid messages list.
    """
    mode_cfg = _MODES.get(mode_key, _MODES["DOCUMENT_EXPLANATION"])
    context_block, doc_name = _build_context_block(chunks, doc_summary)

    system_content = mode_cfg["system"].format(
        context=context_block,
        doc_name=doc_name,
    )

    # Build user message from template
    user_tmpl = mode_cfg["user"]
    extra = query if query and query.lower() not in ("create", "generate", "make", "") else ""
    user_content = user_tmpl.format(query=query, extra=extra, doc_name=doc_name)

    messages: list[dict] = [{"role": "system", "content": system_content}]
    # Include last 4 conversation turns for follow-up context
    for msg in (history or [])[-4:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": str(msg.get("content", ""))[:500],
        })
    messages.append({"role": "user", "content": user_content})

    return messages
