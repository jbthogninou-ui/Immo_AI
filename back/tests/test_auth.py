"""Tests d'authentification et de sécurité des jetons."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import auth

API = settings.API_V1_PREFIX


async def test_register_and_login(client: AsyncClient):
    payload = {
        "email": "nouveau.client@test.bj", "password": "Passw0rd!", "full_name": "Nouveau Client",
        "role": "CLIENT",
    }
    response = await client.post(f"{API}/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["role"] == "CLIENT"

    login = await client.post(
        f"{API}/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login.status_code == 200
    body = login.json()
    assert body["access_token"] and body["refresh_token"]


async def test_duplicate_email_rejected(client: AsyncClient):
    payload = {
        "email": "doublon@test.bj", "password": "Passw0rd!", "full_name": "Doublon", "role": "CLIENT",
    }
    assert (await client.post(f"{API}/auth/register", json=payload)).status_code == 201
    second = await client.post(f"{API}/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


async def test_weak_password_rejected(client: AsyncClient):
    response = await client.post(
        f"{API}/auth/register",
        json={"email": "faible@test.bj", "password": "azerty", "full_name": "Faible", "role": "CLIENT"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("role", ["SUPER_ADMIN", "AGENT"])
async def test_privileged_roles_cannot_self_register(client: AsyncClient, role: str):
    response = await client.post(
        f"{API}/auth/register",
        json={"email": f"{role.lower()}@test.bj", "password": "Passw0rd!",
              "full_name": "Escalade", "role": role},
    )
    assert response.status_code == 422


async def test_invalid_credentials(client: AsyncClient):
    await client.post(
        f"{API}/auth/register",
        json={"email": "creds@test.bj", "password": "Passw0rd!", "full_name": "Creds", "role": "CLIENT"},
    )
    response = await client.post(
        f"{API}/auth/login", json={"email": "creds@test.bj", "password": "MauvaisMdp1"}
    )
    assert response.status_code == 401


async def test_refresh_token_rotation(client: AsyncClient):
    await client.post(
        f"{API}/auth/register",
        json={"email": "rotate@test.bj", "password": "Passw0rd!", "full_name": "Rotate", "role": "CLIENT"},
    )
    login = await client.post(
        f"{API}/auth/login", json={"email": "rotate@test.bj", "password": "Passw0rd!"}
    )
    refresh_token = login.json()["refresh_token"]

    first = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh_token})
    assert first.status_code == 200

    replay = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh_token})
    assert replay.status_code == 401, "Un refresh token doit être à usage unique"


async def test_protected_route_requires_token(client: AsyncClient):
    response = await client.get(f"{API}/properties")
    assert response.status_code == 401


async def test_me_returns_permissions(client: AsyncClient, agency_context: dict):
    response = await client.get(f"{API}/auth/me", headers=auth(agency_context["token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "AGENCY"
    assert "property:create" in body["permissions"]
