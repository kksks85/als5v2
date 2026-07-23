import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EntraConfiguration

router = APIRouter(prefix="/authentication/entra", tags=["authentication"])


class EntraConfigurationInput(BaseModel):
    tenant_id: str = Field(default="", max_length=80)
    client_id: str = Field(default="", max_length=80)
    api_scope: str = Field(default="", max_length=240)
    redirect_uri: str = Field(default="", max_length=500)
    admin_group_id: str = Field(default="", max_length=80)
    coordinator_group_id: str = Field(default="", max_length=80)
    enabled: bool = False


@router.get("/configuration")
def get_entra_configuration(database: Session = Depends(get_db)) -> dict:
    configuration = database.get(EntraConfiguration, 1)
    if not configuration:
        return EntraConfigurationInput().model_dump() | {"client_secret_configured": bool(os.getenv("ENTRA_CLIENT_SECRET"))}
    return EntraConfigurationInput(
        tenant_id=configuration.tenant_id,
        client_id=configuration.client_id,
        api_scope=configuration.api_scope,
        redirect_uri=configuration.redirect_uri,
        admin_group_id=configuration.admin_group_id,
        coordinator_group_id=configuration.coordinator_group_id,
        enabled=configuration.enabled,
    ).model_dump() | {"client_secret_configured": bool(os.getenv("ENTRA_CLIENT_SECRET"))}


@router.put("/configuration")
def save_entra_configuration(body: EntraConfigurationInput, database: Session = Depends(get_db)) -> dict:
    configuration = database.get(EntraConfiguration, 1) or EntraConfiguration(id=1)
    for field, value in body.model_dump().items():
        setattr(configuration, field, value)
    database.add(configuration)
    database.commit()
    return get_entra_configuration(database)
