"""Service visites : demande, validation, refus, programmation."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.enums import NotificationType, PropertyStatus, VisitStatus
from app.models.visit import Visit
from app.repositories.client import ClientAgentRepository, ClientRepository
from app.repositories.property import PropertyRepository
from app.repositories.user import UserRepository
from app.repositories.visit import VisitRepository
from app.schemas.visit import VisitDecision, VisitFeedback, VisitFilters, VisitRequestCreate, VisitUpdate
from app.services.audit import AuditService
from app.services.notification import NotificationService

OPEN_STATUSES = {VisitStatus.REQUESTED, VisitStatus.CONFIRMED, VisitStatus.RESCHEDULED}


class VisitService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = VisitRepository(session)
        self.properties = PropertyRepository(session)
        self.clients = ClientRepository(session)
        self.links = ClientAgentRepository(session)
        self.users = UserRepository(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    async def get_or_404(
        self, visit_id: uuid.UUID, ctx: SecurityContext, *, agent_id=None, client_id=None, owner_id=None
    ) -> Visit:
        visit = await self.repo.get(visit_id)
        if not visit:
            raise NotFoundError("Visite introuvable.")
        if ctx.is_super_admin:
            return visit
        if ctx.is_agency:
            ctx.require_same_agency(visit.agency_id)
            return visit
        if ctx.is_agent:
            ctx.require_same_agency(visit.agency_id)
            if visit.agent_id != agent_id:
                raise PermissionDeniedError("Cette visite ne vous est pas attribuée.")
            return visit
        if ctx.is_client and visit.client_id == client_id:
            return visit
        if ctx.is_owner:
            prop = await self.properties.get(visit.property_id)
            if prop and prop.owner_id == owner_id:
                return visit
        raise PermissionDeniedError("Visite hors de votre périmètre.")

    async def request(
        self, data: VisitRequestCreate, ctx: SecurityContext, *, client_id: uuid.UUID | None
    ) -> Visit:
        prop = await self.properties.get(data.property_id)
        if not prop:
            raise NotFoundError("Bien introuvable.")

        if ctx.is_client:
            if not client_id:
                raise BusinessRuleError(
                    "Votre fiche client n'est pas encore créée auprès d'une agence."
                )
            target_client = client_id
            if not prop.is_published:
                raise NotFoundError("Bien introuvable.")
        else:
            ctx.require_same_agency(prop.agency_id)
            if not data.client_id:
                raise BusinessRuleError("client_id est requis lorsque l'agent crée la visite.")
            target_client = data.client_id

        client = await self.clients.get(target_client)
        if not client:
            raise NotFoundError("Client introuvable.")

        if prop.status in (PropertyStatus.SOLD, PropertyStatus.RENTED):
            raise BusinessRuleError("Ce bien n'est plus disponible à la visite.")
        if data.scheduled_at <= datetime.now(timezone.utc):
            raise BusinessRuleError("La date de visite doit être dans le futur.")

        # Attribution : agent du bien, sinon agent principal du client.
        agent_id = prop.agent_id
        if not agent_id:
            links = await self.links.list_for_client(client.id)
            primary = next((l for l in links if l.is_primary), links[0] if links else None)
            agent_id = primary.agent_id if primary else None

        visit = await self.repo.create(
            agency_id=prop.agency_id,
            property_id=prop.id,
            client_id=client.id,
            agent_id=agent_id,
            scheduled_at=data.scheduled_at,
            duration_minutes=data.duration_minutes,
            client_message=data.client_message,
            status=VisitStatus.REQUESTED if ctx.is_client else VisitStatus.CONFIRMED,
            confirmed_at=None if ctx.is_client else datetime.now(timezone.utc),
            created_by_id=ctx.user_id,
        )

        await self._notify_stakeholders(
            visit,
            title="Nouvelle demande de visite" if ctx.is_client else "Visite programmée",
            body=f"{client.full_name} — bien {prop.reference} le "
                 f"{data.scheduled_at.strftime('%d/%m/%Y à %H:%M')}",
            exclude_user_id=ctx.user_id,
        )
        await self.audit.log(
            action="visit.request", user_id=ctx.user_id, agency_id=visit.agency_id,
            resource_type="visit", resource_id=visit.id,
        )
        return visit

    async def decide(
        self, visit_id: uuid.UUID, data: VisitDecision, ctx: SecurityContext, *, agent_id=None
    ) -> Visit:
        visit = await self.get_or_404(visit_id, ctx, agent_id=agent_id)
        if not ctx.is_agency_staff and not ctx.is_super_admin:
            raise PermissionDeniedError("Seule l'agence ou l'agent peut traiter une demande.")
        if visit.status not in OPEN_STATUSES:
            raise BusinessRuleError(f"Visite déjà traitée (statut {visit.status.value}).")

        now = datetime.now(timezone.utc)
        if data.approve:
            if data.scheduled_at:
                if data.scheduled_at <= now:
                    raise BusinessRuleError("La nouvelle date doit être dans le futur.")
                visit.scheduled_at = data.scheduled_at
                visit.status = VisitStatus.RESCHEDULED
            else:
                visit.status = VisitStatus.CONFIRMED
            visit.confirmed_at = now
            visit.rejection_reason = None
        else:
            visit.status = VisitStatus.REJECTED
            visit.rejection_reason = data.reason or "Créneau indisponible."

        await self.session.flush()
        await self._notify_stakeholders(
            visit,
            title="Visite confirmée" if data.approve else "Visite refusée",
            body=visit.rejection_reason
            or f"Rendez-vous le {visit.scheduled_at.strftime('%d/%m/%Y à %H:%M')}",
            exclude_user_id=ctx.user_id,
        )
        await self.audit.log(
            action="visit.decide", user_id=ctx.user_id, agency_id=visit.agency_id,
            resource_type="visit", resource_id=visit.id, payload={"approved": data.approve},
        )
        return visit

    async def update(
        self, visit_id: uuid.UUID, data: VisitUpdate, ctx: SecurityContext, *, agent_id=None
    ) -> Visit:
        visit = await self.get_or_404(visit_id, ctx, agent_id=agent_id)
        if visit.status in (VisitStatus.COMPLETED, VisitStatus.CANCELLED):
            raise BusinessRuleError("Cette visite est clôturée.")

        values = data.model_dump(exclude_unset=True)
        if "scheduled_at" in values and values["scheduled_at"]:
            if values["scheduled_at"] <= datetime.now(timezone.utc):
                raise BusinessRuleError("La date de visite doit être dans le futur.")
            visit.status = VisitStatus.RESCHEDULED
        for key, value in values.items():
            setattr(visit, key, value)
        await self.session.flush()
        await self._notify_stakeholders(
            visit, title="Visite modifiée",
            body=f"Nouveau créneau : {visit.scheduled_at.strftime('%d/%m/%Y à %H:%M')}",
            exclude_user_id=ctx.user_id,
        )
        return visit

    async def cancel(self, visit_id: uuid.UUID, reason: str | None, ctx: SecurityContext, **scope) -> Visit:
        visit = await self.get_or_404(visit_id, ctx, **scope)
        if visit.status in (VisitStatus.COMPLETED, VisitStatus.CANCELLED):
            raise BusinessRuleError("Cette visite est déjà clôturée.")
        visit.status = VisitStatus.CANCELLED
        visit.cancelled_at = datetime.now(timezone.utc)
        visit.rejection_reason = reason
        await self.session.flush()
        await self._notify_stakeholders(
            visit, title="Visite annulée", body=reason or "", exclude_user_id=ctx.user_id
        )
        return visit

    async def complete(
        self, visit_id: uuid.UUID, data: VisitFeedback, ctx: SecurityContext, *, agent_id=None
    ) -> Visit:
        visit = await self.get_or_404(visit_id, ctx, agent_id=agent_id)
        if visit.status not in OPEN_STATUSES:
            raise BusinessRuleError("Seule une visite en cours peut être clôturée.")
        visit.status = VisitStatus.COMPLETED
        visit.completed_at = datetime.now(timezone.utc)
        visit.feedback = data.feedback
        visit.rating = data.rating
        await self.session.flush()
        return visit

    async def list(self, ctx: SecurityContext, filters: VisitFilters, *, agent_id=None,
                   client_id=None, owner_property_ids=None, limit=20, offset=0):
        return await self.repo.search(
            ctx, filters, agent_id=agent_id, client_id=client_id,
            owner_property_ids=owner_property_ids, limit=limit, offset=offset,
        )

    # ---------------------------- Notifications ----------------------------- #
    async def _notify_stakeholders(
        self, visit: Visit, *, title: str, body: str, exclude_user_id: uuid.UUID | None
    ) -> None:
        recipients: list[uuid.UUID] = []

        client = await self.clients.get(visit.client_id)
        if client and client.user_id:
            recipients.append(client.user_id)

        if visit.agent_id:
            from app.repositories.agency import AgentRepository

            agent = await AgentRepository(self.session).get(visit.agent_id)
            if agent:
                recipients.append(agent.user_id)

        prop = await self.properties.get(visit.property_id)
        if prop and prop.owner_id:
            from app.repositories.owner import OwnerRepository

            owner = await OwnerRepository(self.session).get(prop.owner_id)
            if owner and owner.user_id:
                recipients.append(owner.user_id)

        targets = [uid for uid in dict.fromkeys(recipients) if uid != exclude_user_id]
        for user_id in targets:
            await self.notifications.notify(
                user_id=user_id,
                agency_id=visit.agency_id,
                type=NotificationType.VISIT,
                title=title,
                body=body,
                action_url=f"/visits/{visit.id}",
                payload={"visit_id": str(visit.id), "status": visit.status.value},
            )
