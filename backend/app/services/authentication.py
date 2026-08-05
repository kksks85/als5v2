"""Provider-neutral enterprise authentication services.

Secrets are accepted only long enough to authenticate and are never retained,
included in exceptions, audit records, or application logs.
"""

from __future__ import annotations

import os
import secrets
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

import jwt
from ldap3 import Connection, Server, Tls
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthenticationAuditLog, AuthenticationSettings, RoleMapping, UserSession


class AuthenticationError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 401):
        self.code, self.message, self.status_code = code, message, status_code
        super().__init__(message)


@dataclass(frozen=True)
class DirectoryProfile:
    username: str
    display_name: str
    email: str
    groups: list[str]


class RsaConnector(Protocol):
    def authenticate(self, username: str, password: str, token: str) -> None: ...


class DirectoryConnector(Protocol):
    def find_user(self, username: str) -> DirectoryProfile: ...


class RsaAuthenticationManagerConnector:
    """RSA AM adapter boundary. Configure an approved RSA REST/SOAP adapter here.

    The connector intentionally fails closed until a production adapter is supplied.
    This prevents a partially configured deployment from accepting credentials.
    """
    def authenticate(self, username: str, password: str, token: str) -> None:
        raise AuthenticationError("AUTH_PROVIDER_UNAVAILABLE", "RSA Authentication Manager is not configured.", 503)


class ActiveDirectoryLdapConnector:
    def find_user(self, username: str) -> DirectoryProfile:
        server_uri = os.getenv("LDAP_SERVER_URI")
        base_dn = os.getenv("LDAP_BASE_DN")
        bind_dn = os.getenv("LDAP_BIND_DN")
        bind_password = os.getenv("LDAP_BIND_PASSWORD")
        if not all((server_uri, base_dn, bind_dn, bind_password)):
            raise AuthenticationError("DIRECTORY_UNAVAILABLE", "Active Directory is not configured.", 503)
        if not server_uri.lower().startswith("ldaps://"):
            raise AuthenticationError("DIRECTORY_TLS_REQUIRED", "LDAP must use LDAPS.", 503)
        server = Server(server_uri, use_ssl=True, tls=Tls(validate=2))
        with Connection(server, user=bind_dn, password=bind_password, auto_bind=True) as connection:
            escaped_username = username.replace("\\", "\\5c").replace("*", "\\2a").replace("(", "\\28").replace(")", "\\29")
            connection.search(base_dn, f"(&(objectClass=user)(sAMAccountName={escaped_username}))", attributes=["displayName", "mail", "memberOf", "sAMAccountName"])
            if not connection.entries:
                raise AuthenticationError("DIRECTORY_USER_NOT_FOUND", "Directory profile was not found.")
            entry = connection.entries[0]
            return DirectoryProfile(username=str(entry.sAMAccountName), display_name=str(entry.displayName or username), email=str(entry.mail or ""), groups=[str(group) for group in entry.memberOf])


class RateLimiter:
    def __init__(self) -> None:
        self._attempts: dict[str, deque[datetime]] = defaultdict(deque)

    def allow(self, key: str, per_minute: int) -> bool:
        now = datetime.now(UTC)
        attempts = self._attempts[key]
        while attempts and attempts[0] < now - timedelta(minutes=1):
            attempts.popleft()
        if len(attempts) >= per_minute:
            return False
        attempts.append(now)
        return True


rate_limiter = RateLimiter()


def settings_for(database: Session) -> AuthenticationSettings:
    settings = database.get(AuthenticationSettings, 1)
    if not settings:
        settings = AuthenticationSettings(
            id=1,
            provider="demo",
            enabled=False,
            session_timeout_minutes=60,
            lockout_threshold=5,
            lockout_minutes=15,
            rate_limit_per_minute=10,
        )
        database.add(settings)
        database.commit()
        database.refresh(settings)
    return settings


def audit(database: Session, *, event_type: str, outcome: str, username: str | None, provider: str, source_ip: str | None, correlation_id: str, details: dict | None = None) -> None:
    database.add(AuthenticationAuditLog(event_type=event_type, outcome=outcome, username=username, provider=provider, source_ip=source_ip, correlation_id=correlation_id, details=details or {}))
    database.commit()


def mapped_roles(database: Session, groups: list[str]) -> list[str]:
    mappings = database.scalars(select(RoleMapping).where(RoleMapping.enabled.is_(True), RoleMapping.directory_group.in_(groups))).all()
    return sorted({mapping.application_role for mapping in mappings})


class ConfigurationManager:
    """Reads the singleton, non-secret authentication policy from PostgreSQL."""
    def get(self, database: Session) -> AuthenticationSettings:
        return settings_for(database)


class SessionManager:
    """Creates and verifies signed sessions while enforcing server-side revocation."""
    def create(self, database: Session, profile: DirectoryProfile, roles: list[str], timeout_minutes: int) -> tuple[str, str, datetime]:
        return issue_session(database, profile, roles, timeout_minutes)

    def verify(self, database: Session, token: str) -> dict:
        secret = os.getenv("AUTH_JWT_SECRET")
        if not secret:
            raise AuthenticationError("AUTH_SECRET_MISSING", "Authentication signing key is not configured.", 503)
        try:
            claims = jwt.decode(token, secret, algorithms=["HS256"], issuer="als50")
        except jwt.PyJWTError as error:
            raise AuthenticationError("SESSION_INVALID", "Session is invalid or expired.") from error
        session = database.scalar(select(UserSession).where(UserSession.session_id == claims.get("sid")))
        if not session or session.revoked_at or session.expires_at <= datetime.now(UTC):
            raise AuthenticationError("SESSION_INVALID", "Session is invalid or expired.")
        return claims


class AuthorizationService:
    """Provider-agnostic role enforcement for protected business endpoints."""
    def require_any_role(self, claims: dict, allowed_roles: set[str]) -> None:
        if not allowed_roles.intersection(claims.get("roles", [])):
            raise AuthenticationError("AUTHORIZATION_DENIED", "The session does not have the required role.", 403)


def lockout_active(database: Session, username: str, settings: AuthenticationSettings) -> bool:
    cutoff = datetime.now(UTC) - timedelta(minutes=settings.lockout_minutes)
    failures = database.scalars(select(AuthenticationAuditLog).where(AuthenticationAuditLog.username == username, AuthenticationAuditLog.event_type == "login", AuthenticationAuditLog.outcome == "failure", AuthenticationAuditLog.created_at >= cutoff)).all()
    invalid_credentials = sum(1 for failure in failures if failure.details.get("code") == "AUTH_INVALID_CREDENTIALS")
    return invalid_credentials >= settings.lockout_threshold


def issue_session(database: Session, profile: DirectoryProfile, roles: list[str], timeout_minutes: int) -> tuple[str, str, datetime]:
    secret = os.getenv("AUTH_JWT_SECRET")
    if not secret or len(secret) < 32:
        raise AuthenticationError("AUTH_SECRET_MISSING", "Authentication signing key is not configured.", 503)
    if os.getenv("APP_ENV", "development").lower() != "development" and secret == "development-only-signing-key-replace-before-production":
        raise AuthenticationError("AUTH_SECRET_MISSING", "Authentication signing key is not configured.", 503)
    expires_at = datetime.now(UTC) + timedelta(minutes=timeout_minutes)
    session_id = secrets.token_urlsafe(32)
    token = jwt.encode({"sub": profile.username, "sid": session_id, "roles": roles, "exp": expires_at, "iat": datetime.now(UTC), "iss": "als50"}, secret, algorithm="HS256")
    database.add(UserSession(session_id=session_id, username=profile.username, roles=roles, expires_at=expires_at))
    database.commit()
    return token, session_id, expires_at


def authenticate_enterprise(database: Session, username: str, password: str, rsa_token: str, source_ip: str | None, rsa: RsaConnector | None = None, directory: DirectoryConnector | None = None) -> tuple[DirectoryProfile, list[str], str, datetime]:
    settings = settings_for(database)
    correlation_id = secrets.token_hex(16)
    if not rate_limiter.allow(f"{source_ip}:{username}", settings.rate_limit_per_minute):
        audit(database, event_type="login", outcome="rate_limited", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again later.", 429)
    if lockout_active(database, username, settings):
        audit(database, event_type="login", outcome="locked_out", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_LOCKED", "Account is temporarily locked. Try again later.", 423)
    try:
        (rsa or RsaAuthenticationManagerConnector()).authenticate(username, password, rsa_token)
        profile = (directory or ActiveDirectoryLdapConnector()).find_user(username)
        roles = mapped_roles(database, profile.groups)
        if not roles:
            raise AuthenticationError("AUTHORIZATION_DENIED", "No application role is mapped to this account.", 403)
        token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
        audit(database, event_type="login", outcome="success", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"roles": roles})
        return profile, roles, token, expires_at
    except AuthenticationError as error:
        audit(database, event_type="login", outcome="failure", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"code": error.code})
        raise


def issue_demo_session(database: Session, profile: DirectoryProfile, source_ip: str | None) -> tuple[str, list[str], datetime]:
    settings = settings_for(database)
    roles = ["Administrator"] if profile.username.lower().startswith("als-emp-001") else ["Service User"]
    token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
    audit(database, event_type="demo_login", outcome="success", username=profile.username, provider="demo", source_ip=source_ip, correlation_id=secrets.token_hex(16), details={"roles": roles})
    return token, roles, expires_at