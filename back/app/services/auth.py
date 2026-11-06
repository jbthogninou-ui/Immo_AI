"""Service d'authentification : inscription, connexion, jetons, mots de passe."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AuthenticationError, ConflictError, NotFoundError, PermissionDeniedError, ValidationError,
)
from app.core.permissions import PERMISSIONS, SecurityContext
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, generate_opaque_token,
    hash_password, hash_token, verify_password,
)
from app.models.agency import Agency, Agent
from app.models.client import Client
from app.models.enums import AgencyStatus, AgentStatus, OwnerStatus, UserRole, UserStatus
from app.models.owner import Owner
from app.models.user import PasswordResetToken, RefreshToken, User
from app.repositories.agency import AgencyRepository, AgentRepository
from app.repositories.client import ClientRepository
from app.repositories.owner import OwnerRepository
from app.repositories.user import (
    PasswordResetTokenRepository, RefreshTokenRepository, UserRepository,
)
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, RegisterRequest, TokenPair,
)
from app.services.audit import AuditService
from app.services.email import email_service
from app.utils.slug import slugify

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.refresh_tokens = RefreshTokenRepository(session)
        self.reset_tokens = PasswordResetTokenRepository(session)
        self.agencies = AgencyRepository(session)
        self.agents = AgentRepository(session)
        self.owners = OwnerRepository(session)
        self.clients = ClientRepository(session)
        self.audit = AuditService(session)

    # ------------------------------ Inscription ---------------------------- #
    async def register(
        self, data: RegisterRequest, *, ip: str | None = None
    ) -> tuple[User, str | None]:
        existing = await self.users.get_by_email(data.email)
        if existing:
            retry = await self._retry_rejected_agency(existing, data, ip=ip)
            if retry is None:
                raise ConflictError("Un compte existe déjà avec cette adresse email.")
            return retry

        # Une agence n'a pas de mot de passe à l'inscription : le compte reste
        # sans mot de passe (impossible à connecter) jusqu'à ce que le dossier
        # soit validé par un Super Admin et que le lien d'invitation reçu par
        # email soit utilisé pour en définir un (cf. AgencyService.validate
        # et AuthService.accept_invitation).
        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password) if data.password else None,
            full_name=data.full_name.strip(),
            phone=data.phone,
            role=data.role,
            status=UserStatus.ACTIVE if data.role == UserRole.CLIENT else UserStatus.PENDING,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()

        upload_token: str | None = None
        if data.role == UserRole.AGENCY:
            if not data.agency_name:
                raise ValidationError("agency_name est requis pour créer une agence.")
            agency = Agency(
                name=data.agency_name.strip(),
                slug=await self._unique_agency_slug(data.agency_name),
                email=data.email.lower(),
                phone=data.phone,
                status=AgencyStatus.PENDING_VALIDATION,
                owner_user_id=user.id,
            )
            self.session.add(agency)
            await self.session.flush()
            user.agency_id = agency.id

            # Sans mot de passe, l'agence ne peut pas se connecter pour
            # déposer son justificatif : on lui délivre un jeton temporaire,
            # valable seulement le temps de finaliser cette étape unique
            # d'inscription (voir POST /documents/agency-registration).
            upload_token = await self.create_invitation_token(user.id, ttl_minutes=180)

        await self.session.flush()
        await self.audit.log(
            action="auth.register", user_id=user.id, agency_id=user.agency_id,
            resource_type="user", resource_id=user.id, ip_address=ip,
            payload={"role": data.role.value},
        )
        return user, upload_token

    async def _retry_rejected_agency(
        self, user: User, data: RegisterRequest, *, ip: str | None = None
    ) -> tuple[User, str | None] | None:
        """Autorise une nouvelle tentative d'inscription pour une agence rejetée.

        Sans ça, un email déjà pris par une demande d'agence rejetée serait une
        impasse totale pour le candidat : ce compte n'a jamais eu de mot de
        passe (jamais validé), donc jamais moyen de se connecter ni de
        redéposer un dossier. On réutilise le compte et l'agence existants au
        lieu d'en créer de nouveaux, plutôt que de bloquer sur l'email.

        Renvoie None si la situation ne correspond pas à ce cas précis — le
        register() appelant retombe alors sur le refus habituel (email pris).
        """
        if (
            data.role != UserRole.AGENCY
            or user.role != UserRole.AGENCY
            or user.hashed_password is not None
            or not user.agency_id
        ):
            return None

        agency = await self.agencies.get(user.agency_id)
        if not agency or agency.status is not AgencyStatus.REJECTED:
            return None

        if not data.agency_name:
            raise ValidationError("agency_name est requis pour créer une agence.")

        user.full_name = data.full_name.strip()
        user.phone = data.phone
        user.status = UserStatus.PENDING

        agency.name = data.agency_name.strip()
        agency.phone = data.phone
        agency.status = AgencyStatus.PENDING_VALIDATION
        agency.rejection_reason = None
        agency.validated_at = None
        agency.validated_by_id = None
        await self.session.flush()

        # L'ancien justificatif rejeté ne compte plus pour la validation (il
        # reste en base pour la traçabilité) : un nouveau doit être déposé
        # pour ce nouveau dossier, avec un nouveau jeton de dépôt.
        upload_token = await self.create_invitation_token(user.id, ttl_minutes=180)

        await self.audit.log(
            action="auth.register_retry", user_id=user.id, agency_id=agency.id,
            resource_type="user", resource_id=user.id, ip_address=ip,
            payload={"role": data.role.value},
        )
        return user, upload_token

    async def _unique_agency_slug(self, name: str) -> str:
        base = slugify(name)
        candidate = base
        index = 2
        while await self.agencies.slug_exists(candidate):
            candidate = f"{base}-{index}"
            index += 1
        return candidate

    # ------------------------------- Connexion ----------------------------- #
    async def authenticate(self, data: LoginRequest) -> User:
        user = await self.users.get_by_email(data.email)
        if not user or not user.hashed_password:
            # Coût constant : évite l'énumération de comptes.
            verify_password(data.password, "$2b$12$" + "x" * 53)
            raise AuthenticationError("Identifiants invalides.")
        if not verify_password(data.password, user.hashed_password):
            raise AuthenticationError("Identifiants invalides.")
        if not user.is_active or user.status in (UserStatus.SUSPENDED, UserStatus.DEACTIVATED):
            raise PermissionDeniedError("Ce compte est désactivé ou suspendu.")

        if user.role in (UserRole.AGENCY, UserRole.AGENT) and user.agency_id:
            agency = await self.agencies.get(user.agency_id)
            if agency and agency.status is AgencyStatus.SUSPENDED:
                raise PermissionDeniedError("L'agence rattachée est suspendue.")
        return user

    async def issue_tokens(
        self, user: User, *, user_agent: str | None = None, ip: str | None = None
    ) -> TokenPair:
        claims = {"role": user.role.value, "agency_id": str(user.agency_id) if user.agency_id else None}
        access, access_exp = create_access_token(user.id, claims)
        refresh, refresh_exp, jti = create_refresh_token(user.id, {"role": user.role.value})

        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                jti=jti,
                expires_at=refresh_exp,
                user_agent=(user_agent or "")[:255] or None,
                ip_address=ip,
            )
        )
        await self.users.touch_last_login(user.id)
        await self.session.flush()

        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            expires_at=access_exp,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def login(
        self, data: LoginRequest, *, user_agent: str | None = None, ip: str | None = None
    ) -> tuple[User, TokenPair]:
        user = await self.authenticate(data)
        tokens = await self.issue_tokens(user, user_agent=user_agent, ip=ip)
        await self.audit.log(
            action="auth.login", user_id=user.id, agency_id=user.agency_id,
            ip_address=ip, user_agent=user_agent,
        )
        return user, tokens

    # ------------------------------- Refresh ------------------------------- #
    async def refresh(self, refresh_token: str, *, user_agent: str | None = None, ip: str | None = None) -> TokenPair:
        payload = decode_token(refresh_token, expected_type="refresh")
        stored = await self.refresh_tokens.get_active(hash_token(refresh_token))
        if not stored:
            # Jeton révoqué ou inconnu : on invalide toutes les sessions par précaution.
            user_id = payload.get("sub")
            if user_id:
                await self.refresh_tokens.revoke_all_for_user(uuid.UUID(user_id))
            raise AuthenticationError("Jeton de rafraîchissement invalide ou révoqué.")

        user = await self.users.get(stored.user_id)
        if not user or not user.is_active:
            raise AuthenticationError("Compte indisponible.")

        # Rotation : l'ancien jeton est révoqué à chaque usage.
        await self.refresh_tokens.revoke(stored)
        return await self.issue_tokens(user, user_agent=user_agent, ip=ip)

    async def logout(self, *, user_id: uuid.UUID, refresh_token: str | None, all_devices: bool) -> int:
        if all_devices:
            return await self.refresh_tokens.revoke_all_for_user(user_id)
        if not refresh_token:
            return 0
        stored = await self.refresh_tokens.get_active(hash_token(refresh_token))
        if stored and stored.user_id == user_id:
            await self.refresh_tokens.revoke(stored)
            return 1
        return 0

    # ---------------------------- Mots de passe ---------------------------- #
    async def forgot_password(self, email: str) -> str | None:
        """Retourne l'URL de réinitialisation (utile hors production)."""
        user = await self.users.get_by_email(email)
        if not user:
            return None  # Réponse identique pour ne pas révéler l'existence du compte.

        await self.reset_tokens.invalidate_for_user(user.id)
        raw = generate_opaque_token()
        self.session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(raw),
                expires_at=datetime.now(timezone.utc)
                + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
            )
        )
        await self.session.flush()

        url = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw}"
        await email_service.send_password_reset(to=user.email, url=url)
        await self.audit.log(action="auth.forgot_password", user_id=user.id)
        return None if settings.is_production else url

    async def reset_password(self, token: str, new_password: str) -> None:
        stored = await self.reset_tokens.get_valid(hash_token(token))
        if not stored:
            raise AuthenticationError("Jeton de réinitialisation invalide ou expiré.")
        user = await self.users.get(stored.user_id)
        if not user:
            raise NotFoundError("Utilisateur introuvable.")

        user.hashed_password = hash_password(new_password)
        stored.used_at = datetime.now(timezone.utc)
        await self.refresh_tokens.revoke_all_for_user(user.id)
        await self.session.flush()
        await self.audit.log(action="auth.reset_password", user_id=user.id)

    async def change_password(self, user: User, data: ChangePasswordRequest) -> None:
        if not user.hashed_password or not verify_password(data.current_password, user.hashed_password):
            raise AuthenticationError("Mot de passe actuel incorrect.")
        user.hashed_password = hash_password(data.new_password)
        await self.refresh_tokens.revoke_all_for_user(user.id)
        await self.session.flush()
        await self.audit.log(action="auth.change_password", user_id=user.id)

    # ------------------------- Contexte de sécurité ------------------------ #
    async def build_context(self, user: User) -> SecurityContext:
        """Construit le périmètre d'accès complet de l'utilisateur."""
        owner_id: uuid.UUID | None = None
        client_id: uuid.UUID | None = None

        if user.role is UserRole.OWNER:
            owner = await self.owners.get_by_user(user.id)
            owner_id = owner.id if owner else None
        elif user.role is UserRole.CLIENT:
            client = await self.clients.get_by_user(user.id)
            client_id = client.id if client else None

        return SecurityContext(
            user_id=user.id,
            role=user.role,
            email=user.email,
            agency_id=user.agency_id,
            owner_id=owner_id,
            client_id=client_id,
            is_active=user.is_active,
            permissions=set(PERMISSIONS.get(user.role, set())),
        )

    async def resolve_agent_id(self, user: User) -> uuid.UUID | None:
        if user.role is not UserRole.AGENT:
            return None
        agent = await self.agents.get_by_user(user.id)
        return agent.id if agent else None

    # --------------------------- Invitations agents ------------------------ #
    async def accept_invitation(self, token: str, password: str, full_name: str | None) -> User:
        """Activation d'un compte agent ou propriétaire via jeton d'invitation."""
        stored = await self.reset_tokens.get_valid(hash_token(token))
        if not stored:
            raise AuthenticationError("Invitation invalide ou expirée.")
        user = await self.users.get(stored.user_id)
        if not user:
            raise NotFoundError("Utilisateur introuvable.")

        user.hashed_password = hash_password(password)
        user.is_email_verified = True
        user.status = UserStatus.ACTIVE
        if full_name:
            user.full_name = full_name.strip()
        stored.used_at = datetime.now(timezone.utc)

        if user.role is UserRole.AGENT:
            agent = await self.agents.get_by_user(user.id)
            if agent:
                agent.status = AgentStatus.ACTIVE
                agent.activated_at = datetime.now(timezone.utc)
        elif user.role is UserRole.OWNER:
            owner = await self.owners.get_by_user(user.id)
            if owner and owner.status is OwnerStatus.INVITED:
                owner.status = OwnerStatus.PENDING_VERIFICATION

        await self.session.flush()
        await self.audit.log(
            action="auth.accept_invitation", user_id=user.id, agency_id=user.agency_id
        )
        return user

    async def resolve_upload_token(self, token: str) -> User:
        """Valide le jeton temporaire de dépôt du justificatif d'agence (émis
        à l'inscription) et renvoie l'utilisateur associé, sans le consommer :
        le document peut être redéposé plusieurs fois avant expiration."""
        stored = await self.reset_tokens.get_valid(hash_token(token))
        if not stored:
            raise AuthenticationError("Jeton invalide ou expiré.")
        user = await self.users.get(stored.user_id)
        if not user:
            raise NotFoundError("Utilisateur introuvable.")
        return user

    async def create_invitation_token(self, user_id: uuid.UUID, *, ttl_minutes: int = 60 * 48) -> str:
        """Émet un jeton d'invitation et invalide tous les précédents.

        Sans cette révocation, un lien transmis par erreur — au mauvais
        destinataire, ou copié dans un fil de discussion — resterait valable
        même après régénération. Un seul lien est actif à la fois : le dernier.
        """
        now_ = datetime.now(timezone.utc)
        await self.session.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now_,
            )
            .values(used_at=now_)
        )

        raw = generate_opaque_token()
        self.session.add(
            PasswordResetToken(
                user_id=user_id,
                token_hash=hash_token(raw),
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
            )
        )
        await self.session.flush()
        return raw