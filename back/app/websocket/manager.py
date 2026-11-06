"""Gestionnaire de connexions WebSocket (multi-connexions par utilisateur)."""
from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Registre en mémoire des sockets du *worker courant*.

    La diffusion inter-workers est assurée par Redis Pub/Sub (voir pubsub.py).
    """

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)
        logger.info("WebSocket connecté (user=%s, sockets=%d)", user_id, len(self._connections[user_id]))

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.get(user_id, set()).discard(websocket)
            if not self._connections.get(user_id):
                self._connections.pop(user_id, None)

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))

    @property
    def online_users(self) -> list[uuid.UUID]:
        return list(self._connections.keys())

    async def send_to_user(self, user_id: uuid.UUID, payload: dict[str, Any]) -> int:
        """Envoie un message à toutes les sockets locales de l'utilisateur."""
        sockets = list(self._connections.get(user_id, set()))
        delivered = 0
        for socket in sockets:
            try:
                await socket.send_json(payload)
                delivered += 1
            except Exception:
                logger.debug("Socket morte, retrait (user=%s)", user_id)
                await self.disconnect(user_id, socket)
        return delivered

    async def broadcast(self, user_ids: list[uuid.UUID], payload: dict[str, Any]) -> int:
        total = 0
        for user_id in user_ids:
            total += await self.send_to_user(user_id, payload)
        return total


manager = ConnectionManager()
