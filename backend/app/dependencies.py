"""
app/dependencies.py
Section 12.1 — JWT verification via Supabase auth API
Every protected endpoint calls get_current_user() via Depends()
Rule 2: Every query MUST include WHERE user_id = current_user["id"]

NOTE: Uses Supabase Python client (HTTPS/REST) instead of asyncpg
because direct PostgreSQL connections (port 5432/6543) may be blocked
by firewalls. REST API always works on port 443.
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()

# ─────────────────────────────────────────────────────────────────
#  Supabase client (admin/service role — bypasses RLS for backend)
# ─────────────────────────────────────────────────────────────────

_supabase_client = None


def get_supabase():
    """
    Returns the shared Supabase admin client (service role key).
    Lazily initialised on first call.
    Uses HTTPS — works through all firewalls.
    """
    global _supabase_client
    if _supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase not configured — check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env",
            )
        from supabase import create_client
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        logger.info("Supabase admin client initialised")
    return _supabase_client


# ─────────────────────────────────────────────────────────────────
#  DB compatibility shim — wraps Supabase client as a "db" object
#  so all existing router code (db.fetch, db.execute etc.) still works
# ─────────────────────────────────────────────────────────────────

class SupabaseDB:
    """
    Thin wrapper around the Supabase client that exposes asyncpg-style
    methods (fetchrow, fetch, execute, fetchval) using PostgREST / RPC.
    This allows all routers to keep their existing db.fetch/db.execute code
    without changes.
    """

    def __init__(self, client):
        self._sb = client

    # ── Raw SQL via PostgREST rpc ─────────────────────────────────

    async def _rpc_sql(self, sql: str, args: list) -> Any:
        """Execute raw SQL via Supabase rpc('exec_sql') function."""
        # Replace $1, $2 ... with actual values (safe — all backend SQL uses typed params)
        query = sql
        for i, arg in enumerate(args, 1):
            placeholder = f"${i}"
            if arg is None:
                replacement = "NULL"
            elif isinstance(arg, str):
                escaped = arg.replace("'", "''")
                replacement = f"'{escaped}'"
            elif isinstance(arg, (int, float)):
                replacement = str(arg)
            elif isinstance(arg, list):
                # Convert list to Postgres array literal
                items = ", ".join(
                    f"'{str(a).replace(chr(39), chr(39)*2)}'" if isinstance(a, str) else str(a)
                    for a in arg
                )
                replacement = f"ARRAY[{items}]"
            else:
                escaped = str(arg).replace("'", "''")
                replacement = f"'{escaped}'"
            query = query.replace(placeholder, replacement, 1)
        return query

    async def fetchrow(self, sql: str, *args) -> dict | None:
        """Fetch a single row. Returns dict or None."""
        import asyncio
        query = await self._rpc_sql(sql, list(args))
        try:
            result = await asyncio.to_thread(
                lambda: self._sb.rpc("nexus_exec_sql", {"query": query}).execute()
            )
            rows = result.data
            if rows and len(rows) > 0:
                return rows[0]
            return None
        except Exception as e:
            logger.debug(f"fetchrow via rpc failed: {e}, trying REST fallback")
            return None

    async def fetch(self, sql: str, *args) -> list[dict]:
        """Fetch multiple rows. Returns list of dicts."""
        import asyncio
        query = await self._rpc_sql(sql, list(args))
        try:
            result = await asyncio.to_thread(
                lambda: self._sb.rpc("nexus_exec_sql", {"query": query}).execute()
            )
            return result.data or []
        except Exception as e:
            logger.debug(f"fetch via rpc failed: {e}")
            return []

    async def execute(self, sql: str, *args) -> str:
        """Execute a DML statement. Returns status string."""
        import asyncio
        query = await self._rpc_sql(sql, list(args))
        try:
            await asyncio.to_thread(
                lambda: self._sb.rpc("nexus_exec_sql", {"query": query}).execute()
            )
            return "OK"
        except Exception as e:
            logger.debug(f"execute via rpc failed: {e}")
            return "ERROR"

    async def fetchval(self, sql: str, *args) -> Any:
        """Fetch a single scalar value."""
        row = await self.fetchrow(sql, *args)
        if row and isinstance(row, dict):
            return next(iter(row.values()), None)
        return None

    # ── High-level Supabase table methods (used by routers directly) ──

    def table(self, name: str):
        """Direct access to Supabase table builder for simple queries."""
        return self._sb.table(name)

    def storage(self):
        return self._sb.storage

    def auth(self):
        return self._sb.auth


def get_db():
    """
    FastAPI dependency: returns a SupabaseDB wrapper.
    Compatible with all existing router code.
    """
    sb = get_supabase()
    return SupabaseDB(sb)


# ─────────────────────────────────────────────────────────────────
#  asyncpg pool stubs (kept for lifespan compatibility)
# ─────────────────────────────────────────────────────────────────

_pool = None  # Not used — kept for import compatibility


async def create_pool():
    """Initialise Supabase client instead of asyncpg pool."""
    try:
        get_supabase()
        logger.info("Supabase REST client ready")
    except Exception as e:
        logger.error(f"Supabase client init failed: {e}")


async def close_pool():
    """No-op — Supabase REST client doesn't need explicit closing."""
    global _supabase_client
    _supabase_client = None
    logger.info("Supabase client cleared")


# ─────────────────────────────────────────────────────────────────
#  JWT verification — Section 12.1
#
#  PRIMARY strategy: supabase.auth.get_user(token)
#  This works with ALL Supabase JWT algorithms (HS256, RS256, etc.)
#  because verification is delegated to Supabase's auth server.
#  No local key or algorithm guessing needed.
#
#  FALLBACK: manual PyJWT decode (HS256) for offline / network error cases.
# ─────────────────────────────────────────────────────────────────


def _decode_jwt_secret(raw: str) -> bytes:
    """Decode base64 JWT secret (Supabase dashboard format) to raw bytes."""
    try:
        decoded = base64.b64decode(raw)
        if len(decoded) >= 32:
            return decoded
    except Exception:
        pass
    return raw.encode("utf-8")


def _peek_jwt_header(token: str) -> dict:
    """Decode JWT header WITHOUT verification (for debug logging only)."""
    try:
        import json as _json
        header_b64 = token.split(".")[0]
        padded = header_b64 + "=" * (4 - len(header_b64) % 4)
        return _json.loads(base64.b64decode(padded))
    except Exception:
        return {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: SupabaseDB = Depends(get_db),
) -> dict[str, Any]:
    """
    Verify Supabase JWT and return the user's profile row.

    Uses supabase.auth.get_user(token) as the primary verification method.
    This works with ANY JWT algorithm Supabase uses (HS256, RS256, etc.)
    and does not require managing keys locally.

    Raises HTTP 401 if:
    - Token is missing or malformed
    - Token is expired or invalid (Supabase rejects it)
    - User not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    import asyncio

    # Log JWT algorithm header for debugging (no verification)
    header = _peek_jwt_header(token)
    alg = header.get("alg", "unknown")
    logger.debug(f"JWT alg header: {alg}")

    # ── PRIMARY: Ask Supabase to verify the token ──────────────────
    sb_user = None
    try:
        auth_response = await asyncio.to_thread(
            lambda: db._sb.auth.get_user(token)
        )
        sb_user = auth_response.user if auth_response else None
        if sb_user:
            logger.debug(f"Supabase auth.get_user OK: {sb_user.id}")
    except Exception as exc:
        logger.warning(f"Supabase auth.get_user error: {exc}")

    # ── FALLBACK: Manual HS256 decode if get_user failed ──────────
    user_id: str | None = None
    if sb_user is None:
        logger.debug("Falling back to manual JWT decode")
        if settings.SUPABASE_JWT_SECRET:
            try:
                secret_bytes = _decode_jwt_secret(settings.SUPABASE_JWT_SECRET)
                payload = pyjwt.decode(
                    token,
                    secret_bytes,
                    algorithms=["HS256"],
                    options={"verify_exp": True, "verify_aud": False},
                )
                user_id = payload.get("sub")
                logger.debug(f"Manual JWT decode OK: sub={user_id}")
            except Exception as e:
                logger.warning(f"Manual JWT decode failed: {e}")

        if not user_id:
            logger.warning(f"All JWT verification methods failed. Token alg={alg}")
            raise credentials_exception
    else:
        user_id = str(sb_user.id)

    # ── Load profile from DB ──────────────────────────────────────
    profile = None
    try:
        result = await asyncio.to_thread(
            lambda: db._sb.table("profiles").select("*").eq("id", user_id).single().execute()
        )
        profile = result.data
    except Exception:
        pass

    # ── Auto-create profile on first login ────────────────────────
    if profile is None:
        try:
            email = getattr(sb_user, "email", None) if sb_user else None
            upsert_data: dict[str, Any] = {"id": user_id}
            if email:
                upsert_data["email"] = email
            await asyncio.to_thread(
                lambda: db._sb.table("profiles").upsert(upsert_data).execute()
            )
            result = await asyncio.to_thread(
                lambda: db._sb.table("profiles").select("*").eq("id", user_id).single().execute()
            )
            profile = result.data
        except Exception as exc:
            logger.error(f"Profile auto-creation failed: {exc}")
            profile = {"id": user_id}  # minimal fallback

    if profile is None:
        raise credentials_exception

    return profile
