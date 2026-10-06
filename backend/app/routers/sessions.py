"""
app/routers/sessions.py
Chat session CRUD — using Supabase REST API (HTTPS, no asyncpg needed)
Rule 2: ALL queries filter by user_id
"""
from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user, get_db

router = APIRouter()


class SessionCreate(BaseModel):
    title: str = "New Session"
    doc_ids: Optional[List[str]] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    doc_ids: Optional[List[str]] = None


@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List all sessions ordered by last_active DESC — Rule 2."""
    import asyncio
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("last_active", desc=True)
        .limit(100)
        .execute()
    )
    return {"sessions": result.data or []}


@router.post("/sessions", status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new chat session."""
    import asyncio
    user_id = str(current_user["id"])
    session_id = str(uuid.uuid4())
    record = {
        "id": session_id,
        "user_id": user_id,
        "title": body.title or "New Session",
        "doc_ids": body.doc_ids or [],
    }
    result = await asyncio.to_thread(
        lambda: db._sb.table("sessions").insert(record).execute()
    )
    if result.data:
        return result.data[0]
    raise HTTPException(500, "Failed to create session")


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get a single session — Rule 2: verify ownership."""
    import asyncio
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Session not found")
    return result.data


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: str,
    body: SessionUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update session title or doc_ids — Rule 2: verify ownership."""
    import asyncio
    user_id = str(current_user["id"])

    updates = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.doc_ids is not None:
        updates["doc_ids"] = body.doc_ids
    if not updates:
        raise HTTPException(400, "Nothing to update")

    result = await asyncio.to_thread(
        lambda: db._sb.table("sessions")
        .update(updates)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Session not found")
    return result.data[0]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete session + all messages (CASCADE) — Rule 2."""
    import asyncio
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Session not found")
    return {"deleted": True, "id": session_id}
