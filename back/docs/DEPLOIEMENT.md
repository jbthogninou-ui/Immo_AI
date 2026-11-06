# Déploiement — ImmoFlow AI

Ce document couvre les deux situations : faire tourner la plateforme sur un poste de
travail, et la mettre en ligne sur un serveur accessible depuis Internet.

Il s'applique aux deux archives :

| Archive | Contenu |
|---|---|
| `immoflow-ai-api.zip` | API FastAPI, base de données, script de peuplement |
| `immoflow-ai-frontend.zip` | Interface React |

Les deux se décompressent directement dans le dossier courant, sans sous-dossier
intermédiaire.

---

## Partie 1 — Installation locale

### 1.1 Ce qu'il vous faut

| Outil | Version | Vérifier |
|---|---|---|
| Docker + Docker Compose | 24+ | `docker --version` |
| Node.js | 18 minimum, 20 ou 22 recommandé | `node -v` |
| npm | 9+ | `npm -v` |

Docker suffit pour le backend. Sans Docker, il vous faudra en plus Python 3.12 et
PostgreSQL 16 (voir 1.5).

### 1.2 Backend

```bash
mkdir immoflow-api && cd immoflow-api
unzip ../immoflow-ai-api.zip

cp backend/.env.example backend/.env
```

Ouvrez `backend/.env` et renseignez au minimum la clé de signature :

```bash
# Génère une clé aléatoire
openssl rand -hex 32
```

```env
SECRET_KEY=<la valeur générée>
FRONTEND_BASE_URL=http://localhost:5173
```

> **`FRONTEND_BASE_URL` est le réglage le plus souvent oublié.** C'est l'adresse
> utilisée pour construire les liens d'invitation et de réinitialisation de mot de
> passe. Si elle pointe vers un port où rien n'écoute, les liens envoyés aboutissent
> sur une page introuvable. Elle doit correspondre à l'adresse où le frontend est
> réellement servi : `http://localhost:5173` en développement.

Démarrez :

```bash
docker compose up -d
docker compose logs -f api
```

Vérifiez :

```bash
curl http://localhost:8000/health
# {"status":"healthy","database":"up","redis":"up","version":"1.0.0"}
```

La documentation interactive est sur http://localhost:8000/docs

**Le compte administrateur est créé automatiquement au démarrage** à partir de
`FIRST_SUPERADMIN_EMAIL` et `FIRST_SUPERADMIN_PASSWORD`. Par défaut :

| Identifiant | Mot de passe |
|---|---|
| `admin@immoflow.ai` | `ChangeMe123!` |

Changez ce mot de passe dès la première connexion.

### 1.3 Remplir la base

Une base vide donne une interface vide. Peuplez-la :

```bash
docker compose exec api python scripts/seed_data.py
```

Vous obtenez 4 agences, 41 comptes, 30 biens photographiés, 45 visites, des
transactions, des documents, des conversations et un journal d'audit — avec un compte
par rôle, mot de passe `Demo2026!`.

Pour un volume plus important :

```bash
docker compose exec api python scripts/seed_data.py --reset --properties 200 --clients 40
```

### 1.4 Frontend

```bash
mkdir immoflow-front && cd immoflow-front
unzip ../immoflow-ai-frontend.zip

npm install
npm run dev
```

L'interface est sur http://localhost:5173

Le fichier `.env` est fourni et déjà configuré : les appels `/api/*` sont relayés vers
`http://localhost:8000` par le proxy de développement, sans configuration CORS.

### 1.5 Sans Docker

<details>
<summary>Installation manuelle du backend</summary>

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# PostgreSQL doit tourner et la base exister
createdb immoflow

cp .env.example .env      # renseignez SECRET_KEY et POSTGRES_*
alembic upgrade head
PYTHONPATH=. python scripts/seed_data.py

uvicorn app.main:app --reload --port 8000
```

Redis est optionnel : sans lui, la messagerie fonctionne en REST, sans diffusion
instantanée. L'API le signale au démarrage et continue de fonctionner.

</details>

### 1.6 Vérifier que tout est branché

```bash
# 1. L'API répond
curl http://localhost:8000/health

# 2. La connexion fonctionne à travers le proxy du frontend
curl -X POST http://localhost:5173/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@immoflow.ai","password":"ChangeMe123!"}'

# 3. Le catalogue public renvoie des biens
curl "http://localhost:5173/api/v1/public/properties?size=3"
```

Si les trois répondent, l'installation est correcte.

---

## Partie 2 — Mise en ligne

### 2.1 Architecture cible

```
                    ┌──────────────────────────┐
  Internet ────────▶│  Nginx (443, TLS)        │
                    │  app.domaine.com  ──────▶ fichiers statiques (dist/)
                    │  api.domaine.com  ──────▶ 127.0.0.1:8000
                    └──────────────────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │  Docker Compose          │
                    │  api · postgres · redis  │
                    └──────────────────────────┘
```

Deux sous-domaines, un seul serveur. Le frontend est un site statique : il n'a besoin
d'aucun runtime.

### 2.2 Serveur

| Ressource | Minimum | Confortable |
|---|---|---|
| vCPU | 2 | 4 |
| RAM | 2 Go | 4 Go |
| Disque | 20 Go | 50 Go (documents déposés) |
| OS | Ubuntu 22.04 / Debian 12 | idem |

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo ufw allow 22,80,443/tcp && sudo ufw enable
```

### 2.3 Backend en production

```bash
sudo mkdir -p /opt/immoflow/api && cd /opt/immoflow/api
sudo unzip ~/immoflow-ai-api.zip
sudo cp backend/.env.example backend/.env
sudo chmod 600 backend/.env
```

`backend/.env` :

```env
ENVIRONMENT=production
DEBUG=false

SECRET_KEY=<openssl rand -hex 32>

POSTGRES_HOST=db
POSTGRES_USER=immoflow
POSTGRES_PASSWORD=<mot de passe fort>
POSTGRES_DB=immoflow

REDIS_HOST=redis
REDIS_PASSWORD=<mot de passe fort>

# Restreindre aux domaines réels
BACKEND_CORS_ORIGINS=["https://app.votre-domaine.com"]
ALLOWED_HOSTS=["api.votre-domaine.com"]

PUBLIC_BASE_URL=https://api.votre-domaine.com
FRONTEND_BASE_URL=https://app.votre-domaine.com

FIRST_SUPERADMIN_EMAIL=admin@votre-domaine.com
FIRST_SUPERADMIN_PASSWORD=<mot de passe fort et temporaire>

# Envoi des invitations et réinitialisations
SMTP_ENABLED=true
SMTP_HOST=smtp.votre-fournisseur.com
SMTP_PORT=587
SMTP_USER=<identifiant>
SMTP_PASSWORD=<mot de passe>
EMAIL_FROM=no-reply@votre-domaine.com

# Assistance IA — facultatif, voir 2.8
AI_PROVIDER=none
```

Ne publiez pas les ports de PostgreSQL et Redis. Commentez leurs sections `ports` dans
`docker-compose.yml` : les services communiquent par le réseau interne Docker.

```bash
sudo docker compose up -d --build
sudo docker compose logs -f api
```

### 2.4 Frontend en production

Compilez sur votre machine ou sur le serveur :

```bash
mkdir /tmp/front && cd /tmp/front
unzip ~/immoflow-ai-frontend.zip
```

`.env` :

```env
VITE_API_URL=https://api.votre-domaine.com/api/v1
VITE_WS_URL=wss://api.votre-domaine.com/ws
VITE_DEMO_MODE=false
VITE_APP_NAME=ImmoFlow AI
```

```bash
npm ci
npm run build
sudo mkdir -p /var/www/immoflow
sudo cp -r dist/* /var/www/immoflow/
```

> Les variables `VITE_*` sont lues **à la compilation**. Modifier `.env` après le build
> n'a aucun effet : il faut recompiler.

### 2.5 Nginx

`/etc/nginx/sites-available/immoflow` :

```nginx
# ---------------------------- Frontend ----------------------------
server {
    listen 443 ssl http2;
    server_name app.votre-domaine.com;

    ssl_certificate     /etc/letsencrypt/live/app.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.votre-domaine.com/privkey.pem;

    root /var/www/immoflow;
    index index.html;

    # Routage par historique : toute route inconnue renvoie index.html,
    # sinon un rafraîchissement sur /agence/biens donnerait une 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# ------------------------------ API -------------------------------
upstream immoflow_api {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.votre-domaine.com;

    ssl_certificate     /etc/letsencrypt/live/api.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.votre-domaine.com/privkey.pem;

    client_max_body_size 30M;    # cohérent avec MAX_UPLOAD_SIZE_MB

    location / {
        proxy_pass http://immoflow_api;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Messagerie temps réel : sans ces deux en-têtes, le WebSocket échoue
    # silencieusement et la messagerie retombe en REST seul.
    location /ws {
        proxy_pass http://immoflow_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# ------------------------ Redirection HTTP ------------------------
server {
    listen 80;
    server_name app.votre-domaine.com api.votre-domaine.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/immoflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2.6 Certificats TLS

```bash
sudo certbot --nginx -d app.votre-domaine.com -d api.votre-domaine.com
sudo systemctl enable --now certbot.timer
```

En production, l'API ajoute automatiquement l'en-tête
`Strict-Transport-Security: max-age=31536000; includeSubDomains`.

### 2.7 Première connexion

```bash
curl https://api.votre-domaine.com/health
```

Ouvrez `https://app.votre-domaine.com/connexion`, connectez-vous avec le compte
administrateur, **changez immédiatement son mot de passe** depuis Paramètres → Sécurité.

### 2.8 Assistance IA

Les quatre fonctions d'assistance (recherche en langage courant, estimation, rédaction
d'annonce, contrôle qualité) fonctionnent **sans aucune clé** : elles s'appuient sur les
biens réellement enregistrés et sur une rédaction locale.

Pour les enrichir avec un modèle de langage :

```env
AI_PROVIDER=openai        # ou groq, anthropic
AI_API_KEY=<votre clé>
AI_MODEL=gpt-4o-mini
```

Si l'appel échoue (réseau, quota, réponse invalide), l'API bascule silencieusement sur
le mode local. Aucune fonctionnalité ne devient indisponible à cause d'un service tiers.

---

## Partie 3 — Exploitation

### 3.1 Sauvegardes

```bash
sudo tee /opt/immoflow/backup.sh > /dev/null <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
DIR=/var/backups/immoflow
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$DIR"

docker compose -f /opt/immoflow/api/docker-compose.yml exec -T db \
  pg_dump -U immoflow immoflow | gzip > "$DIR/db_$STAMP.sql.gz"

docker run --rm -v api_uploads_data:/data -v "$DIR":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tar.gz" -C /data .

find "$DIR" -name "*.gz" -mtime +30 -delete
SCRIPT
sudo chmod +x /opt/immoflow/backup.sh
echo "0 2 * * * /opt/immoflow/backup.sh >> /var/log/immoflow-backup.log 2>&1" | sudo crontab -
```

Restauration :

```bash
gunzip -c db_20260803_020000.sql.gz | \
  docker compose exec -T db psql -U immoflow -d immoflow
```

> Testez la restauration au moins une fois par trimestre. Une sauvegarde jamais
> restaurée n'est pas une sauvegarde.

### 3.2 Mise à jour

```bash
cd /opt/immoflow/api
docker compose exec -T db pg_dump -U immoflow immoflow | gzip > /var/backups/immoflow/pre_update.sql.gz
sudo unzip -o ~/immoflow-ai-api.zip
sudo docker compose up -d --build      # les migrations s'appliquent au démarrage
curl https://api.votre-domaine.com/health
```

Frontend :

```bash
cd /tmp/front && unzip -o ~/immoflow-ai-frontend.zip
npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/immoflow/
```

### 3.3 Supervision

| Sonde | Usage |
|---|---|
| `GET /health/live` | Vivacité — redémarrer le conteneur si échec |
| `GET /health/ready` | Disponibilité — retirer du pool si la base est injoignable |
| `GET /health` | Diagnostic complet |

En production, les journaux sortent en JSON sur la sortie standard, avec un
`request_id` renvoyé au client dans l'en-tête `X-Request-ID`. Un utilisateur qui
signale une erreur peut donner cet identifiant : vous retrouvez la trace exacte.

```bash
docker compose logs -f api | grep '"level": "ERROR"'
```

### 3.4 Montée en charge

L'API est sans état : les sessions vivent dans les JWT, la diffusion temps réel passe
par Redis. Plusieurs instances peuvent tourner derrière un répartiteur sans affinité de
session.

Trois points d'attention en multi-instances :

- une seule instance doit appliquer les migrations ;
- le stockage des documents doit être partagé (objet plutôt que volume local) ;
- Redis devient une dépendance critique et non plus optionnelle.

---

## Partie 4 — Résolution des incidents courants

**Le lien d'invitation aboutit sur une page introuvable**
`FRONTEND_BASE_URL` ne correspond pas à l'adresse où le frontend est servi. Corrigez-la
et redémarrez l'API. L'interface répare aussi ce cas d'elle-même : elle réécrit l'hôte
du lien sur son origine réelle avant de l'afficher.

**Aucun email n'est reçu**
Vérifiez `SMTP_ENABLED=true` et les identifiants. Sans SMTP, l'interface affiche le lien
d'invitation directement dans une fenêtre, avec un bouton pour le copier ou l'ouvrir
dans votre messagerie — le parcours reste praticable.

**« L'API est injoignable » sur chaque écran**
Le backend n'est pas démarré ou `VITE_API_URL` est incorrecte. Testez
`curl https://api.votre-domaine.com/health`.

**Écran blanc après le build**
Nginx ne renvoie pas `index.html` sur les routes internes. Vérifiez la directive
`try_files`.

**La messagerie ne se met pas à jour instantanément**
Le WebSocket ne passe pas le proxy. Vérifiez le bloc `location /ws` et la présence des
en-têtes `Upgrade` et `Connection`.

**Aucun compte administrateur**
Il est créé au démarrage de l'API. Consultez les journaux : `docker compose logs api |
grep "Super Admin"`. En cas de besoin :
`docker compose exec api python -m app.database.init_db`.

**Le catalogue est vide**
Comportement normal sur une base neuve. Lancez le script de peuplement, ou créez une
agence puis des biens depuis l'interface.

---

## Checklist avant ouverture au public

- [ ] `SECRET_KEY` aléatoire, unique, hors du dépôt
- [ ] `ENVIRONMENT=production`, `DEBUG=false`
- [ ] Mot de passe du Super Admin changé
- [ ] `BACKEND_CORS_ORIGINS` et `ALLOWED_HOSTS` restreints aux domaines réels
- [ ] `FRONTEND_BASE_URL` pointant vers l'adresse publique du frontend
- [ ] HTTPS actif, renouvellement automatique vérifié
- [ ] Ports PostgreSQL et Redis non publiés, mot de passe Redis défini
- [ ] `client_max_body_size` cohérent avec `MAX_UPLOAD_SIZE_MB`
- [ ] WebSocket testé à travers le proxy
- [ ] SMTP testé (invitation et réinitialisation)
- [ ] Sauvegardes automatisées **et restauration testée**
- [ ] Sondes `/health/live` et `/health/ready` branchées
- [ ] Pare-feu configuré, accès SSH par clé uniquement
