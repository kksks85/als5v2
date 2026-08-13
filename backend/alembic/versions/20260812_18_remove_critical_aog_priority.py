"""remove retired Critical AOG incident priority

Revision ID: 20260812_18
Revises: 20260812_17
Create Date: 2026-08-12
"""

from alembic import op


revision = "20260812_18"
down_revision = "20260812_17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE incidents SET payload = jsonb_set(payload, '{priority}', to_jsonb('Critical'::text)), updated_at = now() WHERE payload ->> 'priority' = 'Critical (AOG)'")


def downgrade() -> None:
    pass