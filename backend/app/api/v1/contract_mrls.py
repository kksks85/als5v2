from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.authentication import require_administrator, require_session, require_csrf
from app.database import get_db
from app.schemas.domain import ContractMrlsGenerate, ContractMrlsLineCreate, ContractSave
from app.services.contract_mrls import create_contract_mrls_line, delete_contract_with_mrls_records, generate_contract_mrls_components, list_contract_mrls_lines, save_contract_with_mrls_records

router = APIRouter(prefix="/contract-mrls", tags=["contract-mrls"])


@router.put("/contracts/{record_id}")
def save_contract(record_id: str, command: ContractSave, claims: dict = Depends(require_session), _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = save_contract_with_mrls_records(database, record_id, command, claims["sub"])
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.delete("/contracts/{record_id}")
def delete_contract(record_id: str, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, str]:
    try:
        delete_contract_with_mrls_records(database, record_id)
        database.commit()
        return {"status": "deleted", "record_id": record_id}
    except Exception:
        database.rollback()
        raise


@router.get("/contracts/{contract_id}/lines")
def get_contract_mrls_lines(contract_id: int, database: Session = Depends(get_db), claims: dict = Depends(require_session)) -> dict[str, list[dict[str, Any]]]:
    return {"items": list_contract_mrls_lines(database, contract_id)}


@router.post("/contracts/{contract_id}/lines")
def add_contract_mrls_line(contract_id: int, command: ContractMrlsLineCreate, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = create_contract_mrls_line(database, contract_id, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise


@router.post("/lines/{line_id}/generate")
def generate_contract_mrls(line_id: int, command: ContractMrlsGenerate, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = generate_contract_mrls_components(database, line_id, command)
        database.commit()
        return result
    except Exception:
        database.rollback()
        raise