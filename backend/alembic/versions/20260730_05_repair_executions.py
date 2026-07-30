"""create repair execution records

Revision ID: 20260730_05
Revises: 20260727_04
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260730_05"
down_revision = "20260727_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "repair_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_repair_executions_record_id"),
    )
    op.create_index("ix_repair_executions_record_id", "repair_executions", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_repair_executions_record_id", table_name="repair_executions")
    op.drop_table("repair_executions")
