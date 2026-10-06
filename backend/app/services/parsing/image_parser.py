# app/services/parsing/image_parser.py
# Image captioning via Groq LLaVA vision (free) — plan §3.2
# Uses Groq SDK directly — NO LiteLLM.
# Falls back to Pillow metadata if no API key or vision call fails.
from __future__ import annotations

import asyncio
import base64
import io
import logging
from typing import List

from app.services.parsing.pdf import ParsedItem

logger = logging.getLogger(__name__)


class ImageParser:
    """
    Caption images using Groq LLaVA vision model (free API).
    Falls back to Pillow metadata extraction if no Groq key.
    Plan §3.2: llama-3.2-11b-vision-preview
    """

    def parse(self, file_bytes: bytes) -> List[ParsedItem]:
        if not file_bytes:
            raise ValueError("Empty file bytes")
        caption = asyncio.run(self._caption_with_groq_vision(file_bytes))
        return [ParsedItem(
            page_num=1,
            content_type="image",
            text=caption,
            caption=caption,
        )]

    async def _caption_with_groq_vision(self, file_bytes: bytes) -> str:
        """Use Groq LLaVA to generate a detailed image caption via Groq SDK."""
        from app.config import settings
        if not settings.GROQ_API_KEY:
            logger.warning("[ImageParser] No GROQ_API_KEY — using Pillow fallback")
            return self._pillow_fallback(file_bytes)
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)

            # Detect image MIME type from magic bytes
            mime = "image/jpeg"
            if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
                mime = "image/png"
            elif file_bytes[:4] == b"GIF8":
                mime = "image/gif"

            b64 = base64.b64encode(file_bytes).decode("utf-8")

            resp = await client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Describe this image in detail for a knowledge retrieval system. "
                                "Include all visible text, charts, diagrams, tables, and visual elements."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64}"},
                        },
                    ],
                }],
                max_tokens=500,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"[ImageParser] Groq vision failed: {e} — using Pillow fallback")
            return self._pillow_fallback(file_bytes)

    def _pillow_fallback(self, file_bytes: bytes) -> str:
        """Extract basic image metadata when no vision API available."""
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            return (
                f"[Image: {img.format} format, {img.size[0]}x{img.size[1]} pixels, "
                f"mode={img.mode}. Add GROQ_API_KEY to enable AI captioning.]"
            )
        except Exception:
            return "[Image file — add GROQ_API_KEY to backend/.env for AI captioning]"
