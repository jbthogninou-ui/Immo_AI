"""Service documents : upload sécurisé, vérification, téléchargement contrôlé."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.document import Document
from app.models.enums import (
    AgencyStatus, DocumentCategory, DocumentStatus, NotificationType, OwnerEntityType,
)
from app.repositories.agency import AgencyRepository
from app.repositories.document import DocumentRepository
from app.repositories.owner import OwnerRepository
from app.repositories.property import PropertyRepository
from app.repositories.user import UserRepository
from app.schemas.document import DocumentFilters
from app.services.audit import AuditService
from app.services.notification import NotificationService
from app.services.storage import storage
from app.utils.files import build_storage_key, checksum, validate_upload


class DocumentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = DocumentRepository(session)
        self.owners = OwnerRepository(session)
        self.agencies = AgencyRepository(session)
        self.properties = PropertyRepository(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    async def upload_agency_registration_document(
        self,
        *,
        content: bytes,
        filename: str,
        mime_type: str | None,
        agency_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Document:
        """Dépôt du justificatif légal juste après l'inscription d'une agence.

        Appelé sans session authentifiée classique : la légitimité de
        l'appelant repose sur la possession du jeton temporaire vérifié en
        amont (AuthService.resolve_upload_token), pas sur un SecurityContext.
        On revérifie ici que l'agence appartient bien au titulaire du jeton
        et qu'elle est toujours en attente de validation, pour empêcher tout
        dépôt sur une agence déjà traitée.
        """
        agency = await self.agencies.get(agency_id)
        if not agency or agency.owner_user_id != user_id:
            raise PermissionDeniedError("Cette agence ne correspond pas à ce compte.")
        if agency.status not in (AgencyStatus.PENDING_VALIDATION, AgencyStatus.REJECTED):
            raise PermissionDeniedError(
                "Le dossier de cette agence n'est plus modifiable à ce stade."
            )

        mime = validate_upload(filename, mime_type, len(content), settings.max_upload_bytes)
        key = build_storage_key(f"agency/{agency_id}", filename)
        await storage.save(key, content)

        document = await self.repo.create(
            agency_id=agency_id,
            entity_type=OwnerEntityType.AGENCY,
            entity_id=agency_id,
            category=DocumentCategory.AGENCY_LEGAL,
            status=DocumentStatus.PENDING,
            filename=filename,
            storage_key=key,
            url=storage.public_url(key),
            mime_type=mime,
            size_bytes=len(content),
            checksum=checksum(content),
            uploaded_by_id=user_id,
        )
        await self.audit.log(
            action="document.upload", user_id=user_id, agency_id=agency_id,
            resource_type="document", resource_id=document.id,
            payload={"category": DocumentCategory.AGENCY_LEGAL.value, "entity": "AGENCY",
                     "context": "agency_registration"},
        )
        return document

    async def upload(
        self,
        *,
        content: bytes,
        filename: str,
        mime_type: str | None,
        entity_type: OwnerEntityType,
        entity_id: uuid.UUID,
        category: DocumentCategory,
        ctx: SecurityContext,
    ) -> Document:
        mime = validate_upload(filename, mime_type, len(content), settings.max_upload_bytes)
        await self._check_entity_access(entity_type, entity_id, ctx)

        key = build_storage_key(f"{entity_type.value.lower()}/{entity_id}", filename)
        await storage.save(key, content)

        document = await self.repo.create(
            agency_id=ctx.agency_id or await self._resolve_agency(entity_type, entity_id),
            entity_type=entity_type,
            entity_id=entity_id,
            category=category,
            status=DocumentStatus.PENDING,
            filename=filename,
            storage_key=key,
            url=storage.public_url(key),
            mime_type=mime,
            size_bytes=len(content),
            checksum=checksum(content),
            uploaded_by_id=ctx.user_id,
        )
        await self.audit.log(
            action="document.upload", user_id=ctx.user_id, agency_id=document.agency_id,
            resource_type="document", resource_id=document.id,
            payload={"category": category.value, "entity": entity_type.value},
        )
        return document

    async def _resolve_agency(self, entity_type: OwnerEntityType, entity_id: uuid.UUID):
        if entity_type is OwnerEntityType.OWNER:
            owner = await self.owners.get(entity_id)
            return owner.agency_id if owner else None
        if entity_type is OwnerEntityType.PROPERTY:
            prop = await self.properties.get(entity_id)
            return prop.agency_id if prop else None
        if entity_type is OwnerEntityType.AGENCY:
            return entity_id
        return None

    async def _check_entity_access(
        self, entity_type: OwnerEntityType, entity_id: uuid.UUID, ctx: SecurityContext
    ) -> None:
        if ctx.is_super_admin:
            return
        if entity_type is OwnerEntityType.OWNER:
            owner = await self.owners.get(entity_id)
            if not owner:
                raise NotFoundError("Propriétaire introuvable.")
            if ctx.is_owner and owner.user_id != ctx.user_id:
                raise PermissionDeniedError("Vous ne pouvez déposer que vos propres documents.")
            if ctx.is_agency_staff:
                ctx.require_same_agency(owner.agency_id)
            return
        if entity_type is OwnerEntityType.PROPERTY:
            prop = await self.properties.get(entity_id)
            if not prop:
                raise NotFoundError("Bien introuvable.")
            if ctx.is_owner and prop.owner_id != ctx.owner_id:
                raise PermissionDeniedError("Ce bien ne vous appartient pas.")
            if ctx.is_agency_staff:
                ctx.require_same_agency(prop.agency_id)
            return
        if entity_type is OwnerEntityType.AGENCY:
            ctx.require_same_agency(entity_id)
            return
        if entity_type is OwnerEntityType.USER and entity_id != ctx.user_id:
            raise PermissionDeniedError("Document lié à un autre utilisateur.")

    async def get_or_404(self, document_id: uuid.UUID, ctx: SecurityContext) -> Document:
        document = await self.repo.get(document_id)
        if not document:
            raise NotFoundError("Document introuvable.")
        if ctx.is_super_admin:
            return document
        if ctx.is_agency_staff:
            ctx.require_same_agency(document.agency_id)
            return document
        if document.uploaded_by_id == ctx.user_id:
            return document
        await self._check_entity_access(document.entity_type, document.entity_id, ctx)
        return document

    async def download(self, document_id: uuid.UUID, ctx: SecurityContext) -> tuple[bytes, Document]:
        document = await self.get_or_404(document_id, ctx)
        content = await storage.read(document.storage_key)
        await self.audit.log(
            action="document.download", user_id=ctx.user_id, agency_id=document.agency_id,
            resource_type="document", resource_id=document.id,
        )
        return content, document

    async def verify(
        self, document_id: uuid.UUID, approve: bool, reason: str | None, ctx: SecurityContext
    ) -> Document:
        document = await self.get_or_404(document_id, ctx)
        if not (ctx.is_agency or ctx.is_super_admin):
            raise PermissionDeniedError("Seule l'agence peut vérifier un document.")

        document.status = DocumentStatus.VERIFIED if approve else DocumentStatus.REJECTED
        document.rejection_reason = None if approve else (reason or "Document non conforme.")
        document.verified_at = datetime.now(timezone.utc) if approve else None
        document.verified_by_id = ctx.user_id
        await self.session.flush()

        if document.uploaded_by_id:
            is_agency_verification = (
                approve
                and document.entity_type == OwnerEntityType.AGENCY
                and document.category == DocumentCategory.AGENCY_LEGAL
            )
            email_to = None
            if is_agency_verification:
                uploader = await UserRepository(self.session).get(document.uploaded_by_id)
                email_to = uploader.email if uploader else None
            await self.notifications.notify(
                user_id=document.uploaded_by_id,
                agency_id=document.agency_id,
                type=NotificationType.DOCUMENT,
                title="Document validé" if approve else "Document rejeté",
                body=(
                    "Vos documents ont été vérifiés. Vous pouvez maintenant créer un ou "
                    "plusieurs agents pour votre agence."
                    if is_agency_verification
                    else (document.rejection_reason or document.filename)
                ),
                send_email=is_agency_verification,
                email_to=email_to,
            )
        await self.audit.log(
            action="document.verify", user_id=ctx.user_id, agency_id=document.agency_id,
            resource_type="document", resource_id=document.id, payload={"approved": approve},
        )
        return document

    async def delete(self, document_id: uuid.UUID, ctx: SecurityContext) -> None:
        document = await self.get_or_404(document_id, ctx)
        if not (ctx.is_agency or ctx.is_super_admin or document.uploaded_by_id == ctx.user_id):
            raise PermissionDeniedError("Suppression non autorisée.")
        await storage.delete(document.storage_key)
        await self.repo.delete(document)
        await self.audit.log(
            action="document.delete", user_id=ctx.user_id, agency_id=ctx.agency_id,
            resource_type="document", resource_id=document_id,
        )

    async def list(self, ctx: SecurityContext, filters: DocumentFilters, *, limit: int, offset: int):
        return await self.repo.search(ctx, filters, limit=limit, offset=offset)