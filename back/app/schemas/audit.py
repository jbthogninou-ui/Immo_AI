"""Schémas journal d'audit."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class AuditLogRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    agency_id: uuid.UUID | None
    action: str
    resource_type: str | None
    resource_id: str | None
    status: str
    ip_address: str | None
    request_id: str | None
    payload: dict
    created_at: datetime


class AuditFilters(BaseModel):
    action: str | None = None
    resource_type: str | None = None
    user_id: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
