"""Pont Redis Pub/Sub : diffusion des événements entre workers."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from app.core.redis_client import get_redis
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

CHANNEL = "immoflow:events"


def _default(obj: Any):
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    raise TypeError(f"Type non sérialisable: {type(obj)}")


async def publish(user_ids: list[uuid.UUID], payload: dict[str, Any]) -> None:
    """Publie un événement destiné à une liste d'utilisateurs.

    En cas d'indisponibilité de Redis, on retombe sur la diffusion locale
    (le service reste fonctionnel en mono-worker).
    """
    envelope = {"user_ids": [str(u) for u in user_ids], "payload": payload}
    try:
        await get_redis().publish(CHANNEL, json.dumps(envelope, default=_default))
    except Exception as exc:
        logger.warning("Redis indisponible, diffusion locale uniquement: %s", exc)
        await manager.broadcast(user_ids, payload)


class PubSubBridge:
    """Tâche de fond qui relaie Redis -> sockets locales."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="ws-pubsub-bridge")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                pubsub = get_redis().pubsub()
                await pubsub.subscribe(CHANNEL)
                logger.info("Pont Redis Pub/Sub actif sur '%s'", CHANNEL)
                async for message in pubsub.listen():
                    if self._stop.is_set():
                        break
                    if message.get("type") != "message":
                        continue
                    try:
                        envelope = json.loads(message["data"])
                        user_ids = [uuid.UUID(u) for u in envelope.get("user_ids", [])]
                        await manager.broadcast(user_ids, envelope.get("payload", {}))
                    except Exception:
                        logger.exception("Événement Pub/Sub illisible")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Pont Pub/Sub interrompu (%s), nouvelle tentative dans 5s", exc)
                await asyncio.sleep(5)


bridge = PubSubBridge()
