# app/services/embedding/cache.py
# Redis SHA-256 embedding cache — graceful when Redis unavailable
from __future__ import annotations
import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)

PREFIX = f"embed:v1:{settings.EMBED_MODEL.replace('/', '_')}:"
TTL = 60 * 60 * 24 * 30  # 30 days

_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis
            _redis = redis.from_url(settings.REDIS_URL, decode_responses=False, socket_connect_timeout=2)
            _redis.ping()
        except Exception as e:
            logger.debug(f"Redis unavailable ({e}) — embedding cache disabled")
            _redis = False  # Mark as unavailable
    return _redis if _redis else None


def get_cached(h: str) -> list | None:
    r = _get_redis()
    if not r:
        return None
    try:
        d = r.get(PREFIX + h)
        return json.loads(d) if d else None
    except Exception:
        return None


def set_cached(h: str, vec: list) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.setex(PREFIX + h, TTL, json.dumps(vec))
    except Exception:
        pass
