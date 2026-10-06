# app/services/parsing/audio_parser.py
# Audio transcription via Groq Whisper API — api_operation_mapping.html
# "Groq offers whisper-large-v3-turbo via API. No local model download.
#  Free on Groq free tier. Much better than running faster-whisper locally."
from __future__ import annotations
import io
import logging
import os
import tempfile
from typing import List

from app.services.parsing.pdf import ParsedItem

logger = logging.getLogger(__name__)


class AudioParser:
    """
    Transcribe audio/video using Groq's whisper-large-v3-turbo API.
    Free, no local RAM, no local model download.
    api_operation_mapping: groq.audio.transcriptions.create()
    """

    def parse(self, file_bytes: bytes) -> List[ParsedItem]:
        if not file_bytes:
            raise ValueError("Empty file bytes")

        from app.config import settings
        if not settings.GROQ_API_KEY:
            return [ParsedItem(
                page_num=1, content_type="text",
                text="[Audio transcription unavailable — add GROQ_API_KEY to backend/.env]",
            )]

        tmp_path = None
        try:
            # Groq SDK requires a file-like object with a name
            suffix = ".mp3"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)

            with open(tmp_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json",  # includes segments
                    language="en",
                )

            # Split into 60-second chunks
            items: List[ParsedItem] = []
            if hasattr(transcript, "segments") and transcript.segments:
                chapter_buffer: list[str] = []
                chapter_num = 1
                chapter_start = 0.0

                for seg in transcript.segments:
                    chapter_buffer.append(seg.text.strip())
                    if seg.end - chapter_start > 60:
                        text = " ".join(chapter_buffer).strip()
                        if text:
                            items.append(ParsedItem(
                                page_num=chapter_num,
                                content_type="text",
                                text=text,
                            ))
                        chapter_num += 1
                        chapter_buffer = []
                        chapter_start = seg.end

                if chapter_buffer:
                    text = " ".join(chapter_buffer).strip()
                    if text:
                        items.append(ParsedItem(
                            page_num=chapter_num,
                            content_type="text",
                            text=text,
                        ))
            else:
                # Fallback: full text as one chunk
                full_text = getattr(transcript, "text", "") or ""
                if full_text:
                    items.append(ParsedItem(
                        page_num=1, content_type="text", text=full_text
                    ))

            if not items:
                raise RuntimeError("Groq Whisper returned no transcription")

            logger.info(f"[AudioParser] Transcribed → {len(items)} segments via Groq Whisper")
            return items

        except Exception as e:
            raise RuntimeError(f"Audio transcription failed: {e}") from e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
