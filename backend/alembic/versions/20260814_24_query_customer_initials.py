"""normalize query number customer initials

Revision ID: 20260814_24
Revises: 20260814_23
Create Date: 2026-08-14
"""

import re

from alembic import op
import sqlalchemy as sa


revision = "20260814_24"
down_revision = "20260814_23"
branch_labels = None
depends_on = None


def customer_initials(customer: str) -> str:
    initials = "".join(word[0] for word in re.findall(r"[A-Za-z0-9]+", customer or "")).upper()
    return initials or "CUSTOMER"


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, record_id, payload FROM queries")).mappings()
    for row in rows:
        record_id = row["record_id"]
        payload = row["payload"]
        match = re.fullmatch(r"[A-Z]+-QRY-(\d+)-(\d{4})", record_id)
        if not match:
            continue
        next_id = f"{customer_initials(payload.get('customer'))}-QRY-{match.group(1)}-{match.group(2)}"
        if next_id == record_id:
            continue
        payload["id"] = next_id
        connection.execute(
            sa.text("UPDATE queries SET record_id = :record_id, payload = CAST(:payload AS jsonb) WHERE id = :id"),
            {"id": row["id"], "record_id": next_id, "payload": __import__("json").dumps(payload)},
        )


def downgrade() -> None:
    pass