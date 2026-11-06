"""Schémas transverses : pagination, réponses génériques."""
from __future__ import annotations

import math
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Numéro de page (1-indexé)")
    size: int = Field(20, ge=1, le=100, description="Éléments par page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    @property
    def limit(self) -> int:
        return self.size


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def create(cls, items: list[T], total: int, page: int, size: int) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)) if size else 1,
        )


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class IDResponse(BaseModel):
    id: str
