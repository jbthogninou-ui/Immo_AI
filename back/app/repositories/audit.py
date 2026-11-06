"""Repository journal d'audit."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.permissions import SecurityContext
from app.models.audit import AuditLog
from app.repositories.base import BaseRepository
from app.schemas.audit import AuditFilters


class AuditLogRepository(BaseRepository[AuditLog]):
    model = AuditLog

    async def search(self, ctx: SecurityContext, filters: AuditFilters, *, limit: int, offset: int):
        stmt = select(AuditLog)
        if not ctx.is_super_admin:
            stmt = stmt.where(AuditLog.agency_id == ctx.agency_id)
        if filters.action:
            stmt = stmt.where(AuditLog.action == filters.action)
        if filters.resource_type:
            stmt = stmt.where(AuditLog.resource_type == filters.resource_type)
        if filters.user_id:
            stmt = stmt.where(AuditLog.user_id == filters.user_id)
        if filters.date_from:
            stmt = stmt.where(AuditLog.created_at >= filters.date_from)
        if filters.date_to:
            stmt = stmt.where(AuditLog.created_at <= filters.date_to)
        stmt = stmt.order_by(AuditLog.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)
