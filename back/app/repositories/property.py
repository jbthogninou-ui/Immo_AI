"""Repositories biens immobiliers."""
from __future__ import annotations

import uuid

from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.permissions import SecurityContext
from app.models.client import ClientAgent
from app.models.enums import PropertyStatus
from app.models.property import Property, PropertyImage, PropertyType
from app.repositories.base import BaseRepository
from app.schemas.property import PropertyFilters

SORTABLE = {
    "created_at": Property.created_at,
    "price": Property.price,
    "area": Property.area,
    "views_count": Property.views_count,
    "published_at": Property.published_at,
}


class PropertyRepository(BaseRepository[Property]):
    model = Property

    def scoped_query(
        self,
        ctx: SecurityContext,
        *,
        agent_id: uuid.UUID | None = None,
        owner_id: uuid.UUID | None = None,
        public: bool = False,
    ):
        stmt = select(Property).options(selectinload(Property.images))
        if public:
            # Catalogue public : uniquement les biens publiés et disponibles.
            return stmt.where(
                Property.is_published.is_(True),
                Property.status.in_([PropertyStatus.AVAILABLE, PropertyStatus.RESERVED]),
            )
        if ctx.is_super_admin:
            return stmt
        if ctx.is_agency:
            return stmt.where(Property.agency_id == ctx.agency_id)
        if ctx.is_agent:
            return stmt.where(Property.agency_id == ctx.agency_id, Property.agent_id == agent_id)
        if ctx.is_owner:
            return stmt.where(Property.owner_id == owner_id)
        if ctx.is_client:
            # Un client voit le catalogue publié de son agence + ses biens en interaction.
            return stmt.where(Property.is_published.is_(True))
        return stmt.where(Property.id.is_(None))

    def apply_filters(self, stmt, f: PropertyFilters):
        if f.q:
            like = f"%{f.q.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Property.title).like(like),
                    func.lower(func.coalesce(Property.description, "")).like(like),
                )
            )
        if f.city:
            stmt = stmt.where(func.lower(Property.city) == f.city.lower())
        if f.district:
            stmt = stmt.where(func.lower(Property.district) == f.district.lower())
        if f.listing_type:
            stmt = stmt.where(Property.listing_type == f.listing_type)
        if f.status:
            stmt = stmt.where(Property.status == f.status)
        if f.property_type_id:
            stmt = stmt.where(Property.property_type_id == f.property_type_id)
        if f.owner_id:
            stmt = stmt.where(Property.owner_id == f.owner_id)
        if f.agent_id:
            stmt = stmt.where(Property.agent_id == f.agent_id)
        if f.min_price is not None:
            stmt = stmt.where(Property.price >= f.min_price)
        if f.max_price is not None:
            stmt = stmt.where(Property.price <= f.max_price)
        if f.min_area is not None:
            stmt = stmt.where(Property.area >= f.min_area)
        if f.max_area is not None:
            stmt = stmt.where(Property.area <= f.max_area)
        if f.bedrooms is not None:
            stmt = stmt.where(Property.bedrooms >= f.bedrooms)
        if f.rooms is not None:
            stmt = stmt.where(Property.rooms >= f.rooms)
        if f.is_published is not None:
            stmt = stmt.where(Property.is_published.is_(f.is_published))
        if f.near_lat is not None and f.near_lng is not None:
            # Bounding box approximatif (1° lat ≈ 111 km) — suffisant sans PostGIS.
            radius = f.radius_km or 10
            dlat = radius / 111.0
            dlng = radius / 111.0
            stmt = stmt.where(
                and_(
                    Property.latitude.between(f.near_lat - dlat, f.near_lat + dlat),
                    Property.longitude.between(f.near_lng - dlng, f.near_lng + dlng),
                )
            )
        return stmt

    def apply_sort(self, stmt, sort: str):
        direction = desc if sort.startswith("-") else asc
        column = SORTABLE.get(sort.lstrip("-"), Property.created_at)
        return stmt.order_by(direction(column))

    async def search(
        self,
        ctx: SecurityContext,
        filters: PropertyFilters,
        *,
        agent_id: uuid.UUID | None = None,
        owner_id: uuid.UUID | None = None,
        public: bool = False,
        limit: int = 20,
        offset: int = 0,
    ):
        stmt = self.scoped_query(ctx, agent_id=agent_id, owner_id=owner_id, public=public)
        stmt = self.apply_filters(stmt, filters)
        stmt = self.apply_sort(stmt, filters.sort)
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def get_with_images(self, property_id: uuid.UUID) -> Property | None:
        stmt = (
            select(Property)
            .options(selectinload(Property.images))
            .where(Property.id == property_id)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def next_reference(self, agency_id: uuid.UUID) -> str:
        total = await self.count(agency_id=agency_id)
        return f"BIEN-{str(agency_id)[:4].upper()}-{total + 1:05d}"

    async def increment_views(self, property_id: uuid.UUID) -> None:
        await self.session.execute(
            Property.__table__.update()
            .where(Property.id == property_id)
            .values(views_count=Property.views_count + 1)
        )

    async def stats_for_agency(self, agency_id: uuid.UUID) -> dict:
        stmt = select(Property.status, func.count()).where(
            Property.agency_id == agency_id
        ).group_by(Property.status)
        rows = (await self.session.execute(stmt)).all()
        return {status.value: count for status, count in rows}

    async def comparables(
        self,
        *,
        city: str | None,
        district: str | None,
        property_type_id: uuid.UUID | None,
        area: float | None,
        limit: int = 30,
    ):
        """Biens comparables pour l'estimation de prix."""
        stmt = select(Property).where(Property.price > 0)
        if district:
            stmt = stmt.where(func.lower(Property.district) == district.lower())
        elif city:
            stmt = stmt.where(func.lower(Property.city) == city.lower())
        if property_type_id:
            stmt = stmt.where(Property.property_type_id == property_type_id)
        if area:
            stmt = stmt.where(Property.area.between(area * 0.6, area * 1.4))
        stmt = stmt.order_by(Property.created_at.desc()).limit(limit)
        return (await self.session.execute(stmt)).scalars().all()


class PropertyImageRepository(BaseRepository[PropertyImage]):
    model = PropertyImage

    async def list_for_property(self, property_id: uuid.UUID):
        stmt = (
            select(PropertyImage)
            .where(PropertyImage.property_id == property_id)
            .order_by(PropertyImage.position)
        )
        return (await self.session.execute(stmt)).scalars().all()

    async def clear_cover(self, property_id: uuid.UUID) -> None:
        await self.session.execute(
            PropertyImage.__table__.update()
            .where(PropertyImage.property_id == property_id)
            .values(is_cover=False)
        )


class PropertyTypeRepository(BaseRepository[PropertyType]):
    model = PropertyType

    async def list_active(self):
        stmt = select(PropertyType).where(PropertyType.is_active.is_(True)).order_by(PropertyType.name)
        return (await self.session.execute(stmt)).scalars().all()
