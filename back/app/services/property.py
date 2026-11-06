"""Service biens immobiliers : CRUD, publication, médias, statuts."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.enums import OwnerStatus, PropertyStatus
from app.models.property import Property, PropertyImage
from app.repositories.agency import AgentRepository
from app.repositories.owner import OwnerRepository
from app.repositories.property import (
    PropertyImageRepository, PropertyRepository, PropertyTypeRepository,
)
from app.schemas.property import (
    PropertyCreate, PropertyFilters, PropertyImageCreate, PropertyUpdate,
)
from app.services.audit import AuditService

# Transitions de statut autorisées.
ALLOWED_TRANSITIONS: dict[PropertyStatus, set[PropertyStatus]] = {
    PropertyStatus.DRAFT: {PropertyStatus.AVAILABLE, PropertyStatus.ARCHIVED},
    PropertyStatus.AVAILABLE: {
        PropertyStatus.RESERVED, PropertyStatus.RENTED, PropertyStatus.SOLD,
        PropertyStatus.ARCHIVED, PropertyStatus.DRAFT,
    },
    PropertyStatus.RESERVED: {
        PropertyStatus.AVAILABLE, PropertyStatus.RENTED, PropertyStatus.SOLD,
        PropertyStatus.ARCHIVED,
    },
    PropertyStatus.RENTED: {PropertyStatus.AVAILABLE, PropertyStatus.ARCHIVED},
    PropertyStatus.SOLD: {PropertyStatus.ARCHIVED},
    PropertyStatus.ARCHIVED: {PropertyStatus.DRAFT, PropertyStatus.AVAILABLE},
}


class PropertyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PropertyRepository(session)
        self.images = PropertyImageRepository(session)
        self.types = PropertyTypeRepository(session)
        self.owners = OwnerRepository(session)
        self.agents = AgentRepository(session)
        self.audit = AuditService(session)

    # ------------------------------ Lecture --------------------------------- #
    async def get_or_404(
        self,
        property_id: uuid.UUID,
        ctx: SecurityContext,
        *,
        agent_id: uuid.UUID | None = None,
        owner_id: uuid.UUID | None = None,
    ) -> Property:
        prop = await self.repo.get_with_images(property_id)
        if not prop:
            raise NotFoundError("Bien introuvable.")

        if ctx.is_super_admin:
            return prop
        if ctx.is_agency_staff:
            ctx.require_same_agency(prop.agency_id)
            if ctx.is_agent and prop.agent_id and prop.agent_id != agent_id:
                raise PermissionDeniedError("Ce bien n'est pas dans votre portefeuille.")
            return prop
        if ctx.is_owner:
            if prop.owner_id != owner_id:
                raise PermissionDeniedError("Ce bien ne vous appartient pas.")
            return prop
        # Client : accès au catalogue publié uniquement.
        if not prop.is_published:
            raise NotFoundError("Bien introuvable.")
        return prop

    async def list(
        self, ctx: SecurityContext, filters: PropertyFilters, *,
        agent_id=None, owner_id=None, public=False, limit=20, offset=0,
    ):
        return await self.repo.search(
            ctx, filters, agent_id=agent_id, owner_id=owner_id,
            public=public, limit=limit, offset=offset,
        )

    # ------------------------------ Écriture -------------------------------- #
    async def create(
        self, data: PropertyCreate, ctx: SecurityContext, *, agent_id: uuid.UUID | None
    ) -> Property:
        if not ctx.agency_id:
            raise PermissionDeniedError("Aucune agence rattachée à votre compte.")
        ctx.require("property:create")

        target_agent = agent_id if ctx.is_agent else (data.agent_id or agent_id)

        if data.owner_id:
            owner = await self.owners.get(data.owner_id)
            if not owner or owner.agency_id != ctx.agency_id:
                raise NotFoundError("Propriétaire introuvable dans votre agence.")
            if owner.status not in (OwnerStatus.ACTIVE, OwnerStatus.PENDING_VERIFICATION):
                raise BusinessRuleError(
                    "Le propriétaire doit être actif ou en cours de vérification."
                )

        payload = data.model_dump(exclude={"images", "agent_id"})
        prop = await self.repo.create(
            agency_id=ctx.agency_id,
            agent_id=target_agent,
            reference=await self.repo.next_reference(ctx.agency_id),
            status=PropertyStatus.DRAFT,
            **payload,
        )

        for index, image in enumerate(data.images):
            self.session.add(
                PropertyImage(
                    property_id=prop.id,
                    url=image.url,
                    caption=image.caption,
                    media_type=image.media_type,
                    is_cover=image.is_cover or index == 0,
                    position=image.position or index,
                )
            )
        await self.session.flush()
        await self.audit.log(
            action="property.create", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="property", resource_id=prop.id,
        )
        return await self.repo.get_with_images(prop.id)  # type: ignore[return-value]

    async def update(
        self, property_id: uuid.UUID, data: PropertyUpdate, ctx: SecurityContext, *, agent_id=None
    ) -> Property:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        ctx.require("property:update")

        values = data.model_dump(exclude_unset=True)
        new_status = values.pop("status", None)
        if ctx.is_agent:
            values.pop("agent_id", None)

        for key, value in values.items():
            setattr(prop, key, value)

        if new_status:
            self._check_transition(prop.status, new_status)
            prop.status = new_status

        await self.session.flush()
        await self.audit.log(
            action="property.update", user_id=ctx.user_id, agency_id=prop.agency_id,
            resource_type="property", resource_id=prop.id,
            payload={"fields": list(values.keys())},
        )
        return await self.repo.get_with_images(prop.id)  # type: ignore[return-value]

    def _check_transition(self, current: PropertyStatus, target: PropertyStatus) -> None:
        if current == target:
            return
        if target not in ALLOWED_TRANSITIONS.get(current, set()):
            raise BusinessRuleError(
                f"Transition de statut interdite : {current.value} → {target.value}."
            )

    async def change_status(
        self, property_id: uuid.UUID, status: PropertyStatus, ctx: SecurityContext, *, agent_id=None
    ) -> Property:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        self._check_transition(prop.status, status)
        prop.status = status
        if status in (PropertyStatus.SOLD, PropertyStatus.RENTED, PropertyStatus.ARCHIVED):
            prop.is_published = False
        await self.session.flush()
        await self.audit.log(
            action="property.change_status", user_id=ctx.user_id, agency_id=prop.agency_id,
            resource_type="property", resource_id=prop.id, payload={"status": status.value},
        )
        return prop

    async def publish(
        self, property_id: uuid.UUID, publish: bool, ctx: SecurityContext, *, agent_id=None
    ) -> Property:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        ctx.require("property:publish")

        if publish:
            missing = [
                field for field in ("title", "price", "city")
                if not getattr(prop, field, None)
            ]
            if not prop.description or len(prop.description) < 40:
                missing.append("description (40 caractères minimum)")
            images = await self.images.list_for_property(prop.id)
            if not images:
                missing.append("au moins une photo")
            if missing:
                raise BusinessRuleError(
                    "Publication impossible : éléments manquants.", details={"missing": missing}
                )
            if prop.status is PropertyStatus.DRAFT:
                prop.status = PropertyStatus.AVAILABLE
            prop.is_published = True
            prop.published_at = datetime.now(timezone.utc)
        else:
            prop.is_published = False

        await self.session.flush()
        await self.audit.log(
            action="property.publish", user_id=ctx.user_id, agency_id=prop.agency_id,
            resource_type="property", resource_id=prop.id, payload={"published": publish},
        )
        return prop

    async def delete(self, property_id: uuid.UUID, ctx: SecurityContext, *, agent_id=None) -> None:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        ctx.require("property:delete")
        if prop.status in (PropertyStatus.SOLD, PropertyStatus.RENTED):
            raise BusinessRuleError(
                "Un bien vendu ou loué ne peut pas être supprimé ; archivez-le à la place."
            )
        await self.repo.delete(prop)
        await self.audit.log(
            action="property.delete", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="property", resource_id=property_id,
        )

    # -------------------------------- Médias -------------------------------- #
    async def add_image(
        self, property_id: uuid.UUID, data: PropertyImageCreate, ctx: SecurityContext, *, agent_id=None
    ) -> PropertyImage:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        if data.is_cover:
            await self.images.clear_cover(prop.id)
        return await self.images.create(
            property_id=prop.id,
            url=data.url,
            caption=data.caption,
            media_type=data.media_type,
            is_cover=data.is_cover,
            position=data.position,
        )

    async def delete_image(
        self, property_id: uuid.UUID, image_id: uuid.UUID, ctx: SecurityContext, *, agent_id=None
    ) -> None:
        prop = await self.get_or_404(property_id, ctx, agent_id=agent_id)
        image = await self.images.get(image_id)
        if not image or image.property_id != prop.id:
            raise NotFoundError("Média introuvable.")
        await self.images.delete(image)

    async def register_view(self, property_id: uuid.UUID) -> None:
        await self.repo.increment_views(property_id)
