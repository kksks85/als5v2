from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AssignmentGroupRecord, AuditLogRecord, CalendarEventRecord, ContractMrlsRecord, ContractRecord, CustomerRecord, EmailLogRecord, EmailSettingsRecord, EmailTemplateRecord, IncidentRecord, KnowledgeDocumentRecord, MailCorrespondenceRecord, NotificationRecord, OutboundEmailRuleRecord, ProcessConfigurationRecord, ProductAssetRecord, ProductMasterRecord, ProductRecord, QueryRecord, RepairExecutionRecord, SubcontractRecord, SystemSettingsRecord, UserRecord
from app.api.v1.authentication import require_administrator, require_csrf, require_session
from app.services.authentication import AUTH_PAYLOAD_KEY, provision_user_credentials, public_user_payload

router = APIRouter(prefix="/records", tags=["records"])

ALLOWED_RESOURCES = {
    "customers",
    "contracts",
    "subcontracts",
    "products",
    "product_assets",
    "incidents",
    "queries",
    "knowledge_documents",
    "users",
    "assignment_groups",
    "notifications",
    "audit_logs",
    "repair_executions",
    "process_configurations",
    "system_settings",
    "email_settings",
    "email_templates",
    "email_logs",
    "outbound_email_rules",
    "mail_correspondence",
    "calendar_events",
}
RESOURCE_MODELS = {
    "customers": CustomerRecord,
    "contracts": ContractRecord,
    "subcontracts": SubcontractRecord,
    "products": ProductRecord,
    "product_assets": ProductAssetRecord,
    "incidents": IncidentRecord,
    "queries": QueryRecord,
    "knowledge_documents": KnowledgeDocumentRecord,
    "users": UserRecord,
    "assignment_groups": AssignmentGroupRecord,
    "notifications": NotificationRecord,
    "audit_logs": AuditLogRecord,
    "repair_executions": RepairExecutionRecord,
    "process_configurations": ProcessConfigurationRecord,
    "system_settings": SystemSettingsRecord,
    "email_settings": EmailSettingsRecord,
    "email_templates": EmailTemplateRecord,
    "email_logs": EmailLogRecord,
    "outbound_email_rules": OutboundEmailRuleRecord,
    "mail_correspondence": MailCorrespondenceRecord,
    "calendar_events": CalendarEventRecord,
}
PRODUCT_MASTER_RESOURCES = {
    "mcs_products",
    "gdt_products",
    "mast_products",
    "simulator_products",
    "tmv_products",
    "battery_products",
    "warhead_sam_products",
    "tools_products",
    "mrls_products",
    "sme_ste_products",
    "gse_products",
    "warranty_quality_claims",
}


class RecordInput(BaseModel):
    record_id: str = Field(min_length=1, max_length=160)
    payload: dict[str, Any]


class BulkRecordsInput(BaseModel):
    records: list[RecordInput] = Field(max_length=20000)


def reject_compressed_knowledge_attachments(payload: dict[str, Any]) -> None:
    for attachment in payload.get("attachments", []):
        name = str(attachment.get("name", "")).lower()
        content_type = str(attachment.get("type", "")).lower()
        if name.endswith((".zip", ".7z", ".rar", ".tar", ".gz", ".gzip", ".bz2", ".xz", ".zst", ".cab", ".iso")) or any(token in content_type for token in ("zip", "compressed", "rar", "7z", "x-tar", "gzip", "bzip", "x-xz")):
            raise HTTPException(status_code=422, detail="Compressed files are not permitted for knowledge documents.")


def validate_resource(resource: str) -> str:
    if resource not in ALLOWED_RESOURCES and resource not in PRODUCT_MASTER_RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown record resource.")
    return resource


def is_contract_mrls_inventory_record(resource: str, record_id: str) -> bool:
    return resource == "mrls_products" and record_id.startswith("contract-mrls-")


def prune_expired_email_logs(database: Session) -> None:
    database.execute(delete(EmailLogRecord).where(EmailLogRecord.created_at < datetime.now(UTC) - timedelta(days=10)))


@router.get("/{resource}")
def list_records(resource: str, claims: dict = Depends(require_session), database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    validate_resource(resource)
    if resource == "email_logs":
        prune_expired_email_logs(database)
        database.commit()
    if resource in PRODUCT_MASTER_RESOURCES:
        records = database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == resource).order_by(ProductMasterRecord.record_id)).all()
        return {"items": [{"record_id": record.record_id, "payload": public_user_payload(record.payload) if resource == "users" else record.payload} for record in records]}
    model = RESOURCE_MODELS[resource]
    records = database.scalars(select(model).order_by(model.record_id)).all()
    if resource == "contracts":
        mrls_records_by_contract: dict[int, list[dict[str, Any]]] = {}
        for mrls_record in database.scalars(select(ContractMrlsRecord).order_by(ContractMrlsRecord.id)).all():
            mrls_records_by_contract.setdefault(mrls_record.contract_id, []).append({
                "id": mrls_record.client_record_id,
                "contractMrlsRecordId": mrls_record.id,
                "requirementId": mrls_record.requirement_id,
                "spareCategory": mrls_record.spare_category,
                "product_serial_number": mrls_record.product_serial_number,
                "material_serial_number": mrls_record.material_serial_number,
                "part_number": mrls_record.part_number,
                "sap_part_number": mrls_record.sap_part_number or "",
                "material_description": mrls_record.material_description,
                "batch_number": mrls_record.batch_number or "",
                "customer": mrls_record.customer,
                "contract_number": mrls_record.contract_number,
                "quantity": str(mrls_record.quantity),
                "unit_of_measurement": mrls_record.unit_of_measurement,
                "remarks": mrls_record.remarks or "",
            })
        return {"items": [{"record_id": record.record_id, "payload": {**record.payload, "mrlsRecords": mrls_records_by_contract.get(record.id, [])}} for record in records]}
    return {"items": [{"record_id": record.record_id, "payload": public_user_payload(record.payload) if resource == "users" else record.payload} for record in records]}


@router.put("/{resource}/{record_id}")
def upsert_record(resource: str, record_id: str, record: RecordInput, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, str]:
    validate_resource(resource)
    if record.record_id != record_id:
        raise HTTPException(status_code=422, detail="Record identifier does not match the request path.")
    write_records(resource, [record], database)
    database.commit()
    return {"status": "saved", "record_id": record_id}


@router.post("/{resource}/bulk-upsert")
def bulk_upsert_records(resource: str, body: BulkRecordsInput, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, int]:
    validate_resource(resource)
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}


@router.put("/{resource}")
def replace_records(resource: str, body: BulkRecordsInput, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, int]:
    """Synchronize a complete client collection, including removals, atomically."""
    validate_resource(resource)
    if resource == "mrls_products":
        # Contract MRLS inventory is owned by the Contract workflow, not a browser collection.
        database.execute(delete(ProductMasterRecord).where(
            ProductMasterRecord.resource == resource,
            ~ProductMasterRecord.record_id.like("contract-mrls-%"),
        ))
    elif resource in PRODUCT_MASTER_RESOURCES:
        database.execute(delete(ProductMasterRecord).where(ProductMasterRecord.resource == resource))
    else:
        database.execute(delete(RESOURCE_MODELS[resource]))
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}


@router.delete("/{resource}/{record_id}")
def delete_record(resource: str, record_id: str, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, str]:
    validate_resource(resource)
    if is_contract_mrls_inventory_record(resource, record_id):
        raise HTTPException(status_code=403, detail="Contract-created MRLS inventory records can only be removed by deleting their Contract MRLS entry.")
    if resource in PRODUCT_MASTER_RESOURCES:
        database.execute(delete(ProductMasterRecord).where(ProductMasterRecord.resource == resource, ProductMasterRecord.record_id == record_id))
        database.commit()
        return {"status": "deleted", "record_id": record_id}
    model = RESOURCE_MODELS[resource]
    database.execute(delete(model).where(model.record_id == record_id))
    database.commit()
    return {"status": "deleted", "record_id": record_id}


def write_records(resource: str, records: list[RecordInput], database: Session) -> None:
    if not records:
        return
    if any(is_contract_mrls_inventory_record(resource, record.record_id) for record in records):
        raise HTTPException(status_code=403, detail="Contract-created MRLS inventory records can only be maintained from the Contract MRLS workflow.")
    if resource == "knowledge_documents":
        for record in records:
            reject_compressed_knowledge_attachments(record.payload)
    now = datetime.now(UTC)
    if resource in PRODUCT_MASTER_RESOURCES:
        existing = {(record.resource, record.record_id): record for record in database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == resource)).all()}
        for record in records:
            target = existing.get((resource, record.record_id))
            if target:
                target.payload = record.payload
                target.updated_at = now
            else:
                database.add(ProductMasterRecord(resource=resource, record_id=record.record_id, payload=record.payload, updated_at=now))
        return
    model = RESOURCE_MODELS[resource]
    def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
        if resource != "incidents":
            return payload
        normalized = dict(payload)
        if not normalized.get("repairExecution"):
            normalized["repairExecution"] = "Incident Registration"
        if not normalized.get("status"):
            normalized["status"] = "Registered" if normalized.get("stage") in {None, "", "Triage"} else normalized["stage"]
        if normalized.get("stage") in {None, "", "Triage"}:
            normalized["stage"] = normalized["status"]
        if normalized.get("priority") == "Critical (AOG)":
            normalized["priority"] = "Critical"
        return normalized
    existing = {}
    record_ids = [record.record_id for record in records]
    for start in range(0, len(record_ids), 500):
        batch_ids = record_ids[start:start + 500]
        existing.update({record.record_id: record for record in database.scalars(select(model).where(model.record_id.in_(batch_ids))).all()})
    for record in records:
        payload = normalize_payload(record.payload)
        target = existing.get(record.record_id)
        if resource == "users":
            if target:
                existing_authentication = target.payload.get(AUTH_PAYLOAD_KEY)
                payload = dict(payload)
                if existing_authentication:
                    payload[AUTH_PAYLOAD_KEY] = existing_authentication
            else:
                username = str(payload.get("username") or payload.get("employeeId") or payload.get("email") or record.record_id).strip()
                payload = provision_user_credentials(payload, username)
        if target:
            target.payload = payload
            target.updated_at = now
        else:
            database.add(model(record_id=record.record_id, payload=payload, updated_at=now))
