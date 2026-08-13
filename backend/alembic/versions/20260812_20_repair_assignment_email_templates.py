"""repair incident assignment email templates

Revision ID: 20260812_20
Revises: 20260812_19
Create Date: 2026-08-12
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20260812_20"
down_revision = "20260812_19"
branch_labels = None
depends_on = None


TABLE_STYLE = "width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"
CELL_STYLE = "padding:8px;border:1px solid #222;text-align:left;vertical-align:top;"


def assignment_body(introduction: str, assignment_label: str, assignment_token: str) -> str:
    return f'''<p>Dear Team,</p><p>{introduction}</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" width="100%" style="{TABLE_STYLE}"><thead><tr><th align="left" style="{CELL_STYLE}">Incident Details</th><th align="left" style="{CELL_STYLE}">Information</th></tr></thead><tbody><tr><th align="left" style="{CELL_STYLE}">Incident Number</th><td align="left" style="{CELL_STYLE}">{{{{incident_id}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Customer</th><td align="left" style="{CELL_STYLE}">{{{{customer}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Short Description</th><td align="left" style="{CELL_STYLE}">{{{{title}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Priority</th><td align="left" style="{CELL_STYLE}">{{{{priority}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Status</th><td align="left" style="{CELL_STYLE}">{{{{status}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Assignment Group</th><td align="left" style="{CELL_STYLE}">{{{{assignment_group}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">{assignment_label}</th><td align="left" style="{CELL_STYLE}">{assignment_token}</td></tr><tr><th align="left" style="{CELL_STYLE}">Description</th><td align="left" style="{CELL_STYLE}">{{{{description}}}}</td></tr></tbody></table><p>Please review the incident and take the required action. Refer to incident <strong>{{{{incident_id}}}}</strong> for all updates.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>'''


GROUP_TEMPLATE = {
    "id": "incident_assignment_group",
    "name": "Incident Assignment to Group",
    "description": "Notifies the assigned support group that an incident requires action.",
    "subject": "Incident {{incident_id}} has been assigned to {{assignment_group}}",
    "body": assignment_body("The following incident has been assigned to your support group for investigation and action.", "Assigned To", "{{assigned_to}}"),
    "usedBy": 1,
}

INDIVIDUAL_TEMPLATE = {
    "id": "assigned_to",
    "name": "Individual Assignment",
    "description": "Notifies the assigned individual that an incident requires action.",
    "subject": "Action required: Incident {{incident_id}} assigned to {{assigned_to}}",
    "body": assignment_body("The following incident has been assigned directly to you for investigation and action.", "Assigned Individual", "{{assigned_to}}"),
    "usedBy": 1,
}

INDIVIDUAL_RULE = {
    "id": "incident_individual_assignment_notification",
    "name": "Individual Assignment Notification",
    "trigger": "On assignment change",
    "recipientType": "assigned_to",
    "recipients": "Assigned To",
    "template": "Individual Assignment",
    "templateId": "assigned_to",
    "groupIds": [],
    "userIds": [],
    "externalEmails": [],
    "resolvedRecipients": [],
    "active": True,
}


def upgrade() -> None:
    for record_id, payload in ((GROUP_TEMPLATE["id"], GROUP_TEMPLATE), (INDIVIDUAL_TEMPLATE["id"], INDIVIDUAL_TEMPLATE)):
        op.execute(
            sa.text("INSERT INTO email_templates (record_id, payload) VALUES (:record_id, CAST(:payload AS jsonb)) ON CONFLICT (record_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()")
            .bindparams(record_id=record_id, payload=json.dumps(payload))
        )
    op.execute(
        sa.text("INSERT INTO outbound_email_rules (record_id, payload) VALUES (:record_id, CAST(:payload AS jsonb)) ON CONFLICT (record_id) DO NOTHING")
        .bindparams(record_id=INDIVIDUAL_RULE["id"], payload=json.dumps(INDIVIDUAL_RULE))
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM outbound_email_rules WHERE record_id = :record_id").bindparams(record_id=INDIVIDUAL_RULE["id"]))