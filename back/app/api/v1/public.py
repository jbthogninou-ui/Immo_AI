"""Catalogue public (aucune authentification requise)."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.core.exceptions import NotFoundError
from app.core.permissions import SecurityContext
from app.models.enums import UserRole
from app.models.agency import Agency
from app.models.enums import AgencyStatus
from app.schemas.common import Page
from app.schemas.property import PropertyFilters, PropertyRead
from app.services.property import PropertyService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/public", tags=["Catalogue public"])

Filters = Annotated[PropertyFilters, Depends()]

ANONYMOUS = SecurityContext(
    user_id=uuid.UUID(int=0), role=UserRole.CLIENT, email="anonymous@public",
)


@router.get("/properties", response_model=Page[PropertyRead],
            summary="Rechercher dans le catalogue publié")
async def public_properties(session: DbSession, pagination: PaginationDep, filters: Filters):
    items, total = await PropertyService(session).list(
        ANONYMOUS, filters, public=True, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [PropertyRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.get("/properties/{property_id}", response_model=PropertyRead,
            summary="Détail d'un bien publié")
async def public_property(property_id: uuid.UUID, session: DbSession):
    service = PropertyService(session)
    prop = await service.repo.get_with_images(property_id)
    if not prop or not prop.is_published:
        raise NotFoundError("Bien introuvable.")
    await service.register_view(property_id)
    await session.commit()
    return prop


class PublicAgency(BaseModel):
    """Vue réduite d'une agence, exposée sans authentification.

    Volontairement limitée : un propriétaire qui souhaite confier un bien doit
    pouvoir identifier l'agence, pas consulter son dossier administratif. Le
    RCCM, l'identifiant fiscal et les coordonnées internes restent privés.
    """

    id: uuid.UUID
    name: str
    slug: str
    city: str | None
    description: str | None
    logo_url: str | None

    model_config = {"from_attributes": True}


@router.get("/agencies", response_model=Page[PublicAgency],
            summary="Lister les agences ouvertes aux propriétaires")
async def public_agencies(
    session: DbSession,
    pagination: PaginationDep,
    q: str | None = Query(default=None, description="Recherche par nom ou ville"),
    city: str | None = Query(default=None),
):
    """Seules les agences validées apparaissent : une agence en attente de
    validation ne peut pas encore recevoir de propriétaires."""
    conditions = [Agency.status == AgencyStatus.ACTIVE]
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(Agency.name.ilike(pattern) | Agency.city.ilike(pattern))
    if city:
        conditions.append(Agency.city.ilike(f"%{city.strip()}%"))

    total = await session.scalar(
        select(func.count()).select_from(Agency).where(*conditions)
    )
    result = await session.execute(
        select(Agency)
        .where(*conditions)
        .order_by(Agency.name)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return Page.create(
        [PublicAgency.model_validate(a) for a in result.scalars().all()],
        total or 0,
        pagination.page,
        pagination.size,
    )
