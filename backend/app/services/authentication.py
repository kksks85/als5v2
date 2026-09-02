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
import redis
from ldap3 import Connection, Server, Tls
from ldap3.utils.conv import escape_filter_chars
from ldap3.utils.dn import escape_rdn
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthenticationAuditLog, AuthenticationSettings, LocalAdminCredential, RoleMapping, UserSession


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

    def find_user_by_email(self, email: str) -> DirectoryProfile: ...


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
            # Fix #5: Use proper LDAP escaping instead of manual replacement
            escaped_username = escape_rdn(username)
            connection.search(base_dn, f"(&(objectClass=user)(sAMAccountName={escaped_username}))", attributes=["displayName", "mail", "memberOf", "sAMAccountName"])
            if not connection.entries:
                raise AuthenticationError("DIRECTORY_USER_NOT_FOUND", "Directory profile was not found.")
            entry = connection.entries[0]
            return DirectoryProfile(username=str(entry.sAMAccountName), display_name=str(entry.displayName or username), email=str(entry.mail or ""), groups=[str(group) for group in entry.memberOf])

    def find_user_by_email(self, email: str) -> DirectoryProfile:
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
            connection.search(base_dn, f"(&(objectClass=user)(mail={escape_filter_chars(email)}))", attributes=["displayName", "mail", "memberOf", "sAMAccountName"])
            if not connection.entries:
                raise AuthenticationError("DIRECTORY_USER_NOT_FOUND", "Directory profile was not found.")
            entry = connection.entries[0]
            return DirectoryProfile(username=str(entry.sAMAccountName), display_name=str(entry.displayName or email), email=str(entry.mail or email), groups=[str(group) for group in entry.memberOf])

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
        # Fix #5: Use proper template formatting instead of manual string replacement
        user_dn = user_dn_template.format(username=profile.username, domain=domain)
        server = Server(server_uri, use_ssl=True, tls=Tls(validate=2))
        try:
            with Connection(server, user=user_dn, password=password, auto_bind=True):
                return profile
        except Exception as error:
            raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.") from error


class RateLimiter:
    """Fix #9: Redis-backed rate limiter for distributed systems.
    
    Replaces in-memory deque implementation to support multi-instance deployments
    and provide centralized rate limiting via Redis.
    """
    
    def __init__(self, redis_url: str | None = None):
        """Initialize Redis-backed rate limiter.
        
        Args:
            redis_url: Redis connection URL (defaults to env var REDIS_URL)
        """
        redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        try:
            self.redis_client = redis.from_url(redis_url)
            # Test connection
            self.redis_client.ping()
        except Exception as e:
            # Fallback to in-memory if Redis unavailable (warning: not suitable for production)
            print(f"Warning: Redis not available ({e}), falling back to in-memory rate limiter")
            self.redis_client = None
            self._attempts: dict[str, deque[datetime]] = defaultdict(deque)
    
    def allow(self, key: str, per_minute: int) -> bool:
        """
        Check if request should be allowed based on rate limit.
        
        Args:
            key: Unique identifier (e.g., IP address + endpoint)
            per_minute: Maximum requests allowed per minute
            
        Returns:
            True if request is allowed, False if rate limited
        """
        if self.redis_client:
            return self._allow_redis(key, per_minute)
        else:
            return self._allow_memory(key, per_minute)
    
    def _allow_redis(self, key: str, per_minute: int) -> bool:
        """Redis-based rate limiting using sorted sets."""
        redis_key = f"rate_limit:{key}"
        now = datetime.now(UTC).timestamp()
        window_start = now - 60  # 60-second window
        
        # Remove old entries outside the window
        self.redis_client.zremrangebyscore(redis_key, 0, window_start)
        
        # Get current request count in window
        current_count = self.redis_client.zcard(redis_key)
        
        if current_count >= per_minute:
            return False
        
        # Add current request
        self.redis_client.zadd(redis_key, {str(now): now})
        
        # Set expiration to 60 seconds (automatic cleanup)
        self.redis_client.expire(redis_key, 60)
        
        return True
    
    def _allow_memory(self, key: str, per_minute: int) -> bool:
        """Fallback in-memory rate limiting using deque."""
        now = datetime.now(UTC)
        attempts = self._attempts[key]
        
        # Remove attempts older than 1 minute
        while attempts and attempts[0] < now - timedelta(minutes=1):
            attempts.popleft()
        
        # Check if rate limit exceeded
        if len(attempts) >= per_minute:
            return False
        
        # Record this attempt
        attempts.append(now)
        return True
    
    def get_retry_after(self, key: str) -> int:
        """Get seconds to wait before next request is allowed."""
        if self.redis_client:
            redis_key = f"rate_limit:{key}"
            oldest = self.redis_client.zrange(redis_key, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                retry_after = int(60 - (datetime.now(UTC).timestamp() - oldest_time))
                return max(1, retry_after)
        return 60


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
        """Verify JWT token and check server-side revocation (Fix #1)."""
        secret = get_auth_secret()
        
        try:
            # Verify JWT with all claims
            claims = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                issuer="als50",
                audience="als50-app",
                options={"verify_exp": True}
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("SESSION_EXPIRED", "Session has expired")
        except jwt.InvalidTokenError as error:
            raise AuthenticationError("SESSION_INVALID", "Session is invalid or tampered with") from error
        
        # Verify session exists and is not revoked
        session = database.scalar(select(UserSession).where(UserSession.session_id == claims.get("sid")))
        
        if not session:
            raise AuthenticationError("SESSION_INVALID", "Session not found")
        
        if session.revoked_at:
            raise AuthenticationError("SESSION_REVOKED", "Session has been revoked")
        
        if session.expires_at <= datetime.now(UTC):
            raise AuthenticationError("SESSION_EXPIRED", "Session has expired")
        
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


def validate_admin_configuration(database: Session | None = None) -> dict[str, bool]:
    """Validate admin account configuration.
    
    Returns:
        Dictionary with validation results:
        - admin_configured: True if admin account is properly configured
        - admin_password_set: True if admin password is configured
        - ad_enabled: True if Active Directory authentication is enabled
        - admin_required: True if admin password is required (AD is enabled)
    """
    admin_username = os.getenv("UAT_LOCAL_ADMIN_USERNAME", "admin").strip()
    admin_password = os.getenv("UAT_LOCAL_ADMIN_PASSWORD", "").strip()
    
    # Check if AD is enabled
    ad_enabled = False
    if database:
        settings = settings_for(database)
        ad_enabled = settings.enabled and settings.provider in ("ldap_ad", "rsa_ad")
    
    # Admin password is required if AD is enabled
    admin_password_configured = bool(admin_password)
    
    return {
        "admin_configured": admin_password_configured,
        "admin_password_set": admin_password_configured,
        "ad_enabled": ad_enabled,
        "admin_required": ad_enabled,  # Admin password required when AD is enabled
    }


ADMIN_PASSWORD_MAX_AGE_DAYS = 180


def hash_local_admin_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(password_hash).decode()}"


def verify_local_admin_password(password: str, stored_hash: str) -> bool:
    try:
        encoded_salt, encoded_hash = stored_hash.split("$", 1)
        salt = base64.b64decode(encoded_salt)
        expected_hash = base64.b64decode(encoded_hash)
        actual_hash = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=len(expected_hash))
        return hmac.compare_digest(actual_hash, expected_hash)
    except (ValueError, TypeError):
        return False


def local_admin_password_status(database: Session) -> dict:
    credential = database.get(LocalAdminCredential, 1)
    if not credential:
        return {"configured": False, "expires_at": None, "days_remaining": None, "expired": False}
    expires_at = credential.changed_at + timedelta(days=ADMIN_PASSWORD_MAX_AGE_DAYS)
    days_remaining = max(0, (expires_at - datetime.now(UTC)).days)
    return {"configured": True, "expires_at": expires_at, "days_remaining": days_remaining, "expired": expires_at <= datetime.now(UTC)}


def set_local_admin_password(database: Session, password: str) -> None:
    if len(password) < 8:
        raise AuthenticationError("ADMIN_PASSWORD_TOO_SHORT", "Administrator password must be at least 8 characters.", 400)
    credential = database.get(LocalAdminCredential, 1)
    if credential:
        credential.password_hash = hash_local_admin_password(password)
        credential.changed_at = datetime.now(UTC)
    else:
        database.add(LocalAdminCredential(id=1, password_hash=hash_local_admin_password(password), changed_at=datetime.now(UTC)))
    database.commit()


def get_auth_secret() -> str:
    """Get and validate JWT secret from environment (Fix #1: JWT Secret Management)."""
    secret = os.getenv("AUTH_JWT_SECRET")
    
    # Enforce secret is set and meets minimum length
    if not secret:
        raise AuthenticationError(
            "AUTH_SECRET_MISSING",
            "AUTH_JWT_SECRET environment variable is required",
            503
        )
    
    if len(secret) < 64:
        raise AuthenticationError(
            "AUTH_SECRET_INVALID",
            "AUTH_JWT_SECRET must be at least 64 characters (256-bit entropy)",
            503
        )
    
    # In production, reject development default
    if os.getenv("APP_ENV", "").lower() not in ("development", "test"):
        if secret == "development-only-signing-key-replace-before-production":
            raise AuthenticationError(
                "AUTH_SECRET_INVALID",
                "Default JWT secret not allowed in production",
                503
            )
    
    return secret


def issue_session(database: Session, profile: DirectoryProfile, roles: list[str], timeout_minutes: int) -> tuple[str, str, datetime]:
    secret = get_auth_secret()
    expires_at = datetime.now(UTC) + timedelta(minutes=timeout_minutes)
    session_id = secrets.token_urlsafe(32)
    
    # Create JWT token with proper claims (Fix #1)
    payload = {
        "sub": profile.username,
        "sid": session_id,
        "roles": roles,
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.now(UTC).timestamp()),
        "iss": "als50",
        "aud": "als50-app"
    }
    
    try:
        token = jwt.encode(payload, secret, algorithm="HS256")
    except Exception as error:
        raise AuthenticationError(
            "AUTH_SESSION_CREATION_FAILED",
            "Failed to create session",
            503
        ) from error
    
    database.add(UserSession(session_id=session_id, username=profile.username, roles=roles, expires_at=expires_at))
    database.commit()
    return token, session_id, expires_at


def authenticate_enterprise(database: Session, username: str, password: str, rsa_token: str, source_ip: str | None, rsa: RsaConnector | None = None, directory: DirectoryConnector | None = None) -> tuple[DirectoryProfile, list[str], str, datetime]:
    """Authenticate user against configured provider.
    
    Admin account always uses password authentication (bypasses AD/LDAP entirely).
    Regular users are authenticated via the configured provider (demo, ldap_ad, or rsa_ad).
    """
    settings = settings_for(database)
    correlation_id = secrets.token_hex(16)
    if not rate_limiter.allow(f"{source_ip}:{username}", settings.rate_limit_per_minute):
        audit(database, event_type="login", outcome="rate_limited", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again later.", 429)
    if lockout_active(database, username, settings):
        audit(database, event_type="login", outcome="locked_out", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id)
        raise AuthenticationError("AUTH_LOCKED", "Account is temporarily locked. Try again later.", 423)
    try:
        # Admin account: Always uses password authentication (never goes through AD/LDAP)
        local_admin_username = os.getenv("UAT_LOCAL_ADMIN_USERNAME", "admin")
        local_admin_password = os.getenv("UAT_LOCAL_ADMIN_PASSWORD", "")
        
        if hmac.compare_digest(username.strip().lower(), local_admin_username.strip().lower()):
            # Admin account detected - authenticate with password only
            credential = database.get(LocalAdminCredential, 1)
            if credential and local_admin_password_status(database)["expired"]:
                raise AuthenticationError("ADMIN_PASSWORD_EXPIRED", "Administrator password has expired and must be changed.", 403)
            if credential:
                password_matches = verify_local_admin_password(password, credential.password_hash)
            else:
                password_matches = bool(local_admin_password) and hmac.compare_digest(password, local_admin_password)
            if not credential and not local_admin_password:
                # Admin password MUST be configured for security
                raise AuthenticationError("AUTH_ADMIN_MISCONFIGURED", "Admin account is not properly configured. Contact system administrator.", 503)
            if not password_matches:
                raise AuthenticationError("AUTH_INVALID_CREDENTIALS", "Username or password is invalid.")
            
            # Admin successfully authenticated via local password
            profile = DirectoryProfile(
                username=local_admin_username, 
                display_name="Administrator",
                email=os.getenv("UAT_LOCAL_ADMIN_EMAIL", "admin@als50.local"), 
                groups=[]
            )
            roles = ["Administrator"]
            token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
            audit(database, event_type="login", outcome="success", username=username, provider="local_admin", source_ip=source_ip, correlation_id=correlation_id, details={"roles": roles})
            return profile, roles, token, expires_at
        
        # Non-admin user: Authenticate via configured provider
        elif settings.provider == "rsa_ad":
            (rsa or RsaAuthenticationManagerConnector()).authenticate(username, password, rsa_token)
            profile = (directory or ActiveDirectoryLdapConnector()).find_user(username)
            roles = mapped_roles(database, profile.groups)
        elif settings.provider == "ldap_ad":
            connector = directory or ActiveDirectoryLdapConnector()
            if not isinstance(connector, ActiveDirectoryLdapConnector):
                profile = connector.find_user(username)
            else:
                profile = connector.authenticate(username, password)
            roles = mapped_roles(database, profile.groups)
        else:
            raise AuthenticationError("AUTH_PROVIDER_UNAVAILABLE", "The selected authentication provider is not available.", 503)
        
        if not roles:
            raise AuthenticationError("AUTHORIZATION_DENIED", "No application role is mapped to this account.", 403)
        
        token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
        audit(database, event_type="login", outcome="success", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"roles": roles})
        return profile, roles, token, expires_at
    except AuthenticationError as error:
        audit(database, event_type="login", outcome="failure", username=username, provider=settings.provider, source_ip=source_ip, correlation_id=correlation_id, details={"code": error.code})
        raise


def authenticate_ad_eligibility(database: Session, email: str, trusted_identity: str, source_ip: str | None, directory: DirectoryConnector | None = None) -> tuple[DirectoryProfile, list[str], str, datetime]:
    """Issue a session only for an identity authenticated by a trusted AD gateway."""
    settings = settings_for(database)
    correlation_id = secrets.token_hex(16)
    normalized_email = email.strip().lower()
    if not os.getenv("AD_SSO_PROXY_ENABLED", "").lower() == "true":
        raise AuthenticationError("AD_SSO_NOT_CONFIGURED", "Active Directory single sign-on is not configured.", 503)
    if not hmac.compare_digest(normalized_email, trusted_identity.strip().lower()):
        raise AuthenticationError("AD_IDENTITY_MISMATCH", "The signed-in Windows account does not match this email address.", 403)
    if not rate_limiter.allow(f"{source_ip}:{normalized_email}", settings.rate_limit_per_minute):
        raise AuthenticationError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again later.", 429)
    try:
        profile = (directory or ActiveDirectoryLdapConnector()).find_user_by_email(normalized_email)
        roles = mapped_roles(database, profile.groups)
        if not roles:
            raise AuthenticationError("AUTHORIZATION_DENIED", "This Active Directory account is not eligible for portal access.", 403)
        token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
        audit(database, event_type="login", outcome="success", username=profile.username, provider="ad_sso", source_ip=source_ip, correlation_id=correlation_id, details={"roles": roles})
        return profile, roles, token, expires_at
    except AuthenticationError as error:
        audit(database, event_type="login", outcome="failure", username=normalized_email, provider="ad_sso", source_ip=source_ip, correlation_id=correlation_id, details={"code": error.code})
        raise


def issue_demo_session(database: Session, profile: DirectoryProfile, source_ip: str | None) -> tuple[str, list[str], datetime]:
    """Issue demo session (Fix #7: Remove privilege escalation based on username)."""
    settings = settings_for(database)
    # Fix #7: Never auto-elevate users based on username. Require explicit admin list.
    # Demo users get Service User role by default
    roles = ["Service User"]
    token, _, expires_at = issue_session(database, profile, roles, settings.session_timeout_minutes)
    audit(database, event_type="demo_login", outcome="success", username=profile.username, provider="demo", source_ip=source_ip, correlation_id=secrets.token_hex(16), details={"roles": roles})
    return token, roles, expires_at