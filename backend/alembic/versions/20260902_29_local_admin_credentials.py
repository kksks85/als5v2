"""add local administrator credential storage

Revision ID: 20260902_29
Revises: 20260825_28
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260902_29"
down_revision = "20260825_28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("local_admin_credentials"):
        return
    op.create_table(
        "local_admin_credentials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("local_admin_credentials")