"""Repository générique : CRUD + pagination asynchrones."""
from __future__ import annotations

import uuid
from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import Select, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ----------------------------- Lecture ---------------------------------- #
    async def get(self, entity_id: uuid.UUID) -> ModelT | None:
        return await self.session.get(self.model, entity_id)

    async def get_by(self, **filters: Any) -> ModelT | None:
        stmt = select(self.model).filter_by(**filters).limit(1)
        return (await self.session.execute(stmt)).scalars().first()

    async def exists(self, **filters: Any) -> bool:
        stmt = select(func.count()).select_from(self.model).filter_by(**filters)
        return bool((await self.session.execute(stmt)).scalar_one())

    async def list(
        self, *, limit: int = 50, offset: int = 0, order_by: Any = None, **filters: Any
    ) -> Sequence[ModelT]:
        stmt = select(self.model).filter_by(**filters)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.limit(limit).offset(offset)
        return (await self.session.execute(stmt)).scalars().all()

    async def count(self, **filters: Any) -> int:
        stmt = select(func.count()).select_from(self.model).filter_by(**filters)
        return int((await self.session.execute(stmt)).scalar_one())

    async def paginate(
        self, stmt: Select, *, limit: int, offset: int
    ) -> tuple[Sequence[ModelT], int]:
        """Exécute une requête paginée + compte total (sans order_by pour le count)."""
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = int((await self.session.execute(count_stmt)).scalar_one())
        rows = (await self.session.execute(stmt.limit(limit).offset(offset))).scalars().unique().all()
        return rows, total

    # ----------------------------- Écriture --------------------------------- #
    async def create(self, **values: Any) -> ModelT:
        instance = self.model(**values)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    def add(self, instance: ModelT) -> ModelT:
        self.session.add(instance)
        return instance

    async def update(self, instance: ModelT, **values: Any) -> ModelT:
        for key, value in values.items():
            if value is not None or key in getattr(self, "nullable_fields", ()):
                setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: ModelT) -> None:
        await self.session.delete(instance)
        await self.session.flush()

    async def delete_by_id(self, entity_id: uuid.UUID) -> int:
        result = await self.session.execute(
            delete(self.model).where(self.model.id == entity_id)  # type: ignore[attr-defined]
        )
        await self.session.flush()
        return result.rowcount or 0
