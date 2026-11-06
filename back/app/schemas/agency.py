"""Schémas agences et agents."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import AgencyStatus, AgentStatus
from app.schemas.common import ORMModel
from app.schemas.user import UserRead


class AgencyBase(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    description: str | None = None
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    country: str = "Bénin"
    website: str | None = None
    registration_number: str | None = Field(default=None, max_length=120)
    tax_id: str | None = Field(default=None, max_length=120)


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    email: EmailStr | None = None
    phone: str | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    website: str | None = None
    logo_url: str | None = None
    registration_number: str | None = None
    tax_id: str | None = None


class AgencyValidation(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class AgencySuspension(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AgencyRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    email: EmailStr
    phone: str | None
    description: str | None
    address: str | None
    city: str | None
    country: str
    logo_url: str | None
    website: str | None
    registration_number: str | None
    tax_id: str | None
    status: AgencyStatus
    rejection_reason: str | None
    validated_at: datetime | None
    owner_user_id: uuid.UUID | None
    created_at: datetime


class AgencyStats(BaseModel):
    agents: int
    owners: int
    clients: int
    properties: int
    published_properties: int
    visits_pending: int
    sales_completed: int
    rentals_active: int


# ------------------------------- Agents ------------------------------------ #
class AgentInvite(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=120)
    license_number: str | None = Field(default=None, max_length=120)
    can_manage_owners: bool = True
    can_publish_properties: bool = True


class AgentUpdate(BaseModel):
    job_title: str | None = None
    license_number: str | None = None
    bio: str | None = None
    status: AgentStatus | None = None
    can_manage_owners: bool | None = None
    can_publish_properties: bool | None = None


class AgentRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    agency_id: uuid.UUID
    job_title: str | None
    license_number: str | None
    bio: str | None
    status: AgentStatus
    can_manage_owners: bool
    can_publish_properties: bool
    invited_at: datetime | None
    activated_at: datetime | None
    created_at: datetime
    user: UserRead | None = None


class AgentInviteResponse(BaseModel):
    agent: AgentRead
    invitation_url: str | None = None
    message: str = "Invitation envoyée."


class AgentInvitationUpdate(BaseModel):
    """Correction d'une invitation encore en attente d'activation."""

    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=3, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=120)
    can_manage_owners: bool | None = None
    can_publish_properties: bool | None = None


class InvitationLinkResponse(BaseModel):
    """Lien d'activation renvoyé à l'auteur de l'invitation.

    Il est fourni systématiquement : tant qu'un serveur SMTP n'est pas
    configuré, c'est le seul moyen pour l'agence de transmettre l'invitation.
    """

    message: str
    invitation_url: str
    expires_in_hours: int = 48
