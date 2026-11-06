"""Endpoints d'administration plateforme (Super Admin) et journal d'audit."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import AgencyOnly, Ctx, DbSession, SuperAdminOnly
from app.models.enums import AgencyStatus
from app.repositories.agency import AgencyRepository
from app.repositories.audit import AuditLogRepository
from app.repositories.property import PropertyRepository
from app.repositories.user import UserRepository
from app.schemas.audit import AuditFilters, AuditLogRead
from app.schemas.common import Page
from app.utils.pagination import PaginationDep
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Administration"])

Filters = Annotated[AuditFilters, Depends()]


class PlatformStats(BaseModel):
    users: int
    agencies: int
    agencies_pending: int
    agencies_active: int
    properties: int


@router.get("/stats", response_model=PlatformStats, summary="Statistiques plateforme",
            dependencies=[SuperAdminOnly])
async def platform_stats(session: DbSession):
    agencies = AgencyRepository(session)
    return PlatformStats(
        users=await UserRepository(session).count(),
        agencies=await agencies.count(),
        agencies_pending=await agencies.count(status=AgencyStatus.PENDING_VALIDATION),
        agencies_active=await agencies.count(status=AgencyStatus.ACTIVE),
        properties=await PropertyRepository(session).count(),
    )


@router.get("/audit-logs", response_model=Page[AuditLogRead], summary="Journal d'audit",
            dependencies=[AgencyOnly])
async def audit_logs(ctx: Ctx, session: DbSession, pagination: PaginationDep, filters: Filters):
    items, total = await AuditLogRepository(session).search(
        ctx, filters, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [AuditLogRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )
