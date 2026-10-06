# app/services/storage_utils.py
# Central Supabase Storage helper — used by ALL modules.
# Single source of truth for bucket name. Never hardcode "documents" anywhere else.
# Reads STORAGE_BUCKET from config (set in .env) — no runtime Supabase API call needed.
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_bucket_name() -> str:
    """
    Return the Supabase Storage bucket name from config.
    Set STORAGE_BUCKET in .env — defaults to 'Documents'.
    This eliminates all hardcoded bucket name strings across the codebase.
    """
    from app.config import settings
    return settings.STORAGE_BUCKET


def storage_from(sb):
    """
    Shorthand: returns sb.storage.from_(correct_bucket_name).
    Usage:
        storage_from(sb).download(path)
        storage_from(sb).upload(path, file, ...)
        storage_from(sb).remove([path])
        storage_from(sb).create_signed_url(path, expires_in=3600)
    """
    return sb.storage.from_(get_bucket_name())


def get_storage_http_url() -> str:
    """
    Returns the base Supabase Storage REST URL for direct HTTP uploads.
    Used for files >5MB to bypass the SDK 6MB limit.
    Format: {SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}
    """
    from app.config import settings
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.STORAGE_BUCKET}"
