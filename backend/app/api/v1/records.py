from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AssignmentGroupRecord, ContractRecord, CustomerRecord, IncidentRecord, KnowledgeDocumentRecord, ProductAssetRecord, ProductRecord, UserRecord

router = APIRouter(prefix="/records", tags=["records"])

ALLOWED_RESOURCES = {
    "customers",
    "contracts",
    "products",
    "product_assets",
    "incidents",
    "knowledge_documents",
    "users",
    "assignment_groups",
}
RESOURCE_MODELS = {
    "customers": CustomerRecord,
    "contracts": ContractRecord,
    "products": ProductRecord,
    "product_assets": ProductAssetRecord,
    "incidents": IncidentRecord,
    "knowledge_documents": KnowledgeDocumentRecord,
    "users": UserRecord,
    "assignment_groups": AssignmentGroupRecord,
}


class RecordInput(BaseModel):
    record_id: str = Field(min_length=1, max_length=160)
    payload: dict[str, Any]


class BulkRecordsInput(BaseModel):
    records: list[RecordInput] = Field(max_length=20000)


def validate_resource(resource: str) -> str:
    if resource not in ALLOWED_RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown record resource.")
    return resource


@router.get("/{resource}")
def list_records(resource: str, database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    validate_resource(resource)
    model = RESOURCE_MODELS[resource]
    records = database.scalars(select(model).order_by(model.updated_at.desc())).all()
    return {"items": [{"record_id": record.record_id, "payload": record.payload} for record in records]}


@router.put("/{resource}/{record_id}")
def upsert_record(resource: str, record_id: str, record: RecordInput, database: Session = Depends(get_db)) -> dict[str, str]:
    validate_resource(resource)
    if record.record_id != record_id:
        raise HTTPException(status_code=422, detail="Record identifier does not match the request path.")
    write_records(resource, [record], database)
    database.commit()
    return {"status": "saved", "record_id": record_id}


@router.post("/{resource}/bulk-upsert")
def bulk_upsert_records(resource: str, body: BulkRecordsInput, database: Session = Depends(get_db)) -> dict[str, int]:
    validate_resource(resource)
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}


@router.put("/{resource}")
def replace_records(resource: str, body: BulkRecordsInput, database: Session = Depends(get_db)) -> dict[str, int]:
    """Synchronize a complete client collection, including removals, atomically."""
    validate_resource(resource)
    database.execute(delete(RESOURCE_MODELS[resource]))
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}


@router.delete("/{resource}/{record_id}")
def delete_record(resource: str, record_id: str, database: Session = Depends(get_db)) -> dict[str, str]:
    validate_resource(resource)
    model = RESOURCE_MODELS[resource]
    database.execute(delete(model).where(model.record_id == record_id))
    database.commit()
    return {"status": "deleted", "record_id": record_id}


def write_records(resource: str, records: list[RecordInput], database: Session) -> None:
    if not records:
        return
    now = datetime.now(UTC)
    model = RESOURCE_MODELS[resource]
    statement = insert(model).values([
        {"record_id": record.record_id, "payload": record.payload, "updated_at": now}
        for record in records
    ])
    statement = statement.on_conflict_do_update(
        index_elements=[model.record_id],
        set_={"payload": statement.excluded.payload, "updated_at": statement.excluded.updated_at},
    )
    database.execute(statement)
