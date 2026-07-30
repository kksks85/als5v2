from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
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


class ProductRecord(RecordMixin, Base):
    __tablename__ = "products"


class ProductAssetRecord(RecordMixin, Base):
    __tablename__ = "product_assets"


class IncidentRecord(RecordMixin, Base):
    __tablename__ = "incidents"


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
