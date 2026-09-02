# Admin Authentication - Free from Active Directory

## Overview

The admin account has been configured to **ALWAYS use password authentication** and is **completely independent from Active Directory (AD)**. Even when AD/LDAP authentication is enforced for all other users, the admin account bypasses AD entirely and authenticates using only a configured password.

## Key Features

✅ **Admin bypasses AD completely** - Uses local password authentication only  
✅ **Admin always has full privileges** - Always assigned "Administrator" role  
✅ **Mandatory password requirement** - Admin password must be configured when AD is enabled  
✅ **Audit logging** - All admin logins are logged as "local_admin" provider  
✅ **Health endpoint validation** - Shows admin configuration status  

## Required Environment Variables

### For Admin Account (REQUIRED)
```bash
# Admin username (default: "admin")
UAT_LOCAL_ADMIN_USERNAME=admin

# Admin password (MUST be set - no default value)
# Use a strong, unique password - this is the only password for admin access
UAT_LOCAL_ADMIN_PASSWORD=<YOUR_STRONG_PASSWORD_HERE>

# Admin email address (optional, default: admin@als50.local)
UAT_LOCAL_ADMIN_EMAIL=admin@company.com
```

### For JWT (REQUIRED)
```bash
# JWT secret for session tokens (at least 64 characters)
AUTH_JWT_SECRET=<YOUR_64_CHAR_JWT_SECRET>
```

### For AD/LDAP (Only if using Active Directory)
```bash
LDAP_SERVER_URI=ldaps://your-ad-server.com
LDAP_BASE_DN=dc=company,dc=com
LDAP_BIND_DN=CN=Service Account,CN=Users,dc=company,dc=com
LDAP_BIND_PASSWORD=<SERVICE_ACCOUNT_PASSWORD>
LDAP_USER_DOMAIN=company.com
```

## Configuration Steps

### Step 1: Set Admin Credentials
```bash
# Docker Compose or Environment File
export UAT_LOCAL_ADMIN_USERNAME=admin
export UAT_LOCAL_ADMIN_PASSWORD=MySecure@dminPassword123!
export UAT_LOCAL_ADMIN_EMAIL=admin@mycompany.com
```

### Step 2: Enable AD Authentication (if using AD)
```bash
# Set LDAP environment variables
export LDAP_SERVER_URI=ldaps://ad.company.com
# ... other LDAP settings
```

### Step 3: Verify Configuration
```bash
# Check health endpoint
curl http://localhost:8000/api/v1/authentication/health

# Response should show:
{
  "status": "ok",
  "provider": "ldap_ad",
  "enforced": true,
  "admin_password_configured": true,
  "admin_authentication_warning": null
}
```

## Login Flow

### Admin Login
```
1. User enters username: "admin" and password: "<admin_password>"
2. System checks if username matches admin account
3. Password is verified against UAT_LOCAL_ADMIN_PASSWORD
4. If correct → Admin authenticated, session created with "Administrator" role
5. ❌ AD/LDAP is NOT consulted at all
```

### Regular User Login (when AD is enabled)
```
1. User enters username and password
2. System checks if username matches admin account
3. If not admin → Use configured provider (LDAP_AD or RSA_AD)
4. Authenticate against Active Directory
5. Fetch user profile and groups from AD
6. Map AD groups to application roles
```

## Important Security Notes

⚠️ **Password Requirements**
- Admin password is MANDATORY when AD is enabled
- If admin password is not configured when AD is enabled, login will fail with error: "Admin account is not properly configured"
- Use a strong, unique password (minimum 12 characters recommended)
- Store password securely (use environment management tools, secrets, etc.)

⚠️ **No AD Synchronization**
- Admin account profile is NOT fetched from Active Directory
- Admin display name is hardcoded as "Administrator"
- Admin email comes from UAT_LOCAL_ADMIN_EMAIL environment variable
- Admin groups are always empty (not relevant)

⚠️ **Lockout & Rate Limiting**
- Admin account is subject to same rate limiting as other users
- Admin account is subject to same lockout policy as other users
- After 5 failed attempts (default), account is locked for 15 minutes (default)

## API Endpoint Changes

### Health Endpoint
**GET /api/v1/authentication/health**

New fields in response:
```json
{
  "admin_password_configured": true,
  "admin_authentication_warning": null  // Shows warning if password not configured
}
```

### Admin Login
**POST /api/v1/authentication/login**

Request:
```json
{
  "username": "admin",
  "password": "<admin_password>",
  "rsa_token": ""
}
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_at": "2026-09-02T14:30:00Z",
  "user": {
    "username": "admin",
    "display_name": "Administrator",
    "email": "admin@als50.local",
    "groups": [],
    "roles": ["Administrator"]
  }
}
```

## Audit Logging

All admin logins are logged with provider type "local_admin":

```python
# Success
{
  "event_type": "login",
  "outcome": "success",
  "username": "admin",
  "provider": "local_admin",
  "details": {"roles": ["Administrator"]}
}

# Failure (wrong password)
{
  "event_type": "login",
  "outcome": "failure",
  "username": "admin",
  "provider": "local_admin",
  "details": {"code": "AUTH_INVALID_CREDENTIALS"}
}

# Failure (not configured)
{
  "event_type": "login",
  "outcome": "failure",
  "username": "admin",
  "provider": "local_admin",
  "details": {"code": "AUTH_ADMIN_MISCONFIGURED"}
}
```

## Troubleshooting

### Problem: "Admin account is not properly configured"
**Solution:** Ensure UAT_LOCAL_ADMIN_PASSWORD environment variable is set
```bash
export UAT_LOCAL_ADMIN_PASSWORD=YourAdminPassword123!
```

### Problem: Admin login fails with "Username or password is invalid"
**Solution:** Verify the password matches exactly
- Ensure no extra spaces in password
- Check for special characters that need escaping
- Verify password is correctly set in environment

### Problem: Health endpoint shows admin_authentication_warning
**Solution:** Set the UAT_LOCAL_ADMIN_PASSWORD before enabling AD authentication
```bash
export UAT_LOCAL_ADMIN_PASSWORD=<secure_password>
```

### Problem: Can't login after AD is enabled
**Solution:** Verify both admin and AD credentials are configured
1. Check admin password is set: `echo $UAT_LOCAL_ADMIN_PASSWORD`
2. Check AD configuration: `curl http://localhost:8000/api/v1/authentication/health`
3. Ensure AD credentials are correct: `LDAP_SERVER_URI`, `LDAP_BASE_DN`, etc.

## Code Implementation Details

### Changes Made

**File: `backend/app/services/authentication.py`**

1. **`authenticate_enterprise()` function** 
   - Checks for admin account FIRST (before provider selection)
   - Admin always uses password authentication
   - Requires admin password to be set
   - Returns error if admin password not configured when trying to login

2. **`validate_admin_configuration()` function**
   - New utility function to check admin setup
   - Returns admin configuration status
   - Used by health endpoint

**File: `backend/app/api/v1/authentication.py`**

1. **`/authentication/health` endpoint**
   - Added `admin_password_configured` field
   - Added `admin_authentication_warning` field
   - Helps identify configuration issues

## Migration from AD-Only Admin to Free Admin

If you were previously relying on AD for admin login:

1. **Set admin password:**
   ```bash
   export UAT_LOCAL_ADMIN_USERNAME=admin
   export UAT_LOCAL_ADMIN_PASSWORD=YourNewAdminPassword123!
   ```

2. **Restart the application:**
   ```bash
   docker-compose restart backend
   # or restart your deployment
   ```

3. **Test admin login:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/authentication/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"YourNewAdminPassword123!","rsa_token":""}'
   ```

4. **Remove admin from AD groups (optional):**
   - If you were managing admin through AD groups, you can now remove those mappings
   - Admin will always authenticate via local password

## Summary

The admin account is now:
- ✅ **Completely independent from Active Directory**
- ✅ **Always uses password authentication only**
- ✅ **Always assigned Administrator role**
- ✅ **Protected by rate limiting and lockout policies**
- ✅ **Fully audited for all login attempts**
- ✅ **Validated in health checks**

This ensures a backup authentication method that cannot be affected by AD outages or misconfigurations.
