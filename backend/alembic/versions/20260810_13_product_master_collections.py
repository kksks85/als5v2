"""add independent non-LM product master records

Revision ID: 20260810_13
Revises: 20260805_12
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260810_13"
down_revision = "20260805_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_master_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource", sa.String(80), nullable=False),
        sa.Column("record_id", sa.String(160), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("resource", "record_id", name="uq_product_master_records_resource_record_id"),
    )
    op.create_index("ix_product_master_records_resource", "product_master_records", ["resource"])


def downgrade() -> None:
    op.drop_table("product_master_records")