"""add customer contract allocation to serialized MRLS components

Revision ID: 20260817_26
Revises: 20260817_25
Create Date: 2026-08-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260817_26"
down_revision = "20260817_25"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("component_instances", sa.Column("customer", sa.String(180)))
    op.add_column("component_instances", sa.Column("contract_number", sa.String(160)))
    op.create_index("ix_component_instances_customer", "component_instances", ["customer"])
    op.create_index("ix_component_instances_contract_number", "component_instances", ["contract_number"])
    op.add_column("component_procurements", sa.Column("customer", sa.String(180)))
    op.add_column("component_procurements", sa.Column("contract_number", sa.String(160)))
    op.create_index("ix_component_procurements_customer", "component_procurements", ["customer"])
    op.create_index("ix_component_procurements_contract_number", "component_procurements", ["contract_number"])


def downgrade() -> None:
    op.drop_index("ix_component_procurements_contract_number", table_name="component_procurements")
    op.drop_index("ix_component_procurements_customer", table_name="component_procurements")
    op.drop_column("component_procurements", "contract_number")
    op.drop_column("component_procurements", "customer")
    op.drop_index("ix_component_instances_contract_number", table_name="component_instances")
    op.drop_index("ix_component_instances_customer", table_name="component_instances")
    op.drop_column("component_instances", "contract_number")
    op.drop_column("component_instances", "customer")