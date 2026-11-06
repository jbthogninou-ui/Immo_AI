"""Repository notifications."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update

from app.models.notification import Notification
from app.repositories.base import BaseRepository
from app.schemas.notification import NotificationFilters


class NotificationRepository(BaseRepository[Notification]):
    model = Notification

    async def list_for_user(
        self, user_id: uuid.UUID, filters: NotificationFilters, *, limit: int, offset: int
    ):
        stmt = select(Notification).where(Notification.user_id == user_id)
        if filters.is_read is not None:
            stmt = stmt.where(Notification.is_read.is_(filters.is_read))
        if filters.type:
            stmt = stmt.where(Notification.type == filters.type)
        stmt = stmt.order_by(Notification.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def unread_count(self, user_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def mark_read(self, user_id: uuid.UUID, ids: list[uuid.UUID] | None) -> int:
        stmt = update(Notification).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
        if ids:
            stmt = stmt.where(Notification.id.in_(ids))
        result = await self.session.execute(
            stmt.values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        return result.rowcount or 0
