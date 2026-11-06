"""Repository documents."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.permissions import SecurityContext
from app.models.document import Document
from app.repositories.base import BaseRepository
from app.schemas.document import DocumentFilters


class DocumentRepository(BaseRepository[Document]):
    model = Document

    def scoped_query(self, ctx: SecurityContext):
        stmt = select(Document)
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency_staff:
            return stmt.where(Document.agency_id == ctx.agency_id)
        # Propriétaires / clients : uniquement leurs propres documents déposés.
        return stmt.where(Document.uploaded_by_id == ctx.user_id)

    async def search(
        self, ctx: SecurityContext, filters: DocumentFilters, *, limit: int, offset: int
    ):
        stmt = self.scoped_query(ctx)
        if filters.entity_type:
            stmt = stmt.where(Document.entity_type == filters.entity_type)
        if filters.entity_id:
            stmt = stmt.where(Document.entity_id == filters.entity_id)
        if filters.category:
            stmt = stmt.where(Document.category == filters.category)
        if filters.status:
            stmt = stmt.where(Document.status == filters.status)
        stmt = stmt.order_by(Document.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def list_for_entity(self, entity_type, entity_id: uuid.UUID):
        stmt = select(Document).where(
            Document.entity_type == entity_type, Document.entity_id == entity_id
        ).order_by(Document.created_at.desc())
        return (await self.session.execute(stmt)).scalars().all()
