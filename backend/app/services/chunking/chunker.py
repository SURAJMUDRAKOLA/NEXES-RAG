"""
app/services/chunking/chunker.py
Section 7.2 — Strategy pattern chunker
Per-doc-type chunk sizes from blueprint: pdf=512/100, pptx=1024/0, etc.
Tables: never split. Images: caption-as-chunk.
Tiny chunk merging: < 30 words merged with next chunk.
"""
from __future__ import annotations

import dataclasses
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
#  ChunkData — output unit of chunking pipeline
# ─────────────────────────────────────────────────────────────────

@dataclasses.dataclass
class ChunkData:
    content: str                          # original text (shown to user — Rule 5)
    modality: str = "text"                # 'text'|'table'|'image'|'audio'
    chunk_type: str = "body"              # 'body'|'table'|'summary'|'caption'
    chunk_index: int = 0
    page_num: Optional[int] = None
    slide_num: Optional[int] = None
    bbox: Optional[dict] = None           # {x, y, w, h} for PDF highlight
    token_count: Optional[int] = None

    # Populated by contextual.py enrichment stage
    enriched_text: Optional[str] = None  # NEVER shown to user — only for embedding
    content_hash: Optional[str] = None   # SHA-256 of enriched_text
    embedding: Optional[list[float]] = None


# ─────────────────────────────────────────────────────────────────
#  Chunk configuration per document type — Section 7.2
# ─────────────────────────────────────────────────────────────────

CHUNK_CONFIG: dict[str, dict] = {
    "pdf":   {"chunk_size": 512,  "overlap": 100},
    "pptx":  {"chunk_size": 1024, "overlap": 0},    # 1 slide = 1 chunk
    "docx":  {"chunk_size": 512,  "overlap": 100},
    "image": {"chunk_size": 2048, "overlap": 0},    # caption = 1 chunk
    "audio": {"chunk_size": 768,  "overlap": 50},   # by chapter/timestamp
    "xlsx":  {"chunk_size": 1024, "overlap": 0},    # 1 table = 1 chunk
}

TINY_CHUNK_THRESHOLD = 30  # words — merge if below this


def _count_words(text: str) -> int:
    return len(text.split())


def _llama_sentence_split(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Recursive sentence splitter using llama_index SentenceSplitter.
    Preserves sentence boundaries — no mid-sentence cuts.
    """
    try:
        from llama_index.core.node_parser import SentenceSplitter
        splitter = SentenceSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            tokenizer=None,  # uses word count as approximation
        )
        return splitter.split_text(text)
    except Exception:
        # Fallback: naive word-count chunking
        words = text.split()
        chunks = []
        step = max(1, chunk_size - overlap)
        for i in range(0, len(words), step):
            chunk = " ".join(words[i : i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        return chunks


# ─────────────────────────────────────────────────────────────────
#  Main chunking function — Section 7.2
# ─────────────────────────────────────────────────────────────────

def _item_get(item, key: str, default=None):
    """Work with both dict items and ParsedItem dataclass objects."""
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def chunk_document(raw_content, doc_type: str) -> list[ChunkData]:
    """
    Apply type-appropriate chunking strategy to parsed document content.

    raw_content items can be either dicts OR ParsedItem dataclass objects.
        content_type: 'text'|'table'|'image'
        text: str
        page_num: int
        slide_num: int (pptx only)
        title: str (pptx only)
        body: str (pptx only)
        caption: str (image only)
        bbox: dict (pdf only)

    Returns:
        List[ChunkData] with chunk_index populated sequentially
    """
    config = CHUNK_CONFIG.get(doc_type, {"chunk_size": 512, "overlap": 100})
    chunks: list[ChunkData] = []
    carry_text = ""  # for merging tiny chunks

    for item in raw_content:
        content_type = _item_get(item, "content_type", "text")

        # ── TABLE: never split — one chunk for the whole table ──
        if content_type == "table":
            text = _item_get(item, "text", "")
            if carry_text:
                text = carry_text + "\n" + text
                carry_text = ""
            if text.strip():
                chunks.append(ChunkData(
                    content=text,
                    modality="table",
                    chunk_type="table",
                    page_num=_item_get(item, "page_num"),
                    bbox=_item_get(item, "bbox"),
                    chunk_index=len(chunks),
                ))

        # ── IMAGE: caption becomes the chunk ──
        elif content_type == "image":
            caption = _item_get(item, "caption") or _item_get(item, "text", "")
            if caption.strip():
                chunks.append(ChunkData(
                    content=caption,
                    modality="image",
                    chunk_type="caption",
                    page_num=_item_get(item, "page_num"),
                    chunk_index=len(chunks),
                ))

        # ── PPTX: one chunk per slide, title prepended ──
        elif doc_type == "pptx":
            slide_num = _item_get(item, "slide_num", 0)
            title = _item_get(item, "title", "")
            body = _item_get(item, "body") or _item_get(item, "text", "")
            text = f"Slide {slide_num}: {title}\n{body}".strip()
            if text:
                chunks.append(ChunkData(
                    content=text,
                    modality="text",
                    chunk_type="body",
                    slide_num=slide_num,
                    page_num=slide_num,          # same as slide_num — used for page_count
                    token_count=len(text.split()),
                    chunk_index=len(chunks),
                ))

        # ── PROSE (pdf, docx, audio, xlsx body text) ──
        else:
            raw_text = (carry_text + " " + _item_get(item, "text", "")).strip()
            carry_text = ""

            if not raw_text:
                continue

            splits = _llama_sentence_split(
                raw_text,
                chunk_size=config["chunk_size"],
                overlap=config["overlap"],
            )

            # Merge tiny chunks with the next one
            merged_splits: list[str] = []
            pending = ""
            for split in splits:
                combined = (pending + " " + split).strip() if pending else split
                if _count_words(combined) < TINY_CHUNK_THRESHOLD:
                    pending = combined  # accumulate
                else:
                    if pending:
                        merged_splits.append(pending)
                    pending = split

            if pending:
                # Last pending chunk — append to last merged or add alone
                if merged_splits:
                    merged_splits[-1] = merged_splits[-1] + " " + pending
                else:
                    merged_splits.append(pending)

            for split in merged_splits:
                if split.strip():
                    chunks.append(ChunkData(
                        content=split.strip(),
                        modality="text",
                        chunk_type="body",
                        page_num=_item_get(item, "page_num"),
                        bbox=_item_get(item, "bbox"),
                        chunk_index=len(chunks),
                    ))

    return chunks
