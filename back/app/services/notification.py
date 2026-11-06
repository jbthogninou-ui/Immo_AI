"""Service de notifications (in-app + temps réel + email)."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType
from app.models.notification import Notification
from app.repositories.notification import NotificationRepository
from app.schemas.notification import NotificationFilters
from app.services.email import email_service
from app.websocket import pubsub

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = NotificationRepository(session)

    async def notify(
        self,
        *,
        user_id: uuid.UUID,
        type: NotificationType,
        title: str,
        body: str | None = None,
        action_url: str | None = None,
        payload: dict | None = None,
        agency_id: uuid.UUID | None = None,
        send_email: bool = False,
        email_to: str | None = None,
    ) -> Notification:
        notification = await self.repo.create(
            user_id=user_id,
            agency_id=agency_id,
            type=type,
            title=title,
            body=body,
            action_url=action_url,
            payload=payload or {},
        )

        await pubsub.publish(
            [user_id],
            {
                "event": "notification.new",
                "data": {
                    "id": str(notification.id),
                    "type": type.value,
                    "title": title,
                    "body": body,
                    "action_url": action_url,
                    "payload": payload or {},
                    "created_at": notification.created_at.isoformat()
                    if notification.created_at
                    else None,
                },
            },
        )

        if send_email and email_to:
            sent = await email_service.send(to=email_to, subject=title, body=body or title)
            notification.is_sent_email = sent

        return notification

    async def notify_many(self, user_ids: list[uuid.UUID], **kwargs) -> list[Notification]:
        return [await self.notify(user_id=uid, **kwargs) for uid in dict.fromkeys(user_ids)]

    async def list(self, user_id: uuid.UUID, filters: NotificationFilters, *, limit: int, offset: int):
        return await self.repo.list_for_user(user_id, filters, limit=limit, offset=offset)

    async def unread_count(self, user_id: uuid.UUID) -> int:
        return await self.repo.unread_count(user_id)

    async def mark_read(self, user_id: uuid.UUID, ids: list[uuid.UUID] | None, all_: bool) -> int:
        return await self.repo.mark_read(user_id, None if all_ else ids)
