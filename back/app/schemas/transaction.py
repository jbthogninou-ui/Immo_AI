"""Schémas transactions (ventes, locations, contrats)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ContractKind, ContractStatus, RentalStatus, SaleStatus
from app.schemas.common import ORMModel


# --------------------------------- Ventes ---------------------------------- #
class SaleCreate(BaseModel):
    property_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="XOF", min_length=3, max_length=3)
    commission_rate: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class SaleUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    commission_rate: Decimal | None = Field(default=None, ge=0, le=100)
    status: SaleStatus | None = None
    notes: str | None = None
    signed_at: datetime | None = None


class SaleRead(ORMModel):
    id: uuid.UUID
    reference: str
    agency_id: uuid.UUID
    property_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    amount: Decimal
    currency: str
    commission_rate: Decimal | None
    commission_amount: Decimal | None
    status: SaleStatus
    notes: str | None
    signed_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


# -------------------------------- Locations -------------------------------- #
class RentalCreate(BaseModel):
    property_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    monthly_rent: Decimal = Field(gt=0)
    charges: Decimal | None = Field(default=None, ge=0)
    deposit_amount: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="XOF", min_length=3, max_length=3)
    start_date: date
    end_date: date | None = None
    duration_months: int | None = Field(default=None, ge=1, le=600)
    notes: str | None = None

    @model_validator(mode="after")
    def _check_dates(self) -> "RentalCreate":
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("end_date doit être postérieure à start_date.")
        return self


class RentalUpdate(BaseModel):
    monthly_rent: Decimal | None = Field(default=None, gt=0)
    charges: Decimal | None = None
    deposit_amount: Decimal | None = None
    end_date: date | None = None
    status: RentalStatus | None = None
    notes: str | None = None


class RentalRead(ORMModel):
    id: uuid.UUID
    reference: str
    agency_id: uuid.UUID
    property_id: uuid.UUID
    client_id: uuid.UUID
    agent_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    monthly_rent: Decimal
    charges: Decimal | None
    deposit_amount: Decimal | None
    currency: str
    start_date: date
    end_date: date | None
    duration_months: int | None
    status: RentalStatus
    notes: str | None
    created_at: datetime


# -------------------------------- Contrats --------------------------------- #
class ContractCreate(BaseModel):
    kind: ContractKind
    title: str | None = None
    content: str | None = None
    sale_id: uuid.UUID | None = None
    rental_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def _check_link(self) -> "ContractCreate":
        if not any([self.sale_id, self.rental_id, self.property_id]):
            raise ValueError("Le contrat doit être lié à une vente, une location ou un bien.")
        return self


class ContractUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: ContractStatus | None = None
    document_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    signed_at: datetime | None = None


class ContractSign(BaseModel):
    # Image PNG encodée en data URL (« data:image/png;base64,... »), capturée
    # depuis le canvas de signature.
    signature: str = Field(min_length=100)


class ContractRead(ORMModel):
    id: uuid.UUID
    reference: str
    agency_id: uuid.UUID
    kind: ContractKind
    status: ContractStatus
    sale_id: uuid.UUID | None
    rental_id: uuid.UUID | None
    property_id: uuid.UUID | None
    client_id: uuid.UUID | None
    agent_id: uuid.UUID | None
    document_id: uuid.UUID | None
    title: str
    content: str | None
    start_date: date | None
    end_date: date | None
    signed_at: datetime | None
    agent_signature: str | None
    agent_signed_at: datetime | None
    client_signature: str | None
    client_signed_at: datetime | None
    created_at: datetime
