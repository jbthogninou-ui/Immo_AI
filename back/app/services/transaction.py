"""Service transactions : ventes, locations, contrats."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.enums import (
    ContractKind, ContractStatus, NotificationType, PropertyStatus, RentalStatus, SaleStatus,
)
from app.models.transaction import Contract, Rental, Sale
from app.repositories.agency import AgencyRepository, AgentRepository
from app.repositories.client import ClientRepository
from app.repositories.owner import OwnerRepository
from app.repositories.property import PropertyRepository
from app.repositories.transaction import ContractRepository, RentalRepository, SaleRepository
from app.schemas.transaction import (
    ContractCreate, ContractSign, ContractUpdate, RentalCreate, RentalUpdate, SaleCreate, SaleUpdate,
)
from app.services.audit import AuditService
from app.services.notification import NotificationService

UNAVAILABLE = {PropertyStatus.SOLD, PropertyStatus.RENTED}


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sales = SaleRepository(session)
        self.rentals = RentalRepository(session)
        self.contracts = ContractRepository(session)
        self.properties = PropertyRepository(session)
        self.clients = ClientRepository(session)
        self.owners = OwnerRepository(session)
        self.agents = AgentRepository(session)
        self.agencies = AgencyRepository(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    # ------------------------------- Ventes --------------------------------- #
    async def create_sale(
        self, data: SaleCreate, ctx: SecurityContext, *, agent_id: uuid.UUID | None
    ) -> Sale:
        prop, client = await self._validate_transaction_targets(data.property_id, data.client_id, ctx)
        if prop.status in UNAVAILABLE:
            raise BusinessRuleError(f"Ce bien est déjà {prop.status.value.lower()}.")

        commission = None
        if data.commission_rate is not None:
            commission = (Decimal(data.amount) * Decimal(data.commission_rate) / Decimal(100)).quantize(
                Decimal("0.01")
            )

        sale = await self.sales.create(
            reference=await self.sales.next_reference(prop.agency_id),
            agency_id=prop.agency_id,
            property_id=prop.id,
            client_id=client.id,
            agent_id=data.agent_id or agent_id or prop.agent_id,
            owner_id=prop.owner_id,
            amount=data.amount,
            currency=data.currency,
            commission_rate=data.commission_rate,
            commission_amount=commission,
            notes=data.notes,
            status=SaleStatus.IN_PROGRESS,
        )
        prop.status = PropertyStatus.RESERVED
        await self.session.flush()

        await self._notify(prop.agency_id, prop.owner_id, client.user_id,
                           "Nouvelle vente enregistrée", f"Bien {prop.reference} — vente {sale.reference}")
        await self.audit.log(
            action="sale.create", user_id=ctx.user_id, agency_id=prop.agency_id,
            resource_type="sale", resource_id=sale.id,
        )
        return sale

    async def update_sale(self, sale_id: uuid.UUID, data: SaleUpdate, ctx: SecurityContext, *, agent_id=None) -> Sale:
        sale = await self._get_sale(sale_id, ctx, agent_id=agent_id)
        values = data.model_dump(exclude_unset=True)
        new_status = values.pop("status", None)
        for key, value in values.items():
            setattr(sale, key, value)

        if sale.commission_rate is not None:
            sale.commission_amount = (
                Decimal(sale.amount) * Decimal(sale.commission_rate) / Decimal(100)
            ).quantize(Decimal("0.01"))

        if new_status:
            await self._apply_sale_status(sale, new_status)
        await self.session.flush()
        return sale

    async def _apply_sale_status(self, sale: Sale, status: SaleStatus) -> None:
        if sale.status is SaleStatus.COMPLETED and status is not SaleStatus.COMPLETED:
            raise BusinessRuleError("Une vente finalisée ne peut plus changer de statut.")
        prop = await self.properties.get(sale.property_id)
        now = datetime.now(timezone.utc)

        if status is SaleStatus.COMPLETED:
            sale.completed_at = now
            sale.signed_at = sale.signed_at or now
            if prop:
                prop.status = PropertyStatus.SOLD
                prop.is_published = False
        elif status is SaleStatus.CANCELLED:
            sale.cancelled_at = now
            if prop and prop.status is PropertyStatus.RESERVED:
                prop.status = PropertyStatus.AVAILABLE
        sale.status = status

    async def _get_sale(self, sale_id: uuid.UUID, ctx: SecurityContext, *, agent_id=None) -> Sale:
        sale = await self.sales.get(sale_id)
        if not sale:
            raise NotFoundError("Vente introuvable.")
        self._check_transaction_access(sale, ctx, agent_id=agent_id)
        return sale

    # ------------------------------ Locations ------------------------------- #
    async def create_rental(
        self, data: RentalCreate, ctx: SecurityContext, *, agent_id: uuid.UUID | None
    ) -> Rental:
        prop, client = await self._validate_transaction_targets(data.property_id, data.client_id, ctx)
        if prop.status in UNAVAILABLE:
            raise BusinessRuleError(f"Ce bien est déjà {prop.status.value.lower()}.")

        rental = await self.rentals.create(
            reference=await self.rentals.next_reference(prop.agency_id),
            agency_id=prop.agency_id,
            property_id=prop.id,
            client_id=client.id,
            agent_id=data.agent_id or agent_id or prop.agent_id,
            owner_id=prop.owner_id,
            monthly_rent=data.monthly_rent,
            charges=data.charges,
            deposit_amount=data.deposit_amount,
            currency=data.currency,
            start_date=data.start_date,
            end_date=data.end_date,
            duration_months=data.duration_months,
            notes=data.notes,
            status=RentalStatus.DRAFT,
        )
        prop.status = PropertyStatus.RESERVED
        await self.session.flush()
        await self._notify(prop.agency_id, prop.owner_id, client.user_id,
                           "Nouveau dossier de location", f"Bien {prop.reference} — {rental.reference}")
        await self.audit.log(
            action="rental.create", user_id=ctx.user_id, agency_id=prop.agency_id,
            resource_type="rental", resource_id=rental.id,
        )
        return rental

    async def update_rental(self, rental_id: uuid.UUID, data: RentalUpdate, ctx: SecurityContext, *, agent_id=None) -> Rental:
        rental = await self._get_rental(rental_id, ctx, agent_id=agent_id)
        values = data.model_dump(exclude_unset=True)
        new_status = values.pop("status", None)
        for key, value in values.items():
            setattr(rental, key, value)

        if new_status:
            prop = await self.properties.get(rental.property_id)
            if new_status is RentalStatus.ACTIVE:
                if prop:
                    prop.status = PropertyStatus.RENTED
                    prop.is_published = False
            elif new_status is RentalStatus.TERMINATED:
                rental.terminated_at = datetime.now(timezone.utc)
                if prop:
                    prop.status = PropertyStatus.AVAILABLE
            elif new_status is RentalStatus.CANCELLED and prop and prop.status is PropertyStatus.RESERVED:
                prop.status = PropertyStatus.AVAILABLE
            rental.status = new_status

        await self.session.flush()
        return rental

    async def _get_rental(self, rental_id: uuid.UUID, ctx: SecurityContext, *, agent_id=None) -> Rental:
        rental = await self.rentals.get(rental_id)
        if not rental:
            raise NotFoundError("Location introuvable.")
        self._check_transaction_access(rental, ctx, agent_id=agent_id)
        return rental

    # ------------------------------- Contrats ------------------------------- #
    async def create_contract(
        self, data: ContractCreate, ctx: SecurityContext, *, agent_id: uuid.UUID | None = None
    ) -> Contract:
        if not ctx.agency_id and not ctx.is_super_admin:
            raise PermissionDeniedError("Périmètre agence requis.")
        agency_id = ctx.agency_id
        prop = None
        client = None

        if data.sale_id:
            sale = await self._get_sale(data.sale_id, ctx)
            agency_id = sale.agency_id
            prop = await self.properties.get(sale.property_id)
            client = await self.clients.get(sale.client_id)
        elif data.rental_id:
            rental = await self._get_rental(data.rental_id, ctx)
            agency_id = rental.agency_id
            prop = await self.properties.get(rental.property_id)
            client = await self.clients.get(rental.client_id)
        elif data.property_id:
            prop = await self.properties.get(data.property_id)
            if not prop:
                raise NotFoundError("Bien introuvable.")
            ctx.require_same_agency(prop.agency_id)
            agency_id = prop.agency_id
            if data.client_id:
                client = await self.clients.get(data.client_id)
                if not client or client.agency_id != agency_id:
                    raise NotFoundError("Client introuvable dans cette agence.")

        agency = await self.agencies.get(agency_id)
        title = data.title or self._contract_title(data.kind, prop)
        content = data.content or self._generate_contract_content(
            kind=data.kind, agency=agency, property=prop, client=client,
            start_date=data.start_date, end_date=data.end_date,
        )

        contract = await self.contracts.create(
            reference=await self.contracts.next_reference(agency_id),
            agency_id=agency_id,
            kind=data.kind,
            title=title,
            content=content,
            sale_id=data.sale_id,
            rental_id=data.rental_id,
            property_id=data.property_id or (prop.id if prop else None),
            client_id=data.client_id or (client.id if client else None),
            document_id=data.document_id,
            start_date=data.start_date,
            end_date=data.end_date,
            agent_id=agent_id,
        )
        await self.audit.log(
            action="contract.create", user_id=ctx.user_id, agency_id=agency_id,
            resource_type="contract", resource_id=contract.id,
        )
        return contract

    def _contract_title(self, kind: ContractKind, prop) -> str:
        label = {
            ContractKind.SALE_DEED: "Contrat de vente",
            ContractKind.LEASE: "Contrat de bail",
            ContractKind.MANDATE: "Mandat de gestion",
        }[kind]
        return f"{label} — {prop.title}" if prop else label

    def _generate_contract_content(
        self, *, kind: ContractKind, agency, property, client, start_date, end_date,
    ) -> str:
        """Génère un texte de contrat basique à partir des informations
        déjà connues du système (agence, bien, client). L'agent/l'agence
        peut ensuite ajuster le texte avant signature."""
        agency_name = agency.name if agency else "L'agence"
        agency_address = getattr(agency, "address", None) or ""
        prop_desc = (
            f"{property.title}, {property.city or ''}"
            + (f", {property.area} m²" if getattr(property, "area", None) else "")
            if property else "le bien concerné"
        )
        price = None
        if property is not None:
            price = getattr(property, "price", None)
        client_name = f"{client.first_name} {client.last_name}" if client else "le client"
        client_email = client.email if client else ""
        period = ""
        if start_date and end_date:
            period = f"\nPériode : du {start_date.isoformat()} au {end_date.isoformat()}."
        elif start_date:
            period = f"\nDate d'effet : {start_date.isoformat()}."

        kind_clause = {
            ContractKind.SALE_DEED: (
                f"Le présent contrat constate la vente du bien désigné ci-dessous par "
                f"{agency_name}, pour le compte du propriétaire, à {client_name}."
            ),
            ContractKind.LEASE: (
                f"Le présent contrat de bail est conclu entre {agency_name}, agissant pour "
                f"le compte du propriétaire, et {client_name}, ci-après « le locataire »."
            ),
            ContractKind.MANDATE: (
                f"Le présent mandat autorise {agency_name} à représenter le propriétaire pour "
                f"la gestion, la mise en location ou la vente du bien désigné ci-dessous."
            ),
        }[kind]

        return (
            f"{kind_clause}\n\n"
            f"Bien concerné : {prop_desc}\n"
            + (f"Prix convenu : {price} FCFA\n" if price else "")
            + f"Client : {client_name} ({client_email})\n"
            + f"Agence : {agency_name}{', ' + agency_address if agency_address else ''}"
            + period
            + "\n\nCe document engage les deux parties dès qu'il est signé électroniquement "
              "par l'agence/l'agent et par le client, ci-dessous."
        )

    async def sign_contract(
        self, contract_id: uuid.UUID, data: ContractSign, ctx: SecurityContext,
        *, agent_id: uuid.UUID | None = None,
    ) -> Contract:
        contract = await self.contracts.get(contract_id)
        if not contract:
            raise NotFoundError("Contrat introuvable.")

        now = datetime.now(timezone.utc)
        if ctx.is_client:
            if contract.client_id != ctx.client_id:
                raise PermissionDeniedError("Ce contrat n'est pas rattaché à votre profil client.")
            contract.client_signature = data.signature
            contract.client_signed_at = now
        elif ctx.is_agency or ctx.is_agent or ctx.is_super_admin:
            ctx.require_same_agency(contract.agency_id)
            contract.agent_signature = data.signature
            contract.agent_signed_at = now
            contract.agent_signed_by_id = ctx.user_id
            if agent_id and not contract.agent_id:
                contract.agent_id = agent_id
        else:
            raise PermissionDeniedError("Vous ne pouvez pas signer ce contrat.")

        if contract.agent_signature and contract.client_signature:
            contract.status = ContractStatus.SIGNED
            contract.signed_at = contract.signed_at or now
        else:
            contract.status = ContractStatus.PENDING_SIGNATURE

        await self.session.flush()
        await self.audit.log(
            action="contract.sign", user_id=ctx.user_id, agency_id=contract.agency_id,
            resource_type="contract", resource_id=contract.id,
        )

        # Prévient l'autre partie qu'il reste une signature à recueillir.
        if contract.client_signature and not contract.agent_signature and contract.agency_id:
            pass  # l'agence voit le contrat "en attente" dans sa liste
        elif contract.agent_signature and not contract.client_signature and contract.client_id:
            client = await self.clients.get(contract.client_id)
            if client and client.user_id:
                await self.notifications.notify(
                    user_id=client.user_id, agency_id=contract.agency_id,
                    type=NotificationType.DOCUMENT,
                    title="Un contrat vous attend",
                    body=f"« {contract.title} » a été signé par l'agence. Il ne reste plus qu'à le signer.",
                    send_email=True, email_to=client.email,
                )
        return contract

    async def get_contract(self, contract_id: uuid.UUID, ctx: SecurityContext) -> Contract:
        contract = await self.contracts.get(contract_id)
        if not contract:
            raise NotFoundError("Contrat introuvable.")
        self._check_contract_access(contract, ctx)
        return contract

    def _check_contract_access(self, contract: Contract, ctx: SecurityContext) -> None:
        if ctx.is_super_admin:
            return
        if ctx.is_agency or ctx.is_agent:
            ctx.require_same_agency(contract.agency_id)
            return
        if ctx.is_client and contract.client_id == ctx.client_id:
            return
        raise PermissionDeniedError("Contrat hors de votre périmètre.")

    def render_contract_html(self, contract: Contract) -> bytes:
        """Version imprimable/téléchargeable du contrat, signatures incluses.
        Volontairement en HTML (pas de dépendance PDF côté serveur) : le
        navigateur l'ouvre et peut l'imprimer/l'exporter en PDF si besoin."""
        def sig_block(label: str, data_url: str | None, signed_at) -> str:
            if not data_url:
                return f'<div class="sig"><p>{label}</p><div class="sig-empty">Non signé</div></div>'
            date_label = signed_at.strftime("%d/%m/%Y à %H:%M") if signed_at else ""
            return (
                f'<div class="sig"><p>{label}</p>'
                f'<img src="{data_url}" alt="Signature {label}" />'
                f'<span class="sig-date">Signé le {date_label}</span></div>'
            )

        body = (contract.content or "").replace("\n", "<br/>")
        html = f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>{contract.title}</title>
<style>
  body {{ font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #1c1917; line-height: 1.6; }}
  h1 {{ font-size: 22px; border-bottom: 2px solid #1c1917; padding-bottom: 10px; }}
  .ref {{ color: #78716c; font-size: 13px; margin-bottom: 24px; }}
  .content {{ white-space: pre-wrap; margin: 24px 0; }}
  .signatures {{ display: flex; gap: 40px; margin-top: 48px; }}
  .sig {{ flex: 1; border-top: 1px solid #d6d3d1; padding-top: 12px; }}
  .sig img {{ max-width: 220px; max-height: 90px; display: block; margin: 8px 0; }}
  .sig-empty {{ color: #a8a29e; font-style: italic; }}
  .sig-date {{ font-size: 12px; color: #78716c; }}
</style></head>
<body>
  <h1>{contract.title}</h1>
  <p class="ref">Référence {contract.reference} — statut : {contract.status.value}</p>
  <div class="content">{body}</div>
  <div class="signatures">
    {sig_block("Agence / Agent", contract.agent_signature, contract.agent_signed_at)}
    {sig_block("Client", contract.client_signature, contract.client_signed_at)}
  </div>
</body></html>"""
        return html.encode("utf-8")

    async def update_contract(self, contract_id: uuid.UUID, data: ContractUpdate, ctx: SecurityContext) -> Contract:
        contract = await self.contracts.get(contract_id)
        if not contract:
            raise NotFoundError("Contrat introuvable.")
        ctx.require_same_agency(contract.agency_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(contract, key, value)
        await self.session.flush()
        return contract

    # ------------------------------- Communs -------------------------------- #
    async def _validate_transaction_targets(self, property_id, client_id, ctx: SecurityContext):
        prop = await self.properties.get(property_id)
        if not prop:
            raise NotFoundError("Bien introuvable.")
        ctx.require_same_agency(prop.agency_id)

        client = await self.clients.get(client_id)
        if not client or client.agency_id != prop.agency_id:
            raise NotFoundError("Client introuvable dans cette agence.")
        return prop, client

    def _check_transaction_access(self, entity, ctx: SecurityContext, *, agent_id=None) -> None:
        if ctx.is_super_admin:
            return
        if ctx.is_agency:
            ctx.require_same_agency(entity.agency_id)
            return
        if ctx.is_agent:
            ctx.require_same_agency(entity.agency_id)
            if entity.agent_id != agent_id:
                raise PermissionDeniedError("Transaction hors de votre portefeuille.")
            return
        if ctx.is_client and entity.client_id == ctx.client_id:
            return
        if ctx.is_owner and entity.owner_id == ctx.owner_id:
            return
        raise PermissionDeniedError("Transaction hors de votre périmètre.")

    async def _notify(self, agency_id, owner_id, client_user_id, title: str, body: str) -> None:
        recipients: list[uuid.UUID] = []
        if client_user_id:
            recipients.append(client_user_id)
        if owner_id:
            owner = await self.owners.get(owner_id)
            if owner and owner.user_id:
                recipients.append(owner.user_id)
        for user_id in dict.fromkeys(recipients):
            await self.notifications.notify(
                user_id=user_id, agency_id=agency_id,
                type=NotificationType.TRANSACTION, title=title, body=body,
            )
