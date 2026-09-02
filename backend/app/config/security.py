"""Security configuration management (Fix #12, #13, #14, #15).

Comprehensive configuration for:
- CORS hardening (Fix #12)
- Session timeout and management (Fix #13)
- Token refresh logic (Fix #14)
- Security settings review (Fix #15)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from enum import Enum


class SessionTimeoutPolicy(str, Enum):
    """Session timeout policies (Fix #13)."""
    STRICT = "strict"  # Force logout after inactivity
    ROLLING = "rolling"  # Extend timeout on each request
    HYBRID = "hybrid"  # Combination of both


@dataclass
class SessionConfig:
    """Session management configuration (Fix #13, #14)."""
    
    # Session timeouts
    session_timeout_minutes: int = 60
    idle_timeout_minutes: int = 30
    absolute_timeout_minutes: int = 480  # 8 hours max absolute timeout
    
    # Token refresh
    token_refresh_threshold_minutes: int = 5  # Refresh if < 5 minutes left
    enable_token_refresh: bool = True
    max_refresh_attempts: int = 3
    
    # Session policy
    timeout_policy: SessionTimeoutPolicy = SessionTimeoutPolicy.ROLLING
    
    # Session security
    require_same_ip: bool = False  # If True, IP must match for token reuse
    secure_httponly_cookies: bool = True
    same_site_policy: str = "Strict"  # "Strict", "Lax", "None"
    
    def get_session_expiry(self) -> datetime:
        """Calculate session expiry time."""
        return datetime.now(timezone.utc) + timedelta(minutes=self.session_timeout_minutes)
    
    def get_idle_expiry(self) -> datetime:
        """Calculate idle timeout expiry."""
        return datetime.now(timezone.utc) + timedelta(minutes=self.idle_timeout_minutes)
    
    def should_refresh_token(self, token_issued_at: datetime, token_expires_at: datetime) -> bool:
        """Determine if token should be refreshed (Fix #14)."""
        if not self.enable_token_refresh:
            return False
        
        now = datetime.now(timezone.utc)
        time_remaining = (token_expires_at - now).total_seconds() / 60
        
        return time_remaining < self.token_refresh_threshold_minutes


@dataclass  
class CorsConfig:
    """CORS configuration hardening (Fix #12)."""
    
    # Allowed origins (must be explicitly configured)
    allowed_origins: list[str] = None
    
    # Allowed methods
    allowed_methods: list[str] = None
    
    # Allowed headers
    allowed_headers: list[str] = None
    
    # Exposed headers
    exposed_headers: list[str] = None
    
    # Credentials policy
    allow_credentials: bool = True
    
    # Cache settings
    max_age_seconds: int = 3600  # 1 hour
    
    def __post_init__(self):
        """Set secure defaults for CORS (Fix #12)."""
        if self.allowed_origins is None:
            # Read from environment, split by comma
            origins_str = os.getenv("CORS_ORIGINS", "")
            self.allowed_origins = [
                origin.strip() 
                for origin in origins_str.split(",") 
                if origin.strip()
            ] if origins_str else []
        
        if self.allowed_methods is None:
            # Only allow necessary methods
            self.allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        
        if self.allowed_headers is None:
            # Whitelist specific headers
            self.allowed_headers = [
                "Content-Type",
                "Authorization",
                "X-CSRF-Token",
                "Accept",
                "Origin",
                "Accept-Language",
                "X-Requested-With",
            ]
        
        if self.exposed_headers is None:
            # Only expose necessary response headers
            self.exposed_headers = [
                "Content-Length",
                "X-Total-Count",
                "X-Page-Count",
            ]
    
    def is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is in allowed list (Fix #12)."""
        return origin in self.allowed_origins
    
    def get_cors_headers(self, origin: str) -> dict[str, str]:
        """Generate CORS response headers (Fix #12)."""
        headers = {}
        
        # Only set CORS headers if origin is allowed
        if not self.is_origin_allowed(origin):
            return headers
        
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Methods"] = ", ".join(self.allowed_methods)
        headers["Access-Control-Allow-Headers"] = ", ".join(self.allowed_headers)
        headers["Access-Control-Expose-Headers"] = ", ".join(self.exposed_headers)
        
        if self.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"
        
        headers["Access-Control-Max-Age"] = str(self.max_age_seconds)
        
        return headers


@dataclass
class SecurityConfig:
    """Comprehensive security configuration (Fix #15)."""
    
    # Environment
    app_env: str = "development"
    debug: bool = False
    
    # Security headers
    enable_hsts: bool = True
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    
    enable_csp: bool = True
    csp_policy: str = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    
    # Request security
    max_request_size_mb: int = 10
    request_timeout_seconds: int = 30
    
    # Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 100
    rate_limit_auth_per_minute: int = 5
    
    # Input validation
    validate_input: bool = True
    sanitize_html: bool = True
    
    # SQL injection protection
    parameterized_queries: bool = True
    
    # CSRF protection
    csrf_enabled: bool = True
    csrf_header_name: str = "X-CSRF-Token"
    
    # Session security
    session_config: SessionConfig = None
    
    # CORS security
    cors_config: CorsConfig = None
    
    def __post_init__(self):
        """Initialize sub-configurations."""
        if self.session_config is None:
            self.session_config = SessionConfig()
        
        if self.cors_config is None:
            self.cors_config = CorsConfig()
        
        # Disable debug in production
        if self.app_env.lower() in ("production", "prod"):
            self.debug = False
    
    def validate_configuration(self) -> list[str]:
        """Validate security configuration and return warnings."""
        warnings = []
        
        if self.app_env.lower() in ("production", "prod"):
            if self.debug:
                warnings.append("Debug mode enabled in production")
            
            if not self.enable_hsts:
                warnings.append("HSTS not enabled in production")
            
            if not self.csrf_enabled:
                warnings.append("CSRF protection disabled in production")
            
            if not self.validate_input:
                warnings.append("Input validation disabled in production")
            
            if not self.cors_config.allowed_origins:
                warnings.append("No CORS origins configured in production")
        
        return warnings
    
    def get_security_headers(self) -> dict[str, str]:
        """Get all security headers (Fix #15)."""
        headers = {}
        
        # HSTS header (Fix #8, #10)
        if self.enable_hsts:
            hsts_value = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if self.hsts_preload:
                hsts_value += "; preload"
            headers["Strict-Transport-Security"] = hsts_value
        
        # CSP header (Fix #10)
        if self.enable_csp:
            headers["Content-Security-Policy"] = self.csp_policy
        
        # Additional security headers (Fix #10)
        headers["X-Content-Type-Options"] = "nosniff"
        headers["X-Frame-Options"] = "DENY"
        headers["X-XSS-Protection"] = "1; mode=block"
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
        
        return headers


# Global configuration instance
_global_security_config: Optional[SecurityConfig] = None


def get_security_config() -> SecurityConfig:
    """Get global security configuration (Fix #15)."""
    global _global_security_config
    
    if _global_security_config is None:
        _global_security_config = SecurityConfig(
            app_env=os.getenv("APP_ENV", "development"),
            debug=os.getenv("DEBUG", "false").lower() == "true",
        )
    
    return _global_security_config


def initialize_security_config(config: Optional[SecurityConfig] = None) -> None:
    """Initialize global security configuration (Fix #15)."""
    global _global_security_config
    _global_security_config = config or SecurityConfig()
    
    # Validate configuration
    warnings = _global_security_config.validate_configuration()
    for warning in warnings:
        print(f"Security warning: {warning}")


# Export all configurations
__all__ = [
    "SessionTimeoutPolicy",
    "SessionConfig",
    "CorsConfig",
    "SecurityConfig",
    "get_security_config",
    "initialize_security_config",
]
