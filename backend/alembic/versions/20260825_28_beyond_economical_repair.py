"""add beyond economical repair decision fields

Revision ID: 20260825_28
Revises: 20260819_27
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20260825_28"
down_revision = "20260819_27"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("component_repairs", sa.Column("ber_reason", sa.Text()))
    op.add_column("component_repairs", sa.Column("ber_decided_at", sa.DateTime(timezone=True)))
    op.add_column("component_repairs", sa.Column("ber_decided_by", sa.String(length=180)))
    op.add_column("component_repairs", sa.Column("ber_replacement_component_id", sa.Integer(), sa.ForeignKey("component_instances.id")))
    op.create_index("ix_component_repairs_ber_replacement_component_id", "component_repairs", ["ber_replacement_component_id"])


def downgrade() -> None:
    op.drop_index("ix_component_repairs_ber_replacement_component_id", table_name="component_repairs")
    op.drop_column("component_repairs", "ber_replacement_component_id")
    op.drop_column("component_repairs", "ber_decided_by")
    op.drop_column("component_repairs", "ber_decided_at")
    op.drop_column("component_repairs", "ber_reason")