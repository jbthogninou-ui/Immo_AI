"""RBAC + isolation multi-tenant.

Le `SecurityContext` est construit à chaque requête à partir du JWT et
transporte l'identité + le périmètre de données autorisé de l'appelant.
Chaque repository applique ce périmètre au niveau SQL (defense in depth).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Iterable

from app.core.exceptions import PermissionDeniedError
from app.models.enums import UserRole

# --------------------------------------------------------------------------- #
# Matrice de permissions
# --------------------------------------------------------------------------- #
Permission = str

PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.SUPER_ADMIN: {"*"},
    UserRole.AGENCY: {
        "agency:read", "agency:update",
        "agent:create", "agent:read", "agent:update", "agent:delete",
        "owner:create", "owner:read", "owner:update", "owner:verify",
        "client:create", "client:read", "client:update", "client:delete",
        "property:create", "property:read", "property:update", "property:delete", "property:publish",
        "visit:read", "visit:update", "visit:delete",
        "transaction:create", "transaction:read", "transaction:update",
        "document:create", "document:read", "document:verify", "document:delete",
        "conversation:create", "conversation:read", "message:create",
        "notification:read",
        "ai:use",
        "audit:read",
    },
    UserRole.AGENT: {
        "agency:read",
        "owner:create", "owner:read", "owner:update",
        "client:create", "client:read", "client:update",
        "property:create", "property:read", "property:update", "property:publish",
        "visit:read", "visit:update",
        "transaction:create", "transaction:read", "transaction:update",
        "document:create", "document:read",
        "conversation:create", "conversation:read", "message:create",
        "notification:read",
        "ai:use",
    },
    UserRole.OWNER: {
        "owner:read", "owner:update",
        "property:read",
        "visit:read",
        "transaction:read",
        "document:create", "document:read",
        "conversation:create", "conversation:read", "message:create",
        "notification:read",
    },
    UserRole.CLIENT: {
        "property:read",
        "visit:create", "visit:read",
        "transaction:read",
        "client:read", "client:update",
        "document:read",
        "conversation:create", "conversation:read", "message:create",
        "notification:read",
        "ai:use",
    },
}


@dataclass(slots=True)
class SecurityContext:
    """Identité + périmètre de données du demandeur."""

    user_id: uuid.UUID
    role: UserRole
    email: str
    agency_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    is_active: bool = True
    permissions: set[str] = field(default_factory=set)

    # ------------------------------ rôles ---------------------------------- #
    @property
    def is_super_admin(self) -> bool:
        return self.role is UserRole.SUPER_ADMIN

    @property
    def is_agency(self) -> bool:
        return self.role is UserRole.AGENCY

    @property
    def is_agent(self) -> bool:
        return self.role is UserRole.AGENT

    @property
    def is_owner(self) -> bool:
        return self.role is UserRole.OWNER

    @property
    def is_client(self) -> bool:
        return self.role is UserRole.CLIENT

    @property
    def is_agency_staff(self) -> bool:
        """Agence ou agent : membres internes d'une agence."""
        return self.role in (UserRole.AGENCY, UserRole.AGENT)

    # --------------------------- vérifications ----------------------------- #
    def has_permission(self, permission: Permission) -> bool:
        granted = PERMISSIONS.get(self.role, set())
        return "*" in granted or permission in granted

    def require(self, *permissions: Permission) -> None:
        missing = [p for p in permissions if not self.has_permission(p)]
        if missing:
            raise PermissionDeniedError(
                f"Permission manquante : {', '.join(missing)}",
                details={"required": list(permissions)},
            )

    def require_roles(self, *roles: UserRole) -> None:
        if self.role not in roles:
            raise PermissionDeniedError(
                "Ce rôle n'est pas autorisé à effectuer cette action.",
                details={"allowed_roles": [r.value for r in roles]},
            )

    def require_same_agency(self, agency_id: uuid.UUID | None) -> None:
        """Barrière multi-tenant : interdit l'accès inter-agences."""
        if self.is_super_admin:
            return
        if agency_id is None or self.agency_id is None or agency_id != self.agency_id:
            raise PermissionDeniedError("Ressource hors de votre périmètre d'agence.")

    def require_self_or_privileged(
        self, user_id: uuid.UUID, privileged: Iterable[UserRole] = ()
    ) -> None:
        if self.user_id == user_id or self.is_super_admin or self.role in tuple(privileged):
            return
        raise PermissionDeniedError("Accès limité à votre propre profil.")
