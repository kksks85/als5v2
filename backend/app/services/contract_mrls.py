import re
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ComponentInstance, ComponentMovement, ContractMrlsLine, ContractMrlsRecord, ContractRecord, ProductMasterRecord
from app.schemas.domain import ContractMrlsGenerate, ContractMrlsLineCreate, ContractSave


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=404, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _contract_number(contract: ContractRecord) -> str:
    return str(contract.payload.get("number") or contract.record_id).strip()


def _line_payload(line: ContractMrlsLine) -> dict[str, Any]:
    return {
        "id": line.id,
        "contract_id": line.contract_id,
        "contract_number": line.contract_number,
        "customer": line.customer,
        "product_category": line.product_category,
        "product_reference": line.product_reference,
        "product_master_record_id": line.product_master_record_id,
        "component_type": line.component_type,
        "subsystem": line.subsystem,
        "part_number": line.part_number,
        "sap_part_number": line.sap_part_number,
        "quantity": line.quantity,
        "generated_quantity": line.generated_quantity,
        "remaining_quantity": line.quantity - line.generated_quantity,
        "status": line.status,
        "created_by": line.created_by,
        "created_at": line.created_at,
    }


def list_contract_mrls_lines(database: Session, contract_id: int) -> list[dict[str, Any]]:
    return [_line_payload(line) for line in database.scalars(
        select(ContractMrlsLine).where(ContractMrlsLine.contract_id == contract_id).order_by(ContractMrlsLine.id)
    )]


def _contract_mrls_record_payload(record: ContractMrlsRecord) -> dict[str, Any]:
    return {
        "id": record.client_record_id,
        "contractMrlsRecordId": record.id,
        "requirementId": record.requirement_id,
        "spareCategory": record.spare_category,
        "product_serial_number": record.product_serial_number,
        "material_serial_number": record.material_serial_number,
        "part_number": record.part_number,
        "sap_part_number": record.sap_part_number or "",
        "material_description": record.material_description,
        "batch_number": record.batch_number or "",
        "customer": record.customer,
        "contract_number": record.contract_number,
        "quantity": str(record.quantity),
        "unit_of_measurement": record.unit_of_measurement,
        "remarks": record.remarks or "",
    }


def _inventory_record_id(record: ContractMrlsRecord) -> str:
    return f"contract-mrls-{record.id}"


def _inventory_payload(record: ContractMrlsRecord) -> dict[str, Any]:
    inventory_record_id = _inventory_record_id(record)
    return {
        "id": inventory_record_id,
        "product_serial_number": record.product_serial_number,
        "part_number": record.part_number,
        "sap_part_number": record.sap_part_number or "",
        "material_description": record.material_description,
        "batch_number": record.batch_number or "",
        "material_serial_number": record.material_serial_number,
        "customer": record.customer,
        "contract_number": record.contract_number,
        "quantity": str(record.quantity),
        "unit_of_measurement": record.unit_of_measurement,
        "remarks": record.remarks or "",
        "contractMrlsRecordId": record.id,
        "requirementId": record.requirement_id,
        "spareCategory": record.spare_category,
        "source": "Contract",
    }


def _sync_mrls_inventory_records(database: Session, records: list[ContractMrlsRecord]) -> None:
    inventory_record_ids = [_inventory_record_id(record) for record in records]
    existing = {
        record.record_id: record
        for record in database.scalars(
            select(ProductMasterRecord)
            .where(
                ProductMasterRecord.resource == "mrls_products",
                ProductMasterRecord.record_id.in_(inventory_record_ids),
            )
            .with_for_update()
        ).all()
    } if inventory_record_ids else {}
    for record in records:
        inventory_record_id = _inventory_record_id(record)
        inventory_record = existing.get(inventory_record_id)
        if inventory_record:
            inventory_record.payload = _inventory_payload(record)
        else:
            database.add(ProductMasterRecord(
                resource="mrls_products",
                record_id=inventory_record_id,
                payload=_inventory_payload(record),
            ))


def list_contract_mrls_records(database: Session, contract_id: int) -> list[dict[str, Any]]:
    records = database.scalars(
        select(ContractMrlsRecord)
        .where(ContractMrlsRecord.contract_id == contract_id)
        .order_by(ContractMrlsRecord.id)
    ).all()
    return [_contract_mrls_record_payload(record) for record in records]


def save_contract_with_mrls_records(database: Session, record_id: str, command: ContractSave, saved_by: str) -> dict[str, Any]:
    payload = dict(command.payload)
    payload.pop("mrlsRecords", None)
    contract_number = str(payload.get("number") or record_id).strip()
    customer = str(payload.get("customer") or "").strip()
    if not contract_number or not customer:
        raise HTTPException(status_code=422, detail="Contract number and customer are required.")

    submitted_ids = [record.id for record in command.mrls_records]
    if len(set(submitted_ids)) != len(submitted_ids):
        raise HTTPException(status_code=422, detail="Each individual MRLS record must have a unique record identifier.")
    serial_numbers = [record.material_serial_number.strip().casefold() for record in command.mrls_records]
    if len(set(serial_numbers)) != len(serial_numbers):
        raise HTTPException(status_code=422, detail="Individual MRLS serial numbers must be unique within the contract.")

    contract = database.scalar(
        select(ContractRecord).where(ContractRecord.record_id == record_id).with_for_update()
    )
    if not contract:
        contract = ContractRecord(record_id=record_id, payload=payload)
        database.add(contract)
        database.flush()
    else:
        contract.payload = payload
        database.flush()

    existing_records = {
        record.client_record_id: record
        for record in database.scalars(
            select(ContractMrlsRecord)
            .where(ContractMrlsRecord.contract_id == contract.id)
            .with_for_update()
        ).all()
    }
    for client_record_id, record in existing_records.items():
        if client_record_id not in submitted_ids:
            inventory_record = database.scalar(
                select(ProductMasterRecord)
                .where(
                    ProductMasterRecord.resource == "mrls_products",
                    ProductMasterRecord.record_id == _inventory_record_id(record),
                )
                .with_for_update()
            )
            if inventory_record:
                database.delete(inventory_record)
            database.delete(record)
    database.flush()

    for submitted in command.mrls_records:
        record = existing_records.get(submitted.id)
        values = {
            "requirement_id": submitted.requirement_id,
            "spare_category": submitted.spare_category,
            "product_serial_number": submitted.product_serial_number,
            "material_serial_number": submitted.material_serial_number,
            "part_number": submitted.part_number,
            "sap_part_number": submitted.sap_part_number,
            "material_description": submitted.material_description,
            "batch_number": submitted.batch_number,
            "customer": customer,
            "contract_number": contract_number,
            "quantity": submitted.quantity,
            "unit_of_measurement": submitted.unit_of_measurement,
            "remarks": submitted.remarks,
            "updated_by": saved_by,
        }
        if record:
            for key, value in values.items():
                setattr(record, key, value)
        else:
            database.add(ContractMrlsRecord(
                contract_id=contract.id,
                client_record_id=submitted.id,
                created_by=saved_by,
                **values,
            ))
    database.flush()

    current_records = database.scalars(
        select(ContractMrlsRecord).where(ContractMrlsRecord.contract_id == contract.id)
    ).all()
    _sync_mrls_inventory_records(database, current_records)
    database.flush()

    records = list_contract_mrls_records(database, contract.id)
    return {
        "record_id": contract.record_id,
        "payload": {**payload, "mrlsRecords": records},
        "mrls_records": records,
    }


def delete_contract_with_mrls_records(database: Session, record_id: str) -> None:
    contract = database.scalar(
        select(ContractRecord).where(ContractRecord.record_id == record_id).with_for_update()
    )
    if not contract:
        raise _not_found("Contract was not found.")
    records = database.scalars(
        select(ContractMrlsRecord).where(ContractMrlsRecord.contract_id == contract.id)
    ).all()
    inventory_record_ids = [_inventory_record_id(record) for record in records]
    if inventory_record_ids:
        for inventory_record in database.scalars(
            select(ProductMasterRecord).where(
                ProductMasterRecord.resource == "mrls_products",
                ProductMasterRecord.record_id.in_(inventory_record_ids),
            )
        ).all():
            database.delete(inventory_record)
    for record in records:
        database.delete(record)
    database.delete(contract)


def create_contract_mrls_line(database: Session, contract_id: int, command: ContractMrlsLineCreate) -> dict[str, Any]:
    contract = database.scalar(select(ContractRecord).where(ContractRecord.id == contract_id).with_for_update())
    if not contract:
        raise _not_found("Contract was not found.")
    if command.product_master_record_id and not database.scalar(select(ProductMasterRecord.id).where(ProductMasterRecord.id == command.product_master_record_id)):
        raise _not_found("Product master record was not found.")
    line = ContractMrlsLine(
        contract_id=contract.id,
        contract_number=_contract_number(contract),
        customer=str(contract.payload.get("customer") or "").strip() or None,
        product_category=command.product_category,
        product_reference=command.product_reference,
        product_master_record_id=command.product_master_record_id,
        component_type=command.component_type,
        subsystem=command.subsystem,
        part_number=command.part_number,
        sap_part_number=command.sap_part_number,
        quantity=command.quantity,
        generated_quantity=0,
        status="planned",
        created_by=command.created_by,
    )
    database.add(line)
    database.flush()
    return _line_payload(line)


def _generated_serial(line: ContractMrlsLine, sequence: int) -> str:
    contract_reference = re.sub(r"[^A-Za-z0-9]+", "-", line.contract_number).strip("-") or "CONTRACT"
    return f"MRLS-{contract_reference[:120]}-L{line.id}-{sequence:04d}"


def generate_contract_mrls_components(database: Session, line_id: int, command: ContractMrlsGenerate) -> dict[str, Any]:
    line = database.scalar(select(ContractMrlsLine).where(ContractMrlsLine.id == line_id).with_for_update())
    if not line:
        raise _not_found("Contract MRLS line was not found.")
    remaining = line.quantity - line.generated_quantity
    if remaining <= 0:
        raise _conflict("All individual MRLS records for this contract line have already been generated.")
    generation_quantity = command.quantity or remaining
    if generation_quantity > remaining:
        raise _conflict("Requested MRLS generation quantity exceeds the remaining contract allocation.")

    components: list[ComponentInstance] = []
    for sequence in range(line.generated_quantity + 1, line.generated_quantity + generation_quantity + 1):
        serial_number = _generated_serial(line, sequence)
        if database.scalar(select(ComponentInstance.id).where(ComponentInstance.serial_number == serial_number)):
            raise _conflict(f"Generated MRLS serial number collision: {serial_number}.")
        component = ComponentInstance(
            serial_number=serial_number,
            component_type=line.component_type,
            subsystem=line.subsystem,
            part_number=line.part_number,
            sap_part_number=line.sap_part_number,
            lifecycle_status="new",
            location_type="mrls",
            location_reference=f"Contract allocation {line.contract_number}",
            customer=line.customer,
            contract_number=line.contract_number,
            contract_mrls_line_id=line.id,
            created_by=command.generated_by,
            received_at=None,
        )
        database.add(component)
        database.flush()
        database.add(ComponentMovement(
            component_id=component.id,
            from_status=None,
            to_status="new",
            from_location_type=None,
            to_location_type="mrls",
            from_location_reference=None,
            to_location_reference=component.location_reference,
            reason="Individual MRLS inventory record generated from contract allocation.",
            transaction_id=f"contract-mrls-line-{line.id}",
            incident_record_id=None,
            performed_by=command.generated_by,
            customer=line.customer,
            site=None,
        ))
        components.append(component)
    line.generated_quantity += generation_quantity
    line.status = "generated" if line.generated_quantity == line.quantity else "partially_generated"
    database.flush()
    return {
        "line": _line_payload(line),
        "components": [{"serial_number": component.serial_number, "status": component.lifecycle_status, "contract_mrls_line_id": component.contract_mrls_line_id} for component in components],
    }