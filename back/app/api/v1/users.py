"""Endpoints d'administration des utilisateurs."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AgencyOnly, Ctx, DbSession, SuperAdminOnly
from app.schemas.common import MessageResponse, Page
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserRead
from app.services.user import UserService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/users", tags=["Utilisateurs"], dependencies=[AgencyOnly])


@router.get("", response_model=Page[UserRead], summary="Lister les utilisateurs du périmètre")
async def list_users(
    ctx: Ctx, session: DbSession, pagination: PaginationDep,
    q: str | None = Query(default=None, description="Recherche nom ou email"),
):
    items, total = await UserService(session).list(
        ctx, term=q, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [UserRead.model_validate(item) for item in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED,
             summary="Créer un compte (réservé aux administrateurs)", dependencies=[SuperAdminOnly])
async def create_user(data: UserAdminCreate, ctx: Ctx, session: DbSession):
    user, _url = await UserService(session).create(data, ctx)
    await session.commit()
    return user


@router.get("/{user_id}", response_model=UserRead, summary="Détail d'un utilisateur")
async def get_user(user_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await UserService(session).get_or_404(user_id, ctx)


@router.patch("/{user_id}", response_model=UserRead, summary="Mise à jour administrative")
async def update_user(user_id: uuid.UUID, data: UserAdminUpdate, ctx: Ctx, session: DbSession):
    user = await UserService(session).admin_update(user_id, data, ctx)
    await session.commit()
    return user


@router.post("/{user_id}/deactivate", response_model=MessageResponse, summary="Désactiver un compte")
async def deactivate_user(user_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await UserService(session).deactivate(user_id, ctx)
    await session.commit()
    return MessageResponse(message="Compte désactivé.")


@router.delete("/{user_id}", response_model=MessageResponse,
               summary="Supprimer définitivement un compte (réservé aux administrateurs)",
               dependencies=[SuperAdminOnly])
async def delete_user(user_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await UserService(session).delete(user_id, ctx)
    await session.commit()
    return MessageResponse(message="Compte supprimé.")
