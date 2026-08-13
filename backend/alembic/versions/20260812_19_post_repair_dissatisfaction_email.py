"""add post repair dissatisfaction email notification

Revision ID: 20260812_19
Revises: 20260812_18
Create Date: 2026-08-12
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20260812_19"
down_revision = "20260812_18"
branch_labels = None
depends_on = None


POST_REPAIR_DISSATISFACTION_TEMPLATE = {
    "id": "post_repair_dissatisfaction_return",
    "name": "Post-repair dissatisfaction return notification",
    "description": "Notifies the responsible repair team when post-repair inspection returns an incident for corrective action.",
    "subject": "Action required: Incident {{incident_id}} returned for corrective action",
    "body": """<p>Dear Team,</p><p>The post-repair inspection has found that the solution for the following incident does not yet meet the applicable resolution and acceptance guidelines. The incident has been returned to your team for corrective action.</p><table role=\"presentation\" border=\"1\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;\"><thead><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Incident Details</th><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Information</th></tr></thead><tbody><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Incident Number</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{incident_id}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Customer</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{customer}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Inspection Stage</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{post_repair_review_stage}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Returned To Stage</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{return_status}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Responsible Team</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{return_assignment_group}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Assigned To</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{return_assignee}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Priority</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{priority}}</td></tr><tr><th align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">Resolution Notes</th><td align=\"left\" style=\"padding:8px;border:1px solid #222;text-align:left;\">{{resolution_details}}</td></tr></tbody></table><p><strong>Required action:</strong> {{dissatisfaction_reason}}</p><p>Please review the work performed, correct the outstanding issue, update the resolution evidence, and resubmit the incident for post-repair inspection.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>""",
    "usedBy": 1,
}

POST_REPAIR_DISSATISFACTION_RULE = {
    "id": "post_repair_dissatisfaction_return_notification",
    "name": "Post-repair dissatisfaction return notification",
    "trigger": "On post-repair dissatisfaction",
    "recipientType": "assignment_group",
    "recipients": "Assignment Group",
    "template": "Post-repair dissatisfaction return notification",
    "templateId": "post_repair_dissatisfaction_return",
    "groupIds": [],
    "userIds": [],
    "externalEmails": [],
    "resolvedRecipients": [],
    "active": True,
}


def upgrade() -> None:
    for table, record_id, payload in (
        ("email_templates", POST_REPAIR_DISSATISFACTION_TEMPLATE["id"], POST_REPAIR_DISSATISFACTION_TEMPLATE),
        ("outbound_email_rules", POST_REPAIR_DISSATISFACTION_RULE["id"], POST_REPAIR_DISSATISFACTION_RULE),
    ):
        op.execute(
            sa.text(f"INSERT INTO {table} (record_id, payload) VALUES (:record_id, CAST(:payload AS jsonb)) ON CONFLICT (record_id) DO NOTHING")
            .bindparams(record_id=record_id, payload=json.dumps(payload))
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM outbound_email_rules WHERE record_id = :record_id").bindparams(record_id=POST_REPAIR_DISSATISFACTION_RULE["id"]))
    op.execute(sa.text("DELETE FROM email_templates WHERE record_id = :record_id").bindparams(record_id=POST_REPAIR_DISSATISFACTION_TEMPLATE["id"]))