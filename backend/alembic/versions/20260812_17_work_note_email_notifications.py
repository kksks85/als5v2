"""add work note email template and mention rule

Revision ID: 20260812_17
Revises: 20260810_16
Create Date: 2026-08-12
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20260812_17"
down_revision = "20260810_16"
branch_labels = None
depends_on = None


WORK_NOTE_TEMPLATE = {
    "id": "work_note_update",
    "name": "Work note update notification",
    "description": "Notifies users mentioned in an incident work note.",
    "subject": "Work note update: Incident {{incident_id}}",
    "body": """<p>Dear Team,</p><p>A work note has been added to the following incident:</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"><thead><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Details</th><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Information</th></tr></thead><tbody><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{incident_id}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Customer</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{customer}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Status</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{status}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Updated By</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{updated_by}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Work Note Update</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{work_notes}}</td></tr></tbody></table><p>Please refer to incident <strong>{{incident_id}}</strong> for further details.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>""",
    "usedBy": 1,
}

WORK_NOTE_RULE = {
    "id": "work_note_mention_notification",
    "name": "Work note mention notification",
    "trigger": "On work note update",
    "recipientType": "mentioned_users",
    "recipients": "Mentioned Users in Work Notes",
    "template": "Work note update notification",
    "templateId": "work_note_update",
    "groupIds": [],
    "userIds": [],
    "externalEmails": [],
    "resolvedRecipients": [],
    "active": True,
}


def upgrade() -> None:
    for table, record_id, payload in (
        ("email_templates", WORK_NOTE_TEMPLATE["id"], WORK_NOTE_TEMPLATE),
        ("outbound_email_rules", WORK_NOTE_RULE["id"], WORK_NOTE_RULE),
    ):
        op.execute(
            sa.text(f"INSERT INTO {table} (record_id, payload) VALUES (:record_id, CAST(:payload AS jsonb)) ON CONFLICT (record_id) DO NOTHING")
            .bindparams(record_id=record_id, payload=json.dumps(payload))
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM outbound_email_rules WHERE record_id = :record_id").bindparams(record_id=WORK_NOTE_RULE["id"]))
    op.execute(sa.text("DELETE FROM email_templates WHERE record_id = :record_id").bindparams(record_id=WORK_NOTE_TEMPLATE["id"]))