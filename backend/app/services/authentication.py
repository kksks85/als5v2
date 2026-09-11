"""Provider-neutral enterprise authentication services.

Secrets are accepted only long enough to authenticate and are never retained,
included in exceptions, audit records, or application logs.
"""

from __future__ import annotations

import os
import secrets
import hmac
import base64
import hashlib
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

import jwt
from ldap3 import Connection, Server, Tls
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthenticationAuditLog, AuthenticationSettings, RoleMapping, UserRecord, UserSession

DEFAULT_USER_PASSWORD = "Welcome@123"
AUTH_PAYLOAD_KEY = "_authentication"
PASSWORD_ITERATIONS = 600_000


class AuthenticationError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 401):
        self.code, self.message, self.status_code = code, message, status_code
        super().__init__(message)


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_value, digest_value = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_value.encode("ascii"))
        expected = base64.b64decode(digest_value.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, base64.binascii.Error):
        return False


def auth_metadata(payload: dict) -> dict:
    metadata = payload.get(AUTH_PAYLOAD_KEY)
    return metadata if isinstance(metadata, dict) else {}


def public_user_payload(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if key != AUTH_PAYLOAD_KEY}


def find_local_user(database: Session, username: str) -> UserRecord | None:
    normalized = normalize_username(username)
    for user in database.scalars(select(UserRecord)).all():
        metadata = auth_metadata(user.payload)
        candidate = metadata.get("username") or user.payload.get("username") or user.payload.get("email")
        candidate_value = normalize_username(str(candidate)) if candidate else ""
        email_local_part = candidate_value.split("@", 1)[0] if "@" in candidate_value else ""
        if candidate_value == normalized or email_local_part == normalized:
            return user
    return None


def provision_user_credentials(payload: dict, username: str, password: str = DEFAULT_USER_PASSWORD) -> dict:
    next_payload = dict(payload)
    next_payload["username"] = username.strip()
    next_payload[AUTH_PAYLOAD_KEY] = {
        "username": normalize_username(username),
        "password_hash": hash_password(password),
        "must_change_password": True,
        "password_changed_at": None,
    }
    return next_payload


def ensure_user_credentials(database: Session, user: UserRecord) -> dict:
    metadata = auth_metadata(user.payload)
    username = metadata.get("username") or user.payload.get("username") or user.payload.get("email")
    if not username:
        raise AuthenticationError("AUTH_USER_NOT_CONFIGURED", "This user does not have a username configured.", 409)
    if not metadata.get("password_hash"):
        user.payload = provision_user_credentials(user.payload, str(username))
        database.flush()
    return auth_metadata(user.payload)


def local_profile(user: UserRecord) -> DirectoryProfile:
    payload = public_user_payload(user.payload)
    return DirectoryProfile(
        username=str(payload.get("username") or payload.get("email") or user.record_id),
        display_name=str(payload.get("name") or payload.get("displayName") or payload.get("username") or user.record_id),
        email=str(payload.get("email") or ""),
        groups=[],
    )


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

    def authenticate(self, username: str, password: str) -> DirectoryProfile:
        profile = self.find_user(username)
        server_uri = os.getenv("LDAP_SERVER_URI")
        base_dn = os.getenv("LDAP_BASE_DN")
        user_dn_template = os.getenv("LDAP_USER_DN_TEMPLATE", "{username}@{domain}")
        domain = os.getenv("LDAP_USER_DOMAIN", "")
        if not server_uri or not base_dn:
            raise AuthenticationError("DIRECTORY_UNAVAILABLE", "Active Directory is not configured.", 503)
        if not server_uri.lower().startswith("ldaps://"):
            raise AuthenticationError("DIRECTORY_TLS_REQUIRED", "LDAP must use LDAPS.", 503)
        user_dn = user_dn_template.format(username=profile.username, domain=domain)
        server = Server(server_uri, use_ssl=True, tls=Tls(validate=2))
        try:
            with Connection(server, user=user_dn, password=password, auto_bind=True):
                return profile
        except Exception as error:
            raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.") from error


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

    def verify(self, database: Session, token: str, allow_password_change: bool = False) -> dict:
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
        if claims.get("must_change_password") and not allow_password_change:
            raise AuthenticationError("PASSWORD_CHANGE_REQUIRED", "Password change is required before continuing.", 403)
        return claims

    def renew(self, database: Session, token: str) -> tuple[str, datetime]:
        claims = self.verify(database, token)
        session = database.scalar(select(UserSession).where(UserSession.session_id == claims["sid"]))
        if not session:
            raise AuthenticationError("SESSION_INVALID", "Session is invalid or expired.")
        expires_at = datetime.now(UTC) + timedelta(minutes=settings_for(database).session_timeout_minutes)
        session.expires_at = expires_at
        database.commit()
        return encode_session_token(claims, expires_at), expires_at


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


def encode_session_token(claims: dict, expires_at: datetime) -> str:
    secret = os.getenv("AUTH_JWT_SECRET")
    if not secret or len(secret) < 32:
        raise AuthenticationError("AUTH_SECRET_MISSING", "Authentication signing key is not configured.", 503)
    if os.getenv("APP_ENV", "development").lower() != "development" and secret == "development-only-signing-key-replace-before-production":
        raise AuthenticationError("AUTH_SECRET_MISSING", "Authentication signing key is not configured.", 503)
    return jwt.encode({**claims, "exp": expires_at, "iat": datetime.now(UTC), "iss": "als50"}, secret, algorithm="HS256")


def issue_session(database: Session, profile: DirectoryProfile, roles: list[str], timeout_minutes: int, must_change_password: bool = False) -> tuple[str, str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(minutes=timeout_minutes)
    session_id = secrets.token_urlsafe(32)
    token = encode_session_token({"sub": profile.username, "sid": session_id, "roles": roles, "must_change_password": must_change_password}, expires_at)
    database.add(UserSession(session_id=session_id, username=profile.username, roles=roles, expires_at=expires_at))
    database.commit()
    return token, session_id, expires_at


def authenticate_enterprise(database: Session, username: str, password: str, rsa_token: str, source_ip: str | None, rsa: RsaConnector | None = None, directory: DirectoryConnector | None = None) -> tuple[DirectoryProfile, list[str], str, datetime, bool]:
    settings = settings_for(database)
    correlation_id = secrets.token_hex(16)
    configured_admin_username = os.getenv("UAT_LOCAL_ADMIN_USERNAME", "admin").strip()
    is_configured_admin = bool(os.getenv("UAT_LOCAL_ADMIN_PASSWORD")) and normalize_username(username) == normalize_username(configured_admin_username)
    if not is_configured_admin and not rate_limiter.allow(f"{source_ip}:{username}", settings.rate_limit_per_minute):
        audit(database, event_type="login", outcome="rate_limited", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again later.", 429)
    if not is_configured_admin and lockout_active(database, username, settings):
        audit(database, event_type="login", outcome="locked_out", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_LOCKED", "Account is temporarily locked. Try again later.", 423)
    try:
        local_admin_username = os.getenv("UAT_LOCAL_ADMIN_USERNAME", "admin").strip()
        local_admin_password = os.getenv("UAT_LOCAL_ADMIN_PASSWORD", "")
        user = None
        if local_admin_password and normalize_username(username) == normalize_username(local_admin_username):
            if not hmac.compare_digest(password, local_admin_password):
                raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.")
            profile = DirectoryProfile(
                username=local_admin_username,
                display_name="UAT Administrator",
                email=os.getenv("UAT_LOCAL_ADMIN_EMAIL", "admin@als50.local"),
                groups=[],
            )
            roles = ["Administrator"]
            must_change_password = False
        else:
            user = find_local_user(database, username)
        if user:
            metadata = ensure_user_credentials(database, user)
            if str(user.payload.get("status", "Active")).casefold() != "active":
                raise AuthenticationError("AUTH_ACCOUNT_INACTIVE", "This account is inactive.", 403)
            if not metadata.get("password_hash") or not verify_password(password, metadata["password_hash"]):
                raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.")
            profile = local_profile(user)
            roles = [str(user.payload.get("role") or "Service engineer")]
            must_change_password = bool(metadata.get("must_change_password"))
        elif not local_admin_password or normalize_username(username) != normalize_username(local_admin_username):
            raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.")
        if not roles:
            raise AuthenticationError("AUTHORIZATION_DENIED", "No application role is mapped to this account.", 403)
        token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes, must_change_password)
        audit(database, event_type="login", outcome="success", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"roles": roles})
        return profile, roles, token, expires_at, must_change_password
    except AuthenticationError as error:
        audit(database, event_type="login", outcome="failure", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"code": error.code})
        raise


def issue_demo_session(database: Session, profile: DirectoryProfile, source_ip: str | None) -> tuple[str, list[str], datetime]:
    settings = settings_for(database)
    roles = ["Administrator"] if profile.username.lower().startswith("als-emp-001") else ["Service User"]
    token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
    audit(database, event_type="demo_login", outcome="success", username=profile.username, provider="demo", source_ip=source_ip, correlation_id=secrets.token_hex(16), details={"roles": roles})
    return token, roles, expires_at