"""add query management records

Revision ID: 20260814_23
Revises: 20260812_22
Create Date: 2026-08-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260814_23"
down_revision = "20260812_22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "queries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("record_id"),
    )
    op.create_index("ix_queries_record_id", "queries", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_queries_record_id", table_name="queries")
    op.drop_table("queries")