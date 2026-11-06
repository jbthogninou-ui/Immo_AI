"""Endpoints documents (upload, vérification, téléchargement contrôlé)."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response

from app.api.deps import AgencyOnly, Ctx, DbSession
from app.core.exceptions import PermissionDeniedError
from app.models.enums import DocumentCategory, OwnerEntityType, UserRole
from app.schemas.common import MessageResponse, Page
from app.schemas.document import DocumentFilters, DocumentRead, DocumentVerification
from app.services.auth import AuthService
from app.services.document import DocumentService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/documents", tags=["Documents"])

Filters = Annotated[DocumentFilters, Depends()]


@router.post(
    "/agency-registration", response_model=DocumentRead, status_code=status.HTTP_201_CREATED,
    summary="Déposer le justificatif d'une agence juste après son inscription",
)
async def upload_agency_registration_document(
    session: DbSession,
    token: str = Form(..., description="Jeton temporaire renvoyé par POST /auth/register"),
    file: UploadFile = File(..., description="Fichier (25 Mo max)"),
):
    """Dépose le justificatif légal d'une agence qui vient de s'inscrire.

    Le compte agence n'a pas encore de mot de passe à ce stade (il est défini
    plus tard, une fois le dossier validé) : cette étape ne peut donc pas
    passer par l'authentification classique. Le jeton temporaire fourni par
    POST /auth/register en tient lieu.
    """
    user = await AuthService(session).resolve_upload_token(token)
    if user.role is not UserRole.AGENCY or not user.agency_id:
        raise PermissionDeniedError("Ce jeton ne permet pas de déposer un justificatif d'agence.")
    content = await file.read()
    document = await DocumentService(session).upload_agency_registration_document(
        content=content,
        filename=file.filename or "document",
        mime_type=file.content_type,
        agency_id=user.agency_id,
        user_id=user.id,
    )
    await session.commit()
    return document


@router.get("", response_model=Page[DocumentRead], summary="Lister les documents accessibles")
async def list_documents(ctx: Ctx, session: DbSession, pagination: PaginationDep, filters: Filters):
    items, total = await DocumentService(session).list(
        ctx, filters, limit=pagination.limit, offset=pagination.offset
    )
    return Page.create(
        [DocumentRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED,
             summary="Téléverser un document")
async def upload_document(
    ctx: Ctx,
    session: DbSession,
    file: UploadFile = File(..., description="Fichier (25 Mo max)"),
    entity_type: OwnerEntityType = Form(...),
    entity_id: uuid.UUID = Form(...),
    category: DocumentCategory = Form(default=DocumentCategory.OTHER),
):
    content = await file.read()
    document = await DocumentService(session).upload(
        content=content,
        filename=file.filename or "document",
        mime_type=file.content_type,
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        ctx=ctx,
    )
    await session.commit()
    return document


@router.get("/{document_id}", response_model=DocumentRead, summary="Métadonnées d'un document")
async def get_document(document_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await DocumentService(session).get_or_404(document_id, ctx)


@router.get("/{document_id}/download", summary="Télécharger un document",
            response_class=Response)
async def download_document(document_id: uuid.UUID, ctx: Ctx, session: DbSession):
    content, document = await DocumentService(session).download(document_id, ctx)
    await session.commit()
    return Response(
        content=content,
        media_type=document.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{document.filename}"'},
    )


@router.post("/{document_id}/verify", response_model=DocumentRead,
             summary="Valider ou rejeter un document", dependencies=[AgencyOnly])
async def verify_document(
    document_id: uuid.UUID, data: DocumentVerification, ctx: Ctx, session: DbSession
):
    document = await DocumentService(session).verify(document_id, data.approve, data.reason, ctx)
    await session.commit()
    return document


@router.delete("/{document_id}", response_model=MessageResponse, summary="Supprimer un document")
async def delete_document(document_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await DocumentService(session).delete(document_id, ctx)
    await session.commit()
    return MessageResponse(message="Document supprimé.")