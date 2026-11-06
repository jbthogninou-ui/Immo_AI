"""Middleware de limitation de débit (fenêtre glissante Redis, fail-open)."""
from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

EXEMPT_PATHS = {"/health", "/health/live", "/health/ready", "/docs", "/redoc", "/openapi.json"}

# Quotas renforcés sur les routes sensibles (par minute).
STRICT_PATHS = {
    "/auth/login": 10,
    "/auth/register": 5,
    "/auth/forgot-password": 5,
    "/auth/refresh": 30,
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED or request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        identifier = self._identify(request)
        limit = settings.RATE_LIMIT_PER_MINUTE
        for suffix, strict_limit in STRICT_PATHS.items():
            if request.url.path.endswith(suffix):
                limit = strict_limit
                break

        key = f"ratelimit:{identifier}:{request.url.path}"
        try:
            redis = get_redis()
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, 60)
            if current > limit:
                ttl = await redis.ttl(key)
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "rate_limited",
                            "message": "Trop de requêtes. Réessayez plus tard.",
                        }
                    },
                    headers={"Retry-After": str(max(ttl, 1))},
                )
        except Exception as exc:  # fail-open : Redis ne doit pas bloquer l'API
            logger.debug("Rate limiting désactivé (Redis indisponible: %s)", exc)

        return await call_next(request)

    @staticmethod
    def _identify(request: Request) -> str:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            return f"token:{hash(auth[7:]) & 0xFFFFFFFF}"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        return f"ip:{request.client.host if request.client else 'unknown'}"
