"""Transactions : ventes, locations et contrats."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import ContractKind, ContractStatus, RentalStatus, SaleStatus
from app.models.user import enum_column


class Sale(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sales"

    reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    agency_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("owners.id", ondelete="SET NULL"), nullable=True
    )

    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="XOF", nullable=False)
    commission_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    commission_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    status: Mapped[SaleStatus] = mapped_column(
        enum_column(SaleStatus, "sale_status"),
        default=SaleStatus.DRAFT, nullable=False, index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Rental(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rentals"

    reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    agency_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("owners.id", ondelete="SET NULL"), nullable=True
    )

    monthly_rent: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    charges: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deposit_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="XOF", nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_months: Mapped[int | None] = mapped_column(nullable=True)

    status: Mapped[RentalStatus] = mapped_column(
        enum_column(RentalStatus, "rental_status"),
        default=RentalStatus.DRAFT, nullable=False, index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Contract(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contracts"

    reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    agency_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    kind: Mapped[ContractKind] = mapped_column(
        enum_column(ContractKind, "contract_kind"), nullable=False
    )
    status: Mapped[ContractStatus] = mapped_column(
        enum_column(ContractStatus, "contract_status"),
        default=ContractStatus.DRAFT, nullable=False, index=True,
    )

    sale_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=True, index=True
    )
    rental_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("rentals.id", ondelete="CASCADE"), nullable=True, index=True
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"), nullable=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Signature électronique (image PNG encodée en data URL base64), capturée
    # au doigt/à la souris depuis un canvas côté client.
    agent_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agent_signed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    client_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
