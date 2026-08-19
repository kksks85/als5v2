"""add system settings records

Revision ID: 20260819_27
Revises: 20260817_26
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260819_27"
down_revision = "20260817_26"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_id", sa.String(160), nullable=False, unique=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_system_settings_record_id", "system_settings", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_system_settings_record_id", table_name="system_settings")
    op.drop_table("system_settings")