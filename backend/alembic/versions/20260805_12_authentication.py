"""add enterprise authentication tables

Revision ID: 20260805_12
Revises: 20260804_11
Create Date: 2026-08-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260805_12"
down_revision = "20260804_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("role_mappings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("directory_group", sa.String(255), nullable=False, unique=True), sa.Column("application_role", sa.String(100), nullable=False), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    op.create_index("ix_role_mappings_directory_group", "role_mappings", ["directory_group"])
    op.create_index("ix_role_mappings_application_role", "role_mappings", ["application_role"])
    op.create_table("authentication_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("provider", sa.String(50), nullable=False, server_default="demo"), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("session_timeout_minutes", sa.Integer(), nullable=False, server_default="60"), sa.Column("lockout_threshold", sa.Integer(), nullable=False, server_default="5"), sa.Column("lockout_minutes", sa.Integer(), nullable=False, server_default="15"), sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False, server_default="10"), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    op.create_table("user_sessions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("session_id", sa.String(64), nullable=False, unique=True), sa.Column("username", sa.String(255), nullable=False), sa.Column("roles", postgresql.JSONB(), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    op.create_index("ix_user_sessions_session_id", "user_sessions", ["session_id"])
    op.create_index("ix_user_sessions_username", "user_sessions", ["username"])
    op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])
    op.create_table("authentication_audit_logs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("event_type", sa.String(80), nullable=False), sa.Column("outcome", sa.String(20), nullable=False), sa.Column("username", sa.String(255)), sa.Column("provider", sa.String(50), nullable=False), sa.Column("source_ip", sa.String(64)), sa.Column("correlation_id", sa.String(64), nullable=False), sa.Column("details", postgresql.JSONB(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    for column in ("event_type", "outcome", "username", "correlation_id", "created_at"):
        op.create_index(f"ix_authentication_audit_logs_{column}", "authentication_audit_logs", [column])


def downgrade() -> None:
    op.drop_table("authentication_audit_logs")
    op.drop_table("user_sessions")
    op.drop_table("authentication_settings")
    op.drop_table("role_mappings")