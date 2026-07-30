"""create process configuration records

Revision ID: 20260730_06
Revises: 20260730_05
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260730_06"
down_revision = "20260730_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "process_configurations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_process_configurations_record_id"),
    )
    op.create_index("ix_process_configurations_record_id", "process_configurations", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_process_configurations_record_id", table_name="process_configurations")
    op.drop_table("process_configurations")
