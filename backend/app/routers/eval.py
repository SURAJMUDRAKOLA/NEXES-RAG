"""
app/routers/eval.py
Feedback + stats — uses Supabase REST API (HTTPS)
"""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user, get_db

router = APIRouter()


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: int  # 1 = thumbs up, -1 = thumbs down


@router.post("/eval/feedback")
async def submit_feedback(
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Submit thumbs up/down — Rule 2: verifies message belongs to user."""
    user_id = str(current_user["id"])

    if body.feedback not in (1, -1):
        raise HTTPException(400, "Feedback must be 1 or -1")

    result = await asyncio.to_thread(
        lambda: db._sb.table("messages")
        .update({"feedback": body.feedback})
        .eq("id", body.message_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Message not found")

    return {"status": "ok", "message_id": body.message_id, "feedback": body.feedback}


@router.get("/eval/stats")
async def get_eval_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Feedback statistics for the current user."""
    user_id = str(current_user["id"])

    result = await asyncio.to_thread(
        lambda: db._sb.table("messages")
        .select("feedback, latency_ms, role")
        .eq("user_id", user_id)
        .execute()
    )
    rows = result.data or []

    thumbs_up = sum(1 for r in rows if r.get("feedback") == 1)
    thumbs_down = sum(1 for r in rows if r.get("feedback") == -1)
    assistant_rows = [r for r in rows if r.get("role") == "assistant"]
    latencies = [r["latency_ms"] for r in assistant_rows if r.get("latency_ms")]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0

    return {
        "thumbs_up": thumbs_up,
        "thumbs_down": thumbs_down,
        "unrated": sum(1 for r in rows if r.get("feedback") is None and r.get("role") == "assistant"),
        "total_responses": len(assistant_rows),
        "avg_latency_ms": avg_latency,
        "satisfaction_rate": (
            round(thumbs_up / (thumbs_up + thumbs_down) * 100, 1)
            if thumbs_up + thumbs_down > 0 else None
        ),
    }
