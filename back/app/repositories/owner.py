"""Repositories propriétaires."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select

from app.core.permissions import SecurityContext
from app.models.enums import OwnerStatus
from app.models.owner import Owner, OwnerInvitation
from app.repositories.base import BaseRepository


class OwnerRepository(BaseRepository[Owner]):
    model = Owner

    def scoped_query(self, ctx: SecurityContext, agent_id: uuid.UUID | None = None):
        """Applique le périmètre RBAC directement en SQL (defense in depth)."""
        stmt = select(Owner)
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency:
            return stmt.where(Owner.agency_id == ctx.agency_id)
        if ctx.is_agent:
            # Un agent ne voit que les propriétaires dont il est le référent.
            return stmt.where(Owner.agency_id == ctx.agency_id, Owner.agent_id == agent_id)
        if ctx.is_owner:
            return stmt.where(Owner.user_id == ctx.user_id)
        # Les clients n'accèdent pas au répertoire des propriétaires.
        return stmt.where(Owner.id.is_(None))

    async def get_by_user(self, user_id: uuid.UUID) -> Owner | None:
        return await self.get_by(user_id=user_id)

    async def get_by_agency_email(self, agency_id: uuid.UUID, email: str) -> Owner | None:
        stmt = select(Owner).where(
            Owner.agency_id == agency_id, func.lower(Owner.email) == email.lower()
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def search(
        self,
        ctx: SecurityContext,
        *,
        term: str | None = None,
        status: OwnerStatus | None = None,
        agent_id: uuid.UUID | None = None,
        scope_agent_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = self.scoped_query(ctx, scope_agent_id)
        if status:
            stmt = stmt.where(Owner.status == status)
        if agent_id:
            stmt = stmt.where(Owner.agent_id == agent_id)
        if term:
            like = f"%{term.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Owner.first_name).like(like),
                    func.lower(Owner.last_name).like(like),
                    func.lower(Owner.email).like(like),
                    Owner.phone.like(f"%{term}%"),
                )
            )
        stmt = stmt.order_by(Owner.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)


class OwnerInvitationRepository(BaseRepository[OwnerInvitation]):
    model = OwnerInvitation

    async def get_valid(self, token_hash: str) -> OwnerInvitation | None:
        stmt = select(OwnerInvitation).where(
            OwnerInvitation.token_hash == token_hash,
            OwnerInvitation.accepted_at.is_(None),
            OwnerInvitation.expires_at > datetime.now(timezone.utc),
        )
        return (await self.session.execute(stmt)).scalars().first()
