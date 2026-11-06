"""Schémas utilisateurs."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import UserRole, UserStatus
from app.schemas.common import ORMModel


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    agency_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    avatar_url: str | None = None
    locale: str | None = Field(default=None, max_length=10)


class UserAdminUpdate(UserUpdate):
    is_active: bool | None = None
    status: UserStatus | None = None
    role: UserRole | None = None
    agency_id: uuid.UUID | None = None


class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole
    agency_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_agency(self) -> "UserAdminCreate":
        if self.role in (UserRole.AGENCY, UserRole.AGENT) and not self.agency_id:
            raise ValueError("Une agence est requise pour ce rôle.")
        return self


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    avatar_url: str | None
    role: UserRole
    status: UserStatus
    is_active: bool
    is_email_verified: bool
    agency_id: uuid.UUID | None
    locale: str
    last_login_at: datetime | None
    created_at: datetime


class UserProfile(UserRead):
    """Profil enrichi retourné par /auth/me."""

    owner_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    permissions: list[str] = []
