"""add email templates and incident creation notification

Revision ID: 20260810_15
Revises: 20260810_14
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260810_15"
down_revision = "20260810_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_id", sa.String(160), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_email_templates_record_id", "email_templates", ["record_id"], unique=True)

    email_templates = sa.table(
        "email_templates",
        sa.column("record_id", sa.String()),
        sa.column("payload", postgresql.JSONB()),
    )
    op.bulk_insert(email_templates, [{
        "record_id": "incident_creation",
        "payload": {
            "id": "incident_creation",
            "name": "Incident creation notification",
            "description": "Notifies the support team that a new incident has been created.",
            "subject": "Incident {{incident_id}} has been created",
            "body": """<p>Dear Team,</p><p>Greetings from <strong>TASL Customer Support Team</strong>.</p><p>We would like to inform you that a new incident has been successfully created with the following details:</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"><thead><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Details</th><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Information</th></tr></thead><tbody><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{incident_id}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Customer</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{customer}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Created On / Opened On</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{opened}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Priority</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{priority}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Category</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{category}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Serial Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{serial_number}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Short Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{title}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{description}}</td></tr></tbody></table><p>Please refer to the <strong>Incident Number [{{incident_id}}]</strong> in all future communications regarding this issue.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>""",
            "usedBy": 0,
        },
    }])


def downgrade() -> None:
    op.drop_index("ix_email_templates_record_id", table_name="email_templates")
    op.drop_table("email_templates")