"""Endpoints propriétaires (workflows invitation et inscription autonome)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.api.deps import AgencyOnly, AgencyStaff, Ctx, DbSession, ScopeDep
from app.models.enums import OwnerStatus
from app.schemas.common import MessageResponse, Page
from app.schemas.owner import (
    OwnerInviteRequest, OwnerInviteResponse, OwnerProfileCompletion, OwnerRead,
    OwnerSelfRegisterRequest, OwnerUpdate, OwnerVerification,
)
from app.services.owner import OwnerService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/owners", tags=["Propriétaires"])


class AcceptOwnerInvitation(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


@router.post("/register", response_model=OwnerRead, status_code=status.HTTP_201_CREATED,
             summary="Inscription autonome d'un propriétaire (workflow 2)")
async def self_register(data: OwnerSelfRegisterRequest, session: DbSession):
    owner = await OwnerService(session).self_register(data)
    await session.commit()
    return owner


@router.post("/accept-invitation", response_model=OwnerRead,
             summary="Acceptation d'une invitation propriétaire (workflow 1)")
async def accept_invitation(data: AcceptOwnerInvitation, session: DbSession):
    owner = await OwnerService(session).accept_invitation(data.token, data.password)
    await session.commit()
    return owner


@router.get("", response_model=Page[OwnerRead], summary="Lister les propriétaires")
async def list_owners(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    q: str | None = Query(default=None),
    owner_status: OwnerStatus | None = Query(default=None, alias="status"),
    agent_id: uuid.UUID | None = Query(default=None),
):
    items, total = await OwnerService(session).list(
        ctx, term=q, status=owner_status, agent_id=agent_id,
        scope_agent_id=scope.agent_id, limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [OwnerRead.model_validate(item) for item in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=OwnerInviteResponse, status_code=status.HTTP_201_CREATED,
             summary="Créer un propriétaire et l'inviter (workflow 1)",
             dependencies=[AgencyStaff])
async def invite_owner(data: OwnerInviteRequest, ctx: Ctx, scope: ScopeDep, session: DbSession):
    owner, url = await OwnerService(session).invite(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return OwnerInviteResponse(owner=OwnerRead.model_validate(owner), invitation_url=url)


@router.get("/{owner_id}", response_model=OwnerRead, summary="Détail d'un propriétaire")
async def get_owner(owner_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await OwnerService(session).get_or_404(owner_id, ctx)


@router.patch("/{owner_id}", response_model=OwnerRead, summary="Modifier un propriétaire")
async def update_owner(owner_id: uuid.UUID, data: OwnerUpdate, ctx: Ctx, session: DbSession):
    owner = await OwnerService(session).update(owner_id, data, ctx)
    await session.commit()
    return owner


@router.post("/{owner_id}/complete-profile", response_model=OwnerRead,
             summary="Compléter le profil propriétaire")
async def complete_profile(
    owner_id: uuid.UUID, data: OwnerProfileCompletion, ctx: Ctx, session: DbSession
):
    owner = await OwnerService(session).complete_profile(owner_id, data, ctx)
    await session.commit()
    return owner


@router.post("/{owner_id}/verify", response_model=OwnerRead,
             summary="Vérifier le dossier propriétaire (agence)", dependencies=[AgencyOnly])
async def verify_owner(
    owner_id: uuid.UUID, data: OwnerVerification, ctx: Ctx, session: DbSession
):
    owner = await OwnerService(session).verify(owner_id, data.approve, data.reason, ctx)
    await session.commit()
    return owner


@router.post("/{owner_id}/suspend", response_model=OwnerRead, summary="Suspendre un propriétaire",
             dependencies=[AgencyOnly])
async def suspend_owner(owner_id: uuid.UUID, ctx: Ctx, session: DbSession):
    owner = await OwnerService(session).suspend(owner_id, ctx)
    await session.commit()
    return owner


@router.get("/{owner_id}/documents", response_model=MessageResponse, include_in_schema=False)
async def owner_documents_hint(owner_id: uuid.UUID):
    return MessageResponse(
        message=f"Utilisez GET /documents?entity_type=OWNER&entity_id={owner_id}"
    )
