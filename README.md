# ImmoFlow AI API

Backend de la plateforme **ImmoFlow AI** — gestion immobilière multi-agences avec RBAC strict,
messagerie temps réel et assistance IA.

> **Périmètre V1** — Aucun module de paiement, abonnement, facturation ou plan premium.

---

## Sommaire

1. [Aperçu](#aperçu)
2. [Stack technique](#stack-technique)
3. [Démarrage rapide](#démarrage-rapide)
4. [Installation locale](#installation-locale)
5. [Variables d'environnement](#variables-denvironnement)
6. [Architecture](#architecture)
7. [Modèle de sécurité](#modèle-de-sécurité)
8. [Modules métier](#modules-métier)
9. [Documentation API](#documentation-api)
10. [WebSocket](#websocket)
11. [Base de données et migrations](#base-de-données-et-migrations)
12. [Tests](#tests)
13. [Déploiement Docker](#déploiement-docker)
14. [Checklist production](#checklist-production)

---

## Peupler la base

```bash
cd backend
PYTHONPATH=. python scripts/seed_data.py                 # 30 biens, 4 agences, 41 comptes
PYTHONPATH=. python scripts/seed_data.py --properties 200 --reset
```

Le script crée un jeu de données cohérent et vérifié : chaque bien appartient à un
propriétaire de la même agence, chaque bien publié a une photo, un bien vendu quitte le
catalogue. Voir [`docs/DONNEES-DEMO.md`](docs/DONNEES-DEMO.md).

## Aperçu

ImmoFlow AI couvre le cycle immobilier complet pour un réseau d'agences : publication de biens,
gestion des propriétaires et des clients, visites, ventes, locations, documents, messagerie
et assistance IA.

**Cinq rôles**, chacun avec un périmètre de données strictement délimité :

| Rôle | Périmètre |
|---|---|
| `SUPER_ADMIN` | Toute la plateforme |
| `AGENCY` | Uniquement les données de son agence |
| `AGENT` | Uniquement ce qui lui est attribué (biens, clients, propriétaires, visites, transactions) |
| `OWNER` | Uniquement ses biens et les interactions associées |
| `CLIENT` | Uniquement ses propres interactions + le catalogue publié |

L'isolation multi-tenant n'est pas une simple vérification en début de handler : **chaque
repository applique le périmètre directement dans la requête SQL** (`scoped_query`), de sorte
qu'un oubli côté service ne peut pas exposer les données d'un autre tenant.

---

## Stack technique

| Composant | Choix |
|---|---|
| Langage | Python 3.12+ |
| Framework | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 (async, `Mapped[]`) |
| Base | PostgreSQL 16 (asyncpg) |
| Migrations | Alembic |
| Validation | Pydantic v2 + pydantic-settings |
| Auth | JWT (PyJWT) — access + refresh avec rotation |
| Mots de passe | bcrypt |
| Cache / Temps réel | Redis (Pub/Sub, rate limiting) |
| Temps réel | WebSocket natif FastAPI |
| Tâches | Celery (optionnel) |
| Conteneurs | Docker + Docker Compose |
| Tests | pytest + pytest-asyncio + httpx |

---

## Démarrage rapide

```bash
git clone <repo> && cd immoflow-ai-api
cp backend/.env.example backend/.env
# Générez une clé : openssl rand -hex 32  → renseignez SECRET_KEY
docker compose up --build
```

| Ressource | URL |
|---|---|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| Santé | http://localhost:8000/health |

Compte initial (modifiable via `.env`) : `admin@immoflow.ai` / `ChangeMe123!`
**Changez ce mot de passe avant toute mise en ligne.**

---

## Installation locale

Prérequis : Python 3.12+, PostgreSQL 16, Redis 7.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows : .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env                                    # puis ajustez les valeurs

createdb immoflow                                       # ou via psql
alembic upgrade head                                    # crée les 25 tables + 18 types énumérés
python -m app.database.init_db                          # Super Admin + types de biens

uvicorn app.main:app --reload
```

L'API démarre en mode **dégradé mais fonctionnel** si Redis est absent : le rate limiting
et la diffusion inter-workers sont désactivés, le reste continue de fonctionner.

---

## Variables d'environnement

Toutes les variables sont documentées dans [`backend/.env.example`](backend/.env.example).
Les plus structurantes :

| Variable | Défaut | Rôle |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` / `staging` / `production` / `test` |
| `SECRET_KEY` | — | **Obligatoire en production.** `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Durée de vie de l'access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Durée de vie du refresh token |
| `POSTGRES_*` | — | Connexion base de données |
| `REDIS_*` | — | Cache, Pub/Sub, rate limiting |
| `STORAGE_BACKEND` | `local` | `local` (disque) ou `s3` |
| `MAX_UPLOAD_SIZE_MB` | `25` | Taille maximale des fichiers |
| `AI_PROVIDER` | `none` | `none` / `openai` / `groq` / `anthropic` |
| `AI_API_KEY` | — | Clé du fournisseur LLM |
| `RATE_LIMIT_PER_MINUTE` | `120` | Quota global par identité |
| `SMTP_*` | — | Envoi d'emails (désactivé → journalisé) |

---

## Architecture

Architecture en couches, chacune avec une responsabilité unique :

```
Requête HTTP
   ↓
Middlewares        → identifiant de requête, chronométrage, en-têtes de sécurité, rate limiting
   ↓
API (routers)      → validation d'entrée/sortie, injection de dépendances, codes HTTP
   ↓
Dépendances        → authentification JWT → SecurityContext + Scope (périmètre RBAC)
   ↓
Services           → règles métier, transitions d'état, notifications, audit
   ↓
Repositories       → requêtes SQL avec application du périmètre (scoped_query)
   ↓
Modèles            → SQLAlchemy 2 (typage Mapped[])
   ↓
PostgreSQL
```

```
backend/
├── app/
│   ├── main.py                  # application FastAPI, middlewares, cycle de vie
│   ├── core/
│   │   ├── config.py            # settings Pydantic
│   │   ├── security.py          # bcrypt, JWT, jetons opaques
│   │   ├── permissions.py       # SecurityContext + matrice RBAC
│   │   ├── exceptions.py        # exceptions métier + handlers globaux
│   │   ├── redis_client.py      # pool Redis partagé
│   │   └── logging_config.py    # logs JSON en production
│   ├── database/
│   │   ├── base.py              # Base déclarative + mixins
│   │   ├── session.py           # moteur async, sessions, sondes
│   │   ├── init_db.py           # données de référence
│   │   └── migrations/          # Alembic
│   ├── models/                  # 25 tables SQLAlchemy
│   ├── schemas/                 # contrats Pydantic v2
│   ├── repositories/            # accès données + isolation SQL
│   ├── services/                # logique métier
│   ├── api/
│   │   ├── deps.py              # dépendances (session, auth, RBAC, scope)
│   │   ├── router.py            # agrégation des routers
│   │   └── v1/                  # 15 routers thématiques
│   ├── websocket/               # gestionnaire de connexions + pont Redis Pub/Sub
│   ├── middleware/              # contexte de requête, rate limiting
│   ├── worker/                  # tâches Celery (optionnel)
│   └── utils/                   # pagination, slugs, fichiers
├── tests/
├── docker/
├── alembic.ini
├── requirements.txt
└── .env.example
```

**Principes appliqués**

- *Dependency injection* : aucune dépendance instanciée globalement dans les handlers ;
  la session, l'utilisateur et le périmètre arrivent par `Depends`.
- *Séparation stricte* : un router ne contient jamais de SQL, un repository ne contient
  jamais de règle métier.
- *Transactions explicites* : les services utilisent `flush()`, seul le router décide du
  `commit()` — une requête = une transaction.
- *Défense en profondeur* : RBAC en dépendance, puis en service, puis en SQL.

---

## Modèle de sécurité

**Authentification**

- Mots de passe hachés avec bcrypt (12 tours par défaut).
- Access token JWT courte durée + refresh token long avec **rotation** : chaque usage
  révoque le précédent. Une réutilisation détectée révoque **toutes** les sessions
  de l'utilisateur (protection contre le vol de jeton).
- Refresh tokens et jetons de réinitialisation stockés **hachés (SHA-256)** en base.
- Comparaison à coût constant à la connexion pour éviter l'énumération de comptes.
- `/auth/forgot-password` répond identiquement que le compte existe ou non.

**Autorisation**

- Matrice de permissions par rôle (`core/permissions.py`), granularité `ressource:action`.
- `SecurityContext` transporte l'identité et le périmètre (agence, agent, propriétaire, client).
- Chaque repository expose `scoped_query(ctx)` qui traduit le périmètre en clauses `WHERE`.
- Les rôles `SUPER_ADMIN` et `AGENT` ne peuvent pas être obtenus par inscription publique.

**Autres protections**

- Rate limiting Redis avec quotas renforcés sur `/auth/*` (fail-open si Redis tombe).
- En-têtes de sécurité (`X-Content-Type-Options`, `X-Frame-Options`, HSTS en production).
- Validation stricte des uploads (type MIME sur liste blanche, taille, nom assaini).
- Protection contre la traversée de chemin dans le stockage local.
- Fichiers servis via l'API avec contrôle d'accès, jamais en accès direct.
- Journal d'audit sur toutes les actions sensibles (qui, quoi, quand, depuis quelle IP).

---

## Modules métier

### 1. Authentification (`/auth`)
Inscription, connexion, refresh, déconnexion (session courante ou tous les appareils),
mot de passe oublié/réinitialisation/changement, acceptation d'invitation, profil, avatar,
liste des sessions actives.

### 2. Agences (`/agencies`)
Création, **validation par le Super Admin**, activation, suspension, informations,
documents légaux, tableau de bord statistique.
Cycle : `PENDING_VALIDATION → ACTIVE ⇄ SUSPENDED` (ou `REJECTED`).

### 3. Agents (`/agents`)
Création avec **invitation par email**, activation du compte via jeton, rattachement à
l'agence, permissions fines (`can_manage_owners`, `can_publish_properties`),
suspension, suppression.

### 4. Propriétaires (`/owners`) — deux workflows

*Workflow 1 — invitation par l'agent*
```
Agent crée (nom, téléphone, email) → invitation envoyée
   → le propriétaire complète son profil et dépose sa CIP
   → l'agence vérifie les documents → ACTIVE
```

*Workflow 2 — inscription autonome*
```
Le propriétaire s'inscrit auprès d'une agence active
   → PENDING_VERIFICATION → l'agence valide → ACTIVE
```

Statuts : `INVITED`, `PENDING_VERIFICATION`, `ACTIVE`, `REJECTED`, `SUSPENDED`.
**Règle bloquante** : la validation est refusée tant qu'aucune pièce d'identité
(catégorie `IDENTITY_CIP`) n'a été déposée.

### 5. Biens immobiliers (`/properties`, `/public/properties`)
CRUD complet, médias (URL ou téléversement), géolocalisation, recherche multicritères
(prix, surface, chambres, ville, quartier, rayon géographique), tri, pagination,
catalogue public sans authentification.

Statuts et transitions contrôlées :
```
DRAFT → AVAILABLE → RESERVED → SOLD | RENTED → ARCHIVED
```
Une transition interdite renvoie `409 business_rule_violation`.
La publication exige : titre, prix, ville, description ≥ 40 caractères, ≥ 1 photo.

### 6. CRM Clients (`/clients`)
Fiche client, **rattachement à un agent après interaction** (`ClientAgent`, avec agent
principal), favoris, historique de recherche, demandes, notes et budget.

### 7. Visites (`/visits`)
Demande (client ou agent), validation, refus motivé, reprogrammation, modification,
annulation, clôture avec note et retour. Notification automatique du client,
de l'agent et du propriétaire à chaque changement.

### 8. Transactions (`/sales`, `/rentals`, `/contracts`)
**Vente** : bien + client + agent + propriétaire, montant, taux et calcul automatique
de commission. La finalisation bascule le bien en `SOLD` et le dépublie.
**Location** : loyer, charges, caution, dates, durée. L'activation bascule le bien en
`RENTED` ; la résiliation le remet en `AVAILABLE`.
**Contrats** : acte de vente, bail, mandat — liés à un document signé.

### 9. Documents (`/documents`)
Téléversement contrôlé (liste blanche MIME, 25 Mo), rattachement polymorphe
(propriétaire, agence, bien, contrat, utilisateur), catégories (CIP, contrat, mandat,
titre de propriété, document légal), workflow de vérification, téléchargement authentifié
avec journalisation.

### 10. Messagerie temps réel (`/conversations`, `/ws`)
Conversations `CLIENT ↔ AGENT`, `PROPRIÉTAIRE ↔ AGENT`, `AGENT ↔ AGENCE`.
Messages texte, images, documents, vidéos. Historique paginé par curseur temporel,
accusés de lecture, compteur de non-lus, indicateur de saisie.
Diffusion multi-workers via **Redis Pub/Sub**.

### 11. Notifications (`/notifications`)
Invitation, validation de compte, nouveau message, visite, transaction, document.
Triple canal : in-app (persisté), WebSocket (temps réel), email (optionnel).

### 12. IA immobilière (`/ai`)

| Endpoint | Fonction |
|---|---|
| `POST /ai/description` | Rédige une annonce professionnelle à partir des caractéristiques |
| `POST /ai/estimate` | Estime un prix : valeur conseillée, fourchette, confiance, explication |
| `POST /ai/assistant` | Recherche en langage naturel + conseil |
| `POST /ai/analyze-listing` | Score qualité, champs manquants, suggestions |

Fournisseurs branchables : OpenAI, Groq, Anthropic (`AI_PROVIDER` + `AI_API_KEY`).

**Sans clé LLM, les quatre fonctions restent opérationnelles** grâce à des replis
déterministes : génération par gabarits, estimation par médiane des biens comparables de
l'agence (repli sur un barème régional au m²), analyse de requête par expressions
régulières, audit d'annonce par règles. L'IA enrichit le résultat, elle n'en est pas
la condition.

Exemple : `"Maison 4 chambres proche centre budget 60 millions"` →
`{bedrooms: 4, city: "Cotonou", max_price: 60000000}` + biens correspondants.

---

## Documentation API

Swagger interactif : **http://localhost:8000/docs** — 85 endpoints regroupés par module.

**Séquence d'authentification**

```bash
# 1. Connexion
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@immoflow.ai","password":"ChangeMe123!"}'

# 2. Utilisation
curl http://localhost:8000/api/v1/properties \
  -H "Authorization: Bearer <access_token>"

# 3. Renouvellement
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

**Format de réponse paginée**
```json
{ "items": [...], "total": 42, "page": 1, "size": 20, "pages": 3 }
```

**Format d'erreur**
```json
{ "error": { "code": "business_rule_violation",
             "message": "Transition de statut interdite : DRAFT → SOLD.",
             "request_id": "a1b2c3…" } }
```

Une **collection Postman** prête à l'emploi est fournie dans
[`postman/`](postman/) (gestion automatique des jetons).

---

## WebSocket

```
ws://localhost:8000/ws?token=<access_token>
```

| Sens | Événements |
|---|---|
| Entrants | `message.send`, `message.read`, `typing`, `ping` |
| Sortants | `connected`, `message.new`, `message.read`, `typing`, `notification.new`, `pong`, `error` |

```javascript
const ws = new WebSocket(`ws://localhost:8000/ws?token=${accessToken}`);

ws.onmessage = ({ data }) => {
  const { event, conversation_id, data: payload } = JSON.parse(data);
  if (event === "message.new") appendMessage(conversation_id, payload);
  if (event === "notification.new") showToast(payload.title);
};

ws.send(JSON.stringify({
  event: "message.send",
  conversation_id: conversationId,
  data: { type: "TEXT", content: "Bonjour" },
}));
```

Chaque message envoyé est persisté, diffusé aux participants connectés (via Redis Pub/Sub,
donc à travers tous les workers) et génère une notification pour les absents.

---

## Base de données et migrations

25 tables, 18 types énumérés PostgreSQL natifs.

**Cœur** : `users`, `agencies`, `agents`, `owners`, `clients`, `properties`
**Rattachements** : `client_agents`, `client_favorites`, `client_search_history`, `client_requests`, `owner_invitations`
**Activité** : `visits`, `sales`, `rentals`, `contracts`, `documents`
**Communication** : `conversations`, `conversation_participants`, `messages`, `notifications`
**Technique** : `property_types`, `property_images`, `audit_logs`, `refresh_tokens`, `password_reset_tokens`

```bash
alembic upgrade head                          # applique les migrations
alembic revision --autogenerate -m "message"  # crée une migration
alembic downgrade -1                          # revient d'un cran
alembic history                               # historique
```

Index composites sur les colonnes réellement filtrées : `(agency_id, status)` pour les biens,
`(agency_id, scheduled_at)` et `(agent_id, status)` pour les visites,
`(conversation_id, created_at)` pour les messages, `(user_id, is_read)` pour les notifications.

---

## Tests

```bash
cd backend
createdb immoflow_test
POSTGRES_DB=immoflow_test pytest -v
```

La suite couvre l'authentification (rotation des jetons, rejet des mots de passe faibles,
blocage de l'escalade de privilèges), le RBAC et l'**isolation multi-tenant**, le cycle de
vie des biens et de la publication, les deux workflows propriétaire, les visites, les
transactions, la messagerie et les quatre fonctions IA en mode repli.

---

## Déploiement Docker

```bash
docker compose up --build -d     # API + PostgreSQL + Redis
docker compose logs -f api
docker compose --profile workers up -d   # ajoute le worker Celery
docker compose down -v           # arrêt + suppression des volumes
```

L'entrypoint attend PostgreSQL, applique les migrations, initialise les données de
référence puis démarre Uvicorn (4 workers, `--proxy-headers`).

L'image de production est **multi-stage**, tourne sous un **utilisateur non-root**
et expose un `HEALTHCHECK`.

Derrière un reverse proxy (Nginx, Traefik), pensez à transmettre `Upgrade` et `Connection`
pour le WebSocket sur `/ws`.

---

## Checklist production

- [ ] `SECRET_KEY` généré aléatoirement (`openssl rand -hex 32`) et stocké dans un coffre
- [ ] `ENVIRONMENT=production`, `DEBUG=false`
- [ ] Mot de passe du Super Admin changé après le premier démarrage
- [ ] `BACKEND_CORS_ORIGINS` et `ALLOWED_HOSTS` restreints aux domaines réels
- [ ] HTTPS terminé au niveau du reverse proxy (HSTS activé automatiquement)
- [ ] PostgreSQL et Redis non exposés publiquement, mot de passe Redis défini
- [ ] Sauvegardes automatiques de la base + test de restauration
- [ ] `STORAGE_BACKEND=s3` (ou volume persistant sauvegardé) pour les documents
- [ ] SMTP configuré (`SMTP_ENABLED=true`)
- [ ] Journaux JSON collectés vers un agrégateur, `request_id` conservé
- [ ] Sondes `/health/live` et `/health/ready` branchées sur l'orchestrateur
- [ ] Purge planifiée des jetons expirés (tâche Celery `tokens.purge_expired`)

---

## Licence

Propriétaire — ImmoFlow AI.
