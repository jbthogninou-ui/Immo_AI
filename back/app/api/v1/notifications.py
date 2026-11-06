"""Endpoints notifications."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import Ctx, DbSession
from app.schemas.common import MessageResponse, Page
from app.schemas.notification import (
    MarkReadRequest, NotificationFilters, NotificationRead, UnreadCount,
)
from app.services.notification import NotificationService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/notifications", tags=["Notifications"])

Filters = Annotated[NotificationFilters, Depends()]


@router.get("", response_model=Page[NotificationRead], summary="Mes notifications")
async def list_notifications(
    ctx: Ctx, session: DbSession, pagination: PaginationDep, filters: Filters
):
    items, total = await NotificationService(session).list(
        ctx.user_id, filters, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [NotificationRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.get("/unread-count", response_model=UnreadCount, summary="Nombre de non lues")
async def unread_count(ctx: Ctx, session: DbSession):
    return UnreadCount(unread=await NotificationService(session).unread_count(ctx.user_id))


@router.post("/read", response_model=MessageResponse, summary="Marquer des notifications comme lues")
async def mark_read(data: MarkReadRequest, ctx: Ctx, session: DbSession):
    count = await NotificationService(session).mark_read(ctx.user_id, data.ids, data.all)
    await session.commit()
    return MessageResponse(message=f"{count} notification(s) marquée(s) comme lue(s).")
