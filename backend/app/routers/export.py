"""
app/routers/export.py
Export chat session as PDF — uses Supabase REST (HTTPS)
Section 11.1
"""
from __future__ import annotations

import asyncio
import logging
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user, get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sessions/{session_id}/export/pdf")
async def export_session_pdf(
    session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Export full chat session as a formatted PDF with sources."""
    user_id = str(current_user["id"])

    # Load session — Rule 2: verify ownership
    sess_result = await asyncio.to_thread(
        lambda: db._sb.table("sessions")
        .select("title, created_at")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not sess_result.data:
        raise HTTPException(404, "Session not found")

    session = sess_result.data

    # Load messages
    msg_result = await asyncio.to_thread(
        lambda: db._sb.table("messages")
        .select("role, content, sources, model_used, latency_ms, created_at")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    messages = msg_result.data or []

    if not messages:
        raise HTTPException(404, "No messages to export")

    # Build PDF
    pdf_bytes = _build_pdf(session, messages)

    safe_title = "".join(
        c for c in (session.get("title") or "session") if c.isalnum() or c in " -_"
    ).strip()[:40] or "chat"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


def _build_pdf(session: dict, messages: list) -> bytes:
    """Generate PDF using ReportLab with graceful plain-text fallback."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer,
            HRFlowable, Table, TableStyle,
        )

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2 * cm,
        )
        styles = getSampleStyleSheet()
        accent = colors.HexColor("#6c63ff")

        title_style = ParagraphStyle(
            "Title", parent=styles["Title"],
            textColor=accent, fontSize=18, spaceAfter=6,
        )
        meta_style = ParagraphStyle(
            "Meta", parent=styles["Normal"],
            textColor=colors.grey, fontSize=8, spaceAfter=12,
        )
        user_style = ParagraphStyle(
            "User", parent=styles["Normal"],
            backColor=colors.HexColor("#1a1a2e"),
            textColor=colors.HexColor("#e0e0e0"),
            borderPadding=(6, 8, 6, 8),
            fontSize=10, spaceAfter=4, leading=14,
        )
        bot_style = ParagraphStyle(
            "Bot", parent=styles["Normal"],
            textColor=colors.black,
            fontSize=10, spaceAfter=8, leading=14,
        )
        source_style = ParagraphStyle(
            "Source", parent=styles["Normal"],
            textColor=colors.HexColor("#6c63ff"),
            fontSize=8, leftIndent=12,
        )

        story = [
            Paragraph(f"Chat Export: {session.get('title', 'Session')}", title_style),
            Paragraph(f"Exported from NEXUS Universal RAG Assistant  •  {session.get('created_at', '')[:10]}", meta_style),
            HRFlowable(width="100%", thickness=1, color=accent),
            Spacer(1, 0.3 * cm),
        ]

        for msg in messages:
            role = msg.get("role", "")
            content = (msg.get("content") or "").strip()
            if not content:
                continue

            content_safe = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

            if role == "user":
                story.append(Paragraph(f"<b>You:</b> {content_safe}", user_style))
            elif role == "assistant":
                model = msg.get("model_used", "")
                latency = msg.get("latency_ms")
                label = f"<b>NEXUS</b>"
                if model:
                    label += f' <font size="7" color="grey">({model})</font>'
                if latency:
                    label += f' <font size="7" color="grey">[{latency}ms]</font>'
                story.append(Paragraph(label, bot_style))
                story.append(Paragraph(content_safe, bot_style))

                # Emit citations
                sources = msg.get("sources") or []
                if sources and isinstance(sources, list):
                    for i, src in enumerate(sources[:5], 1):
                        src_name = src.get("doc_name", "Source") if isinstance(src, dict) else str(src)
                        page = src.get("page_num", "") if isinstance(src, dict) else ""
                        page_str = f" p.{page}" if page else ""
                        story.append(Paragraph(f"[{i}] {src_name}{page_str}", source_style))

            story.append(Spacer(1, 0.15 * cm))

        story.append(Spacer(1, 0.5 * cm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("Generated by NEXUS Universal RAG Assistant", meta_style))

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        # Plain-text PDF fallback (no reportlab)
        lines = [f"NEXUS Chat Export: {session.get('title', 'Session')}\n\n"]
        for msg in messages:
            role = msg.get("role", "").upper()
            content = msg.get("content", "").strip()
            lines.append(f"[{role}]\n{content}\n\n")
        text = "".join(lines)
        return text.encode("utf-8")
