"""Énumérations métier partagées."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    AGENCY = "AGENCY"
    AGENT = "AGENT"
    OWNER = "OWNER"
    CLIENT = "CLIENT"


class UserStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DEACTIVATED = "DEACTIVATED"


class AgencyStatus(str, enum.Enum):
    PENDING_VALIDATION = "PENDING_VALIDATION"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REJECTED = "REJECTED"


class AgentStatus(str, enum.Enum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class OwnerStatus(str, enum.Enum):
    INVITED = "INVITED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class PropertyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    RENTED = "RENTED"
    SOLD = "SOLD"
    ARCHIVED = "ARCHIVED"


class ListingType(str, enum.Enum):
    SALE = "SALE"
    RENT = "RENT"
    BOTH = "BOTH"


class VisitStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    RESCHEDULED = "RESCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class SaleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RentalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    TERMINATED = "TERMINATED"
    CANCELLED = "CANCELLED"


class ContractStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_SIGNATURE = "PENDING_SIGNATURE"
    SIGNED = "SIGNED"
    TERMINATED = "TERMINATED"


class ContractKind(str, enum.Enum):
    SALE_DEED = "SALE_DEED"
    LEASE = "LEASE"
    MANDATE = "MANDATE"


class DocumentCategory(str, enum.Enum):
    IDENTITY_CIP = "IDENTITY_CIP"
    IDENTITY_SELFIE = "IDENTITY_SELFIE"
    CONTRACT = "CONTRACT"
    MANDATE = "MANDATE"
    PROPERTY_TITLE = "PROPERTY_TITLE"
    AGENCY_LEGAL = "AGENCY_LEGAL"
    OTHER = "OTHER"


class DocumentStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class OwnerEntityType(str, enum.Enum):
    """Entité propriétaire d'un document (rattachement polymorphe contrôlé)."""

    USER = "USER"
    AGENCY = "AGENCY"
    OWNER = "OWNER"
    CLIENT = "CLIENT"
    PROPERTY = "PROPERTY"
    CONTRACT = "CONTRACT"


class ConversationType(str, enum.Enum):
    CLIENT_AGENT = "CLIENT_AGENT"
    OWNER_AGENT = "OWNER_AGENT"
    AGENT_AGENCY = "AGENT_AGENCY"
    SUPPORT = "SUPPORT"


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    DOCUMENT = "DOCUMENT"
    VIDEO = "VIDEO"
    SYSTEM = "SYSTEM"


class NotificationType(str, enum.Enum):
    INVITATION = "INVITATION"
    ACCOUNT_VALIDATION = "ACCOUNT_VALIDATION"
    NEW_MESSAGE = "NEW_MESSAGE"
    VISIT = "VISIT"
    TRANSACTION = "TRANSACTION"
    DOCUMENT = "DOCUMENT"
    SYSTEM = "SYSTEM"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    WEBSOCKET = "WEBSOCKET"