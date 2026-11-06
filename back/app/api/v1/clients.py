"""Endpoints CRM clients."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AgencyOnly, AgencyStaff, Ctx, DbSession, ScopeDep
from app.schemas.client import (
    ClientAgentRead, ClientAssign, ClientCreate, ClientRead, ClientRequestCreate,
    ClientRequestRead, ClientUpdate, FavoriteRead, SearchHistoryRead,
)
from app.schemas.common import MessageResponse, Page
from app.services.client import ClientService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/clients", tags=["CRM Clients"])


@router.get("", response_model=Page[ClientRead], summary="Lister les clients")
async def list_clients(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
):
    items, total = await ClientService(session).list(
        ctx, agent_id=scope.agent_id, term=q, is_active=is_active,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [ClientRead.model_validate(item) for item in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED,
             summary="Créer un client", dependencies=[AgencyStaff])
async def create_client(data: ClientCreate, ctx: Ctx, scope: ScopeDep, session: DbSession):
    client = await ClientService(session).create(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return client


@router.get("/{client_id}", response_model=ClientRead, summary="Détail d'un client")
async def get_client(client_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    return await ClientService(session).get_or_404(client_id, ctx, agent_id=scope.agent_id)


@router.patch("/{client_id}", response_model=ClientRead, summary="Modifier un client")
async def update_client(
    client_id: uuid.UUID, data: ClientUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    client = await ClientService(session).update(client_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return client


@router.delete("/{client_id}", response_model=MessageResponse, summary="Supprimer un client",
               dependencies=[AgencyOnly])
async def delete_client(client_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await ClientService(session).delete(client_id, ctx)
    await session.commit()
    return MessageResponse(message="Client supprimé.")


@router.post("/{client_id}/assign", response_model=ClientAgentRead,
             summary="Attribuer un client à un agent", dependencies=[AgencyStaff])
async def assign_client(
    client_id: uuid.UUID, data: ClientAssign, ctx: Ctx, session: DbSession
):
    link = await ClientService(session).assign(
        client_id, data.agent_id, ctx, is_primary=data.is_primary
    )
    await session.commit()
    return link


@router.delete("/{client_id}/assign/{agent_id}", response_model=MessageResponse,
               summary="Retirer l'attribution", dependencies=[AgencyOnly])
async def unassign_client(
    client_id: uuid.UUID, agent_id: uuid.UUID, ctx: Ctx, session: DbSession
):
    await ClientService(session).unassign(client_id, agent_id, ctx)
    await session.commit()
    return MessageResponse(message="Attribution retirée.")


@router.get("/{client_id}/favorites", response_model=Page[FavoriteRead], summary="Favoris du client")
async def list_favorites(
    client_id: uuid.UUID, ctx: Ctx, session: DbSession, pagination: PaginationDep
):
    items, total = await ClientService(session).list_favorites(
        client_id, ctx, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [FavoriteRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("/{client_id}/favorites/{property_id}", response_model=FavoriteRead,
             status_code=status.HTTP_201_CREATED, summary="Ajouter un favori")
async def add_favorite(
    client_id: uuid.UUID, property_id: uuid.UUID, ctx: Ctx, session: DbSession
):
    favorite = await ClientService(session).add_favorite(client_id, property_id, ctx)
    await session.commit()
    return favorite


@router.delete("/{client_id}/favorites/{property_id}", response_model=MessageResponse,
               summary="Retirer un favori")
async def remove_favorite(
    client_id: uuid.UUID, property_id: uuid.UUID, ctx: Ctx, session: DbSession
):
    await ClientService(session).remove_favorite(client_id, property_id, ctx)
    await session.commit()
    return MessageResponse(message="Favori retiré.")


@router.get("/{client_id}/search-history", response_model=Page[SearchHistoryRead],
            summary="Historique de recherche")
async def search_history(
    client_id: uuid.UUID, ctx: Ctx, session: DbSession, pagination: PaginationDep
):
    items, total = await ClientService(session).list_history(
        client_id, ctx, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [SearchHistoryRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("/{client_id}/requests", response_model=ClientRequestRead,
             status_code=status.HTTP_201_CREATED, summary="Créer une demande client")
async def create_request(
    client_id: uuid.UUID, data: ClientRequestCreate, ctx: Ctx, session: DbSession
):
    request = await ClientService(session).create_request(client_id, data, ctx)
    await session.commit()
    return request


@router.get("/requests/all", response_model=Page[ClientRequestRead],
            summary="Lister les demandes de l'agence", dependencies=[AgencyStaff])
async def list_requests(
    ctx: Ctx, session: DbSession, pagination: PaginationDep,
    client_id: uuid.UUID | None = Query(default=None),
):
    items, total = await ClientService(session).list_requests(
        ctx, client_id=client_id, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [ClientRequestRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )
