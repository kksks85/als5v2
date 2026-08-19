from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLogRecord, ComponentInstallation, ComponentInstance, ComponentMovement, ComponentProcurement, ComponentRepair, ComponentReplacement, IncidentRecord, ProductMasterRecord, ProductRecord
from app.schemas.domain import ComponentQualityDecision, ComponentReceiptCreate, ComponentRepairUpdate, ComponentReplacementCreate


MRLS_LOCATION = "MRLS"
REPAIR_LOCATION = "TASL Repair"


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=404, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _component_payload(component: ComponentInstance) -> dict[str, Any]:
    return {
        "serial_number": component.serial_number,
        "component_type": component.component_type,
        "subsystem": component.subsystem,
        "part_number": component.part_number,
        "lifecycle_status": component.lifecycle_status,
        "location_type": component.location_type,
        "location_reference": component.location_reference,
        "customer": component.customer,
        "contract_number": component.contract_number,
    }


def list_components(database: Session, lifecycle_status: str | None = None, component_type: str | None = None, customer: str | None = None, contract_number: str | None = None) -> list[dict[str, Any]]:
    statement = select(ComponentInstance).order_by(ComponentInstance.serial_number)
    if lifecycle_status:
        statement = statement.where(ComponentInstance.lifecycle_status == lifecycle_status)
    if component_type:
        statement = statement.where(ComponentInstance.component_type.ilike(component_type))
    if customer:
        statement = statement.where(ComponentInstance.customer == customer)
    if contract_number:
        statement = statement.where(ComponentInstance.contract_number == contract_number)
    return [_component_payload(component) for component in database.scalars(statement)]


def active_uav_configuration(database: Session, uav_serial_number: str) -> list[dict[str, Any]]:
    rows = database.execute(
        select(ComponentInstallation, ComponentInstance)
        .join(ComponentInstance, ComponentInstance.id == ComponentInstallation.component_id)
        .where(ComponentInstallation.uav_serial_number == uav_serial_number, ComponentInstallation.removed_at.is_(None))
        .order_by(ComponentInstallation.component_position)
    ).all()
    return [{
        "uav_serial_number": installation.uav_serial_number,
        "component_position": installation.component_position,
        "installed_at": installation.installed_at,
        "customer": installation.customer,
        "site": installation.site,
        "component": _component_payload(component),
    } for installation, component in rows]


def component_detail(database: Session, serial_number: str) -> dict[str, Any]:
    component = database.scalar(select(ComponentInstance).where(ComponentInstance.serial_number == serial_number))
    if not component:
        raise _not_found("Component serial number was not found.")
    movements = database.scalars(select(ComponentMovement).where(ComponentMovement.component_id == component.id).order_by(ComponentMovement.moved_at.desc())).all()
    installations = database.scalars(select(ComponentInstallation).where(ComponentInstallation.component_id == component.id).order_by(ComponentInstallation.installed_at.desc())).all()
    repairs = database.scalars(select(ComponentRepair).where(ComponentRepair.component_id == component.id).order_by(ComponentRepair.created_at.desc())).all()
    return {
        "component": _component_payload(component),
        "movements": [{"from_status": row.from_status, "to_status": row.to_status, "from_location": row.from_location_reference, "to_location": row.to_location_reference, "reason": row.reason, "performed_by": row.performed_by, "moved_at": row.moved_at, "incident_record_id": row.incident_record_id} for row in movements],
        "installations": [{"uav_serial_number": row.uav_serial_number, "component_position": row.component_position, "customer": row.customer, "site": row.site, "installed_at": row.installed_at, "removed_at": row.removed_at, "removal_reason": row.removal_reason, "incident_record_id": row.incident_record_id} for row in installations],
        "repairs": [{"id": row.id, "incident_record_id": row.incident_record_id, "repair_status": row.repair_status, "failure_description": row.failure_description, "technician_diagnosis": row.technician_diagnosis, "repair_request": row.repair_request, "repair_started_at": row.repair_started_at, "repair_completed_at": row.repair_completed_at, "repair_outcome": row.repair_outcome, "repair_cost": row.repair_cost, "replacement_parts": row.replacement_parts, "final_disposition": row.final_disposition} for row in repairs],
    }


def repair_queue(database: Session) -> list[dict[str, Any]]:
    rows = database.execute(select(ComponentRepair, ComponentInstance, IncidentRecord).join(ComponentInstance, ComponentInstance.id == ComponentRepair.component_id).outerjoin(IncidentRecord, IncidentRecord.record_id == ComponentRepair.incident_record_id).where(ComponentRepair.repair_status.in_(["sent_for_repair", "under_repair", "repaired", "quality_check"])).order_by(ComponentRepair.created_at.desc())).all()
    return [{"repair_id": repair.id, "incident_record_id": repair.incident_record_id, "original_incident_id": repair_incident.payload.get("parentIncidentId") if repair_incident else None, "repair_status": repair.repair_status, "failure_description": repair.failure_description, "component": _component_payload(component)} for repair, component, repair_incident in rows]


def _audit(database: Session, entity_id: str, action: str, actor: str, details: dict[str, Any]) -> None:
    database.add(AuditLogRecord(record_id=f"component-lifecycle:{entity_id}:{action}", payload={"entityType": "component", "entityId": entity_id, "action": action, "actor": actor, "occurredAt": datetime.now(UTC).isoformat(), **details}))


def receive_component(database: Session, command: ComponentReceiptCreate) -> dict[str, Any]:
    existing = database.scalar(select(ComponentInstance).where(ComponentInstance.serial_number == command.serial_number))
    if existing:
        raise _conflict("A component with this serial number already exists.")
    now = datetime.now(UTC)
    component = ComponentInstance(serial_number=command.serial_number, component_type=command.component_type, subsystem=command.subsystem, part_number=command.part_number, sap_part_number=command.sap_part_number, lifecycle_status="quality_check", location_type="receiving", location_reference="MRLS Receiving", customer=command.customer, contract_number=command.contract_number, received_at=now)
    database.add(component)
    database.flush()
    database.add(ComponentProcurement(component_id=component.id, purchase_order_number=command.purchase_order_number, supplier=command.supplier, customer=command.customer, contract_number=command.contract_number, received_at=now, quality_status="pending", received_by=command.received_by, notes=command.notes))
    database.add(ComponentMovement(component_id=component.id, from_status=None, to_status="quality_check", from_location_type=None, to_location_type="receiving", from_location_reference=None, to_location_reference="MRLS Receiving", reason="New serialized component received pending quality acceptance.", transaction_id=None, incident_record_id=None, performed_by=command.received_by, customer=None, site=None))
    _audit(database, component.serial_number, "component_received", command.received_by, {"purchaseOrderNumber": command.purchase_order_number})
    database.flush()
    return _component_payload(component)


def quality_decision(database: Session, serial_number: str, command: ComponentQualityDecision) -> dict[str, Any]:
    component = database.scalar(select(ComponentInstance).where(ComponentInstance.serial_number == serial_number).with_for_update())
    if not component:
        raise _not_found("Component serial number was not found.")
    if component.lifecycle_status not in {"quality_check", "repaired"}:
        raise _conflict("Only components awaiting quality acceptance can receive a quality decision.")
    procurement = database.scalar(select(ComponentProcurement).where(ComponentProcurement.component_id == component.id))
    repair = database.scalar(select(ComponentRepair).where(ComponentRepair.component_id == component.id).order_by(ComponentRepair.created_at.desc()))
    if command.accepted:
        _record_movement(database, component, to_status="mrls_available", to_location_type="mrls", to_location_reference=MRLS_LOCATION, reason=command.notes or "Quality accepted; component is available in MRLS.", command=ComponentReplacementCreate(transaction_id=f"quality-{serial_number}-{datetime.now(UTC).timestamp()}", incident_record_id=repair.incident_record_id if repair else "quality", uav_serial_number="MRLS", component_position="MRLS", failed_component_serial=serial_number, replacement_component_serial=serial_number, reason=command.notes or "Quality accepted", technician=command.performed_by, failure_date=datetime.now(UTC)))
        if procurement:
            procurement.quality_status = "accepted"
            procurement.accepted_at = datetime.now(UTC)
        if repair:
            repair.repair_status = "completed"
            repair.final_disposition = "mrls_available"
    else:
        _record_movement(database, component, to_status="beyond_repair", to_location_type="scrap", to_location_reference="Quality rejection", reason=command.notes or "Quality rejected.", command=ComponentReplacementCreate(transaction_id=f"quality-reject-{serial_number}-{datetime.now(UTC).timestamp()}", incident_record_id=repair.incident_record_id if repair else "quality", uav_serial_number="MRLS", component_position="MRLS", failed_component_serial=serial_number, replacement_component_serial=serial_number, reason=command.notes or "Quality rejected", technician=command.performed_by, failure_date=datetime.now(UTC)))
        if procurement:
            procurement.quality_status = "rejected"
        if repair:
            repair.repair_status = "beyond_repair"
            repair.final_disposition = "scrap"
    _audit(database, component.serial_number, "quality_accepted" if command.accepted else "quality_rejected", command.performed_by, {"notes": command.notes})
    database.flush()
    return _component_payload(component)


def update_repair(database: Session, repair_id: int, action: str, command: ComponentRepairUpdate) -> dict[str, Any]:
    repair = database.scalar(select(ComponentRepair).where(ComponentRepair.id == repair_id).with_for_update())
    if not repair:
        raise _not_found("Repair record was not found.")
    component = database.scalar(select(ComponentInstance).where(ComponentInstance.id == repair.component_id).with_for_update())
    if action == "start":
        if component.lifecycle_status != "sent_for_repair":
            raise _conflict("Only dispatched components can start repair.")
        _record_movement(database, component, to_status="under_repair", to_location_type="repair_facility", to_location_reference=REPAIR_LOCATION, reason=command.notes or "Repair work started.", command=ComponentReplacementCreate(transaction_id=f"repair-start-{repair_id}", incident_record_id=repair.incident_record_id, uav_serial_number=repair.previous_uav_serial_number or "", component_position=component.component_type, failed_component_serial=component.serial_number, replacement_component_serial=component.serial_number, reason=command.notes or "Repair started", technician=command.performed_by, failure_date=repair.failure_date))
        repair.repair_status = "under_repair"
        repair.repair_started_at = datetime.now(UTC)
    elif action == "complete":
        if component.lifecycle_status != "under_repair":
            raise _conflict("Only components under repair can be completed.")
        repair_command = ComponentReplacementCreate(transaction_id=f"repair-complete-{repair_id}", incident_record_id=repair.incident_record_id, uav_serial_number=repair.previous_uav_serial_number or "", component_position=component.component_type, failed_component_serial=component.serial_number, replacement_component_serial=component.serial_number, reason=command.notes or "Repair completed", technician=command.performed_by, failure_date=repair.failure_date)
        _record_movement(database, component, to_status="repaired", to_location_type="repair_facility", to_location_reference=REPAIR_LOCATION, reason="Repair work completed successfully.", command=repair_command)
        _record_movement(database, component, to_status="quality_check", to_location_type="repair_facility", to_location_reference=REPAIR_LOCATION, reason=command.notes or "Repaired component awaiting quality acceptance.", command=repair_command)
        repair.repair_status = "quality_check"
        repair.repair_completed_at = datetime.now(UTC)
        repair.repair_outcome = command.repair_outcome or "repaired"
    elif action == "scrap":
        if component.lifecycle_status not in {"sent_for_repair", "under_repair", "quality_check"}:
            raise _conflict("Only repair-queue components can be scrapped.")
        _record_movement(database, component, to_status="scrapped", to_location_type="scrap", to_location_reference="TASL Scrap", reason=command.notes or "Component classified beyond repair and scrapped.", command=ComponentReplacementCreate(transaction_id=f"repair-scrap-{repair_id}", incident_record_id=repair.incident_record_id, uav_serial_number=repair.previous_uav_serial_number or "", component_position=component.component_type, failed_component_serial=component.serial_number, replacement_component_serial=component.serial_number, reason=command.notes or "Scrapped", technician=command.performed_by, failure_date=repair.failure_date))
        repair.repair_status = "beyond_repair"
        repair.final_disposition = "scrapped"
    else:
        raise HTTPException(status_code=422, detail="Unknown repair action.")
    repair.technician_diagnosis = command.technician_diagnosis or repair.technician_diagnosis
    repair.repair_request = command.repair_request or repair.repair_request
    repair.repair_cost = command.repair_cost if command.repair_cost is not None else repair.repair_cost
    if command.replacement_parts:
        repair.replacement_parts = command.replacement_parts
    _audit(database, component.serial_number, f"repair_{action}", command.performed_by, {"repairId": repair_id, "notes": command.notes})
    database.flush()
    return component_detail(database, component.serial_number)


def _record_movement(
    database: Session,
    component: ComponentInstance,
    *,
    to_status: str,
    to_location_type: str,
    to_location_reference: str | None,
    reason: str,
    command: ComponentReplacementCreate,
) -> None:
    database.add(ComponentMovement(
        component_id=component.id,
        from_status=component.lifecycle_status,
        to_status=to_status,
        from_location_type=component.location_type,
        to_location_type=to_location_type,
        from_location_reference=component.location_reference,
        to_location_reference=to_location_reference,
        reason=reason,
        transaction_id=command.transaction_id,
        incident_record_id=command.incident_record_id,
        performed_by=command.technician,
        customer=command.customer,
        site=command.site,
    ))
    component.lifecycle_status = to_status
    component.location_type = to_location_type
    component.location_reference = to_location_reference


def _update_product_master_projection(database: Session, command: ComponentReplacementCreate, failed_component: ComponentInstance, replacement_component: ComponentInstance) -> None:
    product_rows = database.scalars(select(ProductRecord).with_for_update()).all()
    target = next((row for row in product_rows if str(row.payload.get("product_serial_number") or "").strip() == command.uav_serial_number
        and str(row.payload.get("material_serial_number") or "").strip() == failed_component.serial_number
        and (not command.component_position or str(row.payload.get("material_description") or "").strip() == command.component_position)), None)
    if not target:
        raise _conflict("No matching current Product Master component was found for the failed serial number and UAV position.")
    payload = dict(target.payload)
    payload["material_serial_number"] = replacement_component.serial_number
    payload["lifecycle_updated_at"] = datetime.now(UTC).isoformat()
    payload["lifecycle_transaction_id"] = command.transaction_id
    target.payload = payload


def _bootstrap_installed_component(database: Session, command: ComponentReplacementCreate) -> ComponentInstance | None:
    product = database.scalar(select(ProductRecord).where(
        ProductRecord.payload["product_serial_number"].astext == command.uav_serial_number,
        ProductRecord.payload["material_serial_number"].astext == command.failed_component_serial,
        ProductRecord.payload["material_description"].astext == command.component_position,
    ).with_for_update())
    if not product:
        return None
    payload = product.payload
    stale_installation = database.execute(
        select(ComponentInstallation, ComponentInstance)
        .join(ComponentInstance, ComponentInstance.id == ComponentInstallation.component_id)
        .where(
            ComponentInstallation.uav_serial_number == command.uav_serial_number,
            ComponentInstallation.component_position == command.component_position,
            ComponentInstallation.removed_at.is_(None),
        )
        .with_for_update()
    ).first()
    if stale_installation:
        installation, stale_component = stale_installation
        installation.removed_at = datetime.now(UTC)
        installation.removal_reason = "Superseded by current Product Master configuration during replacement synchronization."
        installation.incident_record_id = command.incident_record_id
        _record_movement(
            database,
            stale_component,
            to_status="sent_for_repair",
            to_location_type="repair_facility",
            to_location_reference=REPAIR_LOCATION,
            reason="Removed from a stale lifecycle installation to align with the current Product Master configuration.",
            command=command,
        )
        database.flush()
    component = ComponentInstance(
        serial_number=command.failed_component_serial,
        component_type=str(payload.get("material_description") or command.component_position),
        subsystem=payload.get("subsystems") or None,
        part_number=payload.get("part_number") or None,
        sap_part_number=payload.get("sap_part_number") or None,
        lifecycle_status="installed",
        location_type="uav",
        location_reference=command.uav_serial_number,
        customer=command.customer,
        contract_number=str(payload.get("contract_number") or "") or None,
        received_at=datetime.now(UTC),
    )
    database.add(component)
    database.flush()
    database.add(ComponentInstallation(
        component_id=component.id,
        uav_serial_number=command.uav_serial_number,
        component_position=command.component_position,
        customer=command.customer,
        site=command.site,
        installed_at=datetime.now(UTC),
        incident_record_id=command.incident_record_id,
    ))
    # The application session disables autoflush; make the new installation visible to the active-position validation below.
    database.flush()
    database.add(ComponentMovement(
        component_id=component.id,
        from_status=None,
        to_status="installed",
        from_location_type=None,
        to_location_type="uav",
        from_location_reference=None,
        to_location_reference=command.uav_serial_number,
        reason="Current Product Master configuration synchronized for replacement.",
        transaction_id=command.transaction_id,
        incident_record_id=command.incident_record_id,
        performed_by=command.technician,
        customer=command.customer,
        site=command.site,
    ))
    return component


def perform_replacement(database: Session, command: ComponentReplacementCreate) -> dict[str, Any]:
    existing = database.scalar(select(ComponentReplacement).where(ComponentReplacement.transaction_id == command.transaction_id))
    if existing:
        return {"transaction_id": existing.transaction_id, "status": "already_processed"}

    incident = database.scalar(select(IncidentRecord).where(IncidentRecord.record_id == command.incident_record_id).with_for_update())
    if not incident:
        raise _not_found("Replacement requires an existing incident.")
    incident_uav = str(incident.payload.get("serialNumber") or "").strip()
    incident_customer = str(incident.payload.get("customer") or "").strip()
    incident_contract = str(incident.payload.get("contract") or "").strip()
    if incident_uav and incident_uav != command.uav_serial_number:
        raise _conflict("The incident UAV serial number does not match the replacement request.")

    failed_component = database.scalar(select(ComponentInstance).where(ComponentInstance.serial_number == command.failed_component_serial).with_for_update())
    if not failed_component:
        failed_component = _bootstrap_installed_component(database, command)
    replacement_component = database.scalar(select(ComponentInstance).where(ComponentInstance.serial_number == command.replacement_component_serial).with_for_update())
    if not failed_component:
        raise _not_found("Failed component serial number was not found.")
    if not replacement_component:
        raise _not_found("Replacement component serial number was not found.")
    if failed_component.id == replacement_component.id:
        raise _conflict("The failed component and replacement component must be different serial numbers.")
    if replacement_component.lifecycle_status != "mrls_available" or replacement_component.location_type != "mrls":
        raise _conflict("The selected replacement component is not currently available in MRLS.")
    if replacement_component.customer != incident_customer or replacement_component.contract_number != incident_contract:
        raise _conflict("The selected MRLS component is not allocated to this incident customer and contract.")
    if failed_component.component_type.casefold() != replacement_component.component_type.casefold():
        raise _conflict("The replacement component type must match the failed component type.")
    failed_component.customer = incident_customer
    failed_component.contract_number = incident_contract

    active_installation = database.scalar(
        select(ComponentInstallation)
        .where(
            ComponentInstallation.component_id == failed_component.id,
            ComponentInstallation.uav_serial_number == command.uav_serial_number,
            ComponentInstallation.component_position == command.component_position,
            ComponentInstallation.removed_at.is_(None),
        )
        .with_for_update()
    )
    if not active_installation:
        raise _conflict("The failed component is not the active component at the specified UAV position.")
    occupied_position = database.scalar(
        select(ComponentInstallation)
        .where(
            ComponentInstallation.uav_serial_number == command.uav_serial_number,
            ComponentInstallation.component_position == command.component_position,
            ComponentInstallation.removed_at.is_(None),
        )
        .with_for_update()
    )
    if occupied_position and occupied_position.id != active_installation.id:
        raise _conflict("The UAV component position has changed; refresh and try again.")

    now = datetime.now(UTC)
    active_installation.removed_at = now
    active_installation.removal_reason = command.reason
    active_installation.incident_record_id = command.incident_record_id
    _record_movement(database, failed_component, to_status="failed", to_location_type="uav", to_location_reference=command.uav_serial_number, reason=command.reason, command=command)
    _record_movement(database, failed_component, to_status="sent_for_repair", to_location_type="repair_facility", to_location_reference=REPAIR_LOCATION, reason="Removed during replacement and sent for repair.", command=command)
    _record_movement(database, replacement_component, to_status="issued_for_replacement", to_location_type="uav", to_location_reference=command.uav_serial_number, reason="Issued from MRLS for incident replacement.", command=command)
    _record_movement(database, replacement_component, to_status="installed", to_location_type="uav", to_location_reference=command.uav_serial_number, reason="Installed as the incident replacement component.", command=command)

    database.add(ComponentInstallation(
        component_id=replacement_component.id,
        uav_serial_number=command.uav_serial_number,
        component_position=command.component_position,
        customer=command.customer,
        site=command.site,
        installed_at=now,
        incident_record_id=command.incident_record_id,
    ))
    repair_incident = database.scalar(select(IncidentRecord).where(IncidentRecord.payload["parentIncidentId"].astext == command.incident_record_id).order_by(IncidentRecord.created_at.desc())) or incident
    repair_incident_id = repair_incident.record_id
    repair = ComponentRepair(
        component_id=failed_component.id,
        incident_record_id=repair_incident_id,
        previous_uav_serial_number=command.uav_serial_number,
        failure_date=command.failure_date,
        failure_description=command.reason,
        technician_diagnosis=command.technician_diagnosis,
        repair_request=command.repair_request,
        repair_status="sent_for_repair",
    )
    database.add(repair)
    database.flush()
    repair_payload = dict(repair_incident.payload)
    repair_payload["repairLifecycle"] = {
        **(repair_payload.get("repairLifecycle") or {}),
        "repairId": repair.id,
        "componentSerial": failed_component.serial_number,
        "replacementTransactionId": command.transaction_id,
    }
    repair_payload["auditLog"] = [*(repair_payload.get("auditLog") or []), {"id": f"repair-linked-{command.transaction_id}", "assignedGroup": repair_payload.get("assignmentGroup") or "", "updatedBy": command.technician, "updatedAt": now.isoformat(), "changes": [{"field": "Component repair", "previous": "", "next": f"{failed_component.serial_number} linked to this Incident"}]}]
    repair_incident.payload = repair_payload
    database.add(ComponentReplacement(
        transaction_id=command.transaction_id,
        incident_record_id=command.incident_record_id,
        uav_serial_number=command.uav_serial_number,
        component_position=command.component_position,
        removed_component_id=failed_component.id,
        installed_component_id=replacement_component.id,
        reason=command.reason,
        technician=command.technician,
        customer=command.customer,
        site=command.site,
        replaced_at=now,
    ))
    _update_product_master_projection(database, command, failed_component, replacement_component)
    database.add(AuditLogRecord(
        record_id=f"component-replacement:{command.transaction_id}",
        payload={
            "entityType": "component_replacement",
            "entityId": command.transaction_id,
            "action": "incident_replacement_completed",
            "actor": command.technician,
            "occurredAt": now.isoformat(),
            "incidentRecordId": command.incident_record_id,
            "uavSerialNumber": command.uav_serial_number,
            "removedComponentSerial": failed_component.serial_number,
            "installedComponentSerial": replacement_component.serial_number,
        },
    ))
    database.flush()
    return {
        "transaction_id": command.transaction_id,
        "status": "completed",
        "removed_component": _component_payload(failed_component),
        "installed_component": _component_payload(replacement_component),
        "repair_incident_id": repair_incident_id,
        "uav_configuration": active_uav_configuration(database, command.uav_serial_number),
    }


def close_repair_incident(database: Session, repair_incident_id: str, performed_by: str) -> dict[str, Any]:
    repair = database.scalar(select(ComponentRepair).where(ComponentRepair.incident_record_id == repair_incident_id).with_for_update())
    if not repair:
        raise _not_found("No component repair is linked to this incident.")
    component = database.scalar(select(ComponentInstance).where(ComponentInstance.id == repair.component_id).with_for_update())
    repair_incident = database.scalar(select(IncidentRecord).where(IncidentRecord.record_id == repair_incident_id).with_for_update())
    if component.lifecycle_status not in {"sent_for_repair", "under_repair", "quality_check", "repaired"}:
        raise _conflict("This component cannot be returned to MRLS from its current lifecycle state.")
    command = ComponentReplacementCreate(
        transaction_id=f"repair-return-{repair_incident_id}", incident_record_id=repair_incident.payload.get("parentIncidentId") or repair_incident_id,
        uav_serial_number=repair.previous_uav_serial_number or "", component_position=component.component_type,
        failed_component_serial=component.serial_number, replacement_component_serial=component.serial_number,
        reason="Repair incident closed; component returned to MRLS.", technician=performed_by, failure_date=repair.failure_date,
        customer=repair_incident.payload.get("customer"), site=None,
    )
    if component.lifecycle_status != "repaired":
        _record_movement(database, component, to_status="repaired", to_location_type="repair_facility", to_location_reference=REPAIR_LOCATION, reason="Repair work completed through repair incident closure.", command=command)
    _record_movement(database, component, to_status="mrls_available", to_location_type="mrls", to_location_reference=MRLS_LOCATION, reason="Repair incident closed; quality accepted and returned to MRLS.", command=command)
    component.customer = repair_incident.payload.get("customer") or component.customer
    component.contract_number = repair_incident.payload.get("contract") or component.contract_number
    repair.repair_status = "completed"
    repair.repair_completed_at = datetime.now(UTC)
    repair.repair_outcome = "repaired"
    repair.final_disposition = "mrls_available"
    mrls_record = database.scalar(select(ProductMasterRecord).where(ProductMasterRecord.resource == "mrls_products", ProductMasterRecord.record_id == component.serial_number))
    mrls_payload = {
        "id": component.serial_number, "product_serial_number": f"MRLS-COMP-{component.serial_number}", "part_number": component.part_number or "--",
        "sap_part_number": component.sap_part_number or "", "material_description": component.component_type, "material_serial_number": component.serial_number,
        "product_category": repair_incident.payload.get("category") or "", "customer": repair_incident.payload.get("customer") or "",
        "contract_number": repair_incident.payload.get("contract") or "", "quantity": "1", "unit_of_measurement": "EA",
        "remarks": f"Repaired component returned from {repair_incident_id}",
    }
    if mrls_record:
        mrls_record.payload = mrls_payload
    else:
        database.add(ProductMasterRecord(resource="mrls_products", record_id=component.serial_number, payload=mrls_payload))
    _audit(database, component.serial_number, "returned_to_mrls", performed_by, {"repairIncidentId": repair_incident_id, "customer": mrls_payload["customer"], "contractNumber": mrls_payload["contract_number"]})
    database.flush()
    return {"component": _component_payload(component), "repair_incident_id": repair_incident_id}


def attach_repair_to_incident(database: Session, source_incident_id: str, repair_incident_id: str) -> dict[str, Any]:
    repair_incident = database.scalar(select(IncidentRecord).where(IncidentRecord.record_id == repair_incident_id).with_for_update())
    if not repair_incident:
        raise _not_found("Follow-up repair incident was not found.")
    repair = database.scalar(select(ComponentRepair).where(ComponentRepair.incident_record_id == source_incident_id).order_by(ComponentRepair.created_at.desc()).with_for_update())
    if not repair:
        raise _not_found("No component repair was found for the original incident.")
    component = database.scalar(select(ComponentInstance).where(ComponentInstance.id == repair.component_id))
    repair.incident_record_id = repair_incident_id
    payload = dict(repair_incident.payload)
    payload["repairLifecycle"] = {**(payload.get("repairLifecycle") or {}), "repairId": repair.id, "componentSerial": component.serial_number}
    payload["auditLog"] = [*(payload.get("auditLog") or []), {"id": f"repair-linked-{repair.id}", "assignedGroup": payload.get("assignmentGroup") or "", "updatedBy": "System", "updatedAt": datetime.now(UTC).isoformat(), "changes": [{"field": "Component repair", "previous": "", "next": f"{component.serial_number} attached to this repair Incident"}]}]
    repair_incident.payload = payload
    database.flush()
    return {"repair_incident_id": repair_incident_id, "component_serial": component.serial_number}