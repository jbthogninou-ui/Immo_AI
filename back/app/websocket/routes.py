"""Point d'entrée WebSocket : /ws?token=<access_token>."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.exceptions import AppException
from app.core.security import decode_token
from app.database.session import session_scope
from app.models.enums import UserStatus
from app.repositories.user import UserRepository
from app.services.auth import AuthService
from app.services.messaging import MessagingService
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Temps réel"])


async def _authenticate(token: str):
    payload = decode_token(token, expected_type="access")
    user_id = uuid.UUID(payload["sub"])
    async with session_scope() as session:
        user = await UserRepository(session).get(user_id)
        if not user or not user.is_active or user.status in (
            UserStatus.SUSPENDED, UserStatus.DEACTIVATED
        ):
            return None
        return user.id


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="Jeton d'accès JWT"),
):
    """Canal temps réel : messages, accusés de lecture, notifications.

    Événements entrants  : `message.send`, `message.read`, `typing`, `ping`
    Événements sortants  : `message.new`, `message.read`, `typing`,
                           `notification.new`, `pong`, `error`
    """
    try:
        user_id = await _authenticate(token)
    except Exception:
        user_id = None

    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    await websocket.send_json(
        {
            "event": "connected",
            "data": {"user_id": str(user_id), "at": datetime.now(timezone.utc).isoformat()},
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event = payload.get("event")

            if event == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
                continue

            conversation_id = payload.get("conversation_id")
            if not conversation_id:
                await websocket.send_json(
                    {"event": "error", "data": {"message": "conversation_id requis."}}
                )
                continue

            try:
                conversation_uuid = uuid.UUID(str(conversation_id))
                async with session_scope() as session:
                    ctx = await AuthService(session).build_context(
                        await UserRepository(session).get(user_id)  # type: ignore[arg-type]
                    )
                    service = MessagingService(session)

                    if event == "message.send":
                        from app.schemas.messaging import MessageCreate

                        message = MessageCreate(**payload.get("data", {}))
                        await service.send_message(conversation_uuid, message, ctx)
                    elif event == "message.read":
                        await service.mark_read(conversation_uuid, ctx)
                    elif event == "typing":
                        await service.typing(conversation_uuid, ctx)
                    else:
                        await websocket.send_json(
                            {"event": "error", "data": {"message": f"Événement inconnu: {event}"}}
                        )
            except AppException as exc:
                await websocket.send_json(
                    {"event": "error", "data": {"code": exc.error_code, "message": exc.message}}
                )
            except Exception:
                logger.exception("Erreur de traitement d'un événement WebSocket")
                await websocket.send_json(
                    {"event": "error", "data": {"message": "Erreur interne."}}
                )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
