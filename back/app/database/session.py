"""Moteur asynchrone, sessionmaker et dépendance FastAPI de session."""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine_kwargs: dict = {
    "echo": settings.DB_ECHO,
    "pool_pre_ping": True,
    "future": True,
}
if settings.ENVIRONMENT == "test":
    # Aucune connexion n'est conservée entre les tests : chaque boucle d'évènements
    # ouvre puis ferme la sienne.
    _engine_kwargs["poolclass"] = NullPool
elif "sqlite" not in settings.database_url:
    _engine_kwargs.update(
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=1800,
    )

engine = create_async_engine(settings.database_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dépendance FastAPI : une session par requête, rollback sur erreur."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    """Session hors contexte HTTP (workers Celery, scripts, WebSocket)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_database() -> bool:
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # pragma: no cover - dépend de l'infra
        logger.warning("Base de données indisponible: %s", exc)
        return False


async def dispose_engine() -> None:
    await engine.dispose()
