"""Point d'entrée de l'application ImmoFlow AI API."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import setup_logging
from app.core.redis_client import close_redis, ping_redis
from app.database.session import check_database, dispose_engine
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.websocket import pubsub
from app.websocket.routes import router as websocket_router

setup_logging()
logger = logging.getLogger(__name__)

DESCRIPTION = """
API de la plateforme **ImmoFlow AI** — gestion immobilière multi-agences.

### Architecture
Multi-tenant strict avec RBAC : `SUPER_ADMIN`, `AGENCY`, `AGENT`, `OWNER`, `CLIENT`.
Chaque requête est filtrée au niveau SQL selon le périmètre du demandeur.

### Modules
Authentification · Agences · Agents · Propriétaires · Biens · CRM Clients ·
Visites · Transactions · Documents · Messagerie temps réel · Notifications · IA immobilière.

### Authentification
1. `POST /api/v1/auth/login` → `access_token` + `refresh_token`
2. En-tête : `Authorization: Bearer <access_token>`
3. `POST /api/v1/auth/refresh` avant expiration (rotation automatique du refresh token)

### Temps réel
WebSocket : `ws://<host>/ws?token=<access_token>`
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Démarrage de %s (%s)", settings.APP_NAME, settings.ENVIRONMENT)

    db_ok = await check_database()
    redis_ok = await ping_redis()
    logger.info("Base de données: %s | Redis: %s", "OK" if db_ok else "KO", "OK" if redis_ok else "KO")

    # Amorçage idempotent : sans compte administrateur, personne ne peut se
    # connecter et la plateforme est inutilisable. On le crée donc au démarrage
    # plutôt que de dépendre d'une commande à ne pas oublier.
    if db_ok and settings.AUTO_INIT_DB:
        try:
            from app.database.init_db import bootstrap

            await bootstrap()
            logger.info(
                "Compte administrateur disponible : %s", settings.FIRST_SUPERADMIN_EMAIL
            )
        except Exception:  # noqa: BLE001
            # Un échec ici rend la plateforme inutilisable : on le signale
            # avec sa trace complète plutôt que par un simple avertissement.
            logger.exception(
                "ÉCHEC de l'amorçage initial. Aucun compte administrateur n'a pu être "
                "créé. Corrigez la cause puis relancez, ou exécutez manuellement : "
                "python -m app.database.init_db"
            )
    elif db_ok:
        logger.info("Amorçage automatique désactivé (AUTO_INIT_DB=false).")

    # Les liens d'invitation et de réinitialisation pointent vers cette adresse.
    # Une valeur erronée produit des emails dont les liens n'aboutissent nulle
    # part : on l'affiche au démarrage pour que l'écart saute aux yeux.
    logger.info("Liens envoyés par email basés sur : %s", settings.FRONTEND_BASE_URL)

    if redis_ok:
        await pubsub.bridge.start()

    yield

    await pubsub.bridge.stop()
    await close_redis()
    await dispose_engine()
    logger.info("Arrêt propre de l'application.")


app = FastAPI(
    title=settings.APP_NAME,
    description=DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={"name": "ImmoFlow AI", "email": "tech@immoflow.ai"},
    license_info={"name": "Propriétaire"},
)

# ----------------------------- Middlewares --------------------------------- #
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
if settings.ALLOWED_HOSTS != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

register_exception_handlers(app)

# ------------------------------- Routes ------------------------------------ #
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router)


@app.get("/", tags=["Système"], summary="Racine")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }


@app.get("/health", tags=["Système"], summary="État de santé complet")
async def health():
    database = await check_database()
    redis = await ping_redis()
    return {
        "status": "healthy" if database else "degraded",
        "database": "up" if database else "down",
        "redis": "up" if redis else "down",
        "version": settings.APP_VERSION,
    }


@app.get("/health/live", tags=["Système"], summary="Sonde de vivacité")
async def liveness():
    return {"status": "alive"}


@app.get("/health/ready", tags=["Système"], summary="Sonde de disponibilité")
async def readiness():
    return {"status": "ready" if await check_database() else "not-ready"}


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title, version=app.version, description=app.description, routes=app.routes
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi
