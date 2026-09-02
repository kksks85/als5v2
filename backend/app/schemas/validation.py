"""Input validation schemas with security hardening (Fix #11).

Comprehensive data validation to prevent injection attacks,
buffer overflows, and malformed input processing.
"""

from typing import Optional, Any
from pydantic import BaseModel, Field, validator, conlist
import re


class SecurityConfig:
    """Security configuration for schema validation."""
    
    # Maximum string lengths to prevent buffer overflows
    MAX_FIELD_LENGTH = 512
    MAX_LONG_FIELD_LENGTH = 4096
    MAX_ARRAY_LENGTH = 100
    MAX_PHONE_LENGTH = 20
    MAX_EMAIL_LENGTH = 254
    
    # Pattern for alphanumeric IDs
    ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
    
    # Pattern for email validation
    EMAIL_PATTERN = re.compile(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    )
    
    # Pattern for phone numbers
    PHONE_PATTERN = re.compile(r"^[\d\-\+\(\)\s]{7,20}$")
    
    # Dangerous SQL patterns to detect
    SQL_INJECTION_PATTERNS = [
        r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
        r"(--|#|;|\*|\/\*|\*\/)",
        r"(\bOR\b.*=.*)",
        r"(1\s*=\s*1)",
    ]
    
    @staticmethod
    def validate_no_sql_injection(value: str) -> bool:
        """Check if string contains potential SQL injection patterns."""
        for pattern in SecurityConfig.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return False
        return True
    
    @staticmethod
    def validate_no_special_chars(value: str, allowed_chars: str = "") -> bool:
        """Check if string contains only allowed characters."""
        pattern = f"^[a-zA-Z0-9_\\-{allowed_chars}]*$"
        return bool(re.match(pattern, value))


class RecordInput(BaseModel):
    """Input validation for record data (Fix #11: Input Validation)."""
    
    # Core record fields
    resource_type: str = Field(
        ..., 
        min_length=1, 
        max_length=64,
        description="Type of resource (customer, incident, etc.)"
    )
    record_id: Optional[str] = Field(
        None,
        max_length=64,
        description="Unique record identifier"
    )
    
    # Content validation
    data: dict = Field(
        default_factory=dict,
        description="Record data payload"
    )
    
    @validator("resource_type")
    def validate_resource_type(cls, v: str) -> str:
        """Validate resource type is alphanumeric with underscores."""
        if not SecurityConfig.validate_no_special_chars(v):
            raise ValueError("resource_type must be alphanumeric")
        return v.lower()
    
    @validator("record_id")
    def validate_record_id(cls, v: str) -> str:
        """Validate record ID format."""
        if v and not SecurityConfig.ID_PATTERN.match(v):
            raise ValueError("record_id must match alphanumeric pattern")
        return v
    
    @validator("data", pre=True)
    def validate_data_size(cls, v: dict) -> dict:
        """Prevent excessively large payloads."""
        if not isinstance(v, dict):
            raise ValueError("data must be a dictionary")
        
        # Check payload size (5MB limit)
        import json
        payload_size = len(json.dumps(v).encode('utf-8'))
        if payload_size > 5 * 1024 * 1024:
            raise ValueError("Payload too large (max 5MB)")
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "resource_type": "customer",
                "record_id": "cust-001",
                "data": {"name": "Example Customer", "email": "test@example.com"}
            }
        }


class ComponentInput(BaseModel):
    """Input validation for component data (Fix #11)."""
    
    serial_number: str = Field(
        ...,
        min_length=5,
        max_length=50,
        description="Component serial number"
    )
    component_type: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Type of component"
    )
    status: str = Field(
        default="unknown",
        max_length=50,
        description="Current component status"
    )
    metadata: Optional[dict] = Field(
        default_factory=dict,
        description="Additional component metadata"
    )
    
    @validator("serial_number")
    def validate_serial_number(cls, v: str) -> str:
        """Validate serial number format."""
        # Allow alphanumeric, dashes, and hyphens
        if not SecurityConfig.validate_no_special_chars(v, "-"):
            raise ValueError("serial_number contains invalid characters")
        if len(v) > SecurityConfig.MAX_FIELD_LENGTH:
            raise ValueError(f"serial_number too long (max {SecurityConfig.MAX_FIELD_LENGTH})")
        return v.upper()
    
    @validator("component_type")
    def validate_component_type(cls, v: str) -> str:
        """Validate component type."""
        if not SecurityConfig.validate_no_special_chars(v, "/ "):
            raise ValueError("component_type contains invalid characters")
        return v
    
    @validator("status")
    def validate_status(cls, v: str) -> str:
        """Validate status is in allowed values."""
        allowed_statuses = ["unknown", "operational", "damaged", "repaired", "replaced", "retired"]
        if v.lower() not in allowed_statuses:
            raise ValueError(f"status must be one of: {', '.join(allowed_statuses)}")
        return v.lower()


class UserInput(BaseModel):
    """Input validation for user data (Fix #11)."""
    
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Username"
    )
    email: str = Field(
        ...,
        max_length=254,
        description="Email address"
    )
    display_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Display name"
    )
    
    @validator("username")
    def validate_username(cls, v: str) -> str:
        """Validate username format."""
        if not SecurityConfig.validate_no_special_chars(v, "_."):
            raise ValueError("username contains invalid characters")
        return v.lower()
    
    @validator("email")
    def validate_email(cls, v: str) -> str:
        """Validate email format."""
        if not SecurityConfig.EMAIL_PATTERN.match(v):
            raise ValueError("Invalid email format")
        return v.lower()
    
    @validator("display_name")
    def validate_display_name(cls, v: str) -> str:
        """Validate display name."""
        if v and len(v) > SecurityConfig.MAX_FIELD_LENGTH:
            raise ValueError(f"display_name too long")
        return v


class PaginationInput(BaseModel):
    """Input validation for pagination (Fix #11)."""
    
    skip: int = Field(default=0, ge=0, le=100000)
    limit: int = Field(default=50, ge=1, le=1000)
    
    @validator("skip")
    def validate_skip(cls, v: int) -> int:
        """Validate skip parameter."""
        if v < 0:
            raise ValueError("skip must be non-negative")
        if v > 1000000:
            raise ValueError("skip value too large")
        return v
    
    @validator("limit")
    def validate_limit(cls, v: int) -> int:
        """Validate limit parameter."""
        if v < 1:
            raise ValueError("limit must be at least 1")
        if v > 1000:
            raise ValueError("limit cannot exceed 1000")
        return v


class FilterInput(BaseModel):
    """Input validation for filters (Fix #11)."""
    
    field: str = Field(..., max_length=64)
    operator: str = Field(..., max_length=10)
    value: Any = Field(...)
    
    @validator("field")
    def validate_field(cls, v: str) -> str:
        """Validate field name."""
        if not SecurityConfig.validate_no_special_chars(v, "_"):
            raise ValueError("field contains invalid characters")
        return v
    
    @validator("operator")
    def validate_operator(cls, v: str) -> str:
        """Validate operator."""
        allowed_operators = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "startswith"]
        if v not in allowed_operators:
            raise ValueError(f"operator must be one of: {', '.join(allowed_operators)}")
        return v


class BulkOperationInput(BaseModel):
    """Input validation for bulk operations (Fix #11)."""
    
    operations: conlist(dict, min_items=1, max_items=100) = Field(
        ...,
        description="List of operations (max 100)"
    )
    
    @validator("operations")
    def validate_operations(cls, v: list) -> list:
        """Validate each operation."""
        for i, op in enumerate(v):
            if not isinstance(op, dict):
                raise ValueError(f"Operation {i} must be a dictionary")
            if len(op) > 1000:
                raise ValueError(f"Operation {i} too large")
        return v


# Export all validators
__all__ = [
    "SecurityConfig",
    "RecordInput",
    "ComponentInput", 
    "UserInput",
    "PaginationInput",
    "FilterInput",
    "BulkOperationInput",
]
