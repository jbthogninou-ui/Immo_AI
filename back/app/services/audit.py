"""Service de journalisation d'audit."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        action: str,
        user_id: uuid.UUID | None = None,
        agency_id: uuid.UUID | None = None,
        resource_type: str | None = None,
        resource_id: str | uuid.UUID | None = None,
        status: str = "SUCCESS",
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """Enregistre une action. N'interrompt jamais le flux métier."""
        try:
            entry = AuditLog(
                user_id=user_id,
                agency_id=agency_id,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                status=status,
                ip_address=ip_address,
                user_agent=(user_agent or "")[:400] or None,
                request_id=request_id,
                payload=payload or {},
            )
            self.session.add(entry)
            await self.session.flush()
        except Exception:  # pragma: no cover - l'audit ne doit jamais casser l'API
            logger.exception("Échec d'écriture du journal d'audit (action=%s)", action)
