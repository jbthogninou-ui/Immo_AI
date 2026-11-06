"""Utilitaires de pagination pour les endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query

from app.schemas.common import PaginationParams


def pagination_params(
    page: Annotated[int, Query(ge=1, description="Numéro de page")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Éléments par page")] = 20,
) -> PaginationParams:
    return PaginationParams(page=page, size=size)


PaginationDep = Annotated[PaginationParams, Depends(pagination_params)]
