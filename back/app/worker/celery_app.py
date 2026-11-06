"""Configuration Celery (optionnelle) : emails, rapports, tâches planifiées.

Démarrage : celery -A app.worker.celery_app worker --loglevel=info
"""
from __future__ import annotations

import asyncio
import logging

from celery import Celery

from app.core.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "immoflow",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Africa/Porto-Novo",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_max_tasks_per_child=200,
)


def _run(coro):
    return asyncio.run(coro)


@celery_app.task(name="email.send", bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, to: str, subject: str, body: str) -> bool:
    """Envoi d'email hors du cycle de la requête HTTP."""
    from app.services.email import email_service

    try:
        return _run(email_service.send(to=to, subject=subject, body=body))
    except Exception as exc:  # pragma: no cover - dépend de l'infra
        logger.exception("Échec d'envoi d'email à %s", to)
        raise self.retry(exc=exc)


@celery_app.task(name="tokens.purge_expired")
def purge_expired_tokens() -> int:
    """Purge les jetons expirés (à planifier quotidiennement)."""
    from datetime import datetime, timezone

    from sqlalchemy import delete

    from app.database.session import session_scope
    from app.models.user import PasswordResetToken, RefreshToken

    async def _purge() -> int:
        now = datetime.now(timezone.utc)
        total = 0
        async with session_scope() as session:
            for model in (RefreshToken, PasswordResetToken):
                result = await session.execute(delete(model).where(model.expires_at < now))
                total += result.rowcount or 0
        return total

    return _run(_purge())
