"""create outbound email rule records

Revision ID: 20260731_09
Revises: 20260731_08
Create Date: 2026-07-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260731_09"
down_revision = "20260731_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outbound_email_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_outbound_email_rules_record_id"),
    )
    op.create_index("ix_outbound_email_rules_record_id", "outbound_email_rules", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_outbound_email_rules_record_id", table_name="outbound_email_rules")
    op.drop_table("outbound_email_rules")