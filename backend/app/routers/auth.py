"""
app/routers/auth.py
Auth + Profile endpoints — uses Supabase REST API (HTTPS)
"""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.dependencies import get_current_user, get_db

router = APIRouter()


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    ai_provider: Optional[str] = None
    llm_model: Optional[str] = None
    embed_model: Optional[str] = None
    monthly_token_budget: Optional[int] = None


@router.post("/auth/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify Supabase JWT and return user profile. Called on frontend startup."""
    return {
        "id": str(current_user.get("id", "")),
        "display_name": current_user.get("display_name"),
        "ai_provider": current_user.get("ai_provider", "groq"),
        "llm_model": current_user.get("llm_model", "groq/llama-3.3-70b-versatile"),
        "embed_model": current_user.get("embed_model", "gemini-embedding-001"),
        "monthly_token_budget": current_user.get("monthly_token_budget", 500000),
        "tokens_used_this_month": current_user.get("tokens_used_this_month", 0),
        "created_at": str(current_user.get("created_at", "")),
    }


@router.get("/auth/profile")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get the authenticated user's full profile."""
    user_id = str(current_user["id"])
    result = await asyncio.to_thread(
        lambda: db._sb.table("profiles").select("*").eq("id", user_id).single().execute()
    )
    if not result.data:
        raise HTTPException(404, "Profile not found")
    return result.data


@router.patch("/auth/profile")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update user profile settings — Rule 2: only own profile."""
    user_id = str(current_user["id"])

    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.ai_provider is not None:
        updates["ai_provider"] = body.ai_provider
    if body.llm_model is not None:
        updates["llm_model"] = body.llm_model
    if body.embed_model is not None:
        updates["embed_model"] = body.embed_model
    if body.monthly_token_budget is not None:
        if body.monthly_token_budget < 0:
            raise HTTPException(400, "Budget must be >= 0")
        updates["monthly_token_budget"] = body.monthly_token_budget

    if not updates:
        raise HTTPException(400, "Nothing to update")

    result = await asyncio.to_thread(
        lambda: db._sb.table("profiles").update(updates).eq("id", user_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Profile not found")
    return result.data[0]
