"""Schémas notifications."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import NotificationType
from app.schemas.common import ORMModel


class NotificationRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    agency_id: uuid.UUID | None
    type: NotificationType
    title: str
    body: str | None
    action_url: str | None
    payload: dict
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class NotificationFilters(BaseModel):
    is_read: bool | None = None
    type: NotificationType | None = None


class UnreadCount(BaseModel):
    unread: int


class MarkReadRequest(BaseModel):
    ids: list[uuid.UUID] | None = None
    all: bool = False
