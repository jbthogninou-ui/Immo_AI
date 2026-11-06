"""Tests du module biens immobiliers."""
from __future__ import annotations

from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import auth

API = settings.API_V1_PREFIX

VALID_PROPERTY = {
    "title": "Appartement 3 pièces standing à Haie Vive",
    "description": (
        "Appartement lumineux au deuxième étage, séjour spacieux, cuisine équipée, "
        "deux chambres avec placards, proche des commerces et des écoles."
    ),
    "listing_type": "RENT",
    "city": "Cotonou",
    "district": "Haie Vive",
    "price": 350000,
    "area": 95,
    "rooms": 3,
    "bedrooms": 2,
    "bathrooms": 1,
    "amenities": ["climatisation", "parking"],
}


async def test_create_property_starts_as_draft(client: AsyncClient, agency_context: dict):
    response = await client.post(
        f"{API}/properties", json=VALID_PROPERTY, headers=auth(agency_context["token"])
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "DRAFT"
    assert body["is_published"] is False
    assert body["reference"].startswith("BIEN-")


async def test_publish_requires_photo(client: AsyncClient, agency_context: dict):
    created = await client.post(
        f"{API}/properties", json=VALID_PROPERTY, headers=auth(agency_context["token"])
    )
    property_id = created.json()["id"]

    refused = await client.post(
        f"{API}/properties/{property_id}/publish", headers=auth(agency_context["token"])
    )
    assert refused.status_code == 409
    assert "missing" in refused.json()["error"]["details"]

    await client.post(
        f"{API}/properties/{property_id}/images",
        json={"url": "https://cdn.test/photo.jpg", "is_cover": True},
        headers=auth(agency_context["token"]),
    )
    published = await client.post(
        f"{API}/properties/{property_id}/publish", headers=auth(agency_context["token"])
    )
    assert published.status_code == 200
    assert published.json()["is_published"] is True
    assert published.json()["status"] == "AVAILABLE"


async def test_invalid_status_transition_rejected(client: AsyncClient, agency_context: dict):
    created = await client.post(
        f"{API}/properties", json=VALID_PROPERTY, headers=auth(agency_context["token"])
    )
    property_id = created.json()["id"]

    response = await client.post(
        f"{API}/properties/{property_id}/status", json={"status": "SOLD"},
        headers=auth(agency_context["token"]),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "business_rule_violation"


async def test_filters_and_pagination(client: AsyncClient, agency_context: dict):
    for index in range(3):
        payload = dict(VALID_PROPERTY, title=f"Bien filtrable numéro {index}", price=100000 * (index + 1))
        await client.post(f"{API}/properties", json=payload, headers=auth(agency_context["token"]))

    response = await client.get(
        f"{API}/properties?city=Cotonou&max_price=200000&size=2",
        headers=auth(agency_context["token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["size"] == 2
    assert all(float(item["price"]) <= 200000 for item in body["items"])


async def test_public_catalog_only_exposes_published(client: AsyncClient, agency_context: dict):
    created = await client.post(
        f"{API}/properties", json=dict(VALID_PROPERTY, title="Bien non publié confidentiel"),
        headers=auth(agency_context["token"]),
    )
    property_id = created.json()["id"]

    response = await client.get(f"{API}/public/properties/{property_id}")
    assert response.status_code == 404
