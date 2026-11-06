"""Service messagerie temps réel."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.models.enums import ConversationType, MessageType, NotificationType
from app.models.messaging import Conversation, ConversationParticipant, Message
from app.repositories.messaging import (
    ConversationRepository, MessageRepository, ParticipantRepository,
)
from app.repositories.user import UserRepository
from app.schemas.messaging import ConversationCreate, MessageCreate
from app.services.audit import AuditService
from app.services.notification import NotificationService
from app.websocket import pubsub


class MessagingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.conversations = ConversationRepository(session)
        self.participants = ParticipantRepository(session)
        self.messages = MessageRepository(session)
        self.users = UserRepository(session)
        self.audit = AuditService(session)
        self.notifications = NotificationService(session)

    # ---------------------------- Conversations ----------------------------- #
    async def create_conversation(self, data: ConversationCreate, ctx: SecurityContext) -> Conversation:
        agency_id = ctx.agency_id
        member_ids = list(dict.fromkeys([*data.participant_ids, ctx.user_id]))
        if len(member_ids) < 2:
            raise BusinessRuleError("Une conversation requiert au moins deux participants.")

        # Tous les participants doivent partager le même tenant.
        for user_id in member_ids:
            user = await self.users.get(user_id)
            if not user:
                raise NotFoundError(f"Utilisateur {user_id} introuvable.")
            if user.agency_id:
                agency_id = agency_id or user.agency_id
                if not ctx.is_super_admin and user.agency_id != agency_id:
                    raise PermissionDeniedError(
                        "Impossible de créer une conversation entre agences différentes."
                    )
        if not agency_id:
            raise BusinessRuleError("Aucune agence rattachée à cette conversation.")

        existing = await self.conversations.find_direct(agency_id, member_ids, data.type)
        if existing:
            return existing

        conversation = await self.conversations.create(
            agency_id=agency_id,
            type=data.type,
            subject=data.subject,
            property_id=data.property_id,
            created_by_id=ctx.user_id,
        )
        for user_id in member_ids:
            self.session.add(
                ConversationParticipant(conversation_id=conversation.id, user_id=user_id)
            )
        await self.session.flush()

        if data.initial_message:
            await self.send_message(
                conversation.id, MessageCreate(content=data.initial_message), ctx
            )
        return await self.conversations.get_with_participants(conversation.id)  # type: ignore[return-value]

    async def get_or_404(self, conversation_id: uuid.UUID, ctx: SecurityContext) -> Conversation:
        conversation = await self.conversations.get_with_participants(conversation_id)
        if not conversation:
            raise NotFoundError("Conversation introuvable.")
        if ctx.is_super_admin:
            return conversation
        membership = await self.participants.get_membership(conversation_id, ctx.user_id)
        if not membership:
            raise PermissionDeniedError("Vous ne participez pas à cette conversation.")
        return conversation

    async def list_conversations(self, ctx: SecurityContext, *, limit: int, offset: int):
        conversations, total = await self.conversations.list_for_user(
            ctx.user_id, limit=limit, offset=offset
        )
        enriched = []
        for conversation in conversations:
            membership = next(
                (p for p in conversation.participants if p.user_id == ctx.user_id), None
            )
            unread = await self.messages.unread_count(
                conversation.id, membership.last_read_at if membership else None
            )
            enriched.append((conversation, unread))
        return enriched, total

    # ------------------------------- Messages ------------------------------- #
    async def upload_attachment(
        self, conversation_id: uuid.UUID, ctx: SecurityContext,
        *, content: bytes, filename: str, mime_type: str | None,
    ) -> dict:
        """Dépose une pièce jointe (image/fichier) directement dans une
        conversation — pas de circuit de vérification, juste un fichier que
        l'expéditeur et le destinataire peuvent télécharger."""
        from app.services.storage import storage
        from app.utils.files import build_storage_key, validate_upload
        from app.core.config import settings

        await self.get_or_404(conversation_id, ctx)  # vérifie l'appartenance
        mime = validate_upload(filename, mime_type, len(content), settings.max_upload_bytes)
        key = build_storage_key(f"conversation/{conversation_id}", filename)
        await storage.save(key, content)
        return {
            "key": key,
            "name": filename,
            "mime": mime,
            "size": len(content),
        }

    async def download_attachment(self, conversation_id: uuid.UUID, ctx: SecurityContext, key: str) -> bytes:
        from app.services.storage import storage
        await self.get_or_404(conversation_id, ctx)  # vérifie l'appartenance
        if not key.startswith(f"conversation/{conversation_id}/"):
            raise PermissionDeniedError("Cette pièce jointe n'appartient pas à cette conversation.")
        return await storage.read(key)

    async def send_message(
        self, conversation_id: uuid.UUID, data: MessageCreate, ctx: SecurityContext
    ) -> Message:
        conversation = await self.get_or_404(conversation_id, ctx)
        if conversation.is_archived:
            raise BusinessRuleError("Cette conversation est archivée.")

        message = await self.messages.create(
            conversation_id=conversation.id,
            sender_id=ctx.user_id,
            type=data.type,
            content=data.content,
            attachment_url=data.attachment_url,
            attachment_name=data.attachment_name,
            attachment_mime=data.attachment_mime,
            attachment_size=data.attachment_size,
            document_id=data.document_id,
        )
        await self.conversations.touch(conversation)

        recipients = [
            user_id
            for user_id in await self.participants.user_ids(conversation.id)
            if user_id != ctx.user_id
        ]
        payload = {
            "event": "message.new",
            "conversation_id": str(conversation.id),
            "data": {
                "id": str(message.id),
                "sender_id": str(ctx.user_id),
                "type": message.type.value,
                "content": message.content,
                "attachment_url": message.attachment_url,
                "attachment_name": message.attachment_name,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            },
        }
        await pubsub.publish(recipients + [ctx.user_id], payload)

        for user_id in recipients:
            await self.notifications.notify(
                user_id=user_id,
                agency_id=conversation.agency_id,
                type=NotificationType.NEW_MESSAGE,
                title="Nouveau message",
                body=(message.content or message.attachment_name or "Pièce jointe")[:180],
                action_url=f"/conversations/{conversation.id}",
                payload={"conversation_id": str(conversation.id)},
            )
        return message

    async def history(
        self, conversation_id: uuid.UUID, ctx: SecurityContext, *, limit: int, offset: int,
        before: datetime | None = None,
    ):
        await self.get_or_404(conversation_id, ctx)
        return await self.messages.list_history(
            conversation_id, limit=limit, offset=offset, before=before
        )

    async def mark_read(self, conversation_id: uuid.UUID, ctx: SecurityContext) -> datetime:
        await self.get_or_404(conversation_id, ctx)
        membership = await self.participants.get_membership(conversation_id, ctx.user_id)
        if not membership:
            raise PermissionDeniedError("Vous ne participez pas à cette conversation.")
        now = datetime.now(timezone.utc)
        membership.last_read_at = now
        await self.session.flush()

        others = [
            uid for uid in await self.participants.user_ids(conversation_id) if uid != ctx.user_id
        ]
        await pubsub.publish(
            others,
            {
                "event": "message.read",
                "conversation_id": str(conversation_id),
                "data": {"user_id": str(ctx.user_id), "last_read_at": now.isoformat()},
            },
        )
        return now

    async def typing(self, conversation_id: uuid.UUID, ctx: SecurityContext) -> None:
        await self.get_or_404(conversation_id, ctx)
        others = [
            uid for uid in await self.participants.user_ids(conversation_id) if uid != ctx.user_id
        ]
        await pubsub.publish(
            others,
            {
                "event": "typing",
                "conversation_id": str(conversation_id),
                "data": {"user_id": str(ctx.user_id)},
            },
        )

    async def archive(self, conversation_id: uuid.UUID, ctx: SecurityContext) -> Conversation:
        conversation = await self.get_or_404(conversation_id, ctx)
        conversation.is_archived = True
        await self.session.flush()
        return conversation
