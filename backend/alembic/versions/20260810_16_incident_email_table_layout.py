"""fix incident email table layout

Revision ID: 20260810_16
Revises: 20260810_15
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260810_16"
down_revision = "20260810_15"
branch_labels = None
depends_on = None


BODY = """<p>Dear Team,</p><p>Greetings from <strong>TASL Customer Support Team</strong>.</p><p>We would like to inform you that a new incident has been successfully created with the following details:</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"><thead><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Details</th><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Information</th></tr></thead><tbody><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{incident_id}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Customer</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{customer}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Created On / Opened On</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{opened}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Priority</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{priority}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Category</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{category}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Serial Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{serial_number}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Short Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{title}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{description}}</td></tr></tbody></table><p>Please refer to the <strong>Incident Number [{{incident_id}}]</strong> in all future communications regarding this issue.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>"""


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE email_templates SET payload = jsonb_set(payload, '{body}', to_jsonb(CAST(:body AS text))), updated_at = now() WHERE record_id = 'incident_creation'").bindparams(body=BODY)
    )


def downgrade() -> None:
    pass