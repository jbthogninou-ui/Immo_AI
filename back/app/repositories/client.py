"""Repositories CRM clients."""
from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select

from app.core.permissions import SecurityContext
from app.models.client import (
    Client, ClientAgent, ClientFavorite, ClientRequest, ClientSearchHistory,
)
from app.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    model = Client

    def scoped_query(self, ctx: SecurityContext, agent_id: uuid.UUID | None = None):
        stmt = select(Client)
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency:
            return stmt.where(Client.agency_id == ctx.agency_id)
        if ctx.is_agent:
            # Un agent ne voit que les clients qui lui sont attribués.
            sub = select(ClientAgent.client_id).where(
                ClientAgent.agent_id == agent_id,
                ClientAgent.unassigned_at.is_(None),
            )
            return stmt.where(Client.agency_id == ctx.agency_id, Client.id.in_(sub))
        if ctx.is_client:
            return stmt.where(Client.user_id == ctx.user_id)
        return stmt.where(Client.id.is_(None))

    async def get_by_user(self, user_id: uuid.UUID) -> Client | None:
        return await self.get_by(user_id=user_id)

    async def get_by_agency_email(self, agency_id: uuid.UUID, email: str) -> Client | None:
        stmt = select(Client).where(
            Client.agency_id == agency_id, func.lower(Client.email) == email.lower()
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def search(
        self,
        ctx: SecurityContext,
        *,
        agent_id: uuid.UUID | None = None,
        term: str | None = None,
        is_active: bool | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = self.scoped_query(ctx, agent_id)
        if is_active is not None:
            stmt = stmt.where(Client.is_active == is_active)
        if term:
            like = f"%{term.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Client.first_name).like(like),
                    func.lower(Client.last_name).like(like),
                    func.lower(Client.email).like(like),
                )
            )
        stmt = stmt.order_by(Client.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)


class ClientAgentRepository(BaseRepository[ClientAgent]):
    model = ClientAgent

    async def get_link(self, client_id: uuid.UUID, agent_id: uuid.UUID) -> ClientAgent | None:
        return await self.get_by(client_id=client_id, agent_id=agent_id)

    async def list_for_client(self, client_id: uuid.UUID):
        stmt = select(ClientAgent).where(
            ClientAgent.client_id == client_id, ClientAgent.unassigned_at.is_(None)
        )
        return (await self.session.execute(stmt)).scalars().all()

    async def is_assigned(self, client_id: uuid.UUID, agent_id: uuid.UUID) -> bool:
        stmt = select(func.count()).select_from(ClientAgent).where(
            ClientAgent.client_id == client_id,
            ClientAgent.agent_id == agent_id,
            ClientAgent.unassigned_at.is_(None),
        )
        return bool((await self.session.execute(stmt)).scalar_one())


class ClientFavoriteRepository(BaseRepository[ClientFavorite]):
    model = ClientFavorite

    async def list_for_client(self, client_id: uuid.UUID, *, limit: int, offset: int):
        stmt = (
            select(ClientFavorite)
            .where(ClientFavorite.client_id == client_id)
            .order_by(ClientFavorite.created_at.desc())
        )
        return await self.paginate(stmt, limit=limit, offset=offset)


class ClientSearchHistoryRepository(BaseRepository[ClientSearchHistory]):
    model = ClientSearchHistory

    async def list_for_client(self, client_id: uuid.UUID, *, limit: int, offset: int):
        stmt = (
            select(ClientSearchHistory)
            .where(ClientSearchHistory.client_id == client_id)
            .order_by(ClientSearchHistory.created_at.desc())
        )
        return await self.paginate(stmt, limit=limit, offset=offset)


class ClientRequestRepository(BaseRepository[ClientRequest]):
    model = ClientRequest

    async def list_for_agency(
        self, agency_id: uuid.UUID, *, client_id: uuid.UUID | None, limit: int, offset: int
    ):
        stmt = select(ClientRequest).where(ClientRequest.agency_id == agency_id)
        if client_id:
            stmt = stmt.where(ClientRequest.client_id == client_id)
        stmt = stmt.order_by(ClientRequest.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)
