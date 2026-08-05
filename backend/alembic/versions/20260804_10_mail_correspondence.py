"""create mail correspondence records

Revision ID: 20260804_10
Revises: 20260731_09
Create Date: 2026-08-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260804_10"
down_revision = "20260731_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mail_correspondence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.String(length=160), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", name="uq_mail_correspondence_record_id"),
    )
    op.create_index("ix_mail_correspondence_record_id", "mail_correspondence", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_mail_correspondence_record_id", table_name="mail_correspondence")
    op.drop_table("mail_correspondence")