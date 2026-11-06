"""Schémas propriétaires."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import OwnerStatus
from app.schemas.common import ORMModel


class OwnerInviteRequest(BaseModel):
    """Workflow 1 : l'agent crée le propriétaire et déclenche l'invitation."""

    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    address: str | None = None
    city: str | None = None
    notes: str | None = None


class OwnerSelfRegisterRequest(BaseModel):
    """Workflow 2 : le propriétaire s'inscrit lui-même auprès d'une agence."""

    agency_id: uuid.UUID
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    address: str | None = None
    city: str | None = None


class OwnerProfileCompletion(BaseModel):
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    national_id_number: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=30)


class OwnerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    notes: str | None = None
    agent_id: uuid.UUID | None = None


class OwnerVerification(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class OwnerRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    agent_id: uuid.UUID | None
    user_id: uuid.UUID | None
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: str | None
    city: str | None
    national_id_number: str | None
    notes: str | None
    status: OwnerStatus
    rejection_reason: str | None
    invited_at: datetime | None
    verified_at: datetime | None
    created_at: datetime


class OwnerInviteResponse(BaseModel):
    owner: OwnerRead
    invitation_url: str | None = None
    message: str = "Invitation envoyée au propriétaire."
