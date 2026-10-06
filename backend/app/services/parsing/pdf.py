# app/services/parsing/pdf.py
# PyMuPDF primary parser + pdfplumber fallback
from __future__ import annotations
import io
import logging
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ParsedItem:
    page_num: int
    content_type: str          # 'text' | 'table' | 'image'
    text: str = ""
    title: str = ""
    body: str = ""
    caption: str = ""
    markdown_text: str = ""
    slide_num: Optional[int] = None
    bbox: Optional[dict] = None


class PDFParser:
    """PyMuPDF (fitz) primary — pdfplumber fallback for scanned PDFs."""

    def parse(self, file_bytes: bytes) -> List[ParsedItem]:
        if not file_bytes:
            raise ValueError("Empty file bytes")
        try:
            return self._parse_pymupdf(file_bytes)
        except Exception as e:
            logger.warning(f"PyMuPDF failed ({e}), trying pdfplumber")
            try:
                return self._parse_pdfplumber(file_bytes)
            except Exception as e2:
                raise RuntimeError(f"Both PDF parsers failed: {e2}") from e2

    def _parse_pymupdf(self, file_bytes: bytes) -> List[ParsedItem]:
        import fitz  # pymupdf
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        items: List[ParsedItem] = []
        for page in doc:
            page_num = page.number + 1
            blocks = page.get_text("dict")["blocks"]
            page_text_parts = []
            for block in blocks:
                if block["type"] == 0:  # text
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            t = span.get("text", "").strip()
                            if t:
                                page_text_parts.append(t)
            text = " ".join(page_text_parts).strip()
            if text:
                items.append(ParsedItem(
                    page_num=page_num,
                    content_type="text",
                    text=text,
                ))
        doc.close()
        if not items:
            raise RuntimeError("No text extracted by PyMuPDF")
        logger.info(f"[PDFParser] PyMuPDF: {len(items)} pages")
        return items

    def _parse_pdfplumber(self, file_bytes: bytes) -> List[ParsedItem]:
        import pdfplumber
        items: List[ParsedItem] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_num = page.page_number
                text = (page.extract_text() or "").strip()
                # Extract tables
                for table in (page.extract_tables() or []):
                    if table:
                        rows = [" | ".join(str(c) for c in row if c) for row in table if any(row)]
                        md = "\n".join(rows)
                        if md.strip():
                            items.append(ParsedItem(
                                page_num=page_num,
                                content_type="table",
                                text=md,
                                markdown_text=md,
                            ))
                if text:
                    items.append(ParsedItem(page_num=page_num, content_type="text", text=text))
        if not items:
            raise RuntimeError("pdfplumber extracted no content")
        logger.info(f"[PDFParser] pdfplumber: {len(items)} items")
        return items
