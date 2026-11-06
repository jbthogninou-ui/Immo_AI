"""Dépendances FastAPI : session, authentification, contexte de sécurité, RBAC."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Callable

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.permissions import SecurityContext
from app.core.security import decode_token
from app.database.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.repositories.agency import AgentRepository
from app.repositories.property import PropertyRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False
)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    request: Request,
    session: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Jeton d'accès manquant.")

    payload = decode_token(credentials.credentials, expected_type="access")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Jeton malformé.") from exc

    user = await UserRepository(session).get(user_id)
    if not user:
        raise AuthenticationError("Compte introuvable.")
    if not user.is_active or user.status in (UserStatus.SUSPENDED, UserStatus.DEACTIVATED):
        raise PermissionDeniedError("Ce compte est désactivé ou suspendu.")

    request.state.user_id = str(user.id)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_security_context(user: CurrentUser, session: DbSession) -> SecurityContext:
    return await AuthService(session).build_context(user)


Ctx = Annotated[SecurityContext, Depends(get_security_context)]


@dataclass(slots=True)
class Scope:
    """Identifiants métier dérivés, utilisés pour filtrer les requêtes SQL."""

    ctx: SecurityContext
    agent_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None

    @property
    def agency_id(self) -> uuid.UUID | None:
        return self.ctx.agency_id

    @property
    def user_id(self) -> uuid.UUID:
        return self.ctx.user_id


async def get_scope(user: CurrentUser, ctx: Ctx, session: DbSession) -> Scope:
    agent_id = None
    if user.role is UserRole.AGENT:
        agent = await AgentRepository(session).get_by_user(user.id)
        agent_id = agent.id if agent else None
    return Scope(
        ctx=ctx, agent_id=agent_id, owner_id=ctx.owner_id, client_id=ctx.client_id
    )


ScopeDep = Annotated[Scope, Depends(get_scope)]


async def owner_property_ids(scope: ScopeDep, session: DbSession) -> list[uuid.UUID]:
    """Identifiants des biens d'un propriétaire (filtrage des visites)."""
    if not scope.owner_id:
        return []
    properties = await PropertyRepository(session).list(
        owner_id=scope.owner_id, limit=500, offset=0
    )
    return [p.id for p in properties]


# --------------------------------------------------------------------------- #
# Garde-fous RBAC réutilisables
# --------------------------------------------------------------------------- #
def require_roles(*roles: UserRole) -> Callable:
    async def dependency(ctx: Ctx) -> SecurityContext:
        ctx.require_roles(*roles)
        return ctx

    return dependency


def require_permissions(*permissions: str) -> Callable:
    async def dependency(ctx: Ctx) -> SecurityContext:
        ctx.require(*permissions)
        return ctx

    return dependency


SuperAdminOnly = Depends(require_roles(UserRole.SUPER_ADMIN))
AgencyOnly = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.AGENCY))
AgencyStaff = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.AGENCY, UserRole.AGENT))


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


ClientIP = Annotated[str | None, Depends(client_ip)]
UserAgent = Annotated[str | None, Depends(user_agent)]
