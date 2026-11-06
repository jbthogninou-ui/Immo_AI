"""Schémas visites."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import VisitStatus
from app.schemas.common import ORMModel


class VisitRequestCreate(BaseModel):
    property_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=45, ge=15, le=480)
    client_message: str | None = Field(default=None, max_length=1000)
    client_id: uuid.UUID | None = Field(
        default=None, description="Requis si la demande est créée par un agent."
    )


class VisitUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    agent_id: uuid.UUID | None = None
    agent_notes: str | None = None


class VisitDecision(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)
    scheduled_at: datetime | None = Field(
        default=None, description="Nouvelle date en cas de reprogrammation."
    )


class VisitFeedback(BaseModel):
    feedback: str | None = Field(default=None, max_length=2000)
    rating: int | None = Field(default=None, ge=1, le=5)


class VisitRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    property_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None
    scheduled_at: datetime
    duration_minutes: int
    status: VisitStatus
    client_message: str | None
    agent_notes: str | None
    rejection_reason: str | None
    feedback: str | None
    rating: int | None
    confirmed_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class VisitFilters(BaseModel):
    status: VisitStatus | None = None
    property_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
