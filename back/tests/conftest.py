"""Fixtures de test : base PostgreSQL dédiée, client HTTP asynchrone, comptes types."""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy import select
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("SMTP_ENABLED", "false")
os.environ.setdefault("AI_PROVIDER", "none")

from app.core.config import settings  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.session import AsyncSessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import UserRole, UserStatus  # noqa: E402
from app.models.user import User  # noqa: E402

API = settings.API_V1_PREFIX


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database():
    """Recrée le schéma complet avant la session de tests."""
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client


@pytest_asyncio.fixture
async def superadmin_token(client: AsyncClient) -> str:
    async with AsyncSessionLocal() as session:
        existing = (
            await session.execute(select(User).where(User.email == "root@immoflow-test.com"))
        ).scalars().first()
        if existing is None:
            session.add(
                User(
                    email="root@immoflow-test.com",
                    hashed_password=hash_password("RootPass123"),
                    full_name="Root Admin",
                    role=UserRole.SUPER_ADMIN,
                    status=UserStatus.ACTIVE,
                    is_active=True,
                    is_email_verified=True,
                )
            )
            await session.commit()

    response = await client.post(
        f"{API}/auth/login", json={"email": "root@immoflow-test.com", "password": "RootPass123"}
    )
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def agency_context(client: AsyncClient, superadmin_token: str) -> dict:
    """Agence validée + jeton d'accès."""
    email = "agence.test@immoflow-test.com"
    await client.post(
        f"{API}/auth/register",
        json={
            "email": email, "password": "AgencyPass123", "full_name": "Directeur Test",
            "role": "AGENCY", "agency_name": "Agence de Test",
        },
    )
    login = await client.post(f"{API}/auth/login", json={"email": email, "password": "AgencyPass123"})
    token = login.json()["access_token"]
    me = await client.get(f"{API}/auth/me", headers=auth(token))
    agency_id = me.json()["agency_id"]
    await client.post(
        f"{API}/agencies/{agency_id}/validate", json={"approve": True}, headers=auth(superadmin_token)
    )
    return {"token": token, "agency_id": agency_id, "email": email}
