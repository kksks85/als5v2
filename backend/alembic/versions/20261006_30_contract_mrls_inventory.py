"""add contract-driven MRLS inventory foundation

Revision ID: 20261006_30
Revises: 20260902_29
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261006_30"
down_revision = "20260902_29"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contract_mrls_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("contract_id", sa.Integer(), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("contract_number", sa.String(160), nullable=False),
        sa.Column("customer", sa.String(180)),
        sa.Column("product_category", sa.String(160), nullable=False),
        sa.Column("product_reference", sa.String(160)),
        sa.Column("product_master_record_id", sa.Integer(), sa.ForeignKey("product_master_records.id")),
        sa.Column("component_type", sa.String(160), nullable=False),
        sa.Column("subsystem", sa.String(160)),
        sa.Column("part_number", sa.String(160)),
        sa.Column("sap_part_number", sa.String(160)),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("generated_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(40), nullable=False, server_default="planned"),
        sa.Column("created_by", sa.String(180), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("quantity > 0", name="ck_contract_mrls_lines_quantity_positive"),
        sa.CheckConstraint("generated_quantity >= 0 AND generated_quantity <= quantity", name="ck_contract_mrls_lines_generation_range"),
    )
    for column in ("contract_id", "contract_number", "customer", "product_category", "product_reference", "product_master_record_id", "status"):
        op.create_index(f"ix_contract_mrls_lines_{column}", "contract_mrls_lines", [column])
    op.add_column("component_instances", sa.Column("contract_mrls_line_id", sa.Integer(), sa.ForeignKey("contract_mrls_lines.id")))
    op.add_column("component_instances", sa.Column("created_by", sa.String(180)))
    op.create_index("ix_component_instances_contract_mrls_line_id", "component_instances", ["contract_mrls_line_id"])
    op.create_index("ix_component_instances_created_by", "component_instances", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_component_instances_created_by", table_name="component_instances")
    op.drop_index("ix_component_instances_contract_mrls_line_id", table_name="component_instances")
    op.drop_column("component_instances", "created_by")
    op.drop_column("component_instances", "contract_mrls_line_id")
    op.drop_table("contract_mrls_lines")