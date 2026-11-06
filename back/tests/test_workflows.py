"""Tests des workflows métier : propriétaires, visites, transactions, IA."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import auth

API = settings.API_V1_PREFIX


async def test_owner_invitation_workflow(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]
    invitation = await client.post(
        f"{API}/owners",
        json={"first_name": "Alice", "last_name": "Houngbo",
              "email": "alice.houngbo@test.bj", "phone": "+22996000001"},
        headers=auth(token),
    )
    assert invitation.status_code == 201
    body = invitation.json()
    assert body["owner"]["status"] == "INVITED"

    raw_token = body["invitation_url"].split("token=")[1]
    accepted = await client.post(
        f"{API}/owners/accept-invitation", json={"token": raw_token, "password": "OwnerPass123"}
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "PENDING_VERIFICATION"

    owner_id = accepted.json()["id"]
    refused = await client.post(
        f"{API}/owners/{owner_id}/verify", json={"approve": True}, headers=auth(token)
    )
    assert refused.status_code == 409, "La validation exige une pièce d'identité"


async def test_owner_self_registration_workflow(client: AsyncClient, agency_context: dict):
    response = await client.post(
        f"{API}/owners/register",
        json={"agency_id": agency_context["agency_id"], "first_name": "Bernard",
              "last_name": "Agbo", "email": "bernard.agbo@test.bj",
              "phone": "+22996000002", "password": "OwnerPass123"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "PENDING_VERIFICATION"


async def test_visit_lifecycle(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]
    prop = await client.post(
        f"{API}/properties",
        json={"title": "Villa pour test de visite complète", "price": 50000000, "city": "Cotonou"},
        headers=auth(token),
    )
    property_id = prop.json()["id"]

    client_fiche = await client.post(
        f"{API}/clients",
        json={"first_name": "Carla", "last_name": "Zinsou", "email": "carla.zinsou@test.bj"},
        headers=auth(token),
    )
    client_id = client_fiche.json()["id"]

    when = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    visit = await client.post(
        f"{API}/visits",
        json={"property_id": property_id, "client_id": client_id, "scheduled_at": when},
        headers=auth(token),
    )
    assert visit.status_code == 201
    visit_id = visit.json()["id"]

    completed = await client.post(
        f"{API}/visits/{visit_id}/complete", json={"rating": 4, "feedback": "Bonne visite"},
        headers=auth(token),
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "COMPLETED"

    replay = await client.post(
        f"{API}/visits/{visit_id}/complete", json={"rating": 5}, headers=auth(token)
    )
    assert replay.status_code == 409


async def test_visit_in_the_past_rejected(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]
    prop = await client.post(
        f"{API}/properties",
        json={"title": "Bien pour test de date passée", "price": 1000000, "city": "Cotonou"},
        headers=auth(token),
    )
    fiche = await client.post(
        f"{API}/clients",
        json={"first_name": "Dora", "last_name": "Kpade", "email": "dora.kpade@test.bj"},
        headers=auth(token),
    )
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    response = await client.post(
        f"{API}/visits",
        json={"property_id": prop.json()["id"], "client_id": fiche.json()["id"],
              "scheduled_at": past},
        headers=auth(token),
    )
    assert response.status_code == 409


async def test_sale_completion_marks_property_sold(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]
    prop = await client.post(
        f"{API}/properties",
        json={"title": "Maison destinée à la vente test", "price": 30000000, "city": "Porto-Novo"},
        headers=auth(token),
    )
    property_id = prop.json()["id"]
    fiche = await client.post(
        f"{API}/clients",
        json={"first_name": "Eric", "last_name": "Adjovi", "email": "eric.adjovi@test.bj"},
        headers=auth(token),
    )

    sale = await client.post(
        f"{API}/sales",
        json={"property_id": property_id, "client_id": fiche.json()["id"],
              "amount": 29000000, "commission_rate": 5},
        headers=auth(token),
    )
    assert sale.status_code == 201
    assert float(sale.json()["commission_amount"]) == 1450000.0

    finalized = await client.patch(
        f"{API}/sales/{sale.json()['id']}", json={"status": "COMPLETED"}, headers=auth(token)
    )
    assert finalized.status_code == 200

    updated = await client.get(f"{API}/properties/{property_id}", headers=auth(token))
    assert updated.json()["status"] == "SOLD"
    assert updated.json()["is_published"] is False


async def test_ai_endpoints_work_without_llm(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]

    description = await client.post(
        f"{API}/ai/description",
        json={"property_type": "villa", "area": 250, "district": "Fidjrossè", "city": "Cotonou",
              "bedrooms": 4, "amenities": ["piscine", "garage"]},
        headers=auth(token),
    )
    assert description.status_code == 200
    assert len(description.json()["description"]) > 50
    assert description.json()["provider"] == "local"

    estimate = await client.post(
        f"{API}/ai/estimate",
        json={"area": 250, "city": "Cotonou", "district": "Fidjrossè", "amenities": ["piscine"]},
        headers=auth(token),
    )
    assert estimate.status_code == 200
    body = estimate.json()
    assert float(body["price_range_min"]) < float(body["suggested_price"]) < float(body["price_range_max"])

    assistant = await client.post(
        f"{API}/ai/assistant",
        json={"query": "Maison 4 chambres à Cotonou budget 60 millions"},
        headers=auth(token),
    )
    assert assistant.status_code == 200
    criteria = assistant.json()["criteria"]
    assert criteria["bedrooms"] == 4
    assert criteria["city"] == "Cotonou"
    assert float(criteria["max_price"]) == 60_000_000

    analysis = await client.post(
        f"{API}/ai/analyze-listing",
        json={"title": "Villa", "description": "Belle villa."},
        headers=auth(token),
    )
    assert analysis.status_code == 200
    assert 0 <= analysis.json()["score"] <= 100
    assert analysis.json()["suggestions"]


async def test_messaging_and_notifications(client: AsyncClient, agency_context: dict):
    token = agency_context["token"]
    await client.post(
        f"{API}/auth/register",
        json={"email": "messagerie.client@test.bj", "password": "Passw0rd!",
              "full_name": "Client Messagerie", "role": "CLIENT"},
    )
    login = await client.post(
        f"{API}/auth/login", json={"email": "messagerie.client@test.bj", "password": "Passw0rd!"}
    )
    client_token = login.json()["access_token"]
    me = await client.get(f"{API}/auth/me", headers=auth(client_token))
    client_user_id = me.json()["id"]

    conversation = await client.post(
        f"{API}/conversations",
        json={"type": "CLIENT_AGENT", "participant_ids": [client_user_id],
              "subject": "Demande d'information", "initial_message": "Bonjour, une question."},
        headers=auth(token),
    )
    assert conversation.status_code == 201
    conversation_id = conversation.json()["id"]

    reply = await client.post(
        f"{API}/conversations/{conversation_id}/messages",
        json={"type": "TEXT", "content": "Bonjour, je vous écoute."},
        headers=auth(client_token),
    )
    assert reply.status_code == 201

    history = await client.get(
        f"{API}/conversations/{conversation_id}/messages", headers=auth(token)
    )
    assert history.json()["total"] == 2

    unread = await client.get(f"{API}/notifications/unread-count", headers=auth(client_token))
    assert unread.json()["unread"] >= 1

    outsider = await client.get(f"{API}/conversations/{conversation_id}", headers=auth(client_token))
    assert outsider.status_code == 200
