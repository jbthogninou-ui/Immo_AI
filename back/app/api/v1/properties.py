"""Endpoints biens immobiliers."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.api.deps import AgencyStaff, Ctx, DbSession, ScopeDep
from app.models.enums import DocumentCategory, OwnerEntityType, PropertyStatus
from app.schemas.common import MessageResponse, Page
from app.schemas.property import (
    PropertyCreate, PropertyFilters, PropertyImageCreate, PropertyImageRead, PropertyRead,
    PropertyStatusUpdate, PropertyTypeCreate, PropertyTypeRead, PropertyUpdate,
)
from app.services.document import DocumentService
from app.services.property import PropertyService
from app.utils.files import media_type_from_mime
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/properties", tags=["Biens immobiliers"])

Filters = Annotated[PropertyFilters, Depends()]


@router.get("/types", response_model=list[PropertyTypeRead], summary="Types de biens")
async def list_types(session: DbSession):
    return await PropertyService(session).types.list_active()


@router.post("/types", response_model=PropertyTypeRead, status_code=status.HTTP_201_CREATED,
             summary="Créer un type de bien", dependencies=[AgencyStaff])
async def create_type(data: PropertyTypeCreate, session: DbSession):
    from app.utils.slug import slugify

    service = PropertyService(session)
    ptype = await service.types.create(
        name=data.name, slug=slugify(data.name), description=data.description
    )
    await session.commit()
    return ptype


@router.get("", response_model=Page[PropertyRead], summary="Rechercher des biens (périmètre RBAC)")
async def list_properties(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep, filters: Filters
):
    items, total = await PropertyService(session).list(
        ctx, filters, agent_id=scope.agent_id, owner_id=scope.owner_id,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [PropertyRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED,
             summary="Créer un bien", dependencies=[AgencyStaff])
async def create_property(data: PropertyCreate, ctx: Ctx, scope: ScopeDep, session: DbSession):
    prop = await PropertyService(session).create(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return prop


@router.get("/{property_id}", response_model=PropertyRead, summary="Détail d'un bien")
async def get_property(property_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    service = PropertyService(session)
    prop = await service.get_or_404(
        property_id, ctx, agent_id=scope.agent_id, owner_id=scope.owner_id
    )
    if ctx.is_client:
        await service.register_view(property_id)
        await session.commit()
    return prop


@router.patch("/{property_id}", response_model=PropertyRead, summary="Modifier un bien",
              dependencies=[AgencyStaff])
async def update_property(
    property_id: uuid.UUID, data: PropertyUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    prop = await PropertyService(session).update(property_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return prop


@router.delete("/{property_id}", response_model=MessageResponse, summary="Supprimer un bien",
               dependencies=[AgencyStaff])
async def delete_property(property_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    await PropertyService(session).delete(property_id, ctx, agent_id=scope.agent_id)
    await session.commit()
    return MessageResponse(message="Bien supprimé.")


@router.post("/{property_id}/status", response_model=PropertyRead, summary="Changer le statut",
             dependencies=[AgencyStaff])
async def change_status(
    property_id: uuid.UUID, data: PropertyStatusUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    prop = await PropertyService(session).change_status(
        property_id, data.status, ctx, agent_id=scope.agent_id
    )
    await session.commit()
    return prop


@router.post("/{property_id}/publish", response_model=PropertyRead, summary="Publier un bien",
             dependencies=[AgencyStaff])
async def publish_property(
    property_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession,
    publish: bool = Query(default=True),
):
    prop = await PropertyService(session).publish(property_id, publish, ctx, agent_id=scope.agent_id)
    await session.commit()
    return prop


@router.get("/{property_id}/images", response_model=list[PropertyImageRead], summary="Médias du bien")
async def list_images(property_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    service = PropertyService(session)
    await service.get_or_404(property_id, ctx, agent_id=scope.agent_id, owner_id=scope.owner_id)
    return await service.images.list_for_property(property_id)


@router.post("/{property_id}/images", response_model=PropertyImageRead,
             status_code=status.HTTP_201_CREATED, summary="Ajouter un média par URL",
             dependencies=[AgencyStaff])
async def add_image(
    property_id: uuid.UUID, data: PropertyImageCreate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    image = await PropertyService(session).add_image(property_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return image


@router.post("/{property_id}/images/upload", response_model=PropertyImageRead,
             status_code=status.HTTP_201_CREATED, summary="Téléverser une photo ou vidéo",
             dependencies=[AgencyStaff])
async def upload_image(
    property_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession,
    file: UploadFile = File(...), is_cover: bool = Query(default=False),
    caption: str | None = Query(default=None),
):
    service = PropertyService(session)
    await service.get_or_404(property_id, ctx, agent_id=scope.agent_id)

    content = await file.read()
    document = await DocumentService(session).upload(
        content=content,
        filename=file.filename or "media",
        mime_type=file.content_type,
        entity_type=OwnerEntityType.PROPERTY,
        entity_id=property_id,
        category=DocumentCategory.OTHER,
        ctx=ctx,
    )
    image = await service.add_image(
        property_id,
        PropertyImageCreate(
            url=document.url,
            caption=caption,
            media_type=media_type_from_mime(document.mime_type),
            is_cover=is_cover,
        ),
        ctx,
        agent_id=scope.agent_id,
    )
    await session.commit()
    return image


@router.delete("/{property_id}/images/{image_id}", response_model=MessageResponse,
               summary="Supprimer un média", dependencies=[AgencyStaff])
async def delete_image(
    property_id: uuid.UUID, image_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    await PropertyService(session).delete_image(property_id, image_id, ctx, agent_id=scope.agent_id)
    await session.commit()
    return MessageResponse(message="Média supprimé.")
