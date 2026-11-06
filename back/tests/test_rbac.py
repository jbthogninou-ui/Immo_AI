"""Tests d'isolation multi-tenant et de contrôle d'accès basé sur les rôles."""
from __future__ import annotations

from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import auth

API = settings.API_V1_PREFIX


async def _make_agency(client: AsyncClient, superadmin_token: str, name: str, email: str) -> dict:
    await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Passw0rd!", "full_name": name,
              "role": "AGENCY", "agency_name": name},
    )
    login = await client.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
    token = login.json()["access_token"]
    me = await client.get(f"{API}/auth/me", headers=auth(token))
    agency_id = me.json()["agency_id"]
    await client.post(
        f"{API}/agencies/{agency_id}/validate", json={"approve": True},
        headers=auth(superadmin_token),
    )
    return {"token": token, "agency_id": agency_id}


async def test_agency_cannot_list_all_agencies(client: AsyncClient, agency_context: dict):
    response = await client.get(f"{API}/agencies", headers=auth(agency_context["token"]))
    assert response.status_code == 403


async def test_superadmin_can_list_agencies(client: AsyncClient, superadmin_token: str):
    response = await client.get(f"{API}/agencies", headers=auth(superadmin_token))
    assert response.status_code == 200


async def test_cross_tenant_property_access_denied(client: AsyncClient, superadmin_token: str):
    first = await _make_agency(client, superadmin_token, "Tenant A", "tenant.a@test.bj")
    second = await _make_agency(client, superadmin_token, "Tenant B", "tenant.b@test.bj")

    created = await client.post(
        f"{API}/properties",
        json={"title": "Bien confidentiel du tenant A", "price": 25000000,
              "city": "Cotonou", "listing_type": "SALE"},
        headers=auth(first["token"]),
    )
    assert created.status_code == 201
    property_id = created.json()["id"]

    forbidden = await client.get(f"{API}/properties/{property_id}", headers=auth(second["token"]))
    assert forbidden.status_code in (403, 404)

    listing = await client.get(f"{API}/properties", headers=auth(second["token"]))
    assert listing.status_code == 200
    assert all(item["id"] != property_id for item in listing.json()["items"])


async def test_client_cannot_list_owners(client: AsyncClient, agency_context: dict):
    await client.post(
        f"{API}/auth/register",
        json={"email": "curieux@test.bj", "password": "Passw0rd!",
              "full_name": "Client Curieux", "role": "CLIENT"},
    )
    login = await client.post(
        f"{API}/auth/login", json={"email": "curieux@test.bj", "password": "Passw0rd!"}
    )
    token = login.json()["access_token"]

    await client.post(
        f"{API}/owners",
        json={"first_name": "Jean", "last_name": "Propriétaire",
              "email": "jean.prop@test.bj", "phone": "+22990000000"},
        headers=auth(agency_context["token"]),
    )

    response = await client.get(f"{API}/owners", headers=auth(token))
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_client_cannot_create_property(client: AsyncClient):
    await client.post(
        f"{API}/auth/register",
        json={"email": "client.creation@test.bj", "password": "Passw0rd!",
              "full_name": "Client", "role": "CLIENT"},
    )
    login = await client.post(
        f"{API}/auth/login", json={"email": "client.creation@test.bj", "password": "Passw0rd!"}
    )
    response = await client.post(
        f"{API}/properties",
        json={"title": "Tentative interdite de création", "price": 1000000, "city": "Cotonou"},
        headers=auth(login.json()["access_token"]),
    )
    assert response.status_code == 403
