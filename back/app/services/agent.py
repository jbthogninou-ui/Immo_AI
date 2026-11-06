"""Service de gestion des agents (invitation, activation, permissions)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.agency import Agent
from app.models.enums import AgentStatus, NotificationType, UserRole, UserStatus
from app.models.user import User
from app.repositories.agency import AgencyRepository, AgentRepository
from app.repositories.user import UserRepository
from app.schemas.agency import AgentInvite, AgentUpdate
from app.services.audit import AuditService
from app.services.auth import AuthService
from app.services.email import email_service
from app.services.notification import NotificationService


class AgentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AgentRepository(session)
        self.users = UserRepository(session)
        self.agencies = AgencyRepository(session)
        self.auth = AuthService(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    async def get_or_404(self, agent_id: uuid.UUID, ctx: SecurityContext) -> Agent:
        agent = await self.repo.get_with_user(agent_id)
        if not agent:
            raise NotFoundError("Agent introuvable.")
        ctx.require_same_agency(agent.agency_id)
        return agent

    async def invite(
        self, data: AgentInvite, ctx: SecurityContext, *, agency_id: uuid.UUID | None = None
    ) -> tuple[Agent, str | None]:
        target_agency = agency_id or ctx.agency_id
        if not target_agency:
            raise PermissionDeniedError("Aucune agence rattachée à votre compte.")
        ctx.require_same_agency(target_agency)

        agency = await self.agencies.get(target_agency)
        if not agency:
            raise NotFoundError("Agence introuvable.")

        existing = await self.users.get_by_email(data.email)
        if existing:
            # Un agent retiré de l'équipe conserve son compte (désactivé) pour
            # préserver la traçabilité de ce qu'il a créé. Sans ce recyclage,
            # son adresse resterait bloquée à jamais et l'agence ne pourrait
            # plus le réintégrer.
            reusable = (
                existing.role is UserRole.AGENT
                and existing.agency_id == agency.id
                and not existing.is_active
            )
            if not reusable:
                raise ConflictError("Un utilisateur existe déjà avec cette adresse email.")

            existing.full_name = data.full_name.strip()
            existing.phone = data.phone
            existing.status = UserStatus.PENDING
            existing.is_active = True
            existing.hashed_password = None
            await self.session.flush()

            agent = await self.repo.create(
                user_id=existing.id,
                agency_id=agency.id,
                job_title=data.job_title,
                license_number=data.license_number,
                can_manage_owners=data.can_manage_owners,
                can_publish_properties=data.can_publish_properties,
                status=AgentStatus.INVITED,
                invited_at=datetime.now(timezone.utc),
            )
            raw_token = await self.auth.create_invitation_token(existing.id)
            url = f"{settings.FRONTEND_BASE_URL}/accept-invitation?token={raw_token}"
            await email_service.send_agent_invitation(
                to=existing.email, full_name=existing.full_name, agency=agency.name, url=url
            )
            await self.audit.log(
                action="agent.invite", user_id=ctx.user_id, agency_id=agency.id,
                resource_type="agent", resource_id=agent.id, payload={"recycled": True},
            )
            return agent, url if settings.ENVIRONMENT != "production" else None

        user = User(
            email=data.email.lower(),
            full_name=data.full_name.strip(),
            phone=data.phone,
            role=UserRole.AGENT,
            status=UserStatus.PENDING,
            agency_id=agency.id,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()

        agent = await self.repo.create(
            user_id=user.id,
            agency_id=agency.id,
            job_title=data.job_title,
            license_number=data.license_number,
            can_manage_owners=data.can_manage_owners,
            can_publish_properties=data.can_publish_properties,
            status=AgentStatus.INVITED,
            invited_at=datetime.now(timezone.utc),
        )

        raw_token = await self.auth.create_invitation_token(user.id)
        url = f"{settings.FRONTEND_BASE_URL}/accept-invitation?token={raw_token}"
        await email_service.send_agent_invitation(
            to=user.email, full_name=user.full_name, agency=agency.name, url=url
        )
        await self.audit.log(
            action="agent.invite", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agent", resource_id=agent.id, payload={"email": data.email},
        )
        # Le lien est renvoyé à l'auteur de l'invitation, qui est authentifié
        # et habilité. C'est indispensable tant que SMTP n'est pas configuré.
        return agent, url

    async def resend_invitation(self, agent_id: uuid.UUID, ctx: SecurityContext) -> str | None:
        agent = await self.get_or_404(agent_id, ctx)
        if agent.status is AgentStatus.ACTIVE:
            raise ConflictError("Cet agent est déjà actif.")
        user = await self.users.get(agent.user_id)
        agency = await self.agencies.get(agent.agency_id)
        raw_token = await self.auth.create_invitation_token(agent.user_id)
        url = f"{settings.FRONTEND_BASE_URL}/accept-invitation?token={raw_token}"
        if user and agency:
            await email_service.send_agent_invitation(
                to=user.email, full_name=user.full_name, agency=agency.name, url=url
            )
        return url

    async def update_invitation(
        self, agent_id: uuid.UUID, data: "AgentInvitationUpdate", ctx: SecurityContext
    ) -> Agent:
        """Corrige une invitation encore en attente.

        Utile quand l'adresse email a été mal saisie : plutôt que de supprimer
        puis réinviter, on corrige la fiche. Une fois l'agent actif, ces champs
        relèvent de son propre profil et ne sont plus modifiables ici.
        """
        agent = await self.get_or_404(agent_id, ctx)
        if agent.status is not AgentStatus.INVITED:
            raise ConflictError(
                "Cet agent a déjà activé son compte : ses informations "
                "personnelles ne sont plus modifiables depuis l'équipe."
            )
        user = await self.users.get(agent.user_id)
        if not user:
            raise ConflictError("Compte utilisateur introuvable.")

        if data.email and data.email.lower() != user.email:
            existing = await self.users.get_by_email(data.email.lower())
            if existing and existing.id != user.id:
                raise ConflictError("Cette adresse email est déjà utilisée.")
            user.email = data.email.lower()
            user.is_email_verified = False
        if data.full_name:
            user.full_name = data.full_name
        if data.phone is not None:
            user.phone = data.phone
        if data.job_title is not None:
            agent.job_title = data.job_title
        if data.can_manage_owners is not None:
            agent.can_manage_owners = data.can_manage_owners
        if data.can_publish_properties is not None:
            agent.can_publish_properties = data.can_publish_properties

        await self.session.flush()
        await self.audit.log(
            action="agent.update_invitation", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="agent", resource_id=agent.id,
        )
        return agent

    async def update(self, agent_id: uuid.UUID, data: AgentUpdate, ctx: SecurityContext) -> Agent:
        agent = await self.get_or_404(agent_id, ctx)
        values = data.model_dump(exclude_unset=True)
        for key, value in values.items():
            setattr(agent, key, value)
        await self.session.flush()
        await self.audit.log(
            action="agent.update", user_id=ctx.user_id, agency_id=agent.agency_id,
            resource_type="agent", resource_id=agent.id, payload=values,
        )
        return agent

    async def set_status(self, agent_id: uuid.UUID, status: AgentStatus, ctx: SecurityContext) -> Agent:
        agent = await self.get_or_404(agent_id, ctx)
        agent.status = status
        user = await self.users.get(agent.user_id)
        if user:
            user.is_active = status is not AgentStatus.SUSPENDED
            user.status = UserStatus.ACTIVE if status is AgentStatus.ACTIVE else UserStatus.SUSPENDED
            await self.notifications.notify(
                user_id=user.id,
                agency_id=agent.agency_id,
                type=NotificationType.ACCOUNT_VALIDATION,
                title=f"Statut de votre compte agent : {status.value}",
            )
        await self.session.flush()
        await self.audit.log(
            action="agent.set_status", user_id=ctx.user_id, agency_id=agent.agency_id,
            resource_type="agent", resource_id=agent.id, payload={"status": status.value},
        )
        return agent

    async def delete(self, agent_id: uuid.UUID, ctx: SecurityContext) -> None:
        """Retire un agent de l'équipe.

        Un agent qui n'a jamais activé son compte n'a produit aucune donnée :
        son compte utilisateur est supprimé pour de bon, ce qui libère son
        adresse email et permet de le réinviter.

        Un agent qui a été actif a pu créer des biens, des clients ou des
        transactions. Son compte est alors désactivé et non supprimé, pour ne
        pas casser les références et conserver la traçabilité.
        """
        agent = await self.get_or_404(agent_id, ctx)
        user = await self.users.get(agent.user_id)
        never_activated = agent.activated_at is None and agent.status is AgentStatus.INVITED

        await self.repo.delete(agent)
        await self.session.flush()

        if user:
            if never_activated:
                await self.session.delete(user)
            else:
                user.is_active = False
                user.status = UserStatus.DEACTIVATED
        await self.session.flush()
        await self.audit.log(
            action="agent.delete", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="agent", resource_id=agent_id,
        )

    async def list(self, ctx: SecurityContext, *, agency_id: uuid.UUID | None, status, term, limit, offset):
        target = agency_id or ctx.agency_id
        if not ctx.is_super_admin:
            ctx.require_same_agency(target)
        if target is None:
            raise PermissionDeniedError("agency_id requis.")
        return await self.repo.list_for_agency(
            target, status=status, term=term, limit=limit, offset=offset
        )
