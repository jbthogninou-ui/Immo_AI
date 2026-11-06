"""Repositories agences et agents."""
from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.models.agency import Agency, Agent
from app.models.enums import AgencyStatus, AgentStatus
from app.repositories.base import BaseRepository


class AgencyRepository(BaseRepository[Agency]):
    model = Agency

    async def get_by_slug(self, slug: str) -> Agency | None:
        return await self.get_by(slug=slug)

    async def slug_exists(self, slug: str) -> bool:
        return await self.exists(slug=slug)

    async def search(
        self,
        *,
        term: str | None = None,
        status: AgencyStatus | None = None,
        city: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = select(Agency)
        if status:
            stmt = stmt.where(Agency.status == status)
        if city:
            stmt = stmt.where(func.lower(Agency.city) == city.lower())
        if term:
            like = f"%{term.lower()}%"
            stmt = stmt.where(
                or_(func.lower(Agency.name).like(like), func.lower(Agency.email).like(like))
            )
        stmt = stmt.order_by(Agency.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)


class AgentRepository(BaseRepository[Agent]):
    model = Agent

    async def get_with_user(self, agent_id: uuid.UUID) -> Agent | None:
        stmt = (
            select(Agent).options(joinedload(Agent.user)).where(Agent.id == agent_id)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def get_by_user(self, user_id: uuid.UUID) -> Agent | None:
        return await self.get_by(user_id=user_id)

    async def list_for_agency(
        self,
        agency_id: uuid.UUID,
        *,
        status: AgentStatus | None = None,
        term: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = (
            select(Agent)
            .options(joinedload(Agent.user))
            .where(Agent.agency_id == agency_id)
        )
        if status:
            stmt = stmt.where(Agent.status == status)
        if term:
            from app.models.user import User

            like = f"%{term.lower()}%"
            stmt = stmt.join(User, User.id == Agent.user_id).where(
                or_(func.lower(User.full_name).like(like), func.lower(User.email).like(like))
            )
        stmt = stmt.order_by(Agent.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def count_for_agency(self, agency_id: uuid.UUID) -> int:
        return await self.count(agency_id=agency_id)
