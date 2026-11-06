"""Ajoute la catégorie IDENTITY_SELFIE (selfie de vérification KYC).

Revision ID: 0002_identity_selfie
Revises: 0001_initial_schema
Create Date: 2026-08-04
"""
from __future__ import annotations

from alembic import op

revision = "0002_identity_selfie"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE ne peut pas s'exécuter dans le bloc de
    # transaction ouvert par Alembic : on bascule en autocommit pour cette
    # seule instruction, comme recommandé par la documentation Alembic/PG.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'IDENTITY_SELFIE'"
        )


def downgrade() -> None:
    # PostgreSQL ne permet pas de retirer une valeur d'un type énuméré.
    # Un downgrade propre nécessiterait de recréer le type ; on l'omet ici
    # volontairement (aucune donnée n'est perdue en restant en avant).
    pass