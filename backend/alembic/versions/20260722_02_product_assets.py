"""create product asset registry

Revision ID: 20260722_02
Revises: 20260722_01
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260722_02"
down_revision = "20260722_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_product_assets_record_id"),
    )
    op.create_index("ix_product_assets_record_id", "product_assets", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_product_assets_record_id", table_name="product_assets")
    op.drop_table("product_assets")