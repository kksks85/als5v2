from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, EmailStr, Field, model_validator


class ContractCoverageType(StrEnum):
    AMC = "AMC"
    CMC = "CMC"


class ProductAttributeType(StrEnum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    SELECT = "select"


class IncidentPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    AWAITING_CUSTOMER = "awaiting_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Address(BaseModel):
    line_1: str = Field(min_length=1, max_length=200)
    line_2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    region: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=30)
    country: str = Field(min_length=2, max_length=100)


class SiteContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    job_title: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    is_primary: bool = False


class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: Address
    contacts: list[SiteContactCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def has_at_most_one_primary_contact(self) -> "SiteCreate":
        if sum(contact.is_primary for contact in self.contacts) > 1:
            raise ValueError("A site may have only one primary contact.")
        return self


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    customer_code: str = Field(pattern=r"^[A-Z0-9]{2,12}$")
    headquarters_address: Address
    incident_number_template: str = "{{customer_code}}/{{year}}/{{sequence:3}}"
    sites: list[SiteCreate] = Field(default_factory=list)


class ServiceCoverageCreate(BaseModel):
    coverage_type: ContractCoverageType
    starts_on: date | None = None
    ends_on: date | None = None
    features: list[str] = Field(default_factory=list, max_length=50)


class ContractCreate(BaseModel):
    customer_id: int
    contract_number: str = Field(min_length=1, max_length=80)
    signed_on: date
    commences_on: date
    jri_date: date
    duration_months: int = Field(default=24, ge=1, le=120)
    expires_on: date
    warranty_expires_on: date
    service_coverages: list[ServiceCoverageCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def dates_are_ordered(self) -> "ContractCreate":
        if self.expires_on < self.commences_on:
            raise ValueError("Contract expiration cannot be before commencement.")
        if self.warranty_expires_on < self.jri_date:
            raise ValueError("Warranty expiration cannot be before the JRI date.")
        return self


class ProductAttributeDefinitionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,49}$")
    data_type: ProductAttributeType
    required: bool = False
    display_order: int = Field(default=0, ge=0)
    options: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def selection_options_are_configured(self) -> "ProductAttributeDefinitionCreate":
        if self.data_type is ProductAttributeType.SELECT and not self.options:
            raise ValueError("Selection attributes require at least one option.")
        if self.data_type is not ProductAttributeType.SELECT and self.options:
            raise ValueError("Only selection attributes may have options.")
        return self


class IncidentCreate(BaseModel):
    customer_id: int
    site_id: int
    category: str = Field(min_length=1, max_length=100)
    priority: IncidentPriority = IncidentPriority.NORMAL
    description: str = Field(min_length=1, max_length=5000)
    assignee_id: int | None = None
    acknowledgement_by: datetime | None = None
    resolution_by: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
