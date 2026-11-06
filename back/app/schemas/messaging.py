"""Schémas messagerie."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ConversationType, MessageType
from app.schemas.common import ORMModel


class ConversationCreate(BaseModel):
    type: ConversationType
    participant_ids: list[uuid.UUID] = Field(
        min_length=1, description="Utilisateurs à ajouter (l'auteur est ajouté automatiquement)."
    )
    subject: str | None = Field(default=None, max_length=200)
    property_id: uuid.UUID | None = None
    initial_message: str | None = Field(default=None, max_length=5000)


class ParticipantRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    last_read_at: datetime | None
    is_muted: bool
    full_name: str | None = None
    email: str | None = None
    role: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _flatten_user(cls, data):
        if isinstance(data, dict):
            return data
        user = getattr(data, "user", None)
        return {
            "id": data.id,
            "user_id": data.user_id,
            "last_read_at": data.last_read_at,
            "is_muted": data.is_muted,
            "full_name": user.full_name if user else None,
            "email": user.email if user else None,
            "role": (user.role.value if hasattr(user.role, "value") else user.role) if user else None,
        }


class ConversationRead(ORMModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    type: ConversationType
    subject: str | None
    property_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    is_archived: bool
    last_message_at: datetime | None
    created_at: datetime
    participants: list[ParticipantRead] = []
    unread_count: int = 0


class MessageCreate(BaseModel):
    type: MessageType = MessageType.TEXT
    content: str | None = Field(default=None, max_length=5000)
    attachment_url: str | None = Field(default=None, max_length=700)
    attachment_name: str | None = None
    attachment_mime: str | None = None
    attachment_size: int | None = None
    document_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_payload(self) -> "MessageCreate":
        if self.type is MessageType.TEXT and not (self.content or "").strip():
            raise ValueError("Un message texte doit avoir un contenu.")
        if self.type in (MessageType.IMAGE, MessageType.DOCUMENT, MessageType.VIDEO):
            if not self.attachment_url and not self.document_id:
                raise ValueError("Une pièce jointe (attachment_url ou document_id) est requise.")
        return self


class MessageRead(ORMModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID | None
    type: MessageType
    content: str | None
    attachment_url: str | None
    attachment_name: str | None
    attachment_mime: str | None
    attachment_size: int | None
    document_id: uuid.UUID | None
    extra_data: dict
    edited_at: datetime | None
    created_at: datetime


class ReadReceipt(BaseModel):
    last_read_at: datetime


class WSEnvelope(BaseModel):
    """Format d'échange WebSocket."""

    event: str = Field(description="message.new | message.read | typing | notification.new | pong")
    conversation_id: uuid.UUID | None = None
    data: dict = Field(default_factory=dict)
    sent_at: datetime | None = None
