import os
import re
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AssignmentGroupRecord, EmailLogRecord, IncidentRecord, NotificationRecord, OutboundEmailRuleRecord, SubcontractRecord, UserRecord

router = APIRouter(prefix="/notifications", tags=["notifications"])


def prune_expired_email_logs(database: Session) -> None:
    database.execute(delete(EmailLogRecord).where(EmailLogRecord.created_at < datetime.now(UTC) - timedelta(days=10)))


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


class IncidentRegistrationEmail(BaseModel):
    incident_id: str = Field(alias="incidentId", min_length=1, max_length=160)
    rule_id: str = Field(alias="ruleId", min_length=1, max_length=160)
    rule_name: str = Field(alias="ruleName", min_length=1, max_length=240)
    subject: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=20000)
    recipients: list[Recipient] = Field(min_length=1, max_length=200)
    event: str = Field(default="Incident registration notification", min_length=1, max_length=240)
    delivery_key: str = Field(default="registration", alias="deliveryKey", min_length=1, max_length=240)


class IncidentEmailResend(BaseModel):
    incident_id: str = Field(alias="incidentId", min_length=1, max_length=160)


class SmtpTestEmail(BaseModel):
    recipient: EmailStr


class SubcontractCoverageUsage(BaseModel):
    subcontract_id: str = Field(alias="subcontractId", min_length=1, max_length=160)
    inclusion_id: str = Field(alias="inclusionId", min_length=1, max_length=160)
    quantity: int = Field(ge=1, le=100000)
    reference: str = Field(default="", max_length=500)


def environment_flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


def incident_detail_url(incident_id: str) -> str:
    application_url = os.getenv("APP_PUBLIC_URL", "http://localhost:5173").strip().rstrip("/")
    return f"{application_url}/?incidentId={incident_id}"


def link_incident_references(content: str, incident_id: str) -> str:
    if not re.search(rf'<a\b[^>]*>\s*{re.escape(incident_id)}\s*</a>', content, re.IGNORECASE):
        link = f'<a href="{incident_detail_url(incident_id)}" style="color:#1a5fa8;text-decoration:underline;">{incident_id}</a>'
        return content.replace(incident_id, link)
    return content


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
    if re.search(r"<[^>]+>", content):
        plain_content = re.sub(r"\s*<br\s*/?>\s*", "\n", content, flags=re.IGNORECASE)
        plain_content = re.sub(r"</(?:p|tr|h[1-6])>", "\n", plain_content, flags=re.IGNORECASE)
        plain_content = re.sub(r"</(?:td|th)>", "\t", plain_content, flags=re.IGNORECASE)
        plain_content = re.sub(r"<[^>]+>", "", plain_content)
        message.set_content(re.sub(r"\n{3,}", "\n\n", plain_content).strip())
        message.add_alternative(content, subtype="html")
    else:
        message.set_content(content)

    with (smtplib.SMTP_SSL(host, port, timeout=15) if use_ssl else smtplib.SMTP(host, port, timeout=15)) as client:
        if use_tls:
            client.starttls()
        if username:
            client.login(username, password)
        client.send_message(message)
    return {"configured": True, "sent": len(recipients)}


def current_notification_recipients(notification: IncidentRegistrationEmail, database: Session) -> list[Recipient]:
    rule_record = database.scalar(select(OutboundEmailRuleRecord).where(OutboundEmailRuleRecord.record_id == notification.rule_id))
    if not rule_record or not rule_record.payload.get("active"):
        return notification.recipients

    rule = rule_record.payload
    users = [record.payload for record in database.scalars(select(UserRecord)).all()]
    users = [user for user in users if user.get("status") == "Active" and user.get("email")]
    groups = [record.payload for record in database.scalars(select(AssignmentGroupRecord)).all()]
    groups = [group for group in groups if group.get("active")]
    incident_record = database.scalar(select(IncidentRecord).where(IncidentRecord.record_id == notification.incident_id))
    incident = incident_record.payload if incident_record else {}

    def user_emails(selected_users: list[dict]) -> list[str]:
        return [str(user["email"]).strip().lower() for user in selected_users]

    def matching_users(value: object) -> list[dict]:
        needle = str(value or "").lower()
        return [user for user in users if any(str(user.get(field, "")).lower() == needle for field in ("id", "name", "email"))]

    def group_members(selected_groups: list[dict]) -> list[dict]:
        member_ids = {str(member_id) for group in selected_groups for member_id in group.get("memberIds", [])}
        return [user for user in users if str(user.get("id")) in member_ids]

    recipient_type = rule.get("recipientType")
    selected_groups = [group for group in groups if str(group.get("id")) in {str(group_id) for group_id in rule.get("groupIds", [])}]
    selected_users = [user for user in users if str(user.get("id")) in {str(user_id) for user_id in rule.get("userIds", [])}]
    external_emails = rule.get("externalEmails", [])
    if isinstance(external_emails, str):
        external_emails = external_emails.replace(";", ",").split(",")

    if recipient_type == "all_assignment_groups":
        emails = user_emails(group_members(groups))
    elif recipient_type == "multiple_assignment_groups":
        emails = user_emails(group_members(selected_groups))
    elif recipient_type == "assignment_group":
        emails = user_emails(group_members([group for group in groups if group.get("name") == incident.get("assignmentGroup")]))
    elif recipient_type == "approval_assignment_group":
        approval_group = (incident.get("groupApproval") or {}).get("assignmentGroup")
        emails = user_emails(group_members([group for group in groups if group.get("name") == approval_group]))
    elif recipient_type == "specific_user":
        emails = user_emails(selected_users)
    elif recipient_type == "custom_recipients":
        emails = [*user_emails(selected_users), *external_emails]
    elif recipient_type in {"requester", "requested_for"}:
        emails = user_emails(matching_users(incident.get("requestor") or incident.get("requestedFor")))
    elif recipient_type == "assigned_to":
        emails = user_emails(matching_users(incident.get("assignedTo")))
    elif recipient_type == "manager":
        emails = user_emails([user for group in selected_groups for user in matching_users(group.get("manager"))])
    elif recipient_type == "watch_list":
        emails = user_emails([user for value in incident.get("watchList", []) for user in matching_users(value)])
    else:
        return notification.recipients

    unique_emails = list(dict.fromkeys(str(email).strip().lower() for email in [*emails, *external_emails] if str(email).strip()))
    return [Recipient(email=email, name=email) for email in unique_emails]


@router.post("/smtp-connection-test")
def test_smtp_connection() -> dict[str, bool | str]:
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")).strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    if not host or not sender:
        return {
            "success": False,
            "message": "SMTP is not configured on the API service. Set SMTP_HOST and SMTP_FROM_EMAIL in .env, then recreate the API container.",
        }
    if username and not password:
        return {
            "success": False,
            "message": "SMTP authentication is configured, but SMTP_PASSWORD is missing on the API service.",
        }

    port = int(os.getenv("SMTP_PORT", "587"))
    use_ssl = environment_flag("SMTP_USE_SSL")
    use_tls = environment_flag("SMTP_USE_TLS", not use_ssl)
    try:
        with (smtplib.SMTP_SSL(host, port, timeout=15) if use_ssl else smtplib.SMTP(host, port, timeout=15)) as client:
            if use_tls:
                client.starttls()
            if username:
                client.login(username, password)
        return {"success": True, "message": "SMTP connection and authentication succeeded."}
    except (OSError, smtplib.SMTPException) as error:
        return {"success": False, "message": f"SMTP connection failed: {error}"}


@router.post("/smtp-test-email")
def send_smtp_test_email(test: SmtpTestEmail) -> dict[str, bool | str]:
    try:
        delivery = send_email(
            [Recipient(email=test.recipient, name=test.recipient)],
            "TASL ALS50 SMTP test",
            "This is a test message from the TASL ALS50 Customer Support Management Portal. SMTP delivery is working.",
        )
        if delivery["configured"] and delivery["sent"]:
            return {"success": True, "message": f"Test email sent to {test.recipient}."}
        return {"success": False, "message": "SMTP is not configured on the API service."}
    except (OSError, smtplib.SMTPException) as error:
        return {"success": False, "message": f"Test email could not be sent: {error}"}


@router.post("/mention-email")
def send_mention_email(notification: MentionEmail) -> dict[str, int | bool]:
    return send_email(
        notification.recipients,
        f"Work note mention: {notification.incident_id}",
        f"{notification.sender_name} mentioned you in work notes for incident {notification.incident_id}.\n\n{notification.work_notes}",
    )


@router.post("/incident-registration-email")
def send_incident_registration_email(
    notification: IncidentRegistrationEmail,
    database: Session = Depends(get_db),
) -> dict[str, int | bool]:
    prune_expired_email_logs(database)
    created_at = datetime.now(UTC).isoformat()
    content = link_incident_references(notification.content, notification.incident_id)
    unique_recipients = {recipient.email.lower(): recipient for recipient in current_notification_recipients(notification, database)}
    results = []
    for recipient in unique_recipients.values():
        record_id = f"incident-email-{notification.incident_id}-{notification.rule_id}-{notification.delivery_key}-{recipient.email.lower()}"
        existing = database.scalar(select(EmailLogRecord).where(EmailLogRecord.record_id == record_id))
        if existing and existing.payload.get("status") == "Sent":
            results.append(existing.payload)
            continue
        try:
            delivery = send_email([recipient], notification.subject, content)
            if delivery["configured"] and delivery["sent"]:
                status = "Sent"
                details = f"{notification.incident_id}: {notification.rule_name} delivered through the configured SMTP connector."
            else:
                status = "Not sent"
                details = f"{notification.incident_id}: {notification.rule_name} matched, but SMTP_HOST and SMTP_FROM_EMAIL must be configured on the API service."
        except (OSError, smtplib.SMTPException) as error:
            status = "Failed"
            details = f"{notification.incident_id}: {notification.rule_name} could not be delivered: {error}"
        payload = {
            "id": record_id,
            "direction": "Outbound",
            "event": notification.event,
            "status": status,
            "recipient": recipient.email.lower(),
            "subject": notification.subject,
            "content": content,
            "details": details,
            "occurredAt": created_at,
        }
        existing_log = database.scalar(select(EmailLogRecord).where(EmailLogRecord.record_id == record_id))
        if existing_log:
            existing_log.payload = payload
        else:
            database.add(EmailLogRecord(record_id=record_id, payload=payload))
        results.append(payload)
    database.commit()
    return {
        "configured": bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")).strip()),
        "sent": sum(result["status"] == "Sent" for result in results),
        "failed": sum(result["status"] == "Failed" for result in results),
        "not_sent": sum(result["status"] == "Not sent" for result in results),
    }


@router.post("/incident-registration-email/resend")
def resend_incident_registration_email(
    request: IncidentEmailResend,
    database: Session = Depends(get_db),
) -> dict[str, int | bool]:
    matching_logs = [
        record.payload for record in database.scalars(select(EmailLogRecord)).all()
        if record.payload.get("event") == "Incident registration notification"
        and str(record.payload.get("details", "")).startswith(f"{request.incident_id}:")
        and record.payload.get("recipient")
    ]
    if not matching_logs:
        raise HTTPException(status_code=404, detail="No original incident notification was found to resend.")

    source = max(matching_logs, key=lambda payload: payload.get("occurredAt", ""))
    content = link_incident_references(str(source.get("content", "")), request.incident_id)
    if not content:
        raise HTTPException(status_code=409, detail="The original notification did not retain its email content.")

    recipients = {str(payload["recipient"]).lower(): Recipient(email=payload["recipient"], name=payload["recipient"]) for payload in matching_logs}
    occurred_at = datetime.now(UTC).isoformat()
    results = []
    for recipient in recipients.values():
        try:
            delivery = send_email([recipient], str(source.get("subject", f"Incident {request.incident_id}")), content)
            status = "Sent" if delivery["configured"] and delivery["sent"] else "Not sent"
            details = f"{request.incident_id}: Incident notification resent through the configured SMTP connector."
        except (OSError, smtplib.SMTPException) as error:
            status = "Failed"
            details = f"{request.incident_id}: Incident notification resend failed: {error}"
        record_id = f"incident-email-resend-{request.incident_id}-{int(datetime.now(UTC).timestamp() * 1000000)}-{recipient.email.lower()}"
        payload = {"id": record_id, "direction": "Outbound", "event": "Incident registration notification resend", "status": status, "recipient": recipient.email.lower(), "subject": source.get("subject", ""), "content": content, "details": details, "occurredAt": occurred_at}
        database.add(EmailLogRecord(record_id=record_id, payload=payload))
        results.append(payload)
    database.commit()
    return {"configured": bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")).strip()), "sent": sum(result["status"] == "Sent" for result in results), "failed": sum(result["status"] == "Failed" for result in results), "not_sent": sum(result["status"] == "Not sent" for result in results)}


@router.post("/subcontract-coverage-usage")
def consume_subcontract_coverage(
    usage: SubcontractCoverageUsage,
    database: Session = Depends(get_db),
) -> dict:
    subcontract_record = database.scalar(select(SubcontractRecord).where(SubcontractRecord.record_id == usage.subcontract_id).with_for_update())
    if not subcontract_record:
        raise HTTPException(status_code=404, detail="Sub-contract not found.")

    payload = dict(subcontract_record.payload)
    packages = payload.get("maintenancePackages") or {}
    matched_package = ""
    matched_index = -1
    inclusion = None
    for package_key, entries in packages.items():
        for index, entry in enumerate(entries or []):
            if str(entry.get("id")) == usage.inclusion_id:
                matched_package = package_key
                matched_index = index
                inclusion = dict(entry)
                break
        if inclusion:
            break
    if not inclusion:
        raise HTTPException(status_code=404, detail="Maintenance inclusion not found.")
    if matched_package != "unscheduled":
        raise HTTPException(status_code=422, detail="Coverage usage and exhaustion alerts apply only to unscheduled maintenance inclusions.")

    total_quantity = int(inclusion.get("totalQuantity") or 0)
    used_quantity = int(inclusion.get("usedQuantity") or 0)
    if total_quantity <= 0:
        raise HTTPException(status_code=422, detail="Maintenance inclusion must have a positive total coverage quantity.")
    if used_quantity + usage.quantity > total_quantity:
        raise HTTPException(status_code=422, detail=f"Only {total_quantity - used_quantity} coverage unit(s) remain for this inclusion.")

    next_used_quantity = used_quantity + usage.quantity
    inclusion["usedQuantity"] = next_used_quantity
    inclusion["remainingQuantity"] = total_quantity - next_used_quantity
    inclusion["usageHistory"] = [*(inclusion.get("usageHistory") or []), {
        "id": f"usage-{datetime.now(UTC).timestamp():.6f}",
        "quantity": usage.quantity,
        "reference": usage.reference,
        "previousUsedQuantity": used_quantity,
        "newUsedQuantity": next_used_quantity,
        "previousRemainingQuantity": total_quantity - used_quantity,
        "newRemainingQuantity": total_quantity - next_used_quantity,
        "usedAt": datetime.now(UTC).isoformat(),
    }]

    notifications = []
    if next_used_quantity == total_quantity and not inclusion.get("maximumAlertSent"):
        inclusion["maximumAlertSent"] = True
        group = database.scalar(select(AssignmentGroupRecord).where(AssignmentGroupRecord.payload["name"].astext == "Customer Support Management Group"))
        member_ids = {str(member_id) for member_id in (group.payload.get("memberIds") if group else [])}
        users = [record.payload for record in database.scalars(select(UserRecord)).all()]
        recipients = [user for user in users if str(user.get("id")) in member_ids and user.get("status", "Active") == "Active"]
        record_id = f"subcontract-coverage-exhausted:{usage.subcontract_id}:{usage.inclusion_id}"
        notification = {
            "id": record_id,
            "type": "subcontract-coverage-exhausted",
            "title": "Sub-contract coverage exhausted",
            "contractNumber": payload.get("mainContractNumber", ""),
            "subcontractNumber": payload.get("number", ""),
            "customer": payload.get("customer", ""),
            "maintenancePackage": matched_package,
            "inclusionDescription": inclusion.get("itemDescription", ""),
            "recipientGroup": "Customer Support Management Group",
            "recipientUserIds": [user.get("id") for user in recipients],
            "workNotes": f"{inclusion.get('itemDescription', 'Maintenance inclusion')} has reached its maximum allowed coverage of {total_quantity}.",
            "read": False,
            "createdAt": datetime.now(UTC).isoformat(),
        }
        existing = database.scalar(select(NotificationRecord).where(NotificationRecord.record_id == record_id))
        if not existing:
            database.add(NotificationRecord(record_id=record_id, payload=notification))
            notifications.append(notification)

    packages[matched_package][matched_index] = inclusion
    payload["maintenancePackages"] = packages
    subcontract_record.payload = payload
    database.commit()
    return {"subcontract": payload, "notifications": notifications}


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