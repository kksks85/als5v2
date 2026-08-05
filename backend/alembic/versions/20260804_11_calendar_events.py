"""create calendar event records

Revision ID: 20260804_11
Revises: 20260804_10
Create Date: 2026-08-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260804_11"
down_revision = "20260804_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_calendar_events_record_id"),
    )
    op.create_index("ix_calendar_events_record_id", "calendar_events", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_calendar_events_record_id", table_name="calendar_events")
    op.drop_table("calendar_events")
