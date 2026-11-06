"""Service utilisateurs : profil, avatar, administration des comptes."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.enums import OwnerEntityType, UserRole, UserStatus
from app.models.user import User
from app.repositories.agency import AgencyRepository
from app.repositories.user import UserRepository
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserUpdate
from app.services.audit import AuditService
from app.services.auth import AuthService
from app.services.email import email_service
from app.services.storage import storage
from app.utils.files import IMAGE_MIME, build_storage_key, validate_upload

ROLE_LABEL = {
    UserRole.SUPER_ADMIN: "administrateur",
    UserRole.AGENCY: "agence",
    UserRole.AGENT: "agent",
    UserRole.OWNER: "propriétaire",
    UserRole.CLIENT: "client",
}


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)
        self.agencies = AgencyRepository(session)
        self.auth = AuthService(session)
        self.audit = AuditService(session)

    async def get_or_404(self, user_id: uuid.UUID, ctx: SecurityContext) -> User:
        user = await self.repo.get(user_id)
        if not user:
            raise NotFoundError("Utilisateur introuvable.")
        if ctx.is_super_admin or user.id == ctx.user_id:
            return user
        if ctx.is_agency and user.agency_id == ctx.agency_id:
            return user
        raise PermissionDeniedError("Accès à ce profil non autorisé.")

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(user, key, value)
        await self.session.flush()
        return user

    async def admin_update(
        self, user_id: uuid.UUID, data: UserAdminUpdate, ctx: SecurityContext
    ) -> User:
        user = await self.get_or_404(user_id, ctx)
        values = data.model_dump(exclude_unset=True)
        if not ctx.is_super_admin:
            for field in ("role", "agency_id"):
                values.pop(field, None)
        if values.get("role") is UserRole.SUPER_ADMIN and not ctx.is_super_admin:
            raise PermissionDeniedError("Attribution du rôle SUPER_ADMIN interdite.")
        for key, value in values.items():
            setattr(user, key, value)
        await self.session.flush()
        await self.audit.log(
            action="user.admin_update", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="user", resource_id=user.id, payload={"fields": list(values.keys())},
        )
        return user

    async def set_avatar(self, user: User, *, content: bytes, filename: str, mime: str | None) -> User:
        resolved = validate_upload(filename, mime, len(content), settings.max_upload_bytes)
        if resolved not in IMAGE_MIME:
            raise PermissionDeniedError("L'avatar doit être une image.")
        key = build_storage_key(f"avatars/{user.id}", filename)
        await storage.save(key, content)
        user.avatar_url = storage.public_url(key)
        await self.session.flush()
        return user

    async def create(self, data: UserAdminCreate, ctx: SecurityContext) -> tuple[User, str | None]:
        """Création directe d'un compte par un administrateur — envoie un
        lien d'activation par email, comme pour une invitation d'agent."""
        if not ctx.is_super_admin:
            raise PermissionDeniedError("Réservé aux administrateurs de la plateforme.")
        if await self.repo.get_by_email(data.email):
            raise ConflictError("Un utilisateur existe déjà avec cette adresse email.")

        agency_name = "ImmoFlow AI"
        if data.agency_id:
            agency = await self.agencies.get(data.agency_id)
            if not agency:
                raise NotFoundError("Agence introuvable.")
            agency_name = agency.name

        user = User(
            email=data.email.lower(),
            full_name=data.full_name.strip(),
            phone=data.phone,
            role=data.role,
            status=UserStatus.PENDING,
            agency_id=data.agency_id,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()

        raw_token = await self.auth.create_invitation_token(user.id)
        url = f"{settings.FRONTEND_BASE_URL}/accept-invitation?token={raw_token}"
        await email_service.send_account_created(
            to=user.email, full_name=user.full_name, role_label=ROLE_LABEL.get(data.role, "utilisateur"), url=url,
        )
        await self.audit.log(
            action="user.admin_create", user_id=ctx.user_id,
            resource_type="user", resource_id=user.id, payload={"role": data.role.value},
        )
        return user, url if settings.ENVIRONMENT != "production" else None

    async def delete(self, user_id: uuid.UUID, ctx: SecurityContext) -> None:
        if not ctx.is_super_admin:
            raise PermissionDeniedError("Réservé aux administrateurs de la plateforme.")
        if user_id == ctx.user_id:
            raise PermissionDeniedError("Vous ne pouvez pas supprimer votre propre compte.")
        user = await self.repo.get(user_id)
        if not user:
            raise NotFoundError("Utilisateur introuvable.")
        await self.repo.delete(user)
        await self.audit.log(
            action="user.admin_delete", user_id=ctx.user_id,
            resource_type="user", resource_id=user_id,
        )

    async def deactivate(self, user_id: uuid.UUID, ctx: SecurityContext) -> User:
        user = await self.get_or_404(user_id, ctx)
        if user.id == ctx.user_id:
            raise PermissionDeniedError("Vous ne pouvez pas désactiver votre propre compte.")
        user.is_active = False
        user.status = UserStatus.DEACTIVATED
        await self.session.flush()
        await self.audit.log(
            action="user.deactivate", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="user", resource_id=user.id,
        )
        return user

    async def list(self, ctx: SecurityContext, *, term: str | None, limit: int, offset: int):
        agency_id = None if ctx.is_super_admin else ctx.agency_id
        return await self.repo.search(term=term, agency_id=agency_id, limit=limit, offset=offset)
