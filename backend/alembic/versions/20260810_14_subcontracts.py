"""add standalone subcontract records

Revision ID: 20260810_14
Revises: 20260810_13
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260810_14"
down_revision = "20260810_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subcontracts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_id", sa.String(160), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_subcontracts_record_id", "subcontracts", ["record_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_subcontracts_record_id", table_name="subcontracts")
    op.drop_table("subcontracts")