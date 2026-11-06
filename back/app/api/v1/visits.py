"""Endpoints visites."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, status

from app.api.deps import AgencyStaff, Ctx, DbSession, ScopeDep, owner_property_ids
from app.schemas.common import Page
from app.schemas.visit import (
    VisitDecision, VisitFeedback, VisitFilters, VisitRead, VisitRequestCreate, VisitUpdate,
)
from app.services.visit import VisitService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/visits", tags=["Visites"])

Filters = Annotated[VisitFilters, Depends()]
OwnerProperties = Annotated[list[uuid.UUID], Depends(owner_property_ids)]


@router.get("", response_model=Page[VisitRead], summary="Lister les visites du périmètre")
async def list_visits(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    filters: Filters, owner_props: OwnerProperties,
):
    items, total = await VisitService(session).list(
        ctx, filters, agent_id=scope.agent_id, client_id=scope.client_id,
        owner_property_ids=owner_props, limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [VisitRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=VisitRead, status_code=status.HTTP_201_CREATED,
             summary="Demander ou programmer une visite")
async def request_visit(
    data: VisitRequestCreate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    visit = await VisitService(session).request(data, ctx, client_id=scope.client_id)
    await session.commit()
    return visit


@router.get("/{visit_id}", response_model=VisitRead, summary="Détail d'une visite")
async def get_visit(
    visit_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    return await VisitService(session).get_or_404(
        visit_id, ctx, agent_id=scope.agent_id, client_id=scope.client_id, owner_id=scope.owner_id
    )


@router.post("/{visit_id}/decision", response_model=VisitRead,
             summary="Valider, refuser ou reprogrammer", dependencies=[AgencyStaff])
async def decide_visit(
    visit_id: uuid.UUID, data: VisitDecision, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    visit = await VisitService(session).decide(visit_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return visit


@router.patch("/{visit_id}", response_model=VisitRead, summary="Modifier une visite",
              dependencies=[AgencyStaff])
async def update_visit(
    visit_id: uuid.UUID, data: VisitUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    visit = await VisitService(session).update(visit_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return visit


@router.post("/{visit_id}/cancel", response_model=VisitRead, summary="Annuler une visite")
async def cancel_visit(
    visit_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession,
    reason: str | None = Body(default=None, embed=True),
):
    visit = await VisitService(session).cancel(
        visit_id, reason, ctx,
        agent_id=scope.agent_id, client_id=scope.client_id, owner_id=scope.owner_id,
    )
    await session.commit()
    return visit


@router.post("/{visit_id}/complete", response_model=VisitRead, summary="Clôturer une visite",
             dependencies=[AgencyStaff])
async def complete_visit(
    visit_id: uuid.UUID, data: VisitFeedback, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    visit = await VisitService(session).complete(visit_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return visit
