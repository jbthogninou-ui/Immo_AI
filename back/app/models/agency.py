"""Agences immobilières (tenant racine) et agents."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import AgencyStatus, AgentStatus
from app.models.user import User, enum_column

if TYPE_CHECKING:
    from app.models.property import Property


class Agency(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "agencies"

    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    country: Mapped[str] = mapped_column(String(80), default="Bénin", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    registration_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    status: Mapped[AgencyStatus] = mapped_column(
        enum_column(AgencyStatus, "agency_status"),
        default=AgencyStatus.PENDING_VALIDATION,
        nullable=False,
        index=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    members: Mapped[list["User"]] = relationship(
        "User", back_populates="agency", foreign_keys="User.agency_id"
    )
    agents: Mapped[list["Agent"]] = relationship(
        "Agent", back_populates="agency", cascade="all, delete-orphan"
    )
    properties: Mapped[list["Property"]] = relationship("Property", back_populates="agency")

    @property
    def is_operational(self) -> bool:
        return self.status is AgencyStatus.ACTIVE


class Agent(Base, UUIDMixin, TimestampMixin):
    """Profil métier d'un agent, rattaché à un `User` de rôle AGENT."""

    __tablename__ = "agents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AgentStatus] = mapped_column(
        enum_column(AgentStatus, "agent_status"), default=AgentStatus.INVITED, nullable=False
    )
    can_manage_owners: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_publish_properties: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")
    agency: Mapped["Agency"] = relationship("Agency", back_populates="agents")
