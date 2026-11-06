"""Repositories transactions (ventes, locations, contrats)."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.core.permissions import SecurityContext
from app.models.enums import RentalStatus, SaleStatus
from app.models.transaction import Contract, Rental, Sale
from app.repositories.base import BaseRepository


class _ScopedTransactionRepository(BaseRepository):
    """Facteur commun de périmètre pour ventes et locations."""

    def scoped_query(
        self,
        ctx: SecurityContext,
        *,
        agent_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        owner_id: uuid.UUID | None = None,
    ):
        model = self.model
        stmt = select(model)
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency:
            return stmt.where(model.agency_id == ctx.agency_id)
        if ctx.is_agent:
            return stmt.where(model.agency_id == ctx.agency_id, model.agent_id == agent_id)
        if ctx.is_client:
            return stmt.where(model.client_id == client_id)
        if ctx.is_owner:
            return stmt.where(model.owner_id == owner_id)
        return stmt.where(model.id.is_(None))


class SaleRepository(_ScopedTransactionRepository):
    model = Sale

    async def next_reference(self, agency_id: uuid.UUID) -> str:
        total = await self.count(agency_id=agency_id)
        return f"VTE-{str(agency_id)[:4].upper()}-{total + 1:05d}"

    async def search(self, ctx: SecurityContext, *, status: SaleStatus | None = None,
                     property_id: uuid.UUID | None = None, agent_id: uuid.UUID | None = None,
                     client_id: uuid.UUID | None = None, owner_id: uuid.UUID | None = None,
                     limit: int = 20, offset: int = 0):
        stmt = self.scoped_query(ctx, agent_id=agent_id, client_id=client_id, owner_id=owner_id)
        if status:
            stmt = stmt.where(Sale.status == status)
        if property_id:
            stmt = stmt.where(Sale.property_id == property_id)
        stmt = stmt.order_by(Sale.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def count_completed(self, agency_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Sale).where(
            Sale.agency_id == agency_id, Sale.status == SaleStatus.COMPLETED
        )
        return int((await self.session.execute(stmt)).scalar_one())


class RentalRepository(_ScopedTransactionRepository):
    model = Rental

    async def next_reference(self, agency_id: uuid.UUID) -> str:
        total = await self.count(agency_id=agency_id)
        return f"LOC-{str(agency_id)[:4].upper()}-{total + 1:05d}"

    async def search(self, ctx: SecurityContext, *, status: RentalStatus | None = None,
                     property_id: uuid.UUID | None = None, agent_id: uuid.UUID | None = None,
                     client_id: uuid.UUID | None = None, owner_id: uuid.UUID | None = None,
                     limit: int = 20, offset: int = 0):
        stmt = self.scoped_query(ctx, agent_id=agent_id, client_id=client_id, owner_id=owner_id)
        if status:
            stmt = stmt.where(Rental.status == status)
        if property_id:
            stmt = stmt.where(Rental.property_id == property_id)
        stmt = stmt.order_by(Rental.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def count_active(self, agency_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Rental).where(
            Rental.agency_id == agency_id, Rental.status == RentalStatus.ACTIVE
        )
        return int((await self.session.execute(stmt)).scalar_one())


class ContractRepository(BaseRepository[Contract]):
    model = Contract

    async def next_reference(self, agency_id: uuid.UUID) -> str:
        total = await self.count(agency_id=agency_id)
        return f"CTR-{str(agency_id)[:4].upper()}-{total + 1:05d}"

    async def search(self, *, agency_id: uuid.UUID | None, sale_id: uuid.UUID | None = None,
                     rental_id: uuid.UUID | None = None, client_id: uuid.UUID | None = None,
                     limit: int = 20, offset: int = 0):
        stmt = select(Contract)
        if agency_id:
            stmt = stmt.where(Contract.agency_id == agency_id)
        if sale_id:
            stmt = stmt.where(Contract.sale_id == sale_id)
        if rental_id:
            stmt = stmt.where(Contract.rental_id == rental_id)
        if client_id:
            stmt = stmt.where(Contract.client_id == client_id)
        stmt = stmt.order_by(Contract.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)
