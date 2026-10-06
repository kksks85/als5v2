"""add contract-scoped individual MRLS records

Revision ID: 20261006_31
Revises: 20261006_30
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261006_31"
down_revision = "20261006_30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contract_mrls_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("contract_id", sa.Integer(), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("client_record_id", sa.String(160), nullable=False),
        sa.Column("requirement_id", sa.String(160), nullable=False),
        sa.Column("spare_category", sa.String(160), nullable=False),
        sa.Column("product_serial_number", sa.String(160), nullable=False),
        sa.Column("material_serial_number", sa.String(160), nullable=False),
        sa.Column("part_number", sa.String(160), nullable=False),
        sa.Column("sap_part_number", sa.String(160)),
        sa.Column("material_description", sa.String(500), nullable=False),
        sa.Column("batch_number", sa.String(160)),
        sa.Column("customer", sa.String(180), nullable=False),
        sa.Column("contract_number", sa.String(160), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_of_measurement", sa.String(80), nullable=False),
        sa.Column("remarks", sa.Text()),
        sa.Column("created_by", sa.String(180), nullable=False),
        sa.Column("updated_by", sa.String(180), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("contract_id", "client_record_id", name="uq_contract_mrls_records_client_record"),
        sa.UniqueConstraint("contract_id", "material_serial_number", name="uq_contract_mrls_records_material_serial"),
        sa.CheckConstraint("quantity = 1", name="ck_contract_mrls_records_single_unit"),
    )
    for column in ("contract_id", "client_record_id", "requirement_id", "spare_category", "material_serial_number", "customer", "contract_number"):
        op.create_index(f"ix_contract_mrls_records_{column}", "contract_mrls_records", [column])


def downgrade() -> None:
    op.drop_table("contract_mrls_records")