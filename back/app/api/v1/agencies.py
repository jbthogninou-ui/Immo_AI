"""Endpoints de gestion des agences."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AgencyOnly, Ctx, DbSession, SuperAdminOnly
from app.models.enums import AgencyStatus
from app.schemas.agency import (
    AgencyCreate, AgencyRead, AgencyStats, AgencySuspension, AgencyUpdate, AgencyValidation,
)
from app.schemas.common import Page
from app.services.agency import AgencyService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/agencies", tags=["Agences"])


@router.get("", response_model=Page[AgencyRead], summary="Lister les agences",
            dependencies=[SuperAdminOnly])
async def list_agencies(
    session: DbSession, pagination: PaginationDep,
    q: str | None = Query(default=None),
    agency_status: AgencyStatus | None = Query(default=None, alias="status"),
    city: str | None = Query(default=None),
):
    items, total = await AgencyService(session).repo.search(
        term=q, status=agency_status, city=city,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [AgencyRead.model_validate(item) for item in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=AgencyRead, status_code=status.HTTP_201_CREATED,
             summary="Créer une agence", dependencies=[SuperAdminOnly])
async def create_agency(data: AgencyCreate, ctx: Ctx, session: DbSession):
    agency = await AgencyService(session).create(data, ctx)
    await session.commit()
    return agency


@router.get("/me", response_model=AgencyRead, summary="Mon agence")
async def my_agency(ctx: Ctx, session: DbSession):
    from app.core.exceptions import NotFoundError

    if not ctx.agency_id:
        raise NotFoundError("Aucune agence rattachée à votre compte.")
    return await AgencyService(session).get_or_404(ctx.agency_id)


@router.get("/{agency_id}", response_model=AgencyRead, summary="Détail d'une agence")
async def get_agency(agency_id: uuid.UUID, ctx: Ctx, session: DbSession):
    agency = await AgencyService(session).get_or_404(agency_id)
    if not ctx.is_super_admin:
        ctx.require_same_agency(agency.id)
    return agency


@router.patch("/{agency_id}", response_model=AgencyRead, summary="Modifier une agence",
              dependencies=[AgencyOnly])
async def update_agency(agency_id: uuid.UUID, data: AgencyUpdate, ctx: Ctx, session: DbSession):
    agency = await AgencyService(session).update(agency_id, data, ctx)
    await session.commit()
    return agency


@router.post("/{agency_id}/validate", response_model=AgencyRead,
             summary="Valider ou rejeter une agence (Super Admin)", dependencies=[SuperAdminOnly])
async def validate_agency(
    agency_id: uuid.UUID, data: AgencyValidation, ctx: Ctx, session: DbSession
):
    agency = await AgencyService(session).validate(agency_id, data.approve, data.reason, ctx)
    await session.commit()
    return agency


@router.post("/{agency_id}/suspend", response_model=AgencyRead, summary="Suspendre une agence",
             dependencies=[SuperAdminOnly])
async def suspend_agency(
    agency_id: uuid.UUID, data: AgencySuspension, ctx: Ctx, session: DbSession
):
    agency = await AgencyService(session).suspend(agency_id, data.reason, ctx)
    await session.commit()
    return agency


@router.post("/{agency_id}/activate", response_model=AgencyRead, summary="Réactiver une agence",
             dependencies=[SuperAdminOnly])
async def activate_agency(agency_id: uuid.UUID, ctx: Ctx, session: DbSession):
    agency = await AgencyService(session).activate(agency_id, ctx)
    await session.commit()
    return agency


@router.get("/{agency_id}/stats", response_model=AgencyStats, summary="Statistiques de l'agence")
async def agency_stats(agency_id: uuid.UUID, ctx: Ctx, session: DbSession):
    if not ctx.is_super_admin:
        ctx.require_same_agency(agency_id)
    return await AgencyService(session).stats(agency_id)
