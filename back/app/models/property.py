"""Biens immobiliers, types de biens et médias."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import ListingType, PropertyStatus
from app.models.user import enum_column


class PropertyType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "property_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Property(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "properties"
    __table_args__ = (
        Index("ix_properties_agency_status", "agency_id", "status"),
        Index("ix_properties_geo", "latitude", "longitude"),
    )

    reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)

    agency_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("owners.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    property_type_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("property_types.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    listing_type: Mapped[ListingType] = mapped_column(
        enum_column(ListingType, "listing_type"), default=ListingType.SALE, nullable=False, index=True
    )
    status: Mapped[PropertyStatus] = mapped_column(
        enum_column(PropertyStatus, "property_status"),
        default=PropertyStatus.DRAFT, nullable=False, index=True,
    )

    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    country: Mapped[str] = mapped_column(String(80), default="Bénin", nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="XOF", nullable=False)
    charges: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deposit: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    area: Mapped[float | None] = mapped_column(Float, nullable=True)
    land_area: Mapped[float | None] = mapped_column(Float, nullable=True)
    rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)

    amenities: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    ai_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    agency: Mapped["Agency"] = relationship("Agency", back_populates="properties", lazy="joined")  # noqa: F821
    owner: Mapped["Owner | None"] = relationship("Owner", back_populates="properties")  # noqa: F821
    agent: Mapped["Agent | None"] = relationship("Agent", lazy="joined", viewonly=True)  # noqa: F821
    images: Mapped[list["PropertyImage"]] = relationship(
        "PropertyImage",
        back_populates="property",
        cascade="all, delete-orphan",
        order_by="PropertyImage.position",
    )

    @property
    def is_available(self) -> bool:
        return self.status is PropertyStatus.AVAILABLE

    @property
    def agent_user_id(self) -> uuid.UUID | None:
        """Compte utilisateur de l'agent en charge, pour la messagerie."""
        return self.agent.user_id if self.agent else None

    @property
    def agency_contact_user_id(self) -> uuid.UUID | None:
        """Repli si aucun agent n'est encore affecté : le compte de l'agence."""
        return self.agency.owner_user_id if self.agency else None


class PropertyImage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "property_images"

    property_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)
    media_type: Mapped[str] = mapped_column(String(20), default="IMAGE", nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    property: Mapped["Property"] = relationship("Property", back_populates="images")
