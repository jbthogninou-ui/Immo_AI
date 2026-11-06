"""Schémas biens immobiliers."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ListingType, PropertyStatus
from app.schemas.common import ORMModel


class PropertyTypeRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    is_active: bool


class PropertyTypeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class PropertyImageRead(ORMModel):
    id: uuid.UUID
    property_id: uuid.UUID
    url: str
    thumbnail_url: str | None
    caption: str | None
    media_type: str
    is_cover: bool
    position: int


class PropertyImageCreate(BaseModel):
    url: str = Field(max_length=512)
    caption: str | None = None
    media_type: str = "IMAGE"
    is_cover: bool = False
    position: int = 0


class PropertyBase(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    description: str | None = None
    listing_type: ListingType = ListingType.SALE
    property_type_id: uuid.UUID | None = None
    address: str | None = Field(default=None, max_length=255)
    district: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    country: str = "Bénin"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    price: Decimal = Field(gt=0)
    currency: str = Field(default="XOF", min_length=3, max_length=3)
    charges: Decimal | None = Field(default=None, ge=0)
    deposit: Decimal | None = Field(default=None, ge=0)
    area: float | None = Field(default=None, gt=0)
    land_area: float | None = Field(default=None, gt=0)
    rooms: int | None = Field(default=None, ge=0, le=200)
    bedrooms: int | None = Field(default=None, ge=0, le=100)
    bathrooms: int | None = Field(default=None, ge=0, le=100)
    floor: int | None = Field(default=None, ge=-5, le=200)
    year_built: int | None = Field(default=None, ge=1800, le=2100)
    amenities: list[str] = Field(default_factory=list)


class PropertyCreate(PropertyBase):
    owner_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = Field(
        default=None, description="Réservé à l'agence : agent en charge du bien."
    )
    images: list[PropertyImageCreate] = Field(default_factory=list)


class PropertyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=5, max_length=200)
    description: str | None = None
    listing_type: ListingType | None = None
    property_type_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    address: str | None = None
    district: str | None = None
    city: str | None = None
    country: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    charges: Decimal | None = None
    deposit: Decimal | None = None
    area: float | None = None
    land_area: float | None = None
    rooms: int | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    floor: int | None = None
    year_built: int | None = None
    amenities: list[str] | None = None
    status: PropertyStatus | None = None


class PropertyRead(ORMModel):
    id: uuid.UUID
    reference: str
    agency_id: uuid.UUID
    agent_id: uuid.UUID | None
    agent_user_id: uuid.UUID | None = None
    agency_contact_user_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None
    property_type_id: uuid.UUID | None
    title: str
    description: str | None
    listing_type: ListingType
    status: PropertyStatus
    address: str | None
    district: str | None
    city: str | None
    country: str
    latitude: float | None
    longitude: float | None
    price: Decimal
    currency: str
    charges: Decimal | None
    deposit: Decimal | None
    area: float | None
    land_area: float | None
    rooms: int | None
    bedrooms: int | None
    bathrooms: int | None
    floor: int | None
    year_built: int | None
    amenities: list
    is_published: bool
    published_at: datetime | None
    views_count: int
    created_at: datetime
    updated_at: datetime
    images: list[PropertyImageRead] = []


class PropertyFilters(BaseModel):
    q: str | None = Field(default=None, description="Recherche plein texte titre/description")
    city: str | None = None
    district: str | None = None
    listing_type: ListingType | None = None
    status: PropertyStatus | None = None
    property_type_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    min_area: float | None = Field(default=None, ge=0)
    max_area: float | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    rooms: int | None = Field(default=None, ge=0)
    is_published: bool | None = None
    near_lat: float | None = Field(default=None, ge=-90, le=90)
    near_lng: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=500)
    sort: str = Field(default="-created_at", description="Ex: price, -price, -created_at")

    @model_validator(mode="after")
    def _check_ranges(self) -> "PropertyFilters":
        if self.min_price and self.max_price and self.min_price > self.max_price:
            raise ValueError("min_price ne peut pas dépasser max_price.")
        if self.near_lat is not None and self.near_lng is None:
            raise ValueError("near_lng est requis avec near_lat.")
        return self


class PropertyStatusUpdate(BaseModel):
    status: PropertyStatus
    reason: str | None = None
