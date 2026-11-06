"""Modèles SQLAlchemy — l'import de ce module enregistre tout le metadata."""
from app.database.base import Base
from app.models.agency import Agency, Agent
from app.models.audit import AuditLog
from app.models.client import (
    Client, ClientAgent, ClientFavorite, ClientRequest, ClientSearchHistory,
)
from app.models.document import Document
from app.models.enums import (
    AgencyStatus, AgentStatus, ConversationType, ContractKind, ContractStatus,
    DocumentCategory, DocumentStatus, ListingType, MessageType, NotificationChannel,
    NotificationType, OwnerEntityType, OwnerStatus, PropertyStatus, RentalStatus,
    SaleStatus, UserRole, UserStatus, VisitStatus,
)
from app.models.messaging import Conversation, ConversationParticipant, Message
from app.models.notification import Notification
from app.models.owner import Owner, OwnerInvitation
from app.models.property import Property, PropertyImage, PropertyType
from app.models.transaction import Contract, Rental, Sale
from app.models.user import PasswordResetToken, RefreshToken, User
from app.models.visit import Visit

__all__ = [
    "Base", "Agency", "Agent", "AuditLog", "Client", "ClientAgent", "ClientFavorite",
    "ClientRequest", "ClientSearchHistory", "Contract", "Conversation",
    "ConversationParticipant", "Document", "Message", "Notification", "Owner",
    "OwnerInvitation", "PasswordResetToken", "Property", "PropertyImage",
    "PropertyType", "RefreshToken", "Rental", "Sale", "User", "Visit",
    "AgencyStatus", "AgentStatus", "ConversationType", "ContractKind", "ContractStatus",
    "DocumentCategory", "DocumentStatus", "ListingType", "MessageType",
    "NotificationChannel", "NotificationType", "OwnerEntityType", "OwnerStatus",
    "PropertyStatus", "RentalStatus", "SaleStatus", "UserRole", "UserStatus", "VisitStatus",
]
