"""add approval required email rules

Revision ID: 20260812_21
Revises: 20260812_20
Create Date: 2026-08-12
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20260812_21"
down_revision = "20260812_20"
branch_labels = None
depends_on = None


TABLE_STYLE = "width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"
CELL_STYLE = "padding:8px;border:1px solid #222;text-align:left;vertical-align:top;"


def approval_template(template_id: str, name: str, approval_type: str, request_detail_label: str, request_detail_token: str) -> dict:
    return {
        "id": template_id,
        "name": name,
        "description": f"Notifies the approval group when {approval_type.lower()} is required.",
        "subject": f"Approval required: {approval_type} for incident {{{{incident_id}}}}",
        "body": f'''<p>Dear Approval Team,</p><p>Your approval is required before the incident can proceed.</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" width="100%" style="{TABLE_STYLE}"><thead><tr><th align="left" style="{CELL_STYLE}">Approval Details</th><th align="left" style="{CELL_STYLE}">Information</th></tr></thead><tbody><tr><th align="left" style="{CELL_STYLE}">Incident Number</th><td align="left" style="{CELL_STYLE}">{{{{incident_id}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Customer</th><td align="left" style="{CELL_STYLE}">{{{{customer}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Short Description</th><td align="left" style="{CELL_STYLE}">{{{{title}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Approval Type</th><td align="left" style="{CELL_STYLE}">{{{{approval_type}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Requested By</th><td align="left" style="{CELL_STYLE}">{{{{approval_requested_by}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">Approval Group</th><td align="left" style="{CELL_STYLE}">{{{{approval_assignment_group}}}}</td></tr><tr><th align="left" style="{CELL_STYLE}">{request_detail_label}</th><td align="left" style="{CELL_STYLE}">{request_detail_token}</td></tr><tr><th align="left" style="{CELL_STYLE}">Priority</th><td align="left" style="{CELL_STYLE}">{{{{priority}}}}</td></tr></tbody></table><p>Please review the request and record your decision in the Approval Center.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>''',
        "usedBy": 1,
    }


PRE_DISPATCH_TEMPLATE = approval_template("pre_dispatch_approval_required", "Pre-dispatch approval required", "Pre-dispatch approval", "Resolution Notes", "{{approval_request_reason}}")
PART_REPLACEMENT_TEMPLATE = approval_template("part_replacement_approval_required", "Part replacement approval required", "Part replacement approval", "Replacement Parts", "{{replacement_parts}}")

PRE_DISPATCH_RULE = {
    "id": "pre_dispatch_approval_required_notification",
    "name": "Pre-dispatch approval required",
    "trigger": "On approval required",
    "approvalType": "pre-dispatch",
    "recipientType": "approval_assignment_group",
    "recipients": "Approval Assignment Group",
    "template": PRE_DISPATCH_TEMPLATE["name"],
    "templateId": PRE_DISPATCH_TEMPLATE["id"],
    "groupIds": [], "userIds": [], "externalEmails": [], "resolvedRecipients": [], "active": True,
}

PART_REPLACEMENT_RULE = {
    "id": "part_replacement_approval_required_notification",
    "name": "Part replacement approval required",
    "trigger": "On approval required",
    "approvalType": "replacement-parts",
    "recipientType": "approval_assignment_group",
    "recipients": "Approval Assignment Group",
    "template": PART_REPLACEMENT_TEMPLATE["name"],
    "templateId": PART_REPLACEMENT_TEMPLATE["id"],
    "groupIds": [], "userIds": [], "externalEmails": [], "resolvedRecipients": [], "active": True,
}


def upgrade() -> None:
    for table, payload in (("email_templates", PRE_DISPATCH_TEMPLATE), ("email_templates", PART_REPLACEMENT_TEMPLATE), ("outbound_email_rules", PRE_DISPATCH_RULE), ("outbound_email_rules", PART_REPLACEMENT_RULE)):
        op.execute(
            sa.text(f"INSERT INTO {table} (record_id, payload) VALUES (:record_id, CAST(:payload AS jsonb)) ON CONFLICT (record_id) DO NOTHING")
            .bindparams(record_id=payload["id"], payload=json.dumps(payload))
        )


def downgrade() -> None:
    for table, payload in (("outbound_email_rules", PART_REPLACEMENT_RULE), ("outbound_email_rules", PRE_DISPATCH_RULE), ("email_templates", PART_REPLACEMENT_TEMPLATE), ("email_templates", PRE_DISPATCH_TEMPLATE)):
        op.execute(sa.text(f"DELETE FROM {table} WHERE record_id = :record_id").bindparams(record_id=payload["id"]))