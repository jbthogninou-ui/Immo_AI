"""Ajoute la signature électronique (agent + client) aux contrats.

Revision ID: 0003_contract_signatures
Revises: 0002_identity_selfie
Create Date: 2026-08-06
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0003_contract_signatures"
down_revision = "0002_identity_selfie"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column(
        "client_id", pg.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("contracts", sa.Column(
        "agent_id", pg.UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("contracts", sa.Column("agent_signature", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("agent_signed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contracts", sa.Column(
        "agent_signed_by_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("contracts", sa.Column("client_signature", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("client_signed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_contracts_client_id", "contracts", ["client_id"])
    op.create_index("ix_contracts_agent_id", "contracts", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_contracts_agent_id", table_name="contracts")
    op.drop_index("ix_contracts_client_id", table_name="contracts")
    op.drop_column("contracts", "client_signed_at")
    op.drop_column("contracts", "client_signature")
    op.drop_column("contracts", "agent_signed_by_id")
    op.drop_column("contracts", "agent_signed_at")
    op.drop_column("contracts", "agent_signature")
    op.drop_column("contracts", "agent_id")
    op.drop_column("contracts", "client_id")
