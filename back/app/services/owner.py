"""Service propriétaires : invitation, inscription autonome, vérification."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    BusinessRuleError, ConflictError, NotFoundError, PermissionDeniedError,
)
from app.core.permissions import SecurityContext
from app.core.security import generate_opaque_token, hash_password, hash_token
from app.models.enums import (
    AgencyStatus, DocumentCategory, NotificationType, OwnerEntityType, OwnerStatus,
    UserRole, UserStatus,
)
from app.models.owner import Owner, OwnerInvitation
from app.models.user import User
from app.repositories.agency import AgencyRepository, AgentRepository
from app.repositories.document import DocumentRepository
from app.repositories.owner import OwnerInvitationRepository, OwnerRepository
from app.repositories.user import UserRepository
from app.schemas.owner import (
    OwnerInviteRequest, OwnerProfileCompletion, OwnerSelfRegisterRequest, OwnerUpdate,
)
from app.services.audit import AuditService
from app.services.auth import AuthService
from app.services.email import email_service
from app.services.notification import NotificationService

INVITATION_TTL_HOURS = 72


class OwnerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = OwnerRepository(session)
        self.invitations = OwnerInvitationRepository(session)
        self.users = UserRepository(session)
        self.agents = AgentRepository(session)
        self.agencies = AgencyRepository(session)
        self.documents = DocumentRepository(session)
        self.auth = AuthService(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    # ------------------------------- Lecture -------------------------------- #
    async def get_or_404(self, owner_id: uuid.UUID, ctx: SecurityContext) -> Owner:
        owner = await self.repo.get(owner_id)
        if not owner:
            raise NotFoundError("Propriétaire introuvable.")
        if ctx.is_owner:
            if owner.user_id != ctx.user_id:
                raise PermissionDeniedError("Accès limité à votre propre fiche.")
        elif ctx.is_client:
            raise PermissionDeniedError("Les clients n'accèdent pas aux propriétaires.")
        else:
            ctx.require_same_agency(owner.agency_id)
        return owner

    # ------------------- Workflow 1 : invitation par l'agent ---------------- #
    async def invite(
        self, data: OwnerInviteRequest, ctx: SecurityContext, *, agent_id: uuid.UUID | None
    ) -> tuple[Owner, str | None]:
        if not ctx.agency_id:
            raise PermissionDeniedError("Aucune agence rattachée à votre compte.")
        agency = await self.agencies.get(ctx.agency_id)
        if not agency:
            raise NotFoundError("Agence introuvable.")

        if await self.repo.get_by_agency_email(agency.id, data.email):
            raise ConflictError("Ce propriétaire existe déjà dans votre agence.")

        owner = await self.repo.create(
            agency_id=agency.id,
            agent_id=agent_id,
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=data.email.lower(),
            phone=data.phone,
            address=data.address,
            city=data.city,
            notes=data.notes,
            status=OwnerStatus.INVITED,
            invited_at=datetime.now(timezone.utc),
        )

        # Compte utilisateur pré-créé (sans mot de passe) si l'email est libre.
        user = await self.users.get_by_email(owner.email)
        if user is None:
            user = User(
                email=owner.email,
                full_name=owner.full_name,
                phone=owner.phone,
                role=UserRole.OWNER,
                status=UserStatus.PENDING,
                agency_id=agency.id,
                is_active=True,
            )
            self.session.add(user)
            await self.session.flush()
        if user.role is UserRole.OWNER:
            owner.user_id = user.id

        raw = generate_opaque_token()
        self.session.add(
            OwnerInvitation(
                owner_id=owner.id,
                token_hash=hash_token(raw),
                email=owner.email,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=INVITATION_TTL_HOURS),
                invited_by_id=ctx.user_id,
            )
        )
        await self.session.flush()

        url = f"{settings.FRONTEND_BASE_URL}/owner/onboarding?token={raw}"
        await email_service.send_owner_invitation(
            to=owner.email, full_name=owner.full_name, agency=agency.name, url=url
        )
        await self.audit.log(
            action="owner.invite", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="owner", resource_id=owner.id, payload={"email": owner.email},
        )
        # Comme pour les agents : le lien revient à l'auteur de l'invitation.
        return owner, url

    async def accept_invitation(self, token: str, password: str) -> Owner:
        invitation = await self.invitations.get_valid(hash_token(token))
        if not invitation:
            raise NotFoundError("Invitation invalide ou expirée.")
        owner = await self.repo.get(invitation.owner_id)
        if not owner:
            raise NotFoundError("Propriétaire introuvable.")

        user = await self.users.get(owner.user_id) if owner.user_id else None
        if user is None:
            user = User(
                email=owner.email,
                full_name=owner.full_name,
                phone=owner.phone,
                role=UserRole.OWNER,
                agency_id=owner.agency_id,
            )
            self.session.add(user)
            await self.session.flush()
            owner.user_id = user.id

        user.hashed_password = hash_password(password)
        user.status = UserStatus.ACTIVE
        user.is_active = True
        user.is_email_verified = True

        owner.status = OwnerStatus.PENDING_VERIFICATION
        invitation.accepted_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.audit.log(
            action="owner.accept_invitation", user_id=user.id, agency_id=owner.agency_id,
            resource_type="owner", resource_id=owner.id,
        )
        return owner

    # ----------------- Workflow 2 : inscription autonome -------------------- #
    async def self_register(self, data: OwnerSelfRegisterRequest) -> Owner:
        agency = await self.agencies.get(data.agency_id)
        if not agency:
            raise NotFoundError("Agence introuvable.")
        if agency.status is not AgencyStatus.ACTIVE:
            raise BusinessRuleError("Cette agence n'accepte pas encore d'inscriptions.")
        if await self.repo.get_by_agency_email(agency.id, data.email):
            raise ConflictError("Vous êtes déjà enregistré auprès de cette agence.")
        if await self.users.get_by_email(data.email):
            raise ConflictError("Un compte existe déjà avec cette adresse email.")

        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=f"{data.first_name} {data.last_name}".strip(),
            phone=data.phone,
            role=UserRole.OWNER,
            status=UserStatus.PENDING,
            agency_id=agency.id,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()

        owner = await self.repo.create(
            agency_id=agency.id,
            user_id=user.id,
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=data.email.lower(),
            phone=data.phone,
            address=data.address,
            city=data.city,
            status=OwnerStatus.PENDING_VERIFICATION,
        )

        # L'agence est notifiée pour vérification.
        if agency.owner_user_id:
            await self.notifications.notify(
                user_id=agency.owner_user_id,
                agency_id=agency.id,
                type=NotificationType.ACCOUNT_VALIDATION,
                title="Nouveau propriétaire à vérifier",
                body=f"{owner.full_name} s'est inscrit et attend la validation de son dossier.",
                action_url=f"/owners/{owner.id}",
            )
        await self.audit.log(
            action="owner.self_register", user_id=user.id, agency_id=agency.id,
            resource_type="owner", resource_id=owner.id,
        )
        return owner

    # --------------------------- Profil / documents ------------------------- #
    async def complete_profile(
        self, owner_id: uuid.UUID, data: OwnerProfileCompletion, ctx: SecurityContext
    ) -> Owner:
        owner = await self.get_or_404(owner_id, ctx)
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(owner, key, value)
        owner.profile_completed_at = datetime.now(timezone.utc)
        if owner.status is OwnerStatus.INVITED:
            owner.status = OwnerStatus.PENDING_VERIFICATION
        await self.session.flush()
        await self.audit.log(
            action="owner.complete_profile", user_id=ctx.user_id, agency_id=owner.agency_id,
            resource_type="owner", resource_id=owner.id,
        )
        return owner

    async def verify(
        self, owner_id: uuid.UUID, approve: bool, reason: str | None, ctx: SecurityContext
    ) -> Owner:
        owner = await self.get_or_404(owner_id, ctx)
        if not ctx.is_agency and not ctx.is_super_admin:
            raise PermissionDeniedError("Seule l'agence peut vérifier un dossier propriétaire.")

        documents = await self.documents.list_for_entity(
            entity_type=OwnerEntityType.OWNER, entity_id=owner.id
        )
        has_identity = any(d.category is DocumentCategory.IDENTITY_CIP for d in documents)
        if approve and not has_identity:
            raise BusinessRuleError(
                "Aucune pièce d'identité (CIP) n'a été déposée pour ce propriétaire."
            )

        owner.status = OwnerStatus.ACTIVE if approve else OwnerStatus.REJECTED
        owner.rejection_reason = None if approve else (reason or "Documents non conformes.")
        owner.verified_at = datetime.now(timezone.utc) if approve else None
        owner.verified_by_id = ctx.user_id

        if owner.user_id:
            user = await self.users.get(owner.user_id)
            if user and approve:
                user.status = UserStatus.ACTIVE
                user.is_active = True
                # Email de bienvenue dédié (plus soigné que le texte générique
                # de notification), en plus de la notification in-app.
                await email_service.send_account_validated(
                    to=user.email,
                    full_name=f"{owner.first_name} {owner.last_name}",
                    url=f"{settings.FRONTEND_BASE_URL}/connexion",
                )
            if user:
                await self.notifications.notify(
                    user_id=user.id,
                    agency_id=owner.agency_id,
                    type=NotificationType.ACCOUNT_VALIDATION,
                    title="Dossier validé" if approve else "Dossier rejeté",
                    body=(
                        "Votre dossier propriétaire a été validé par l'agence."
                        if approve
                        else f"Votre dossier a été rejeté : {owner.rejection_reason}"
                    ),
                    send_email=not approve,
                    email_to=user.email,
                )
        await self.session.flush()
        await self.audit.log(
            action="owner.verify", user_id=ctx.user_id, agency_id=owner.agency_id,
            resource_type="owner", resource_id=owner.id, payload={"approved": approve},
        )
        return owner

    async def update(self, owner_id: uuid.UUID, data: OwnerUpdate, ctx: SecurityContext) -> Owner:
        owner = await self.get_or_404(owner_id, ctx)
        values = data.model_dump(exclude_unset=True)
        if "agent_id" in values and not ctx.is_agency and not ctx.is_super_admin:
            values.pop("agent_id")
        for key, value in values.items():
            setattr(owner, key, value)
        await self.session.flush()
        return owner

    async def suspend(self, owner_id: uuid.UUID, ctx: SecurityContext) -> Owner:
        owner = await self.get_or_404(owner_id, ctx)
        owner.status = OwnerStatus.SUSPENDED
        await self.session.flush()
        await self.audit.log(
            action="owner.suspend", user_id=ctx.user_id, agency_id=owner.agency_id,
            resource_type="owner", resource_id=owner.id,
        )
        return owner

    async def list(self, ctx: SecurityContext, *, term, status, agent_id, scope_agent_id, limit, offset):
        return await self.repo.search(
            ctx, term=term, status=status, agent_id=agent_id,
            scope_agent_id=scope_agent_id, limit=limit, offset=offset,
        )