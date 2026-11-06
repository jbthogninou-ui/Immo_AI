"""Schémas documents."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import DocumentCategory, DocumentStatus, OwnerEntityType
from app.schemas.common import ORMModel


class DocumentRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID | None
    entity_type: OwnerEntityType
    entity_id: uuid.UUID
    category: DocumentCategory
    status: DocumentStatus
    filename: str
    url: str
    mime_type: str
    size_bytes: int
    uploaded_by_id: uuid.UUID | None
    verified_at: datetime | None
    rejection_reason: str | None
    created_at: datetime


class DocumentVerification(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class DocumentFilters(BaseModel):
    entity_type: OwnerEntityType | None = None
    entity_id: uuid.UUID | None = None
    category: DocumentCategory | None = None
    status: DocumentStatus | None = None
