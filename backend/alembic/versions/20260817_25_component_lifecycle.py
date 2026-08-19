"""add serialized component lifecycle tables

Revision ID: 20260817_25
Revises: 20260814_24
Create Date: 2026-08-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260817_25"
down_revision = "20260814_24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "component_instances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("serial_number", sa.String(160), nullable=False, unique=True),
        sa.Column("component_type", sa.String(160), nullable=False),
        sa.Column("subsystem", sa.String(160)),
        sa.Column("part_number", sa.String(160)),
        sa.Column("sap_part_number", sa.String(160)),
        sa.Column("lifecycle_status", sa.String(40), nullable=False),
        sa.Column("location_type", sa.String(40), nullable=False),
        sa.Column("location_reference", sa.String(160)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_component_instances_serial_number", "component_instances", ["serial_number"])
    op.create_index("ix_component_instances_component_type", "component_instances", ["component_type"])
    op.create_index("ix_component_instances_lifecycle_status", "component_instances", ["lifecycle_status"])
    op.create_index("ix_component_instances_location_type", "component_instances", ["location_type"])
    op.create_index("ix_component_instances_location_reference", "component_instances", ["location_reference"])

    op.create_table(
        "component_installations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False),
        sa.Column("uav_serial_number", sa.String(160), nullable=False),
        sa.Column("component_position", sa.String(160), nullable=False),
        sa.Column("customer", sa.String(180)),
        sa.Column("site", sa.String(180)),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("removal_reason", sa.Text()),
        sa.Column("incident_record_id", sa.String(160)),
    )
    op.create_index("ix_component_installations_component_id", "component_installations", ["component_id"])
    op.create_index("ix_component_installations_uav_serial_number", "component_installations", ["uav_serial_number"])
    op.create_index("ix_component_installations_component_position", "component_installations", ["component_position"])
    op.create_index("ix_component_installations_removed_at", "component_installations", ["removed_at"])
    op.create_index("ix_component_installations_incident_record_id", "component_installations", ["incident_record_id"])
    op.create_index("uq_active_component_position", "component_installations", ["uav_serial_number", "component_position"], unique=True, postgresql_where=sa.text("removed_at IS NULL"))
    op.create_index("uq_active_component_installation", "component_installations", ["component_id"], unique=True, postgresql_where=sa.text("removed_at IS NULL"))

    op.create_table(
        "component_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False),
        sa.Column("from_status", sa.String(40)),
        sa.Column("to_status", sa.String(40), nullable=False),
        sa.Column("from_location_type", sa.String(40)),
        sa.Column("to_location_type", sa.String(40), nullable=False),
        sa.Column("from_location_reference", sa.String(160)),
        sa.Column("to_location_reference", sa.String(160)),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("transaction_id", sa.String(160)),
        sa.Column("incident_record_id", sa.String(160)),
        sa.Column("performed_by", sa.String(180), nullable=False),
        sa.Column("customer", sa.String(180)),
        sa.Column("site", sa.String(180)),
        sa.Column("moved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    for column in ("component_id", "to_status", "to_location_type", "transaction_id", "incident_record_id", "moved_at"):
        op.create_index(f"ix_component_movements_{column}", "component_movements", [column])

    op.create_table(
        "component_repairs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False),
        sa.Column("incident_record_id", sa.String(160), nullable=False),
        sa.Column("previous_uav_serial_number", sa.String(160)),
        sa.Column("failure_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("failure_description", sa.Text(), nullable=False),
        sa.Column("technician_diagnosis", sa.Text()),
        sa.Column("repair_request", sa.Text()),
        sa.Column("repair_status", sa.String(40), nullable=False),
        sa.Column("repair_started_at", sa.DateTime(timezone=True)),
        sa.Column("repair_completed_at", sa.DateTime(timezone=True)),
        sa.Column("repair_outcome", sa.String(80)),
        sa.Column("repair_cost", sa.Numeric(12, 2)),
        sa.Column("replacement_parts", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("final_disposition", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    for column in ("component_id", "incident_record_id", "repair_status"):
        op.create_index(f"ix_component_repairs_{column}", "component_repairs", [column])

    op.create_table(
        "component_replacements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transaction_id", sa.String(160), nullable=False, unique=True),
        sa.Column("incident_record_id", sa.String(160), nullable=False),
        sa.Column("uav_serial_number", sa.String(160), nullable=False),
        sa.Column("component_position", sa.String(160), nullable=False),
        sa.Column("removed_component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False),
        sa.Column("installed_component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("technician", sa.String(180), nullable=False),
        sa.Column("customer", sa.String(180)),
        sa.Column("site", sa.String(180)),
        sa.Column("replaced_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    for column in ("transaction_id", "incident_record_id", "uav_serial_number", "removed_component_id", "installed_component_id"):
        op.create_index(f"ix_component_replacements_{column}", "component_replacements", [column])

    op.create_table(
        "component_procurements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("component_id", sa.Integer(), sa.ForeignKey("component_instances.id"), nullable=False, unique=True),
        sa.Column("purchase_order_number", sa.String(160)),
        sa.Column("supplier", sa.String(180)),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quality_status", sa.String(40), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("received_by", sa.String(180), nullable=False),
        sa.Column("notes", sa.Text()),
    )
    for column in ("component_id", "purchase_order_number", "quality_status"):
        op.create_index(f"ix_component_procurements_{column}", "component_procurements", [column])


def downgrade() -> None:
    op.drop_table("component_procurements")
    op.drop_table("component_replacements")
    op.drop_table("component_repairs")
    op.drop_table("component_movements")
    op.drop_table("component_installations")
    op.drop_table("component_instances")