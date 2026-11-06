"""Service de gestion des agences (validation Super Admin, suspension, stats)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BusinessRuleError, ConflictError, NotFoundError, PermissionDeniedError,
)
from app.core.config import settings
from app.core.permissions import SecurityContext
from app.models.agency import Agency
from app.models.document import Document
from app.models.enums import (
    AgencyStatus, DocumentCategory, DocumentStatus, NotificationType, OwnerEntityType, UserStatus,
)
from app.repositories.agency import AgencyRepository, AgentRepository
from app.repositories.client import ClientRepository
from app.repositories.document import DocumentRepository
from app.repositories.owner import OwnerRepository
from app.repositories.property import PropertyRepository
from app.repositories.transaction import RentalRepository, SaleRepository
from app.repositories.user import UserRepository
from app.repositories.visit import VisitRepository
from app.schemas.agency import AgencyCreate, AgencyStats, AgencyUpdate
from app.services.audit import AuditService
from app.services.auth import AuthService
from app.services.email import email_service
from app.services.notification import NotificationService
from app.utils.slug import slugify


class AgencyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AgencyRepository(session)
        self.documents = DocumentRepository(session)
        self.users = UserRepository(session)
        self.agents = AgentRepository(session)
        self.owners = OwnerRepository(session)
        self.clients = ClientRepository(session)
        self.properties = PropertyRepository(session)
        self.visits = VisitRepository(session)
        self.sales = SaleRepository(session)
        self.rentals = RentalRepository(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)
        self.auth = AuthService(session)

    async def get_or_404(self, agency_id: uuid.UUID) -> Agency:
        agency = await self.repo.get(agency_id)
        if not agency:
            raise NotFoundError("Agence introuvable.")
        return agency

    async def _unique_slug(self, name: str) -> str:
        base = slugify(name)
        candidate, index = base, 2
        while await self.repo.slug_exists(candidate):
            candidate = f"{base}-{index}"
            index += 1
        return candidate

    async def create(self, data: AgencyCreate, ctx: SecurityContext) -> Agency:
        if await self.repo.get_by(email=data.email):
            raise ConflictError("Une agence utilise déjà cette adresse email.")
        agency = await self.repo.create(
            **data.model_dump(),
            slug=await self._unique_slug(data.name),
            status=AgencyStatus.PENDING_VALIDATION,
        )
        await self.audit.log(
            action="agency.create", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agency", resource_id=agency.id,
        )
        return agency

    async def update(self, agency_id: uuid.UUID, data: AgencyUpdate, ctx: SecurityContext) -> Agency:
        agency = await self.get_or_404(agency_id)
        ctx.require_same_agency(agency.id)
        await self.repo.update(agency, **data.model_dump(exclude_unset=True))
        await self.audit.log(
            action="agency.update", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agency", resource_id=agency.id,
            payload=data.model_dump(exclude_unset=True, mode="json"),
        )
        return agency

    # --------------------- Validation par le Super Admin -------------------- #
    async def validate(self, agency_id: uuid.UUID, approve: bool, reason: str | None, ctx: SecurityContext) -> Agency:
        if not ctx.is_super_admin:
            raise PermissionDeniedError("Seul le Super Admin peut valider une agence.")
        agency = await self.get_or_404(agency_id)
        if agency.status is AgencyStatus.ACTIVE and approve:
            raise BusinessRuleError("Cette agence est déjà active.")

        if approve:
            has_proof = await self.session.scalar(
                select(func.count()).select_from(Document).where(
                    Document.entity_type == OwnerEntityType.AGENCY,
                    Document.entity_id == agency.id,
                    Document.category == DocumentCategory.AGENCY_LEGAL,
                    Document.status != DocumentStatus.REJECTED,
                )
            )
            if not has_proof:
                raise BusinessRuleError(
                    "Impossible de valider cette agence : aucun document justificatif "
                    "(RCCM, IFU, registre du commerce…) n'a été déposé."
                )

        now = datetime.now(timezone.utc)
        if approve:
            agency.status = AgencyStatus.ACTIVE
            agency.validated_at = now
            agency.validated_by_id = ctx.user_id
            agency.rejection_reason = None
        else:
            agency.status = AgencyStatus.REJECTED
            agency.rejection_reason = reason or "Dossier non conforme."
        await self.session.flush()

        if agency.owner_user_id:
            owner_user = await self.users.get(agency.owner_user_id)
            if owner_user:
                if approve:
                    # Le compte reste sans mot de passe : on envoie un lien
                    # d'invitation (même mécanisme que pour les agents/
                    # propriétaires) permettant au responsable de l'agence de
                    # terminer son inscription en définissant son mot de
                    # passe. Le compte utilisateur ne passe à ACTIVE qu'à ce
                    # moment-là (cf. AuthService.accept_invitation).
                    raw_token = await self.auth.create_invitation_token(owner_user.id)
                    url = (
                        f"{settings.FRONTEND_BASE_URL}/accept-invitation"
                        f"?token={raw_token}&type=agency"
                    )
                    await email_service.send_agency_validated(
                        to=owner_user.email,
                        full_name=owner_user.full_name,
                        agency=agency.name,
                        url=url,
                    )
                    await self.notifications.notify(
                        user_id=owner_user.id,
                        agency_id=agency.id,
                        type=NotificationType.ACCOUNT_VALIDATION,
                        title="Agence validée",
                        body=(
                            f"Votre agence {agency.name} a été validée. "
                            "Finalisez votre inscription pour y accéder."
                        ),
                        action_url=url,
                        send_email=False,
                    )
                else:
                    await self.notifications.notify(
                        user_id=owner_user.id,
                        agency_id=agency.id,
                        type=NotificationType.ACCOUNT_VALIDATION,
                        title="Demande d'agence rejetée",
                        body=f"Votre demande a été rejetée : {agency.rejection_reason}",
                        send_email=True,
                        email_to=owner_user.email,
                    )

        await self.audit.log(
            action="agency.validate", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agency", resource_id=agency.id,
            payload={"approved": approve, "reason": reason},
        )
        return agency

    async def suspend(self, agency_id: uuid.UUID, reason: str, ctx: SecurityContext) -> Agency:
        agency = await self.get_or_404(agency_id)
        agency.status = AgencyStatus.SUSPENDED
        agency.suspended_at = datetime.now(timezone.utc)
        agency.rejection_reason = reason
        await self.session.flush()
        await self.audit.log(
            action="agency.suspend", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agency", resource_id=agency.id, payload={"reason": reason},
        )
        return agency

    async def activate(self, agency_id: uuid.UUID, ctx: SecurityContext) -> Agency:
        agency = await self.get_or_404(agency_id)
        agency.status = AgencyStatus.ACTIVE
        agency.suspended_at = None
        await self.session.flush()
        await self.audit.log(
            action="agency.activate", user_id=ctx.user_id, agency_id=agency.id,
            resource_type="agency", resource_id=agency.id,
        )
        return agency

    # -------------------------------- Stats -------------------------------- #
    async def stats(self, agency_id: uuid.UUID) -> AgencyStats:
        property_stats = await self.properties.stats_for_agency(agency_id)
        published = await self.properties.count(agency_id=agency_id, is_published=True)
        return AgencyStats(
            agents=await self.agents.count(agency_id=agency_id),
            owners=await self.owners.count(agency_id=agency_id),
            clients=await self.clients.count(agency_id=agency_id),
            properties=sum(property_stats.values()),
            published_properties=published,
            visits_pending=await self.visits.count_pending(agency_id),
            sales_completed=await self.sales.count_completed(agency_id),
            rentals_active=await self.rentals.count_active(agency_id),
        )