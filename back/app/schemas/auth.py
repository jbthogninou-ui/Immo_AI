"""Schémas d'authentification."""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import UserRole
from app.schemas.common import ORMModel
from app.schemas.user import UserRead

PASSWORD_POLICY = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$")


def validate_password_strength(value: str) -> str:
    if not PASSWORD_POLICY.match(value):
        raise ValueError(
            "Le mot de passe doit contenir au moins 8 caractères, "
            "une minuscule, une majuscule et un chiffre."
        )
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    # Optionnel : une agence ne fournit pas de mot de passe à l'inscription.
    # Elle en définit un plus tard, via le lien d'invitation reçu par email
    # une fois son dossier validé par le Super Admin (cf. AuthService.register
    # et AgencyService.validate).
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole = Field(
        default=UserRole.CLIENT,
        description="Rôle demandé : CLIENT, OWNER ou AGENCY. Les rôles AGENT et "
                    "SUPER_ADMIN ne peuvent pas être auto-attribués.",
    )
    agency_name: str | None = Field(default=None, max_length=180)

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return validate_password_strength(v)

    @field_validator("role")
    @classmethod
    def _forbid_privileged_roles(cls, v: UserRole) -> UserRole:
        if v in (UserRole.SUPER_ADMIN, UserRole.AGENT):
            raise ValueError("Ce rôle ne peut pas être obtenu par inscription publique.")
        return v

    @model_validator(mode="after")
    def _password_required_unless_agency(self) -> "RegisterRequest":
        if self.role == UserRole.AGENCY:
            if self.password is not None:
                raise ValueError(
                    "Le mot de passe ne doit pas être fourni pour une inscription "
                    "d'agence : il sera défini après validation du dossier par un "
                    "administrateur, via le lien reçu par email."
                )
        elif self.password is None:
            raise ValueError("Le mot de passe est requis pour ce type de compte.")
        return self


class RegisterResponse(UserRead):
    # Jeton temporaire renvoyé uniquement pour une inscription d'agence : il
    # permet de déposer le justificatif légal (RCCM, IFU…) juste après la
    # création du compte, alors que celui-ci n'a encore ni mot de passe ni
    # session. Voir POST /documents/agency-registration.
    agency_upload_token: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
    all_devices: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

    _check_password = field_validator("new_password")(validate_password_strength)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    _check_password = field_validator("new_password")(validate_password_strength)


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=150)

    _check_password = field_validator("password")(validate_password_strength)


class SessionInfo(ORMModel):
    id: uuid.UUID
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None