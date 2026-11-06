"""Endpoints messagerie (REST ; le temps réel passe par /ws)."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, File, Query, UploadFile, status
from fastapi.responses import Response

from app.api.deps import Ctx, DbSession
from app.schemas.common import MessageResponse, Page
from app.schemas.messaging import (
    ConversationCreate, ConversationRead, MessageCreate, MessageRead, ParticipantRead, ReadReceipt,
)
from app.services.messaging import MessagingService
from app.utils.pagination import PaginationDep

router = APIRouter(prefix="/conversations", tags=["Messagerie"])


@router.get("", response_model=Page[ConversationRead], summary="Mes conversations")
async def list_conversations(ctx: Ctx, session: DbSession, pagination: PaginationDep):
    rows, total = await MessagingService(session).list_conversations(
        ctx, limit=pagination.limit, offset=pagination.offset
    )
    items = []
    for conversation, unread in rows:
        payload = ConversationRead.model_validate(conversation)
        payload.unread_count = unread
        payload.participants = [
            ParticipantRead.model_validate(p) for p in conversation.participants
        ]
        items.append(payload)
    return Page.create(items, total, pagination.page, pagination.size)


@router.post("", response_model=ConversationRead, status_code=status.HTTP_201_CREATED,
             summary="Créer (ou retrouver) une conversation")
async def create_conversation(data: ConversationCreate, ctx: Ctx, session: DbSession):
    conversation = await MessagingService(session).create_conversation(data, ctx)
    await session.commit()
    return conversation


@router.get("/{conversation_id}", response_model=ConversationRead, summary="Détail d'une conversation")
async def get_conversation(conversation_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await MessagingService(session).get_or_404(conversation_id, ctx)


@router.get("/{conversation_id}/messages", response_model=Page[MessageRead],
            summary="Historique des messages")
async def list_messages(
    conversation_id: uuid.UUID, ctx: Ctx, session: DbSession, pagination: PaginationDep,
    before: datetime | None = Query(default=None, description="Pagination par curseur temporel"),
):
    items, total = await MessagingService(session).history(
        conversation_id, ctx, limit=pagination.limit, offset=pagination.offset, before=before
    )
    return Page.create(
        [MessageRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.get("/{conversation_id}/attachments/download", response_class=Response,
            summary="Télécharger une pièce jointe de la conversation")
async def download_attachment(
    conversation_id: uuid.UUID, ctx: Ctx, session: DbSession,
    key: str = Query(...), filename: str = Query("fichier"), mime: str = Query("application/octet-stream"),
):
    content = await MessagingService(session).download_attachment(conversation_id, ctx, key)
    return Response(
        content=content, media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{conversation_id}/attachments", summary="Déposer un fichier/image dans la conversation")
async def upload_attachment(
    conversation_id: uuid.UUID, ctx: Ctx, session: DbSession, file: UploadFile = File(...),
):
    content = await file.read()
    result = await MessagingService(session).upload_attachment(
        conversation_id, ctx, content=content, filename=file.filename or "fichier",
        mime_type=file.content_type,
    )
    await session.commit()
    return result


@router.post("/{conversation_id}/messages", response_model=MessageRead,
             status_code=status.HTTP_201_CREATED, summary="Envoyer un message")
async def send_message(
    conversation_id: uuid.UUID, data: MessageCreate, ctx: Ctx, session: DbSession
):
    message = await MessagingService(session).send_message(conversation_id, data, ctx)
    await session.commit()
    return message


@router.post("/{conversation_id}/read", response_model=ReadReceipt, summary="Marquer comme lu")
async def mark_read(conversation_id: uuid.UUID, ctx: Ctx, session: DbSession):
    last_read_at = await MessagingService(session).mark_read(conversation_id, ctx)
    await session.commit()
    return ReadReceipt(last_read_at=last_read_at)


@router.post("/{conversation_id}/archive", response_model=MessageResponse,
             summary="Archiver une conversation")
async def archive(conversation_id: uuid.UUID, ctx: Ctx, session: DbSession):
    await MessagingService(session).archive(conversation_id, ctx)
    await session.commit()
    return MessageResponse(message="Conversation archivée.")
