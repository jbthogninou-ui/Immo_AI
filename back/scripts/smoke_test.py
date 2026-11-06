"""Test de fumée : déroule le cycle métier complet sur une base fraîche.

Prérequis :
    createdb immoflow && alembic upgrade head && python -m app.database.init_db

Usage :
    PYTHONPATH=. python scripts/smoke_test.py

Le script échoue bruyamment (AssertionError) au premier écart, ce qui en fait
un contrôle de non-régression exploitable en intégration continue.
"""
from fastapi.testclient import TestClient
from app.main import app

_cm = TestClient(app)
c = _cm.__enter__()  # portail asyncio persistant (une seule boucle d'évènements)
P = "/api/v1"
ok = lambda r, code=200: (r.status_code == code) or (_ for _ in ()).throw(
    AssertionError(f"{r.request.method} {r.request.url} -> {r.status_code} {r.text[:300]}")
)

def h(t): return {"Authorization": f"Bearer {t}"}

# 1. Super Admin
r = c.post(f"{P}/auth/login", json={"email": "admin@immoflow.ai", "password": "ChangeMe123!"}); ok(r)
admin = r.json()["access_token"]; print("1. Login Super Admin OK")

# 2. Inscription agence
r = c.post(f"{P}/auth/register", json={
    "email": "agence@atlantique.bj", "password": "Agence2026", "full_name": "Directeur Atlantique",
    "phone": "+22997000001", "role": "AGENCY", "agency_name": "Atlantique Immobilier"}); ok(r, 201)
print("2. Inscription agence OK — statut:", r.json()["status"])

r = c.post(f"{P}/auth/login", json={"email": "agence@atlantique.bj", "password": "Agence2026"}); ok(r)
agency_tk = r.json()["access_token"]
r = c.get(f"{P}/auth/me", headers=h(agency_tk)); ok(r)
agency_id = r.json()["agency_id"]

# 3. Blocage avant validation ? (l'agence existe mais est PENDING) -> validation Super Admin
r = c.post(f"{P}/agencies/{agency_id}/validate", json={"approve": True}, headers=h(admin)); ok(r)
print("3. Validation Super Admin OK — statut agence:", r.json()["status"])

# 4. Invitation agent
r = c.post(f"{P}/agents", json={"email": "agent@atlantique.bj", "full_name": "Agent Koffi",
                                "phone": "+22997000002", "job_title": "Négociateur"},
           headers=h(agency_tk)); ok(r, 201)
inv_url = r.json()["invitation_url"]; token = inv_url.split("token=")[1]
print("4. Invitation agent OK")

r = c.post(f"{P}/auth/accept-invitation", json={"token": token, "password": "Agent2026"}); ok(r)
r = c.post(f"{P}/auth/login", json={"email": "agent@atlantique.bj", "password": "Agent2026"}); ok(r)
agent_tk = r.json()["access_token"]; print("   Activation compte agent OK")

# 5. Invitation propriétaire (workflow 1)
r = c.post(f"{P}/owners", json={"first_name": "Marc", "last_name": "Dossou",
                                "email": "marc.dossou@mail.bj", "phone": "+22997000003"},
           headers=h(agent_tk)); ok(r, 201)
owner_id = r.json()["owner"]["id"]; otoken = r.json()["invitation_url"].split("token=")[1]
r = c.post(f"{P}/owners/accept-invitation", json={"token": otoken, "password": "Owner2026"}); ok(r)
print("5. Workflow propriétaire OK — statut:", r.json()["status"])

r = c.post(f"{P}/auth/login", json={"email": "marc.dossou@mail.bj", "password": "Owner2026"}); ok(r)
owner_tk = r.json()["access_token"]

# 5b. Upload CIP + vérification agence
files = {"file": ("cip.pdf", b"%PDF-1.4 fake cip document", "application/pdf")}
r = c.post(f"{P}/documents", files=files,
           data={"entity_type": "OWNER", "entity_id": owner_id, "category": "IDENTITY_CIP"},
           headers=h(owner_tk)); ok(r, 201)
doc_id = r.json()["id"]
r = c.post(f"{P}/owners/{owner_id}/verify", json={"approve": True}, headers=h(agency_tk)); ok(r)
print("   Upload CIP + vérification agence OK — statut:", r.json()["status"])

# 6. Création bien
r = c.get(f"{P}/properties/types", headers=h(agent_tk)); ok(r)
type_id = r.json()[0]["id"]
r = c.post(f"{P}/properties", json={
    "title": "Villa 4 chambres avec piscine à Fidjrossè",
    "description": "Belle villa moderne située dans un quartier calme et sécurisé de Cotonou, "
                   "proche des commodités, avec piscine, jardin arboré et garage double.",
    "listing_type": "SALE", "property_type_id": type_id, "owner_id": owner_id,
    "city": "Cotonou", "district": "Fidjrossè", "address": "Rue 12.34",
    "latitude": 6.36, "longitude": 2.38, "price": 145000000, "area": 320,
    "rooms": 7, "bedrooms": 4, "bathrooms": 3,
    "amenities": ["piscine", "garage", "jardin"],
    "images": [{"url": "https://cdn.immoflow.ai/p1.jpg", "is_cover": True}]},
    headers=h(agent_tk)); ok(r, 201)
prop = r.json(); prop_id = prop["id"]
print("6. Création bien OK —", prop["reference"], "| statut:", prop["status"])

r = c.post(f"{P}/properties/{prop_id}/publish", headers=h(agent_tk)); ok(r)
print("   Publication OK — statut:", r.json()["status"], "| publié:", r.json()["is_published"])

# 7. Client + isolation
r = c.post(f"{P}/auth/register", json={"email": "client@mail.bj", "password": "Client2026",
                                       "full_name": "Awa Sossou", "role": "CLIENT"}); ok(r, 201)
r = c.post(f"{P}/auth/login", json={"email": "client@mail.bj", "password": "Client2026"}); ok(r)
client_tk = r.json()["access_token"]

r = c.post(f"{P}/clients", json={"first_name": "Awa", "last_name": "Sossou",
                                 "email": "client@mail.bj", "phone": "+22997000004",
                                 "budget_max": 160000000}, headers=h(agent_tk)); ok(r, 201)
client_id = r.json()["id"]
print("7. Fiche client CRM OK (rattachée à l'agent)")

# 8. Catalogue public
r = c.get(f"{P}/public/properties?city=Cotonou"); ok(r)
print("8. Catalogue public OK —", r.json()["total"], "bien(s)")

# 9. Visite
from datetime import datetime, timedelta, timezone
when = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
r = c.post(f"{P}/visits", json={"property_id": prop_id, "client_id": client_id,
                                "scheduled_at": when}, headers=h(agent_tk)); ok(r, 201)
visit_id = r.json()["id"]; print("9. Visite créée OK — statut:", r.json()["status"])
r = c.post(f"{P}/visits/{visit_id}/complete", json={"feedback": "Client très intéressé", "rating": 5},
           headers=h(agent_tk)); ok(r)
print("   Clôture visite OK — statut:", r.json()["status"])

# 10. Vente
r = c.post(f"{P}/sales", json={"property_id": prop_id, "client_id": client_id,
                               "amount": 142000000, "commission_rate": 5},
           headers=h(agent_tk)); ok(r, 201)
sale = r.json(); print("10. Vente OK —", sale["reference"], "| commission:", sale["commission_amount"])
r = c.patch(f"{P}/sales/{sale['id']}", json={"status": "COMPLETED"}, headers=h(agent_tk)); ok(r)
r = c.get(f"{P}/properties/{prop_id}", headers=h(agent_tk)); ok(r)
print("    Vente finalisée -> statut du bien:", r.json()["status"])

# 11. Messagerie
r = c.get(f"{P}/auth/me", headers=h(client_tk)); ok(r); client_uid = r.json()["id"]
r = c.post(f"{P}/conversations", json={"type": "CLIENT_AGENT", "participant_ids": [client_uid],
                                       "subject": "Villa Fidjrossè",
                                       "initial_message": "Bonjour, le bien est-il toujours disponible ?"},
           headers=h(agent_tk)); ok(r, 201)
conv_id = r.json()["id"]
r = c.post(f"{P}/conversations/{conv_id}/messages", json={"type": "TEXT", "content": "Oui, avec plaisir !"},
           headers=h(client_tk)); ok(r, 201)
r = c.get(f"{P}/conversations/{conv_id}/messages", headers=h(agent_tk)); ok(r)
print("11. Messagerie OK —", r.json()["total"], "messages")

# 12. Notifications
r = c.get(f"{P}/notifications/unread-count", headers=h(client_tk)); ok(r)
print("12. Notifications OK —", r.json()["unread"], "non lues")

# 13. IA
r = c.post(f"{P}/ai/description", json={"property_id": prop_id}, headers=h(agent_tk)); ok(r)
print("13. IA description OK (" + r.json()["provider"] + ") :", r.json()["description"][:90] + "...")
r = c.post(f"{P}/ai/estimate", json={"property_id": prop_id}, headers=h(agent_tk)); ok(r)
e = r.json(); print("    IA estimation OK :", f"{float(e['suggested_price']):,.0f}".replace(",", " "),
                    e["currency"], "| confiance", e["confidence"])
r = c.post(f"{P}/ai/assistant", json={"query": "Villa 4 chambres à Cotonou budget 150 millions"},
           headers=h(client_tk)); ok(r)
a = r.json(); print("    IA assistant OK — critères:", a["criteria"]["bedrooms"], "ch.,",
                    a["criteria"]["city"], ", max", a["criteria"]["max_price"])
r = c.post(f"{P}/ai/analyze-listing", json={"property_id": prop_id}, headers=h(agent_tk)); ok(r)
print("    IA analyse annonce OK — score:", r.json()["score"], "/100")

# 14. ISOLATION MULTI-TENANT
r = c.post(f"{P}/auth/register", json={"email": "autre@agence.bj", "password": "Autre2026",
                                       "full_name": "Autre Agence", "role": "AGENCY",
                                       "agency_name": "Littoral Immo"}); ok(r, 201)
r = c.post(f"{P}/auth/login", json={"email": "autre@agence.bj", "password": "Autre2026"}); ok(r)
other_tk = r.json()["access_token"]
r = c.get(f"{P}/properties/{prop_id}", headers=h(other_tk))
assert r.status_code in (403, 404), r.status_code
print("14. Isolation multi-tenant OK — autre agence bloquée:", r.status_code)

r = c.get(f"{P}/agencies", headers=h(agency_tk))
assert r.status_code == 403, r.status_code
print("    RBAC OK — agence ne peut pas lister toutes les agences:", r.status_code)

r = c.get(f"{P}/owners", headers=h(client_tk)); ok(r)
assert r.json()["total"] == 0
print("    Périmètre client OK — 0 propriétaire visible")

r = c.get(f"{P}/properties", headers=h(owner_tk)); ok(r)
print("    Périmètre propriétaire OK —", r.json()["total"], "bien(s) visible(s)")

# 15. Audit
r = c.get(f"{P}/admin/audit-logs", headers=h(agency_tk)); ok(r)
print("15. Journal d'audit OK —", r.json()["total"], "entrées")

# 16. Refresh + logout
r = c.post(f"{P}/auth/login", json={"email": "client@mail.bj", "password": "Client2026"}); ok(r)
rt = r.json()["refresh_token"]
r = c.post(f"{P}/auth/refresh", json={"refresh_token": rt}); ok(r)
print("16. Rotation refresh token OK")
r = c.post(f"{P}/auth/refresh", json={"refresh_token": rt})
assert r.status_code == 401, r.status_code
print("    Réutilisation de l'ancien token bloquée:", r.status_code)

_cm.__exit__(None, None, None)
print("\n===== TOUS LES TESTS BOUT-EN-BOUT SONT PASSÉS =====")
