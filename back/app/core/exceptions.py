"""Exceptions métier et gestionnaires d'erreurs globaux."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Exception de base de l'application."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    error_code: str = "app_error"
    message: str = "Une erreur est survenue."

    def __init__(
        self,
        message: str | None = None,
        *,
        error_code: str | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        self.error_code = error_code or self.error_code
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "not_found"
    message = "Ressource introuvable."


class ConflictError(AppException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "conflict"
    message = "Conflit avec l'état actuel de la ressource."


class ValidationError(AppException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "validation_error"
    message = "Données invalides."


class AuthenticationError(AppException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "authentication_error"
    message = "Authentification requise ou invalide."


class PermissionDeniedError(AppException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "permission_denied"
    message = "Vous n'avez pas les droits nécessaires pour cette action."


class BusinessRuleError(AppException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "business_rule_violation"
    message = "Cette opération viole une règle métier."


class ExternalServiceError(AppException):
    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "external_service_error"
    message = "Service externe indisponible."


class RateLimitError(AppException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "rate_limited"
    message = "Trop de requêtes. Réessayez plus tard."


def _payload(
    error_code: str, message: str, details: Any = None, request: Request | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"error": {"code": error_code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    if request is not None:
        rid = getattr(request.state, "request_id", None)
        if rid:
            body["error"]["request_id"] = rid
    return body


def _clean_validation_errors(errors: list[dict]) -> list[dict]:
    """Rend les erreurs Pydantic sérialisables (le champ `ctx` peut contenir
    des instances d'exception issues des validateurs personnalisés)."""
    cleaned: list[dict] = []
    for error in errors:
        item = {
            key: value for key, value in error.items() if key not in ("ctx", "input", "url")
        }
        ctx = error.get("ctx")
        if isinstance(ctx, dict) and "error" in ctx:
            item["msg"] = str(ctx["error"])
        cleaned.append(jsonable_encoder(item))
    return cleaned


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def _app_exception(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.error_code, exc.message, exc.details, request),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload("http_error", str(exc.detail), request=request),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exception(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_payload(
                "validation_error",
                "Le corps de la requête est invalide.",
                details=_clean_validation_errors(exc.errors()),
                request=request,
            ),
        )

    @app.exception_handler(IntegrityError)
    async def _integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Integrity error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_payload(
                "integrity_error",
                "Contrainte d'intégrité violée (doublon ou référence invalide).",
                request=request,
            ),
        )

    @app.exception_handler(SQLAlchemyError)
    async def _sqlalchemy_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("database_error", "Erreur base de données.", request=request),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("internal_error", "Erreur interne du serveur.", request=request),
        )
