"""Endpoints de gestion des agents."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AgencyOnly, AgencyStaff, Ctx, DbSession
from app.models.enums import AgentStatus
from app.schemas.agency import (
    AgentInvitationUpdate,
    AgentInvite,
    AgentInviteResponse,
    AgentRead,
    AgentUpdate,
    InvitationLinkResponse,
)
from app.schemas.common import MessageResponse, Page
from app.services.agent import AgentService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=Page[AgentRead], summary="Lister les agents",
            dependencies=[AgencyStaff])
async def list_agents(
    ctx: Ctx, session: DbSession, pagination: PaginationDep,
    agency_id: uuid.UUID | None = Query(default=None, description="Réservé au Super Admin"),
    agent_status: AgentStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
):
    items, total = await AgentService(session).list(
        ctx, agency_id=agency_id, status=agent_status, term=q,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [AgentRead.model_validate(item) for item in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=AgentInviteResponse, status_code=status.HTTP_201_CREATED,
             summary="Créer et inviter un agent", dependencies=[AgencyOnly])
async def invite_agent(
    data: AgentInvite, ctx: Ctx, session: DbSession,
    agency_id: uuid.UUID | None = Query(default=None, description="Réservé au Super Admin"),
):
    agent, url = await AgentService(session).invite(data, ctx, agency_id=agency_id)
    await session.commit()
    return AgentInviteResponse(agent=AgentRead.model_validate(agent), invitation_url=url)


@router.get("/{agent_id}", response_model=AgentRead, summary="Détail d'un agent",
            dependencies=[AgencyStaff])
async def get_agent(agent_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await AgentService(session).get_or_404(agent_id, ctx)


@router.patch("/{agent_id}", response_model=AgentRead, summary="Modifier un agent",
              dependencies=[AgencyOnly])
async def update_agent(agent_id: uuid.UUID, data: AgentUpdate, ctx: Ctx, session: DbSession):
    agent = await AgentService(session).update(agent_id, data, ctx)
    await session.commit()
    return agent


@router.patch("/{agent_id}/invitation", response_model=AgentRead,
              summary="Corriger une invitation en attente",
              dependencies=[AgencyOnly])
async def update_invitation(
    agent_id: uuid.UUID, data: AgentInvitationUpdate, ctx: Ctx, session: DbSession
):
    agent = await AgentService(session).update_invitation(agent_id, data, ctx)
    await session.commit()
    return agent


@router.post("/{agent_id}/resend-invitation", response_model=InvitationLinkResponse,
             summary="Renvoyer l'invitation", dependencies=[AgencyOnly])
async def resend_invitation(agent_id: uuid.UUID, ctx: Ctx, session: DbSession):
    """Génère un nouveau lien d'activation et invalide le précédent."""
    url = await AgentService(session).resend_invitation(agent_id, ctx)
    await session.commit()
    return InvitationLinkResponse(
        message="Nouveau lien d'activation généré. Le lien précédent n'est plus valable.",
        invitation_url=url,
    )


@router.post("/{agent_id}/suspend", response_model=AgentRead, summary="Suspendre un agent",
             dependencies=[AgencyOnly])
async def suspend_agent(agent_id: uuid.UUID, ctx: Ctx, session: DbSession):
    agent = await AgentService(session).set_status(agent_id, AgentStatus.SUSPENDED, ctx)
    await session.commit()
    return agent


@router.post("/{agent_id}/activate", response_model=AgentRead, summary="Activer un agent",
             dependencies=[AgencyOnly])
async def activate_agent(agent_id: uuid.UUID, ctx: Ctx, session: DbSession):
    agent = await AgentService(session).set_status(agent_id, AgentStatus.ACTIVE, ctx)
    await session.commit()
    return agent


@router.delete("/{agent_id}", response_model=MessageResponse, summary="Supprimer un agent",
               dependencies=[AgencyOnly])
async def delete_agent(agent_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await AgentService(session).delete(agent_id, ctx)
    await session.commit()
    return MessageResponse(message="Agent supprimé.")
