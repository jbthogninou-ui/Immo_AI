# Guide d'installation — ImmoFlow AI API

## Option 1 — Docker (recommandé)

**Prérequis** : Docker 24+, Docker Compose v2.

```bash
git clone <repo> && cd immoflow-ai-api
cp backend/.env.example backend/.env
```

Éditez `backend/.env` et renseignez au minimum :

```env
SECRET_KEY=<sortie de: openssl rand -hex 32>
FIRST_SUPERADMIN_EMAIL=votre.admin@domaine.com
FIRST_SUPERADMIN_PASSWORD=<mot de passe fort>
```

```bash
docker compose up --build
```

L'entrypoint attend PostgreSQL, applique les migrations, crée le Super Admin et les
types de biens, puis démarre l'API sur http://localhost:8000/docs.

Commandes utiles :

```bash
docker compose logs -f api           # journaux
docker compose exec api bash         # shell dans le conteneur
docker compose exec db psql -U immoflow -d immoflow
docker compose down                  # arrêt
docker compose down -v               # arrêt + purge des volumes
```

---

## Option 2 — Installation locale

**Prérequis** : Python 3.12+, PostgreSQL 16+, Redis 7+ (facultatif).

### 1. Environnement Python

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Base de données

```bash
sudo -u postgres psql -c "CREATE USER immoflow WITH PASSWORD 'immoflow';"
sudo -u postgres psql -c "CREATE DATABASE immoflow OWNER immoflow;"
```

### 3. Configuration

```bash
cp .env.example .env
```

Vérifiez `POSTGRES_*`, `REDIS_*` et générez `SECRET_KEY`.

### 4. Migrations et données de référence

```bash
alembic upgrade head
python -m app.database.init_db
```

### 5. Démarrage

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Vérification de l'installation

```bash
curl http://localhost:8000/health
# {"status":"healthy","database":"up","redis":"up","version":"1.0.0"}

curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@immoflow.ai","password":"ChangeMe123!"}'
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Base de données indisponible` au démarrage | PostgreSQL arrêté ou identifiants erronés | `pg_isready`, vérifiez `POSTGRES_*` dans `.env` |
| `Redis indisponible` | Redis absent | Sans effet bloquant : quotas et diffusion multi-workers désactivés |
| `alembic: command not found` | Environnement virtuel non activé | `source .venv/bin/activate` |
| 401 sur toutes les routes | Jeton expiré | `POST /api/v1/auth/refresh` |
| 403 `permission_denied` | Rôle insuffisant ou ressource hors périmètre | Vérifiez le rôle via `GET /api/v1/auth/me` |
| 409 sur la publication d'un bien | Éléments obligatoires manquants | Le champ `details.missing` liste ce qui manque |
| WebSocket fermé immédiatement | Jeton absent ou invalide | `ws://…/ws?token=<access_token>` |
| Erreur de migration `type already exists` | Base partiellement migrée | `alembic downgrade base` puis `alembic upgrade head` |

---

## Mise à jour

```bash
git pull
pip install -r backend/requirements.txt   # nouvelles dépendances
cd backend && alembic upgrade head        # nouvelles migrations
```

En Docker : `docker compose up --build -d` (les migrations sont appliquées automatiquement).
