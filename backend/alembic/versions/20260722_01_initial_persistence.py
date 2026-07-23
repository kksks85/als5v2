"""create persistence tables

Revision ID: 20260722_01
Revises:
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260722_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("customers", "contracts", "products", "incidents", "knowledge_documents", "users", "assignment_groups"):
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("record_id", sa.String(length=160), nullable=False),
            sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("record_id", name=f"uq_{table}_record_id"),
        )
        op.create_index(f"ix_{table}_record_id", table, ["record_id"])
    op.create_table(
        "entra_configuration",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("client_id", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("api_scope", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("redirect_uri", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("admin_group_id", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("coordinator_group_id", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "application_secret_notices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("application_secret_notices")
    op.drop_table("entra_configuration")
    for table in ("assignment_groups", "users", "knowledge_documents", "incidents", "products", "contracts", "customers"):
        op.drop_index(f"ix_{table}_record_id", table_name=table)
        op.drop_table(table)
