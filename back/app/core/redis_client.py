"""Client Redis partagé (cache, pub/sub temps réel, rate limiting)."""
from __future__ import annotations

import logging

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Retourne (et crée à la demande) le pool Redis global."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            health_check_interval=30,
        )
    return _redis


async def ping_redis() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception as exc:  # pragma: no cover - dépend de l'infra
        logger.warning("Redis indisponible: %s", exc)
        return False


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
