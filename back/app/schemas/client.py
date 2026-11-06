"""Schémas CRM clients."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class ClientCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    city: str | None = None
    source: str | None = Field(default=None, max_length=80)
    notes: str | None = None
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    preferences: dict = Field(default_factory=dict)
    agent_id: uuid.UUID | None = Field(
        default=None, description="Agent référent ; par défaut l'agent appelant."
    )


class ClientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    city: str | None = None
    source: str | None = None
    notes: str | None = None
    budget_min: Decimal | None = None
    budget_max: Decimal | None = None
    preferences: dict | None = None
    is_active: bool | None = None


class ClientRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    user_id: uuid.UUID | None
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None
    city: str | None
    source: str | None
    notes: str | None
    budget_min: Decimal | None
    budget_max: Decimal | None
    preferences: dict
    is_active: bool
    created_at: datetime


class ClientAssign(BaseModel):
    agent_id: uuid.UUID
    is_primary: bool = True


class ClientAgentRead(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID
    agency_id: uuid.UUID
    is_primary: bool
    assigned_at: datetime | None


class FavoriteRead(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    property_id: uuid.UUID
    created_at: datetime


class SearchHistoryRead(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    query: str
    filters: dict
    results_count: int
    created_at: datetime


class ClientRequestCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str | None = None
    property_id: uuid.UUID | None = None


class ClientRequestRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None
    property_id: uuid.UUID | None
    subject: str
    message: str | None
    status: str
    created_at: datetime
