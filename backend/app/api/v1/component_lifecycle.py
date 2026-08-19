from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.domain import ComponentQualityDecision, ComponentReceiptCreate, ComponentRepairUpdate, ComponentReplacementCreate
from app.services.component_lifecycle import active_uav_configuration, attach_repair_to_incident, close_repair_incident, component_detail, list_components, perform_replacement, quality_decision, receive_component, repair_queue, update_repair

router = APIRouter(prefix="/component-lifecycle", tags=["component-lifecycle"])


@router.get("/components")
def get_components(lifecycle_status: str | None = None, component_type: str | None = None, customer: str | None = None, contract_number: str | None = None, database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    return {"items": list_components(database, lifecycle_status, component_type, customer, contract_number)}


@router.get("/mrls")
def get_mrls_components(component_type: str | None = None, customer: str | None = None, contract_number: str | None = None, database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    return {"items": list_components(database, "mrls_available", component_type, customer, contract_number)}


@router.get("/components/{serial_number}")
def get_component(serial_number: str, database: Session = Depends(get_db)) -> dict[str, Any]:
    return component_detail(database, serial_number)


@router.get("/repairs")
def get_repair_queue(database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    return {"items": repair_queue(database)}


@router.get("/uavs/{uav_serial_number}/configuration")
def get_uav_configuration(uav_serial_number: str, database: Session = Depends(get_db)) -> dict[str, list[dict[str, Any]]]:
    return {"items": active_uav_configuration(database, uav_serial_number)}


@router.post("/replacements")
def create_replacement(command: ComponentReplacementCreate, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = perform_replacement(database, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/receipts")
def create_component_receipt(command: ComponentReceiptCreate, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = receive_component(database, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/components/{serial_number}/quality")
def decide_component_quality(serial_number: str, command: ComponentQualityDecision, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = quality_decision(database, serial_number, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/repairs/{repair_id}/{action}")
def progress_component_repair(repair_id: int, action: str, command: ComponentRepairUpdate, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = update_repair(database, repair_id, action, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/repairs/by-incident/{repair_incident_id}/close")
def close_component_repair_incident(repair_incident_id: str, performed_by: str, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = close_repair_incident(database, repair_incident_id, performed_by)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/repairs/attach")
def attach_component_repair(source_incident_id: str, repair_incident_id: str, database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = attach_repair_to_incident(database, source_incident_id, repair_incident_id)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise