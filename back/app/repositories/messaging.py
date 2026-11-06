"""Repositories messagerie."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.messaging import Conversation, ConversationParticipant, Message
from app.repositories.base import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    model = Conversation

    async def get_with_participants(self, conversation_id: uuid.UUID) -> Conversation | None:
        stmt = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(Conversation.id == conversation_id)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def list_for_user(self, user_id: uuid.UUID, *, limit: int, offset: int):
        sub = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.left_at.is_(None),
        )
        stmt = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(Conversation.id.in_(sub))
            .order_by(
                func.coalesce(Conversation.last_message_at, Conversation.created_at).desc()
            )
        )
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def find_direct(
        self, agency_id: uuid.UUID, user_ids: list[uuid.UUID], conv_type
    ) -> Conversation | None:
        """Retrouve une conversation existante réunissant exactement ces participants."""
        n = len(user_ids)
        matching = (
            select(ConversationParticipant.conversation_id)
            .where(
                ConversationParticipant.user_id.in_(user_ids),
                ConversationParticipant.left_at.is_(None),
            )
            .group_by(ConversationParticipant.conversation_id)
            .having(func.count(func.distinct(ConversationParticipant.user_id)) == n)
            .subquery()
        )
        total = (
            select(ConversationParticipant.conversation_id)
            .where(ConversationParticipant.left_at.is_(None))
            .group_by(ConversationParticipant.conversation_id)
            .having(func.count(ConversationParticipant.id) == n)
            .subquery()
        )
        stmt = (
            select(Conversation.id)
            .where(
                Conversation.agency_id == agency_id,
                Conversation.type == conv_type,
                Conversation.id.in_(select(matching.c.conversation_id)),
                Conversation.id.in_(select(total.c.conversation_id)),
            )
            .limit(1)
        )
        conv_id = (await self.session.execute(stmt)).scalars().first()
        return await self.get_with_participants(conv_id) if conv_id else None

    async def touch(self, conversation: Conversation) -> None:
        conversation.last_message_at = datetime.now(timezone.utc)
        await self.session.flush()


class ParticipantRepository(BaseRepository[ConversationParticipant]):
    model = ConversationParticipant

    async def get_membership(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> ConversationParticipant | None:
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.left_at.is_(None),
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def user_ids(self, conversation_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.left_at.is_(None),
        )
        return list((await self.session.execute(stmt)).scalars().all())


class MessageRepository(BaseRepository[Message]):
    model = Message

    async def list_history(
        self, conversation_id: uuid.UUID, *, limit: int, offset: int, before: datetime | None = None
    ):
        stmt = select(Message).where(
            Message.conversation_id == conversation_id, Message.deleted_at.is_(None)
        )
        if before:
            stmt = stmt.where(Message.created_at < before)
        stmt = stmt.order_by(Message.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def unread_count(self, conversation_id: uuid.UUID, since: datetime | None) -> int:
        stmt = select(func.count()).select_from(Message).where(
            Message.conversation_id == conversation_id, Message.deleted_at.is_(None)
        )
        if since:
            stmt = stmt.where(Message.created_at > since)
        return int((await self.session.execute(stmt)).scalar_one())
