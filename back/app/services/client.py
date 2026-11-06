"""Service CRM clients : fiche, attribution agent, favoris, historique."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.client import Client, ClientAgent, ClientFavorite, ClientRequest, ClientSearchHistory
from app.repositories.agency import AgentRepository
from app.repositories.client import (
    ClientAgentRepository, ClientFavoriteRepository, ClientRepository,
    ClientRequestRepository, ClientSearchHistoryRepository,
)
from app.repositories.property import PropertyRepository
from app.schemas.client import ClientCreate, ClientRequestCreate, ClientUpdate
from app.services.audit import AuditService


class ClientService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ClientRepository(session)
        self.links = ClientAgentRepository(session)
        self.favorites = ClientFavoriteRepository(session)
        self.history = ClientSearchHistoryRepository(session)
        self.requests = ClientRequestRepository(session)
        self.agents = AgentRepository(session)
        self.properties = PropertyRepository(session)
        self.audit = AuditService(session)

    async def get_or_404(
        self, client_id: uuid.UUID, ctx: SecurityContext, *, agent_id: uuid.UUID | None = None
    ) -> Client:
        client = await self.repo.get(client_id)
        if not client:
            raise NotFoundError("Client introuvable.")
        if ctx.is_client:
            if client.user_id != ctx.user_id:
                raise PermissionDeniedError("Accès limité à votre propre fiche client.")
            return client
        if ctx.is_owner:
            raise PermissionDeniedError("Les propriétaires n'accèdent pas au CRM clients.")
        ctx.require_same_agency(client.agency_id)
        if ctx.is_agent and agent_id and not await self.links.is_assigned(client.id, agent_id):
            raise PermissionDeniedError("Ce client ne vous est pas attribué.")
        return client

    async def create(
        self, data: ClientCreate, ctx: SecurityContext, *, agent_id: uuid.UUID | None
    ) -> Client:
        if not ctx.agency_id:
            raise PermissionDeniedError("Aucune agence rattachée à votre compte.")
        if await self.repo.get_by_agency_email(ctx.agency_id, data.email):
            raise ConflictError("Ce client existe déjà dans votre agence.")

        payload = data.model_dump(exclude={"agent_id"})
        client = await self.repo.create(agency_id=ctx.agency_id, **payload)

        # Règle métier : un client appartient à un agent après interaction.
        target_agent = data.agent_id or agent_id
        if target_agent:
            await self.assign(client.id, target_agent, ctx, is_primary=True)

        await self.audit.log(
            action="client.create", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="client", resource_id=client.id,
        )
        return client

    async def assign(
        self, client_id: uuid.UUID, agent_id: uuid.UUID, ctx: SecurityContext, *, is_primary: bool = True
    ) -> ClientAgent:
        client = await self.repo.get(client_id)
        if not client:
            raise NotFoundError("Client introuvable.")
        ctx.require_same_agency(client.agency_id)

        agent = await self.agents.get(agent_id)
        if not agent or agent.agency_id != client.agency_id:
            raise NotFoundError("Agent introuvable dans cette agence.")

        existing = await self.links.get_link(client_id, agent_id)
        if existing:
            existing.unassigned_at = None
            existing.is_primary = is_primary
            await self.session.flush()
            return existing

        if is_primary:
            for link in await self.links.list_for_client(client_id):
                link.is_primary = False

        link = await self.links.create(
            client_id=client_id,
            agent_id=agent_id,
            agency_id=client.agency_id,
            is_primary=is_primary,
            assigned_at=datetime.now(timezone.utc),
        )
        await self.audit.log(
            action="client.assign", user_id=ctx.user_id, agency_id=client.agency_id,
            resource_type="client", resource_id=client_id, payload={"agent_id": str(agent_id)},
        )
        return link

    async def unassign(self, client_id: uuid.UUID, agent_id: uuid.UUID, ctx: SecurityContext) -> None:
        link = await self.links.get_link(client_id, agent_id)
        if not link:
            raise NotFoundError("Attribution introuvable.")
        ctx.require_same_agency(link.agency_id)
        link.unassigned_at = datetime.now(timezone.utc)
        link.is_primary = False
        await self.session.flush()

    async def update(
        self, client_id: uuid.UUID, data: ClientUpdate, ctx: SecurityContext, *, agent_id=None
    ) -> Client:
        client = await self.get_or_404(client_id, ctx, agent_id=agent_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(client, key, value)
        await self.session.flush()
        return client

    async def delete(self, client_id: uuid.UUID, ctx: SecurityContext) -> None:
        client = await self.get_or_404(client_id, ctx)
        if not (ctx.is_agency or ctx.is_super_admin):
            raise PermissionDeniedError("Seule l'agence peut supprimer une fiche client.")
        await self.repo.delete(client)
        await self.audit.log(
            action="client.delete", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="client", resource_id=client_id,
        )

    async def list(self, ctx: SecurityContext, *, agent_id, term, is_active, limit, offset):
        return await self.repo.search(
            ctx, agent_id=agent_id, term=term, is_active=is_active, limit=limit, offset=offset
        )

    # ------------------------------- Favoris -------------------------------- #
    async def add_favorite(self, client_id: uuid.UUID, property_id: uuid.UUID, ctx: SecurityContext):
        client = await self.get_or_404(client_id, ctx)
        prop = await self.properties.get(property_id)
        if not prop:
            raise NotFoundError("Bien introuvable.")
        existing = await self.favorites.get_by(client_id=client.id, property_id=property_id)
        if existing:
            return existing
        return await self.favorites.create(client_id=client.id, property_id=property_id)

    async def remove_favorite(self, client_id: uuid.UUID, property_id: uuid.UUID, ctx: SecurityContext):
        client = await self.get_or_404(client_id, ctx)
        favorite = await self.favorites.get_by(client_id=client.id, property_id=property_id)
        if not favorite:
            raise NotFoundError("Favori introuvable.")
        await self.favorites.delete(favorite)

    async def list_favorites(self, client_id: uuid.UUID, ctx: SecurityContext, *, limit, offset):
        client = await self.get_or_404(client_id, ctx)
        return await self.favorites.list_for_client(client.id, limit=limit, offset=offset)

    # ------------------------- Historique de recherche ---------------------- #
    async def record_search(
        self, client_id: uuid.UUID, query: str, filters: dict, results_count: int
    ) -> ClientSearchHistory:
        return await self.history.create(
            client_id=client_id, query=query[:500], filters=filters, results_count=results_count
        )

    async def list_history(self, client_id: uuid.UUID, ctx: SecurityContext, *, limit, offset):
        client = await self.get_or_404(client_id, ctx)
        return await self.history.list_for_client(client.id, limit=limit, offset=offset)

    # ------------------------------- Demandes ------------------------------- #
    async def create_request(
        self, client_id: uuid.UUID, data: ClientRequestCreate, ctx: SecurityContext
    ) -> ClientRequest:
        client = await self.get_or_404(client_id, ctx)
        links = await self.links.list_for_client(client.id)
        primary = next((l for l in links if l.is_primary), links[0] if links else None)
        return await self.requests.create(
            agency_id=client.agency_id,
            client_id=client.id,
            agent_id=primary.agent_id if primary else None,
            property_id=data.property_id,
            subject=data.subject,
            message=data.message,
        )

    async def list_requests(self, ctx: SecurityContext, *, client_id, limit, offset):
        if not ctx.agency_id and not ctx.is_super_admin:
            raise PermissionDeniedError("Périmètre agence requis.")
        return await self.requests.list_for_agency(
            ctx.agency_id, client_id=client_id, limit=limit, offset=offset
        )
