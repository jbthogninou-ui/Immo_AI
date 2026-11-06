"""Initialisation des données de référence (Super Admin, types de biens).

Usage : python -m app.database.init_db
Idempotent : peut être relancé sans effet de bord.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.security import hash_password
from app.database.session import session_scope
from app.models.enums import UserRole, UserStatus
from app.models.property import PropertyType
from app.models.user import User
from app.utils.slug import slugify

logger = logging.getLogger(__name__)

DEFAULT_PROPERTY_TYPES = [
    ("Villa", "Maison individuelle avec cour ou jardin"),
    ("Appartement", "Logement en immeuble collectif"),
    ("Studio", "Logement d'une pièce principale"),
    ("Duplex", "Logement sur deux niveaux"),
    ("Maison", "Habitation individuelle"),
    ("Terrain", "Parcelle nue, lotie ou non"),
    ("Bureau", "Local à usage professionnel"),
    ("Boutique", "Local commercial"),
    ("Magasin / Entrepôt", "Local de stockage"),
    ("Immeuble", "Bâtiment complet à revenus"),
]


async def create_superadmin() -> None:
    async with session_scope() as session:
        existing = (
            await session.execute(
                select(User).where(User.role == UserRole.SUPER_ADMIN).limit(1)
            )
        ).scalars().first()
        if existing:
            logger.info("Super Admin déjà présent (%s).", existing.email)
            return

        session.add(
            User(
                email=settings.FIRST_SUPERADMIN_EMAIL.lower(),
                hashed_password=hash_password(settings.FIRST_SUPERADMIN_PASSWORD),
                full_name="Super Administrateur",
                role=UserRole.SUPER_ADMIN,
                status=UserStatus.ACTIVE,
                is_active=True,
                is_email_verified=True,
            )
        )
        logger.info("Super Admin créé : %s", settings.FIRST_SUPERADMIN_EMAIL)


async def create_property_types() -> None:
    async with session_scope() as session:
        existing = {
            slug for slug in (
                await session.execute(select(PropertyType.slug))
            ).scalars().all()
        }
        created = 0
        for name, description in DEFAULT_PROPERTY_TYPES:
            slug = slugify(name)
            if slug in existing:
                continue
            session.add(PropertyType(name=name, slug=slug, description=description))
            created += 1
        logger.info("%d type(s) de bien créé(s).", created)


async def bootstrap() -> None:
    """Amorçage minimal, sûr à relancer autant de fois que nécessaire.

    Appelé au démarrage de l'application : garantit qu'un compte
    administrateur et les types de biens existent toujours, sans dépendre
    d'une commande manuelle.
    """
    await create_superadmin()
    await create_property_types()


async def main() -> None:
    setup_logging()
    await bootstrap()
    logger.info("Initialisation terminée.")


if __name__ == "__main__":
    asyncio.run(main())
