"""Enterprise authentication and session API.

The real endpoint is provider-neutral: RSA verifies credentials, AD supplies the
profile/groups, and group-to-role mapping is persisted locally. Demo login is
kept separately so it cannot be confused with production authentication.
"""

import hmac
import os
from datetime import datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthenticationSettings, LocalAdminCredential, RoleMapping, UserSession
from app.services.authentication import AuthenticationError, AuthorizationService, DirectoryProfile, SessionManager, audit, authenticate_ad_eligibility, authenticate_enterprise, issue_demo_session, local_admin_password_status, set_local_admin_password, settings_for, verify_local_admin_password

router = APIRouter(prefix="/authentication", tags=["authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024, repr=False)
    rsa_token: str = Field(default="", max_length=1024, repr=False)

    @field_validator("username")
    @classmethod
    def normalized_username(cls, value: str) -> str:
        value = value.strip()
        if not value or any(character in value for character in "\r\n\x00"):
            raise ValueError("Username is invalid.")
        return value


class AdEligibilityLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or any(character in value for character in "\r\n\x00"):
            raise ValueError("Email is invalid.")
        return value


class DemoLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    display_name: str = Field(min_length=1, max_length=255)
    email: str = Field(default="", max_length=320)
    password: str = Field(default="", max_length=1024, repr=False)


class RoleMappingInput(BaseModel):
    directory_group: str = Field(min_length=1, max_length=255)
    application_role: str = Field(min_length=1, max_length=100)
    enabled: bool = True


class AuthenticationSettingsInput(BaseModel):
    provider: str = Field(default="demo", pattern="^(demo|ldap_ad|rsa_ad|azure_ad|okta|ping|auth0)$")
    enabled: bool = False
    session_timeout_minutes: int = Field(default=60, ge=5, le=1440)
    lockout_threshold: int = Field(default=5, ge=1, le=20)
    lockout_minutes: int = Field(default=15, ge=1, le=1440)
    rate_limit_per_minute: int = Field(default=10, ge=1, le=120)


class LocalAdminPasswordStatus(BaseModel):
    configured: bool
    expires_at: datetime | None
    days_remaining: int | None
    expired: bool
    password_change_interval_days: int = 180


class LocalAdminPasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024, repr=False)
    new_password: str = Field(min_length=8, max_length=1024, repr=False)


def source_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def auth_response(profile: DirectoryProfile, roles: list[str], token: str, expires_at: datetime) -> dict:
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at.isoformat(), "user": {"username": profile.username, "display_name": profile.display_name, "email": profile.email, "groups": profile.groups, "roles": roles}}


def require_session(request: Request, database: Session = Depends(get_db)) -> dict:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip() or request.cookies.get("als50_session", "")
    try:
        return SessionManager().verify(database, token)
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error


def require_csrf(request: Request) -> None:
    if request.cookies.get("als50_session") and request.headers.get("X-CSRF-Token") != request.cookies.get("als50_csrf"):
        raise HTTPException(status_code=403, detail={"code": "CSRF_VALIDATION_FAILED", "message": "CSRF validation failed."})


def require_administrator(claims: dict = Depends(require_session)) -> None:
    try:
        AuthorizationService().require_any_role(claims, {"Administrator"})
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, database: Session = Depends(get_db)) -> dict:
    try:
        profile, roles, token, expires_at = authenticate_enterprise(database, body.username, body.password, body.rsa_token, source_ip(request))
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error
    max_age = int((expires_at - datetime.now(expires_at.tzinfo)).total_seconds())
    response.set_cookie("als50_session", token, httponly=True, secure=request.url.scheme == "https", samesite="strict", max_age=max_age, path="/")
    response.set_cookie("als50_csrf", __import__("secrets").token_urlsafe(32), httponly=False, secure=request.url.scheme == "https", samesite="strict", max_age=max_age, path="/")
    return auth_response(profile, roles, token, expires_at)


@router.post("/ad-eligibility-login")
def ad_eligibility_login(body: AdEligibilityLoginRequest, request: Request, response: Response, database: Session = Depends(get_db)) -> dict:
    identity_header = os.getenv("AD_TRUSTED_IDENTITY_HEADER", "X-Remote-User")
    trusted_identity = request.headers.get(identity_header, "")
    if not trusted_identity:
        raise HTTPException(status_code=401, detail={"code": "AD_IDENTITY_REQUIRED", "message": "A trusted Active Directory identity is required."})
    try:
        profile, roles, token, expires_at = authenticate_ad_eligibility(database, body.email, trusted_identity, source_ip(request))
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error
    max_age = int((expires_at - datetime.now(expires_at.tzinfo)).total_seconds())
    response.set_cookie("als50_session", token, httponly=True, secure=request.url.scheme == "https", samesite="strict", max_age=max_age, path="/")
    response.set_cookie("als50_csrf", __import__("secrets").token_urlsafe(32), httponly=False, secure=request.url.scheme == "https", samesite="strict", max_age=max_age, path="/")
    return auth_response(profile, roles, token, expires_at)


@router.post("/demo-login")
def demo_login(body: DemoLoginRequest, request: Request, database: Session = Depends(get_db)) -> dict:
    settings = settings_for(database)
    if settings.enabled and settings.provider != "demo":
        raise HTTPException(status_code=403, detail={"code": "DEMO_LOGIN_DISABLED", "message": "Demo login is disabled when enterprise authentication is enabled."})
    demo_password = os.getenv("UAT_DEMO_PASSWORD", "")
    if demo_password and not hmac.compare_digest(body.password, demo_password):
        raise HTTPException(status_code=401, detail={"code": "AUTH_INVALID_CREDENTIALS", "message": "Username or password is invalid."})
    try:
        profile = DirectoryProfile(username=body.username, display_name=body.display_name, email=body.email, groups=[])
        token, roles, expires_at = issue_demo_session(database, profile, source_ip(request))
        return auth_response(profile, roles, token, expires_at)
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error


@router.post("/logout")
def logout(request: Request, response: Response, claims: dict = Depends(require_session), _: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict:
    session = database.scalar(select(UserSession).where(UserSession.session_id == claims["sid"]))
    if session:
        session.revoked_at = datetime.now(session.expires_at.tzinfo)
        database.commit()
    audit(database, event_type="logout", outcome="success", username=claims["sub"], provider="session", source_ip=source_ip(request), correlation_id="session-logout")
    response.delete_cookie("als50_session", path="/")
    response.delete_cookie("als50_csrf", path="/")
    return {"status": "ok"}


@router.get("/me")
def current_session(claims: dict = Depends(require_session)) -> dict:
    return {"username": claims["sub"], "roles": claims["roles"], "expires_at": datetime.fromtimestamp(claims["exp"], UTC).isoformat()}


@router.get("/health")
def authentication_health(database: Session = Depends(get_db)) -> dict:
    from app.services.authentication import validate_admin_configuration
    settings = settings_for(database)
    auth_secret_configured = bool(os.getenv("AUTH_JWT_SECRET"))
    ldap_configured = all(os.getenv(variable) for variable in ("LDAP_SERVER_URI", "LDAP_BASE_DN", "LDAP_BIND_DN", "LDAP_BIND_PASSWORD", "LDAP_USER_DOMAIN"))
    provider_configured = settings.provider == "demo" or (settings.provider in {"ldap_ad", "rsa_ad"} and auth_secret_configured and ldap_configured)
    admin_config = validate_admin_configuration(database)

    return {
        "status": "ok",
        "provider": str(settings.provider) if settings.provider else "demo",
        "enforced": bool(settings.enabled),
        "live_provider_configured": provider_configured,
        "auth_secret_configured": auth_secret_configured,
        "ldap_configured": ldap_configured,
        "admin_password_configured": admin_config["admin_password_set"],
        "admin_authentication_warning": "Admin password not configured!" if (settings.enabled and not admin_config["admin_password_set"]) else None,
    }


@router.get("/local-admin-password", response_model=LocalAdminPasswordStatus)
def get_local_admin_password_status(_: None = Depends(require_administrator), database: Session = Depends(get_db)) -> dict:
    return {**local_admin_password_status(database), "password_change_interval_days": 180}


@router.put("/local-admin-password", response_model=LocalAdminPasswordStatus)
def update_local_admin_password(body: LocalAdminPasswordUpdate, request: Request, claims: dict = Depends(require_session), _: None = Depends(require_csrf), database: Session = Depends(get_db)) -> dict:
    try:
        AuthorizationService().require_any_role(claims, {"Administrator"})
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error
    if hmac.compare_digest(body.current_password, body.new_password):
        raise HTTPException(status_code=400, detail={"code": "ADMIN_PASSWORD_REUSED", "message": "Choose a new administrator password."})
    credential = database.get(LocalAdminCredential, 1)
    bootstrap_password = os.getenv("UAT_LOCAL_ADMIN_PASSWORD", "")
    current_password_valid = verify_local_admin_password(body.current_password, credential.password_hash) if credential else bool(bootstrap_password) and hmac.compare_digest(body.current_password, bootstrap_password)
    if not current_password_valid:
        raise HTTPException(status_code=401, detail={"code": "AUTH_INVALID_CREDENTIALS", "message": "Current administrator password is invalid."})
    try:
        set_local_admin_password(database, body.new_password)
        audit(database, event_type="admin_password_changed", outcome="success", username=claims["sub"], provider="local_admin", source_ip=source_ip(request), correlation_id=__import__("secrets").token_hex(16))
    except AuthenticationError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message}) from error
    return {**local_admin_password_status(database), "password_change_interval_days": 180}


@router.get("/settings")
def get_settings(_: None = Depends(require_administrator), database: Session = Depends(get_db)) -> AuthenticationSettingsInput:
    return AuthenticationSettingsInput.model_validate(settings_for(database), from_attributes=True)


@router.put("/settings")
def update_settings(body: AuthenticationSettingsInput, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> AuthenticationSettingsInput:
    settings = settings_for(database)
    for field, value in body.model_dump().items():
        setattr(settings, field, value)
    database.commit()
    database.refresh(settings)
    return AuthenticationSettingsInput.model_validate(settings, from_attributes=True)


@router.get("/role-mappings")
def list_role_mappings(_: None = Depends(require_administrator), database: Session = Depends(get_db)) -> list[RoleMappingInput]:
    return [RoleMappingInput.model_validate(mapping, from_attributes=True) for mapping in database.scalars(select(RoleMapping).order_by(RoleMapping.directory_group)).all()]


@router.put("/role-mappings/{directory_group}")
def save_role_mapping(directory_group: str, body: RoleMappingInput, _: None = Depends(require_administrator), csrf: None = Depends(require_csrf), database: Session = Depends(get_db)) -> RoleMappingInput:
    if directory_group != body.directory_group:
        raise HTTPException(status_code=400, detail={"code": "AUTH_VALIDATION_ERROR", "message": "Path and body group names must match."})
    mapping = database.scalar(select(RoleMapping).where(RoleMapping.directory_group == directory_group)) or RoleMapping(directory_group=directory_group, application_role=body.application_role)
    mapping.application_role, mapping.enabled = body.application_role, body.enabled
    database.add(mapping)
    database.commit()
    return RoleMappingInput.model_validate(mapping, from_attributes=True)