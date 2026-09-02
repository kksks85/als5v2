"""Authorization and access control service for IDOR prevention and role-based access."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Record  # Assuming you have this model


class AuthorizationService:
    """Centralized authorization logic for role-based access control and IDOR prevention."""

    @staticmethod
    def require_admin(claims: dict) -> None:
        """Ensure user has Administrator role."""
        if "Administrator" not in claims.get("roles", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator role required for this operation"
            )

    @staticmethod
    def require_any_role(claims: dict, required_roles: list[str]) -> None:
        """Ensure user has at least one of the required roles."""
        user_roles = set(claims.get("roles", []))
        if not user_roles.intersection(set(required_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of the following roles required: {', '.join(required_roles)}"
            )

    @staticmethod
    def can_access_record(
        claims: dict,
        record: Record,
        database: Session,
        require_owner: bool = False
    ) -> bool:
        """
        Check if user can access a specific record.
        
        Args:
            claims: JWT claims containing user_id and roles
            record: The record being accessed
            database: Database session
            require_owner: If True, user must own the record (not just be admin)
        
        Returns:
            True if user can access the record
        """
        user_id = claims.get("sub")  # JWT standard: 'sub' is subject (user ID)
        user_roles = set(claims.get("roles", []))

        # Administrators can access any record
        if "Administrator" in user_roles and not require_owner:
            return True

        # Check record ownership
        if hasattr(record, "owner_id"):
            return record.owner_id == user_id

        # Check if user is in record's access list (if applicable)
        if hasattr(record, "allowed_users"):
            return user_id in record.allowed_users

        # Default: deny access
        return False

    @staticmethod
    def can_modify_record(
        claims: dict,
        record: Record,
        database: Session
    ) -> bool:
        """Check if user can modify a record."""
        user_roles = set(claims.get("roles", []))

        # Administrators can modify any record
        if "Administrator" in user_roles:
            return True

        # Check record ownership for modifications
        if hasattr(record, "owner_id"):
            return record.owner_id == claims.get("sub")

        return False

    @staticmethod
    def can_delete_record(
        claims: dict,
        record: Record,
        database: Session
    ) -> bool:
        """Check if user can delete a record."""
        user_roles = set(claims.get("roles", []))

        # Only Administrators can delete records
        if "Administrator" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can delete records"
            )

        return True

    @staticmethod
    def can_access_repair_incident(
        claims: dict,
        incident_id: str,
        database: Session
    ) -> bool:
        """
        Check if user can access a repair incident.
        
        Repair Technicians can access incidents assigned to them.
        Administrators can access all incidents.
        """
        user_id = claims.get("sub")
        user_roles = set(claims.get("roles", []))

        # Administrators can access any incident
        if "Administrator" in user_roles:
            return True

        # Check if repair technician is assigned to this incident
        if "Repair Technician" in user_roles:
            # This assumes the incident has an assigned_to field
            # Adjust based on your actual incident model
            return True  # TODO: Add actual assignment check

        return False

    @staticmethod
    def can_access_customer(
        claims: dict,
        customer_id: str,
        database: Session
    ) -> bool:
        """
        Check if user can access customer data.
        
        Service Users can access their own customer records.
        Administrators can access all customers.
        """
        user_id = claims.get("sub")
        user_roles = set(claims.get("roles", []))

        # Administrators can access any customer
        if "Administrator" in user_roles:
            return True

        # Service Users can access their assigned customers
        if "Service User" in user_roles:
            # This assumes there's a customer assignment relationship
            # Adjust based on your actual customer model
            return True  # TODO: Add actual customer access check

        return False

    @staticmethod
    def get_accessible_records(
        claims: dict,
        database: Session,
        resource_type: str,
        model_class
    ) -> list:
        """
        Get list of records accessible to the user.
        
        Administrators see all records.
        Other users see only their own records.
        """
        user_id = claims.get("sub")
        user_roles = set(claims.get("roles", []))

        # Administrators see all records
        if "Administrator" in user_roles:
            return database.query(model_class).all()

        # Other users see only their own records
        if hasattr(model_class, "owner_id"):
            return database.query(model_class).filter(
                model_class.owner_id == user_id
            ).all()

        # Default: empty list
        return []

    @staticmethod
    def verify_token_claims(claims: dict) -> None:
        """
        Verify that all required claims are present in the token.
        
        Raises HTTPException if claims are invalid.
        """
        required_claims = ["sub", "roles", "exp", "iat"]
        for claim in required_claims:
            if claim not in claims:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token: missing '{claim}' claim"
                )

        # Verify roles is a list
        if not isinstance(claims.get("roles"), list):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: 'roles' must be a list"
            )

        # Verify expiration
        from datetime import datetime, timezone
        exp = claims.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )


# Dependency functions for FastAPI
def require_admin(claims: dict) -> dict:
    """FastAPI dependency to require Administrator role."""
    AuthorizationService.require_admin(claims)
    return claims


def require_any_role(required_roles: list[str]):
    """FastAPI dependency factory for role requirements."""
    def dependency(claims: dict) -> dict:
        AuthorizationService.require_any_role(claims, required_roles)
        return claims
    return dependency


def require_service_user(claims: dict) -> dict:
    """FastAPI dependency to require Service User role."""
    AuthorizationService.require_any_role(claims, ["Service User", "Administrator"])
    return claims


def require_repair_technician(claims: dict) -> dict:
    """FastAPI dependency to require Repair Technician role."""
    AuthorizationService.require_any_role(claims, ["Repair Technician", "Administrator"])
    return claims
