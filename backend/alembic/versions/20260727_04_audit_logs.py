"""create audit log records

Revision ID: 20260727_04
Revises: 20260727_03
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260727_04"
down_revision = "20260727_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_audit_logs_record_id"),
    )
    op.create_index("ix_audit_logs_record_id", "audit_logs", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_record_id", table_name="audit_logs")
    op.drop_table("audit_logs")