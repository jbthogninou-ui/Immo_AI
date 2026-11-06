"""Schémas du module IA immobilière."""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import ListingType


class DescriptionRequest(BaseModel):
    property_id: uuid.UUID | None = Field(
        default=None, description="Si fourni, les caractéristiques sont chargées depuis le bien."
    )
    property_type: str | None = Field(default=None, max_length=80, examples=["Villa"])
    listing_type: ListingType = ListingType.SALE
    area: float | None = Field(default=None, gt=0, examples=[180])
    land_area: float | None = Field(default=None, gt=0, examples=[600])
    floor: int | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, ge=1800, le=2100)
    district: str | None = Field(default=None, examples=["Fidjrossè"])
    city: str | None = Field(default=None, examples=["Cotonou"])
    rooms: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    charges: Decimal | None = Field(default=None, ge=0)
    deposit: Decimal | None = Field(default=None, ge=0)
    currency: str = "XOF"
    amenities: list[str] = Field(default_factory=list, examples=[["piscine", "garage"]])
    tone: str = Field(default="professionnel", examples=["professionnel", "chaleureux", "premium"])
    language: str = Field(default="fr", max_length=5)
    max_words: int = Field(default=180, ge=40, le=600)


class DescriptionResponse(BaseModel):
    description: str
    title_suggestion: str | None = None
    highlights: list[str] = []
    provider: str
    model: str | None = None


class EstimationRequest(BaseModel):
    property_id: uuid.UUID | None = None
    property_type: str | None = None
    listing_type: ListingType = ListingType.SALE
    area: float | None = Field(default=None, gt=0)
    land_area: float | None = Field(default=None, gt=0)
    district: str | None = None
    city: str | None = None
    rooms: int | None = None
    bedrooms: int | None = None
    year_built: int | None = None
    amenities: list[str] = Field(default_factory=list)
    currency: str = "XOF"


class EstimationResponse(BaseModel):
    suggested_price: Decimal
    price_range_min: Decimal
    price_range_max: Decimal
    currency: str
    confidence: float = Field(ge=0, le=1)
    explanation: str
    comparables_count: int = 0
    method: str
    provider: str


class AssistantRequest(BaseModel):
    query: str = Field(
        min_length=3, max_length=1000,
        examples=["Maison 4 chambres proche centre budget 60 millions"],
    )
    history: list[dict] = Field(default_factory=list, description="[{role, content}]")
    include_results: bool = True
    limit: int = Field(default=10, ge=1, le=50)


class ParsedSearchCriteria(BaseModel):
    listing_type: ListingType | None = None
    property_type: str | None = None
    city: str | None = None
    district: str | None = None
    bedrooms: int | None = None
    rooms: int | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    min_area: float | None = None
    amenities: list[str] = []


class AssistantResponse(BaseModel):
    answer: str
    criteria: ParsedSearchCriteria
    results: list[dict] = []
    results_count: int = 0
    provider: str


class ListingAnalysisRequest(BaseModel):
    property_id: uuid.UUID | None = None
    title: str | None = None
    description: str | None = None


class ListingAnalysisResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    missing_fields: list[str] = []
    quality_issues: list[str] = []
    suggestions: list[str] = []
    provider: str
