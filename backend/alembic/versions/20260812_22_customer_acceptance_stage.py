"""rename the customer post repair acceptance stage

Revision ID: 20260812_22
Revises: 20260812_21
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260812_22"
down_revision = "20260812_21"
branch_labels = None
depends_on = None


def apply_stage_name(source: str, target: str) -> None:
    for table in ("process_configurations", "incidents"):
        op.execute(sa.text(f"""
            UPDATE {table}
            SET payload = jsonb_set(
                jsonb_set(payload, '{{status}}', to_jsonb(CAST(:target AS text)), true),
                '{{stage}}', to_jsonb(CAST(:target AS text)), true
            )
            WHERE payload->>'repairExecution' IN ('Repair at Site - TASL', 'Repair at Site - Vendor')
              AND (payload->>'status' = :source OR payload->>'stage' = :source)
        """).bindparams(source=source, target=target))


def upgrade() -> None:
    apply_stage_name("Post Repair Acceptance", "Post Repair Acceptance by Customer")


def downgrade() -> None:
    apply_stage_name("Post Repair Acceptance by Customer", "Post Repair Acceptance")