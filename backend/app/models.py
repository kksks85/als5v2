from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RecordMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomerRecord(RecordMixin, Base):
    __tablename__ = "customers"


class ContractRecord(RecordMixin, Base):
    __tablename__ = "contracts"


class SubcontractRecord(RecordMixin, Base):
    __tablename__ = "subcontracts"


class ProductRecord(RecordMixin, Base):
    __tablename__ = "products"


class ProductMasterRecord(Base):
    __tablename__ = "product_master_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource: Mapped[str] = mapped_column(String(80), index=True)
    record_id: Mapped[str] = mapped_column(String(160))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProductAssetRecord(RecordMixin, Base):
    __tablename__ = "product_assets"


class ComponentInstance(Base):
    __tablename__ = "component_instances"

    id: Mapped[int] = mapped_column(primary_key=True)
    serial_number: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    component_type: Mapped[str] = mapped_column(String(160), index=True)
    subsystem: Mapped[str | None] = mapped_column(String(160))
    part_number: Mapped[str | None] = mapped_column(String(160))
    sap_part_number: Mapped[str | None] = mapped_column(String(160))
    lifecycle_status: Mapped[str] = mapped_column(String(40), index=True)
    location_type: Mapped[str] = mapped_column(String(40), index=True)
    location_reference: Mapped[str | None] = mapped_column(String(160), index=True)
    customer: Mapped[str | None] = mapped_column(String(180), index=True)
    contract_number: Mapped[str | None] = mapped_column(String(160), index=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ComponentInstallation(Base):
    __tablename__ = "component_installations"

    id: Mapped[int] = mapped_column(primary_key=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), index=True)
    uav_serial_number: Mapped[str] = mapped_column(String(160), index=True)
    component_position: Mapped[str] = mapped_column(String(160), index=True)
    customer: Mapped[str | None] = mapped_column(String(180))
    site: Mapped[str | None] = mapped_column(String(180))
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    removal_reason: Mapped[str | None] = mapped_column(Text)
    incident_record_id: Mapped[str | None] = mapped_column(String(160), index=True)


class ComponentMovement(Base):
    __tablename__ = "component_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str] = mapped_column(String(40), index=True)
    from_location_type: Mapped[str | None] = mapped_column(String(40))
    to_location_type: Mapped[str] = mapped_column(String(40), index=True)
    from_location_reference: Mapped[str | None] = mapped_column(String(160))
    to_location_reference: Mapped[str | None] = mapped_column(String(160))
    reason: Mapped[str] = mapped_column(Text)
    transaction_id: Mapped[str | None] = mapped_column(String(160), index=True)
    incident_record_id: Mapped[str | None] = mapped_column(String(160), index=True)
    performed_by: Mapped[str] = mapped_column(String(180))
    customer: Mapped[str | None] = mapped_column(String(180))
    site: Mapped[str | None] = mapped_column(String(180))
    moved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ComponentRepair(Base):
    __tablename__ = "component_repairs"

    id: Mapped[int] = mapped_column(primary_key=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), index=True)
    incident_record_id: Mapped[str] = mapped_column(String(160), index=True)
    previous_uav_serial_number: Mapped[str | None] = mapped_column(String(160))
    failure_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failure_description: Mapped[str] = mapped_column(Text)
    technician_diagnosis: Mapped[str | None] = mapped_column(Text)
    repair_request: Mapped[str | None] = mapped_column(Text)
    repair_status: Mapped[str] = mapped_column(String(40), index=True)
    repair_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    repair_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    repair_outcome: Mapped[str | None] = mapped_column(String(80))
    repair_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    replacement_parts: Mapped[dict] = mapped_column(JSONB, default=list)
    final_disposition: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ComponentReplacement(Base):
    __tablename__ = "component_replacements"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    incident_record_id: Mapped[str] = mapped_column(String(160), index=True)
    uav_serial_number: Mapped[str] = mapped_column(String(160), index=True)
    component_position: Mapped[str] = mapped_column(String(160))
    removed_component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), index=True)
    installed_component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    technician: Mapped[str] = mapped_column(String(180))
    customer: Mapped[str | None] = mapped_column(String(180))
    site: Mapped[str | None] = mapped_column(String(180))
    replaced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ComponentProcurement(Base):
    __tablename__ = "component_procurements"

    id: Mapped[int] = mapped_column(primary_key=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("component_instances.id"), unique=True, index=True)
    purchase_order_number: Mapped[str | None] = mapped_column(String(160), index=True)
    supplier: Mapped[str | None] = mapped_column(String(180))
    customer: Mapped[str | None] = mapped_column(String(180), index=True)
    contract_number: Mapped[str | None] = mapped_column(String(160), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    quality_status: Mapped[str] = mapped_column(String(40), index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_by: Mapped[str] = mapped_column(String(180))
    notes: Mapped[str | None] = mapped_column(Text)


class IncidentRecord(RecordMixin, Base):
    __tablename__ = "incidents"


class QueryRecord(RecordMixin, Base):
    __tablename__ = "queries"


class KnowledgeDocumentRecord(RecordMixin, Base):
    __tablename__ = "knowledge_documents"


class UserRecord(RecordMixin, Base):
    __tablename__ = "users"


class AssignmentGroupRecord(RecordMixin, Base):
    __tablename__ = "assignment_groups"


class NotificationRecord(RecordMixin, Base):
    __tablename__ = "notifications"


class AuditLogRecord(RecordMixin, Base):
    __tablename__ = "audit_logs"


class RepairExecutionRecord(RecordMixin, Base):
    __tablename__ = "repair_executions"


class ProcessConfigurationRecord(RecordMixin, Base):
    __tablename__ = "process_configurations"


class SystemSettingsRecord(RecordMixin, Base):
    __tablename__ = "system_settings"


class EmailSettingsRecord(RecordMixin, Base):
    __tablename__ = "email_settings"


class EmailTemplateRecord(RecordMixin, Base):
    __tablename__ = "email_templates"


class EmailLogRecord(RecordMixin, Base):
    __tablename__ = "email_logs"


class OutboundEmailRuleRecord(RecordMixin, Base):
    __tablename__ = "outbound_email_rules"


class MailCorrespondenceRecord(RecordMixin, Base):
    __tablename__ = "mail_correspondence"


class CalendarEventRecord(RecordMixin, Base):
    __tablename__ = "calendar_events"


class EntraConfiguration(Base):
    __tablename__ = "entra_configuration"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    tenant_id: Mapped[str] = mapped_column(String(80), default="")
    client_id: Mapped[str] = mapped_column(String(80), default="")
    api_scope: Mapped[str] = mapped_column(String(240), default="")
    redirect_uri: Mapped[str] = mapped_column(String(500), default="")
    admin_group_id: Mapped[str] = mapped_column(String(80), default="")
    coordinator_group_id: Mapped[str] = mapped_column(String(80), default="")
    enabled: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ApplicationSecretNotice(Base):
    __tablename__ = "application_secret_notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)


class RoleMapping(Base):
    __tablename__ = "role_mappings"

    id: Mapped[int] = mapped_column(primary_key=True)
    directory_group: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    application_role: Mapped[str] = mapped_column(String(100), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AuthenticationSettings(Base):
    __tablename__ = "authentication_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    provider: Mapped[str] = mapped_column(String(50), default="demo")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    session_timeout_minutes: Mapped[int] = mapped_column(Integer, default=60)
    lockout_threshold: Mapped[int] = mapped_column(Integer, default=5)
    lockout_minutes: Mapped[int] = mapped_column(Integer, default=15)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=10)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(255), index=True)
    roles: Mapped[dict] = mapped_column(JSONB, default=list)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthenticationAuditLog(Base):
    __tablename__ = "authentication_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    outcome: Mapped[str] = mapped_column(String(20), index=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(50))
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(64), index=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
