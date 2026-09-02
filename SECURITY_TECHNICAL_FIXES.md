# TECHNICAL REMEDIATION GUIDE
## Aerofix Service Management API - Security Fixes
**Version:** 1.0  
**Date:** 2026-09-01

---

## TABLE OF CONTENTS

1. [Fix #1: JWT Secret Management](#fix-1-jwt-secret-management)
2. [Fix #2: Authentication on Data Endpoints](#fix-2-authentication-on-data-endpoints)
3. [Fix #3: CSRF Protection on Write Operations](#fix-3-csrf-protection-on-write-operations)
4. [Fix #4: Authorization & IDOR Prevention](#fix-4-authorization--idor-prevention)
5. [Fix #5: LDAP Injection Prevention](#fix-5-ldap-injection-prevention)
6. [Fix #6: Secrets Management](#fix-6-secrets-management)
7. [Fix #7: Remove Demo Privilege Escalation](#fix-7-remove-demo-privilege-escalation)
8. [Fix #8: HTTPS Enforcement](#fix-8-https-enforcement)
9. [Fix #9: Rate Limiting](#fix-9-rate-limiting)
10. [Fix #10: Security Headers](#fix-10-security-headers)

---

## FIX #1: JWT SECRET MANAGEMENT

### Problem
```python
# Current vulnerable code in docker-compose.yml
AUTH_JWT_SECRET: ${AUTH_JWT_SECRET:-development-only-signing-key-replace-before-production}
```

This hardcoded default is easily missed during deployment.

### Solution

#### Step 1: Update `backend/app/services/authentication.py`

```python
import os
import secrets
from datetime import UTC, datetime, timedelta
import jwt
from fastapi import HTTPException

# Add minimum secret length validation
def get_auth_secret() -> str:
    """Get and validate JWT secret from environment."""
    secret = os.getenv("AUTH_JWT_SECRET")
    
    # Enforce minimum length and secure characters
    if not secret:
        raise RuntimeError(
            "AUTH_JWT_SECRET environment variable is required"
        )
    
    if len(secret) < 64:
        raise RuntimeError(
            "AUTH_JWT_SECRET must be at least 64 characters (256-bit entropy)"
        )
    
    # In production, fail if using development default
    if os.getenv("APP_ENV", "").lower() not in ("development", "test"):
        if secret == "development-only-signing-key-replace-before-production":
            raise RuntimeError(
                "Default JWT secret not allowed in production. "
                "Generate a strong secret: python -c \"import secrets; "
                "print(secrets.token_urlsafe(64))\""
            )
    
    return secret

def issue_session(database: Session, profile: DirectoryProfile, 
                 roles: list[str], timeout_minutes: int) -> tuple[str, str, datetime]:
    """Create and store a new session."""
    secret = get_auth_secret()  # Use validated secret
    
    expires_at = datetime.now(UTC) + timedelta(minutes=timeout_minutes)
    session_id = secrets.token_urlsafe(32)
    
    # Create JWT token
    payload = {
        "sub": profile.username,
        "sid": session_id,
        "roles": roles,
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.now(UTC).timestamp()),
        "iss": "als50",
        "aud": "als50-app"  # Add audience claim for extra security
    }
    
    try:
        token = jwt.encode(payload, secret, algorithm="HS256")
    except Exception as error:
        raise AuthenticationError(
            "AUTH_SESSION_CREATION_FAILED", 
            "Failed to create session", 
            503
        ) from error
    
    # Store session in database
    session = UserSession(
        session_id=session_id,
        username=profile.username,
        roles=roles,
        expires_at=expires_at,
        created_at=datetime.now(UTC)
    )
    database.add(session)
    database.commit()
    
    return token, session_id, expires_at

class SessionManager:
    """Manages session creation and verification."""
    
    def verify(self, database: Session, token: str) -> dict:
        """Verify JWT token and check server-side revocation."""
        secret = get_auth_secret()
        
        try:
            # Decode and validate token
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
            raise AuthenticationError(
                "SESSION_INVALID",
                "Session is invalid or tampered with"
            ) from error
        
        # Verify session is not revoked
        session = database.scalar(
            select(UserSession).where(
                UserSession.session_id == claims.get("sid")
            )
        )
        
        if not session:
            raise AuthenticationError("SESSION_INVALID", "Session not found")
        
        if session.revoked_at:
            raise AuthenticationError("SESSION_REVOKED", "Session has been revoked")
        
        if session.expires_at <= datetime.now(UTC):
            raise AuthenticationError("SESSION_EXPIRED", "Session has expired")
        
        return claims
```

#### Step 2: Update `docker-compose.yml`

```yaml
services:
  api:
    build: ./backend
    environment:
      APP_ENV: ${APP_ENV:-development}
      DATABASE_URL: ${DATABASE_URL:?error - set DATABASE_URL in .env}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}
      APP_PUBLIC_URL: ${APP_PUBLIC_URL:-http://localhost:5173}
      
      # Make secrets required - NO DEFAULTS
      AUTH_JWT_SECRET: ${AUTH_JWT_SECRET:?error - set AUTH_JWT_SECRET in .env}
      LDAP_SERVER_URI: ${LDAP_SERVER_URI:?error - set LDAP_SERVER_URI in .env}
      LDAP_BASE_DN: ${LDAP_BASE_DN:?error - set LDAP_BASE_DN in .env}
      LDAP_BIND_DN: ${LDAP_BIND_DN:?error - set LDAP_BIND_DN in .env}
      LDAP_BIND_PASSWORD: ${LDAP_BIND_PASSWORD:?error - set LDAP_BIND_PASSWORD in .env}
      
      # Optional with safe defaults
      LDAP_USER_DN_TEMPLATE: ${LDAP_USER_DN_TEMPLATE:-{username}@{domain}}
      LDAP_USER_DOMAIN: ${LDAP_USER_DOMAIN:-}
      UAT_LOCAL_ADMIN_USERNAME: ${UAT_LOCAL_ADMIN_USERNAME:-admin}
      UAT_LOCAL_ADMIN_PASSWORD: ${UAT_LOCAL_ADMIN_PASSWORD:?error - set UAT_LOCAL_ADMIN_PASSWORD in .env}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
```

#### Step 3: Create `.env.example`

```bash
# Database Configuration
POSTGRES_USER=als50
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_DB=als50
DATABASE_URL=postgresql+psycopg://als50:<password>@db:5432/als50

# Application Environment
APP_ENV=production
APP_PUBLIC_URL=https://app.example.com

# CORS Configuration
CORS_ORIGINS=https://app.example.com

# JWT Secret (generate with: python -c "import secrets; print(secrets.token_urlsafe(64))")
AUTH_JWT_SECRET=<generate-64-character-secret>

# LDAP/Active Directory
LDAP_SERVER_URI=ldaps://ad.example.com:636
LDAP_BASE_DN=dc=example,dc=com
LDAP_BIND_DN=CN=ServiceAccount,OU=Service Accounts,dc=example,dc=com
LDAP_BIND_PASSWORD=<service-account-password>
LDAP_USER_DN_TEMPLATE={username}@example.com
LDAP_USER_DOMAIN=example.com

# Entra ID (Microsoft Entra/Azure AD)
ENTRA_TENANT_ID=<your-tenant-id>
ENTRA_CLIENT_ID=<your-client-id>
ENTRA_CLIENT_SECRET=<your-client-secret>
ENTRA_API_SCOPE=api://<client-id>/.default

# UAT/Demo
UAT_LOCAL_ADMIN_USERNAME=admin
UAT_LOCAL_ADMIN_PASSWORD=<generate-strong-password>
UAT_LOCAL_ADMIN_EMAIL=admin@company.com
UAT_DEMO_PASSWORD=<demo-password-or-leave-empty>

# SMTP Configuration
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USERNAME=noreply@company.com
SMTP_PASSWORD=<smtp-password>
SMTP_FROM_EMAIL=noreply@company.com
SMTP_FROM_NAME=Aerofix Service
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

#### Step 4: Update `.gitignore`

```bash
# Security - Never commit secrets
.env
.env.*.local
.env.production
.env.staging

# Docker
docker-compose.override.yml

# Dependencies
node_modules/
venv/
__pycache__/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
logs/

# Build
dist/
build/
*.egg-info/
```

#### Step 5: Generate Secrets

```bash
#!/bin/bash

# Generate JWT Secret
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
echo "JWT_SECRET: $JWT_SECRET"

# Generate Database Password
DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "DB_PASSWORD: $DB_PASSWORD"

# Generate LDAP Bind Password (if using LDAP)
LDAP_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "LDAP_PASSWORD: $LDAP_PASSWORD"

# Generate SMTP Password (if using SMTP)
SMTP_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "SMTP_PASSWORD: $SMTP_PASSWORD"

# Create .env file
cat > .env << EOF
AUTH_JWT_SECRET=$JWT_SECRET
POSTGRES_PASSWORD=$DB_PASSWORD
LDAP_BIND_PASSWORD=$LDAP_PASSWORD
SMTP_PASSWORD=$SMTP_PASSWORD
EOF

echo "✅ .env file created with generated secrets"
echo "⚠️  Keep .env secure and never commit it to version control"
```

---

## FIX #2: AUTHENTICATION ON DATA ENDPOINTS

### Problem
```python
# Current vulnerable code
@router.get("/{resource}")
def list_records(resource: str, database: Session = Depends(get_db)):
    # NO AUTHENTICATION REQUIRED
    records = database.scalars(select(model).order_by(model.record_id)).all()
    return {"items": records}
```

### Solution

#### Step 1: Create authentication middleware wrapper

```python
# backend/app/api/v1/auth.py
from fastapi import Depends, HTTPException, Request
from app.api.v1.authentication import require_session

def require_authenticated_user(
    request: Request,
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)
) -> dict:
    """Dependency for endpoints requiring authentication."""
    return claims

def require_role(required_roles: set[str]):
    """Factory function to create role requirement dependency."""
    async def check_role(claims: dict = Depends(require_session)) -> dict:
        user_roles = set(claims.get("roles", []))
        if not required_roles.intersection(user_roles):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": f"User requires one of: {', '.join(required_roles)}"
                }
            )
        return claims
    return check_role
```

#### Step 2: Update records API endpoints

```python
# backend/app/api/v1/records.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.v1.authentication import require_session  # Add this import

router = APIRouter(prefix="/records", tags=["records"])

@router.get("/{resource}")
def list_records(
    resource: str, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)  # ADD AUTHENTICATION
) -> dict[str, list[dict[str, Any]]]:
    """List all records of a given resource type."""
    # Verify user has access to this resource type
    allowed_resources = get_allowed_resources_for_user(claims)
    if resource not in allowed_resources:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Access denied"}
        )
    
    validate_resource(resource)
    if resource == "email_logs":
        prune_expired_email_logs(database)
        database.commit()
    
    if resource in PRODUCT_MASTER_RESOURCES:
        records = database.scalars(
            select(ProductMasterRecord)
            .where(ProductMasterRecord.resource == resource)
            .order_by(ProductMasterRecord.record_id)
        ).all()
        return {"items": [{"record_id": record.record_id, "payload": record.payload} 
                         for record in records]}
    
    model = RESOURCE_MODELS[resource]
    records = database.scalars(
        select(model).order_by(model.record_id)
    ).all()
    return {"items": [{"record_id": record.record_id, "payload": record.payload} 
                     for record in records]}

def get_allowed_resources_for_user(claims: dict) -> set[str]:
    """Determine which resources user can access based on role."""
    user_roles = set(claims.get("roles", []))
    
    # Define resource access by role
    resource_permissions = {
        "Administrator": set(ALLOWED_RESOURCES + list(PRODUCT_MASTER_RESOURCES)),
        "Service User": {
            "components", "repairs", "customers", "contracts",
            "incidents", "queries", "notifications"
        },
        "Coordinator": {
            "customers", "contracts", "incidents", "users",
            "assignment_groups"
        }
    }
    
    allowed = set()
    for role in user_roles:
        if role in resource_permissions:
            allowed.update(resource_permissions[role])
    
    return allowed
```

#### Step 3: Update all other GET endpoints

```python
# backend/app/api/v1/component_lifecycle.py
@router.get("/components")
def get_components(
    lifecycle_status: str | None = None, 
    component_type: str | None = None, 
    customer: str | None = None, 
    contract_number: str | None = None, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)  # ADD THIS
) -> dict[str, list[dict[str, Any]]]:
    return {"items": list_components(database, lifecycle_status, component_type, 
                                    customer, contract_number)}

@router.get("/components/{serial_number}")
def get_component(
    serial_number: str, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)  # ADD THIS
) -> dict[str, Any]:
    return component_detail(database, serial_number)

@router.get("/repairs")
def get_repair_queue(
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)  # ADD THIS
) -> dict[str, list[dict[str, Any]]]:
    return {"items": repair_queue(database)}
```

---

## FIX #3: CSRF PROTECTION ON WRITE OPERATIONS

### Problem
```python
# Current vulnerable code
@router.put("/{resource}/{record_id}")
def upsert_record(resource: str, record_id: str, record: RecordInput, 
                 database: Session = Depends(get_db)):
    # NO CSRF PROTECTION
    write_records(resource, [record], database)
    return {"status": "saved"}
```

### Solution

#### Step 1: Update CSRF protection in authentication

```python
# backend/app/api/v1/authentication.py

def require_csrf(request: Request) -> None:
    """Verify CSRF token for state-changing operations."""
    # For requests with session cookie, require CSRF token
    if request.cookies.get("als50_session"):
        csrf_token = request.headers.get("X-CSRF-Token", "")
        csrf_cookie = request.cookies.get("als50_csrf", "")
        
        if not csrf_token or not csrf_cookie:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "CSRF_MISSING",
                    "message": "CSRF token is required"
                }
            )
        
        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(csrf_token, csrf_cookie):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "CSRF_INVALID",
                    "message": "CSRF validation failed"
                }
            )

@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, 
         database: Session = Depends(get_db)) -> dict:
    try:
        profile, roles, token, expires_at = authenticate_enterprise(
            database, body.username, body.password, body.rsa_token, 
            source_ip(request)
        )
    except AuthenticationError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": error.message}
        ) from error
    
    max_age = int((expires_at - datetime.now(expires_at.tzinfo)).total_seconds())
    
    # Set secure session cookie
    response.set_cookie(
        "als50_session",
        token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        max_age=max_age,
        path="/"
    )
    
    # Set CSRF token in httponly cookie AND return in response
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        "als50_csrf",
        csrf_token,
        httponly=True,  # CHANGE FROM FALSE - httponly for security
        secure=request.url.scheme == "https",
        samesite="strict",
        max_age=max_age,
        path="/"
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat(),
        "csrf_token": csrf_token,  # Also return in response body
        "user": {
            "username": profile.username,
            "display_name": profile.display_name,
            "email": profile.email,
            "groups": profile.groups,
            "roles": roles
        }
    }
```

#### Step 2: Add CSRF to all write operations

```python
# backend/app/api/v1/records.py

@router.put("/{resource}/{record_id}")
def upsert_record(
    resource: str, 
    record_id: str, 
    record: RecordInput, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session),  # Authentication
    _: None = Depends(require_csrf)           # CSRF protection
) -> dict[str, str]:
    """Update or create a record."""
    validate_resource(resource)
    if record.record_id != record_id:
        raise HTTPException(status_code=422, detail="Record ID mismatch")
    write_records(resource, [record], database)
    database.commit()
    return {"status": "saved", "record_id": record_id}

@router.post("/{resource}/bulk-upsert")
def bulk_upsert_records(
    resource: str, 
    body: BulkRecordsInput, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session),  # Authentication
    _: None = Depends(require_csrf)           # CSRF protection
) -> dict[str, int]:
    """Bulk upsert records."""
    validate_resource(resource)
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}

@router.put("/{resource}")
def replace_records(
    resource: str, 
    body: BulkRecordsInput, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session),  # Authentication
    _: None = Depends(require_csrf)           # CSRF protection
) -> dict[str, int]:
    """Synchronize records atomically."""
    validate_resource(resource)
    if resource in PRODUCT_MASTER_RESOURCES:
        database.execute(
            delete(ProductMasterRecord).where(ProductMasterRecord.resource == resource)
        )
    else:
        database.execute(delete(RESOURCE_MODELS[resource]))
    write_records(resource, body.records, database)
    database.commit()
    return {"saved": len(body.records)}

@router.delete("/{resource}/{record_id}")
def delete_record(
    resource: str, 
    record_id: str, 
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session),  # Authentication
    _: None = Depends(require_csrf)           # CSRF protection
) -> dict[str, str]:
    """Delete a record."""
    validate_resource(resource)
    if resource in PRODUCT_MASTER_RESOURCES:
        database.execute(
            delete(ProductMasterRecord)
            .where(ProductMasterRecord.resource == resource)
            .where(ProductMasterRecord.record_id == record_id)
        )
    else:
        model = RESOURCE_MODELS[resource]
        database.execute(
            delete(model).where(model.record_id == record_id)
        )
    database.commit()
    return {"status": "deleted", "record_id": record_id}
```

#### Step 3: Update frontend API client

```javascript
// frontend/src/data/api.js
let csrfToken = ''

function setCsrfToken(token) {
  csrfToken = token
  // Also store in sessionStorage for redundancy
  sessionStorage.setItem('csrf_token', token)
}

function getCsrfToken() {
  // First try sessionStorage, then cookie
  return csrfToken || sessionStorage.getItem('csrf_token') || ''
}

async function request(path, options = {}) {
  const token = getCsrfToken()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'same-origin',
    headers: { 
      'Content-Type': 'application/json', 
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(token ? { 'X-CSRF-Token': token } : {}),
      ...options.headers 
    },
    ...options,
  })
  // ... error handling
}

export const authenticationApi = {
  login: async (credentials) => {
    const session = await request('/authentication/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
    accessToken = session.access_token
    setCsrfToken(session.csrf_token)  // Store CSRF token from response
    return session
  },
  
  demoLogin: async (user, password) => {
    const session = await request('/authentication/demo-login', {
      method: 'POST',
      body: JSON.stringify({
        username: user.credential || user.email,
        display_name: user.name,
        email: user.email,
        password
      })
    })
    accessToken = session.access_token
    setCsrfToken(session.csrf_token)  // Store CSRF token
    return session
  }
}
```

---

## FIX #4: AUTHORIZATION & IDOR PREVENTION

### Problem
```python
# Current vulnerable code
@router.get("/components/{serial_number}")
def get_component(serial_number: str, database: Session = Depends(get_db)):
    # No check if user has access to this component
    return component_detail(database, serial_number)
```

### Solution

#### Step 1: Create authorization service

```python
# backend/app/services/authorization.py
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import ComponentInstance, ComponentRepair, UserSession

class AuthorizationService:
    """Handle authorization checks and access control."""
    
    def can_access_component(
        self, 
        username: str, 
        component_id: int, 
        database: Session
    ) -> bool:
        """Check if user has access to component."""
        # Admins can access all
        user_session = database.scalar(
            select(UserSession)
            .where(UserSession.username == username)
            .where(UserSession.revoked_at.is_(None))
        )
        
        if user_session and "Administrator" in user_session.roles:
            return True
        
        # Service users can access components in their assignments
        component = database.scalar(
            select(ComponentInstance).where(ComponentInstance.id == component_id)
        )
        
        if not component:
            return False
        
        # Check if user is assigned to repair for this component
        repair = database.scalar(
            select(ComponentRepair)
            .where(ComponentRepair.component_id == component_id)
            .where(ComponentRepair.repair_status != "completed")
        )
        
        if repair and repair.technician == username:
            return True
        
        return False
    
    def can_modify_record(
        self,
        username: str,
        resource_type: str,
        record_id: str,
        database: Session
    ) -> bool:
        """Check if user can modify a record."""
        # Admins can modify all
        user = database.scalar(
            select(UserSession)
            .where(UserSession.username == username)
            .where(UserSession.revoked_at.is_(None))
        )
        
        if user and "Administrator" in user.roles:
            return True
        
        # Service users can only modify their own entries
        # Implement resource-specific logic
        if resource_type == "incidents":
            # Check if user is assigned to incident
            pass
        
        return False
```

#### Step 2: Update component endpoints with authorization

```python
# backend/app/api/v1/component_lifecycle.py
from app.services.authorization import AuthorizationService

authorization = AuthorizationService()

@router.get("/components/{serial_number}")
def get_component(
    serial_number: str,
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session)
) -> dict[str, Any]:
    """Get component details with authorization check."""
    component = database.scalar(
        select(ComponentInstance)
        .where(ComponentInstance.serial_number == serial_number)
    )
    
    if not component:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Component not found"}
        )
    
    # Check authorization
    if not authorization.can_access_component(claims["sub"], component.id, database):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Access denied"}
        )
    
    return component_detail(database, serial_number)

@router.post("/repairs/{repair_id}/{action}")
def progress_component_repair(
    repair_id: int,
    action: str,
    command: ComponentRepairUpdate,
    database: Session = Depends(get_db),
    claims: dict = Depends(require_session),
    _: None = Depends(require_csrf)
) -> dict[str, Any]:
    """Update repair with authorization check."""
    # Get repair
    repair = database.scalar(
        select(ComponentRepair).where(ComponentRepair.id == repair_id)
    )
    
    if not repair:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Repair not found"}
        )
    
    # Check authorization - only admins or assigned technicians
    is_admin = "Administrator" in claims.get("roles", [])
    is_technician = repair.technician == claims["sub"]  # Assuming field exists
    
    if not (is_admin or is_technician):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Access denied"}
        )
    
    try:
        result = update_repair(database, repair_id, action, command)
        database.commit()
        
        # Log the modification
        from app.services.audit import log_audit_event
        log_audit_event(
            database,
            resource="repair",
            record_id=str(repair_id),
            operation="UPDATE",
            username=claims["sub"],
            action=action,
            changes=command.model_dump()
        )
        
        return result
    except Exception:
        database.rollback()
        raise
```

---

## FIX #5: LDAP INJECTION PREVENTION

### Problem
```python
# Current vulnerable code
escaped_username = username.replace("\\", "\\5c").replace("*", "\\2a")\
                            .replace("(", "\\28").replace(")", "\\29")
# Missing escapes for: &, |, ~, NUL, /
```

### Solution

```python
# backend/app/services/authentication.py
from ldap3.utils.dn import escape_rdn
from ldap3 import ALL_ATTRIBUTES

class ActiveDirectoryLdapConnector:
    def find_user(self, username: str) -> DirectoryProfile:
        """Find user in Active Directory using LDAP."""
        server_uri = os.getenv("LDAP_SERVER_URI")
        base_dn = os.getenv("LDAP_BASE_DN")
        bind_dn = os.getenv("LDAP_BIND_DN")
        bind_password = os.getenv("LDAP_BIND_PASSWORD")
        
        if not all((server_uri, base_dn, bind_dn, bind_password)):
            raise AuthenticationError(
                "DIRECTORY_UNAVAILABLE",
                "Active Directory is not configured.",
                503
            )
        
        if not server_uri.lower().startswith("ldaps://"):
            raise AuthenticationError(
                "DIRECTORY_TLS_REQUIRED",
                "LDAP must use LDAPS (TLS).",
                503
            )
        
        try:
            # Use ldap3's proper escaping function
            escaped_username = escape_rdn(username)
            
            # Create server connection with TLS validation
            import certifi
            server = Server(
                server_uri,
                use_ssl=True,
                tls=Tls(
                    validate=2,  # CERT_REQUIRED
                    ca_certs_file=certifi.where()
                )
            )
            
            # Bind as service account
            with Connection(server, user=bind_dn, password=bind_password, 
                          auto_bind=True, connect_timeout=5) as connection:
                
                # Search for user with proper filter
                search_filter = f"(&(objectClass=user)(sAMAccountName={escaped_username}))"
                
                connection.search(
                    base_dn,
                    search_filter,
                    attributes=[
                        "displayName",
                        "mail",
                        "memberOf",
                        "sAMAccountName",
                        "userAccountControl",
                        "accountExpires"
                    ],
                    size_limit=1  # Only get one result
                )
                
                if not connection.entries:
                    raise AuthenticationError(
                        "DIRECTORY_USER_NOT_FOUND",
                        "Directory profile was not found."
                    )
                
                entry = connection.entries[0]
                
                # Check if account is disabled
                user_account_control = int(entry.userAccountControl.value or 0)
                is_disabled = bool(user_account_control & 2)  # 0x2 = ACCOUNTDISABLE
                
                if is_disabled:
                    raise AuthenticationError(
                        "AUTH_ACCOUNT_DISABLED",
                        "Account is disabled."
                    )
                
                # Extract groups
                groups = [str(group) for group in (entry.memberOf.values or [])]
                
                return DirectoryProfile(
                    username=str(entry.sAMAccountName.value),
                    display_name=str(entry.displayName.value or entry.sAMAccountName.value),
                    email=str(entry.mail.value or ""),
                    groups=groups
                )
        
        except Exception as error:
            if isinstance(error, AuthenticationError):
                raise
            
            raise AuthenticationError(
                "DIRECTORY_ERROR",
                "Failed to connect to directory service.",
                503
            ) from error
    
    def authenticate(self, username: str, password: str) -> DirectoryProfile:
        """Authenticate user credentials against Active Directory."""
        profile = self.find_user(username)
        
        server_uri = os.getenv("LDAP_SERVER_URI")
        user_dn_template = os.getenv("LDAP_USER_DN_TEMPLATE", "{username}@{domain}")
        domain = os.getenv("LDAP_USER_DOMAIN", "")
        
        if not server_uri:
            raise AuthenticationError(
                "DIRECTORY_UNAVAILABLE",
                "Active Directory is not configured.",
                503
            )
        
        if not server_uri.lower().startswith("ldaps://"):
            raise AuthenticationError(
                "DIRECTORY_TLS_REQUIRED",
                "LDAP must use LDAPS (TLS).",
                503
            )
        
        # Format user DN using template
        user_dn = user_dn_template.format(
            username=profile.username,
            domain=domain
        )
        
        try:
            import certifi
            server = Server(
                server_uri,
                use_ssl=True,
                tls=Tls(
                    validate=2,  # CERT_REQUIRED
                    ca_certs_file=certifi.where()
                ),
                connect_timeout=5
            )
            
            # Attempt to bind with user credentials
            with Connection(
                server,
                user=user_dn,
                password=password,
                auto_bind=True,
                connect_timeout=5
            ):
                return profile
        
        except Exception as error:
            raise AuthenticationError(
                "AUTH_INVALID_CREDENTIALS",
                "Username or password is invalid."
            ) from error
```

---

## FIX #6: SECRETS MANAGEMENT

### Problem
Credentials stored in environment variables without encryption or rotation.

### Solution (Production Deployment)

#### Option A: AWS Secrets Manager

```python
# backend/app/config.py
import boto3
from botocore.exceptions import ClientError

class SecretsManager:
    def __init__(self):
        self.client = boto3.client('secretsmanager')
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour
    
    def get_secret(self, secret_name: str) -> str:
        """Retrieve secret from AWS Secrets Manager."""
        if secret_name in self.cache:
            secret_data = self.cache[secret_name]
            if time.time() - secret_data['timestamp'] < self.cache_ttl:
                return secret_data['value']
        
        try:
            response = self.client.get_secret_value(SecretId=secret_name)
            if 'SecretString' in response:
                value = response['SecretString']
            else:
                value = base64.b64decode(response['SecretBinary'])
            
            # Cache with timestamp
            self.cache[secret_name] = {
                'value': value,
                'timestamp': time.time()
            }
            
            return value
        except ClientError as error:
            raise RuntimeError(f"Failed to retrieve secret '{secret_name}'") from error

# Usage
secrets_manager = SecretsManager()
jwt_secret = secrets_manager.get_secret('aerofix/auth/jwt_secret')
db_password = secrets_manager.get_secret('aerofix/database/password')
```

#### Option B: HashiCorp Vault

```python
# backend/app/config.py
import hvac

class VaultSecretsManager:
    def __init__(self):
        self.client = hvac.Client(
            url=os.getenv('VAULT_ADDR', 'http://localhost:8200'),
            token=os.getenv('VAULT_TOKEN')
        )
        self.cache = {}
    
    def get_secret(self, path: str) -> dict:
        """Retrieve secret from Vault."""
        if path in self.cache:
            return self.cache[path]['data']['data']
        
        try:
            secret = self.client.secrets.kv.read_secret_version(path=path)
            self.cache[path] = secret
            return secret['data']['data']
        except Exception as error:
            raise RuntimeError(f"Failed to retrieve secret from Vault: {path}") from error

# Usage
vault = VaultSecretsManager()
auth_secrets = vault.get_secret('aerofix/auth')
jwt_secret = auth_secrets['jwt_secret']
ldap_password = auth_secrets['ldap_bind_password']
```

#### Option C: Azure Key Vault

```python
# backend/app/config.py
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

class AzureKeyVaultManager:
    def __init__(self):
        credential = DefaultAzureCredential()
        vault_url = f"https://{os.getenv('VAULT_NAME')}.vault.azure.net/"
        self.client = SecretClient(vault_url=vault_url, credential=credential)
        self.cache = {}
    
    def get_secret(self, secret_name: str) -> str:
        """Retrieve secret from Azure Key Vault."""
        if secret_name in self.cache:
            return self.cache[secret_name]
        
        try:
            secret = self.client.get_secret(secret_name)
            self.cache[secret_name] = secret.value
            return secret.value
        except Exception as error:
            raise RuntimeError(f"Failed to retrieve secret: {secret_name}") from error

# Usage
vault = AzureKeyVaultManager()
jwt_secret = vault.get_secret('aerofix-auth-jwt-secret')
```

---

## FIX #7: REMOVE DEMO PRIVILEGE ESCALATION

### Problem
```python
# Current vulnerable code
roles = ["Administrator"] if profile.username.lower().startswith("als-emp-001") else ["Service User"]
# Anyone with username starting with "als-emp-001" becomes admin!
```

### Solution

```python
# backend/app/services/authentication.py

def issue_demo_session(database: Session, profile: DirectoryProfile, 
                      source_ip: str | None) -> tuple[str, list[str], datetime]:
    """Issue demo session - demo login always grants Service User role."""
    settings = settings_for(database)
    
    # Get explicit list of demo admin users (if any)
    demo_admin_usernames = set(
        name.strip().lower() 
        for name in os.getenv("DEMO_ADMIN_USERNAMES", "").split(",")
        if name.strip()
    )
    
    # Determine roles - explicit whitelist only
    if profile.username.lower() in demo_admin_usernames:
        roles = ["Administrator"]
    else:
        roles = ["Service User"]
    
    token, _, expires_at = issue_session(
        database,
        profile,
        roles,
        settings.session_timeout_minutes
    )
    
    audit(
        database,
        event_type="demo_login",
        outcome="success",
        username=profile.username,
        provider="demo",
        source_ip=source_ip,
        correlation_id=secrets.token_hex(16),
        details={"roles": roles}
    )
    
    return token, roles, expires_at
```

Add to `.env.example`:
```bash
# Demo admin users (comma-separated usernames that get admin in demo mode)
# Leave empty for no demo admins
DEMO_ADMIN_USERNAMES=
```

---

## FIX #8: HTTPS ENFORCEMENT

### Problem
No HTTPS enforcement in nginx configuration.

### Solution

```nginx
# frontend/nginx.conf

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Minimum TLS 1.2 (1.3 recommended)
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    
    # HSTS (Strict-Transport-Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CSP
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" always;
    
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 32m;
    
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~ \.mjs$ {
        types {
            application/javascript mjs;
        }
    }
}
```

### Generate SSL Certificate

```bash
# For development
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# For production (use Let's Encrypt)
sudo certbot certonly --standalone -d yourdomain.com
```

Update docker-compose.yml:
```yaml
services:
  web:
    build: ./frontend
    ports:
      - "${APP_PORT:-443}:443"
      - "80:80"  # For HTTP redirect
    volumes:
      - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
      - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro
    depends_on:
      - api
```

---

## FIX #9: RATE LIMITING

### Problem
Bulk operations and endpoints can be abused with DoS attacks.

### Solution

```bash
# Install slowapi
pip install slowapi
```

```python
# backend/app/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, 
                         lambda request, exc: JSONResponse(
                             status_code=429,
                             content={"detail": "Rate limit exceeded"}
                         ))

# Apply limiter to app
app = Limiter(key_func=get_remote_address)(app)

# Include routers with rate limiting
app.include_router(health_router, prefix="/api/v1")
app.include_router(records_router, prefix="/api/v1")
```

```python
# backend/app/api/v1/records.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

@router.get("/{resource}")
@limiter.limit("100/minute")  # 100 requests per minute
def list_records(request: Request, ...):
    # ... implementation

@router.post("/{resource}/bulk-upsert")
@limiter.limit("10/minute")  # 10 bulk uploads per minute
def bulk_upsert_records(request: Request, ...):
    # ... implementation

@router.put("/{resource}")
@limiter.limit("5/minute")  # 5 full replaces per minute
def replace_records(request: Request, ...):
    # ... implementation

@router.delete("/{resource}/{record_id}")
@limiter.limit("50/minute")  # 50 deletes per minute
def delete_record(request: Request, ...):
    # ... implementation
```

```python
# backend/app/api/v1/authentication.py
@router.post("/login")
@limiter.limit("5/minute")  # 5 login attempts per minute
def login(request: Request, ...):
    # ... implementation

@router.post("/demo-login")
@limiter.limit("10/minute")  # 10 demo logins per minute
def demo_login(request: Request, ...):
    # ... implementation
```

---

## FIX #10: SECURITY HEADERS

### Problem
Missing comprehensive security headers in nginx.

### Solution

```nginx
# Complete security header configuration for nginx.conf

server {
    # ... SSL config from Fix #8 ...
    
    # SECURITY HEADERS
    
    # Prevent MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;
    
    # Prevent clickjacking
    add_header X-Frame-Options "DENY" always;
    
    # XSS Protection (for older browsers)
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Referrer Policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Permissions Policy (formerly Feature-Policy)
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://login.microsoftonline.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';" always;
    
    # Strict Transport Security (HSTS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Additional security headers
    add_header X-Permitted-Cross-Domain-Policies "none" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    
    # ... rest of nginx config ...
}
```

Update `requirements.txt` to include:
```bash
pip install secure
```

Then in Python, you can verify headers:
```python
# backend/app/middleware.py
from secure import Secure

secure_headers = Secure()

@app.middleware("http")
async def set_secure_headers(request, call_next):
    response = await call_next(request)
    response.headers.update(secure_headers.framework.headers())
    return response
```

---

## VERIFICATION CHECKLIST

After implementing all fixes, verify:

```bash
#!/bin/bash

echo "🔒 Security Fixes Verification"
echo "=============================="

# 1. Check JWT Secret
if grep -q "development-only-signing-key" docker-compose.yml; then
    echo "❌ FAIL: Default JWT secret still in docker-compose.yml"
else
    echo "✅ PASS: JWT secret properly configured"
fi

# 2. Check .env is in .gitignore
if grep -q "^\.env" .gitignore; then
    echo "✅ PASS: .env in .gitignore"
else
    echo "❌ FAIL: .env not in .gitignore"
fi

# 3. Test authentication on /records endpoint
RESPONSE=$(curl -s http://localhost:8000/api/v1/records/customers)
if echo "$RESPONSE" | grep -q "401\|403"; then
    echo "✅ PASS: /records endpoint requires authentication"
else
    echo "❌ FAIL: /records endpoint accessible without auth"
fi

# 4. Check HTTPS redirect
RESPONSE=$(curl -i -L http://localhost | head -1)
if echo "$RESPONSE" | grep -q "301"; then
    echo "✅ PASS: HTTPS redirect configured"
else
    echo "⚠️  WARNING: Verify HTTPS redirect manually"
fi

# 5. Check security headers
HEADERS=$(curl -i https://localhost 2>/dev/null | grep -i "strict-transport\|x-frame\|x-content")
if [ ! -z "$HEADERS" ]; then
    echo "✅ PASS: Security headers present"
    echo "$HEADERS"
else
    echo "❌ FAIL: Security headers missing"
fi

# 6. Run security scanners
echo ""
echo "Running security scanners..."
bandit -r backend/app -q && echo "✅ Bandit passed" || echo "⚠️  Bandit found issues"
safety check -q && echo "✅ Safety passed" || echo "⚠️  Safety found issues"

echo ""
echo "=============================="
echo "Verification complete!"
```

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All critical fixes implemented
- [ ] Code reviewed by 2 developers
- [ ] Security tests passing
- [ ] Bandit/Safety scanners passing
- [ ] Deployed to staging environment
- [ ] Manual penetration testing completed
- [ ] SSL/TLS certificates generated and configured
- [ ] Secrets configured in production (not in code)
- [ ] HTTPS enforced and verified
- [ ] Rate limiting configured and tested
- [ ] Audit logging implemented and verified
- [ ] Authentication required on all data endpoints
- [ ] CSRF protection verified on write operations
- [ ] Authorization checks implemented and tested
- [ ] Security headers verified in HTTP responses
- [ ] Database backups configured
- [ ] Incident response plan reviewed

---

**Last Updated:** 2026-09-01  
**Status:** Ready for Implementation  
**Next Step:** Begin with Critical Fixes (Fix #1-#8)

