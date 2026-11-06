"""Agrégation des routers de l'API v1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin, agencies, agents, ai, auth, clients, conversations, documents,
    notifications, owners, properties, public, transactions, users, visits,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(agencies.router)
api_router.include_router(agents.router)
api_router.include_router(owners.router)
api_router.include_router(clients.router)
api_router.include_router(properties.router)
api_router.include_router(public.router)
api_router.include_router(visits.router)
api_router.include_router(transactions.router)
api_router.include_router(documents.router)
api_router.include_router(conversations.router)
api_router.include_router(notifications.router)
api_router.include_router(ai.router)
api_router.include_router(admin.router)
