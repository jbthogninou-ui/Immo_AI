"""Repository visites."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import and_, func, or_, select

from app.core.permissions import SecurityContext
from app.models.enums import VisitStatus
from app.models.visit import Visit
from app.repositories.base import BaseRepository
from app.schemas.visit import VisitFilters


class VisitRepository(BaseRepository[Visit]):
    model = Visit

    def scoped_query(
        self,
        ctx: SecurityContext,
        *,
        agent_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        owner_property_ids: list[uuid.UUID] | None = None,
    ):
        stmt = select(Visit)
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency:
            return stmt.where(Visit.agency_id == ctx.agency_id)
        if ctx.is_agent:
            return stmt.where(Visit.agency_id == ctx.agency_id, Visit.agent_id == agent_id)
        if ctx.is_client:
            return stmt.where(Visit.client_id == client_id)
        if ctx.is_owner:
            ids = owner_property_ids or []
            return stmt.where(Visit.property_id.in_(ids)) if ids else stmt.where(Visit.id.is_(None))
        return stmt.where(Visit.id.is_(None))

    async def search(
        self,
        ctx: SecurityContext,
        filters: VisitFilters,
        *,
        agent_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        owner_property_ids: list[uuid.UUID] | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = self.scoped_query(
            ctx, agent_id=agent_id, client_id=client_id, owner_property_ids=owner_property_ids
        )
        if filters.status:
            stmt = stmt.where(Visit.status == filters.status)
        if filters.property_id:
            stmt = stmt.where(Visit.property_id == filters.property_id)
        if filters.client_id:
            stmt = stmt.where(Visit.client_id == filters.client_id)
        if filters.agent_id:
            stmt = stmt.where(Visit.agent_id == filters.agent_id)
        if filters.date_from:
            stmt = stmt.where(Visit.scheduled_at >= filters.date_from)
        if filters.date_to:
            stmt = stmt.where(Visit.scheduled_at <= filters.date_to)
        stmt = stmt.order_by(Visit.scheduled_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def has_conflict(
        self,
        *,
        agent_id: uuid.UUID | None,
        scheduled_at: datetime,
        duration_minutes: int,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        """Détecte un chevauchement d'agenda pour l'agent."""
        if not agent_id:
            return False
        end = scheduled_at + timedelta(minutes=duration_minutes)
        stmt = select(func.count()).select_from(Visit).where(
            Visit.agent_id == agent_id,
            Visit.status.in_([VisitStatus.REQUESTED, VisitStatus.CONFIRMED, VisitStatus.RESCHEDULED]),
            and_(
                Visit.scheduled_at < end,
                func.coalesce(Visit.scheduled_at, scheduled_at) >= scheduled_at - timedelta(hours=8),
            ),
        )
        if exclude_id:
            stmt = stmt.where(Visit.id != exclude_id)
        rows = (await self.session.execute(stmt)).scalar_one()
        return bool(rows)

    async def count_pending(self, agency_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Visit).where(
            Visit.agency_id == agency_id, Visit.status == VisitStatus.REQUESTED
        )
        return int((await self.session.execute(stmt)).scalar_one())
