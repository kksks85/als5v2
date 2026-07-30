import os
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NotificationRecord

router = APIRouter(prefix="/notifications", tags=["notifications"])


class Recipient(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=160)


class MentionEmail(BaseModel):
    recipients: list[Recipient] = Field(min_length=1, max_length=200)
    sender_name: str = Field(alias="senderName", min_length=1, max_length=160)
    incident_id: str = Field(alias="incidentId", min_length=1, max_length=160)
    work_notes: str = Field(alias="workNotes", min_length=1, max_length=10000)


class WarrantyExpiryNotification(BaseModel):
    contract_number: str = Field(alias="contractNumber", min_length=1, max_length=160)
    customer: str = Field(min_length=1, max_length=240)
    expiry_date: str = Field(alias="expiryDate", min_length=10, max_length=10)
    recipients: list[Recipient] = Field(default_factory=list, max_length=200)


def environment_flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


def send_email(recipients: list[Recipient], subject: str, content: str) -> dict[str, int | bool]:
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")).strip()
    if not host or not sender or not recipients:
        return {"configured": bool(host and sender), "sent": 0}

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    use_ssl = environment_flag("SMTP_USE_SSL")
    use_tls = environment_flag("SMTP_USE_TLS", not use_ssl)
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM_NAME", "Aerofix Service") + f" <{sender}>"
    message["To"] = ", ".join(f"{recipient.name} <{recipient.email}>" for recipient in recipients)
    message["Subject"] = subject
    message.set_content(content)

    with (smtplib.SMTP_SSL(host, port, timeout=15) if use_ssl else smtplib.SMTP(host, port, timeout=15)) as client:
        if use_tls:
            client.starttls()
        if username:
            client.login(username, password)
        client.send_message(message)
    return {"configured": True, "sent": len(recipients)}


@router.post("/mention-email")
def send_mention_email(notification: MentionEmail) -> dict[str, int | bool]:
    return send_email(
        notification.recipients,
        f"Work note mention: {notification.incident_id}",
        f"{notification.sender_name} mentioned you in work notes for incident {notification.incident_id}.\n\n{notification.work_notes}",
    )


@router.post("/warranty-expiry")
def create_warranty_expiry_notification(
    notification: WarrantyExpiryNotification,
    database: Session = Depends(get_db),
) -> dict:
    record_id = f"contract-warranty-expired:{notification.contract_number}:{notification.expiry_date}"
    existing = database.scalar(select(NotificationRecord).where(NotificationRecord.record_id == record_id))
    if existing:
        return {"created": False, "notification": existing.payload, "email": {"configured": False, "sent": 0}}

    created_at = datetime.now(UTC).isoformat()
    payload = {
        "id": record_id,
        "type": "warranty-expired",
        "title": "Warranty expired",
        "contractNumber": notification.contract_number,
        "customer": notification.customer,
        "expiryDate": notification.expiry_date,
        "recipientGroup": "Customer Support Management Group",
        "recipients": [recipient.model_dump() for recipient in notification.recipients],
        "read": False,
        "createdAt": created_at,
    }
    database.add(NotificationRecord(record_id=record_id, payload=payload))
    database.commit()

    try:
        email = send_email(
            notification.recipients,
            f"Warranty expired: {notification.contract_number}",
            "\n".join([
                f"The warranty for contract {notification.contract_number} has expired.",
                f"Customer: {notification.customer}",
                f"Warranty expiry date: {notification.expiry_date}",
                "Review and update AMC/CMC coverage as required.",
            ]),
        )
    except (OSError, smtplib.SMTPException) as error:
        email = {"configured": True, "sent": 0, "error": str(error)}
    return {"created": True, "notification": payload, "email": email}