"""Primitives de sécurité : hachage de mots de passe et jetons JWT."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import AuthenticationError

TokenType = Literal["access", "refresh"]


# --------------------------------------------------------------------------- #
# Mots de passe
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #
def _create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, datetime, str]:
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti,
        "iss": settings.APP_NAME,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expire, jti


def create_access_token(
    subject: str | uuid.UUID, extra_claims: dict[str, Any] | None = None
) -> tuple[str, datetime]:
    token, expire, _ = _create_token(
        str(subject),
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims,
    )
    return token, expire


def create_refresh_token(
    subject: str | uuid.UUID, extra_claims: dict[str, Any] | None = None
) -> tuple[str, datetime, str]:
    return _create_token(
        str(subject),
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        extra_claims,
    )


def decode_token(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.APP_NAME,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Le jeton a expiré.", error_code="token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Jeton invalide.", error_code="token_invalid") from exc

    if expected_type and payload.get("type") != expected_type:
        raise AuthenticationError(
            f"Type de jeton invalide (attendu: {expected_type}).",
            error_code="token_wrong_type",
        )
    return payload


# --------------------------------------------------------------------------- #
# Jetons opaques (invitations, reset password) — stockés hachés en base
# --------------------------------------------------------------------------- #
def generate_opaque_token(nbytes: int = 48) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_compare(a: str, b: str) -> bool:
    return secrets.compare_digest(a, b)
