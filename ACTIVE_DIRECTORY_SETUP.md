# Active Directory LDAP Setup Guide

## Overview
This guide explains how to configure Active Directory (LDAP) authentication for the ALS50 Service Management system. This is currently running live at the vclient location.

## Prerequisites
- Windows Server with Active Directory Domain Services (AD DS) installed
- LDAP Server configured with TLS/SSL (LDAPS required on port 636)
- Service account with read permissions for user and group lookups
- Network connectivity from deployment environment to AD server
- Valid TLS certificate (self-signed certificates require proper CA bundle configuration)

## Environment Variables Configuration

All configuration is done through environment variables that need to be set in your deployment environment.

### Required LDAP Configuration Variables

```bash
# Active Directory LDAP Server URI (must use LDAPS for encryption)
LDAP_SERVER_URI=ldaps://ad.corp.example.com:636

# Base DN for user searches (this is where user objects are located)
LDAP_BASE_DN=OU=Users,DC=corp,DC=example,DC=com

# Service account DN (read-only account with search permissions)
LDAP_BIND_DN=CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com

# Service account password (stored securely in vault)
LDAP_BIND_PASSWORD=YourServiceAccountPassword

# Optional: User DN template for authentication (default shown)
# This template is used to construct the DN for user authentication
LDAP_USER_DN_TEMPLATE={username}@{domain}

# Optional: Domain suffix for user authentication
LDAP_USER_DOMAIN=corp.example.com
```

### Authentication JWT Configuration

```bash
# JWT signing secret for session tokens (minimum 32 characters)
AUTH_JWT_SECRET=your-secret-key-minimum-32-characters-long
```

## Step-by-Step Setup Instructions

### Step 1: Verify Active Directory Server Configuration

1. **Connect to your AD server** and verify LDAPS is enabled on port 636:
   ```bash
   openssl s_client -connect ad.corp.example.com:636
   ```

2. **Verify certificate validity**:
   ```bash
   openssl s_client -connect ad.corp.example.com:636 -showcerts
   ```

3. **Note the certificate details** - you'll need these if self-signed

### Step 2: Create Service Account in Active Directory

1. **Open Active Directory Users and Computers** on your DC
2. **Create a new user account** (not a computer account):
   - **Name**: `ServiceAccount` (or your preferred name)
   - **Username**: `ServiceAccount`
   - **Password**: Create a strong password (store securely)
   - **Uncheck**: "User must change password at next logon"
   - **Check**: "Password never expires"

3. **Set account permissions**:
   ```
   Right-click on the Users OU → Delegate Control
   
   Select "ServiceAccount" → Next
   
   Select "Read all user information" → Next
   
   Confirm delegation
   ```

4. **Get the account's Distinguished Name (DN)**:
   ```
   Open Active Directory Users and Computers
   Find your ServiceAccount
   Right-click → Properties → Attribute Editor
   Look for: `distinguishedName`
   Example: CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com
   ```

### Step 3: Create User Groups and Add Mappings

1. **Create security groups in Active Directory**:
   - `CN=ALS50-Admins,OU=Groups,DC=corp,DC=example,DC=com` (for Administrators)
   - `CN=ALS50-Users,OU=Groups,DC=corp,DC=example,DC=com` (for Service Users)

2. **Add users to appropriate groups**:
   - Add admin users to `ALS50-Admins` group
   - Add regular users to `ALS50-Users` group

3. **Verify group membership**:
   ```bash
   # In Active Directory Users and Computers, open the group
   # Members tab should show all assigned users
   ```

### Step 4: Deploy Environment Configuration

#### On Windows Server (Deployment Environment)

1. **Set environment variables** (using System Properties or PowerShell):
   ```powershell
   # Run as Administrator
   [Environment]::SetEnvironmentVariable("LDAP_SERVER_URI", "ldaps://ad.corp.example.com:636", "Machine")
   [Environment]::SetEnvironmentVariable("LDAP_BASE_DN", "OU=Users,DC=corp,DC=example,DC=com", "Machine")
   [Environment]::SetEnvironmentVariable("LDAP_BIND_DN", "CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com", "Machine")
   [Environment]::SetEnvironmentVariable("LDAP_BIND_PASSWORD", "ServiceAccountPassword", "Machine")
   [Environment]::SetEnvironmentVariable("LDAP_USER_DOMAIN", "corp.example.com", "Machine")
   [Environment]::SetEnvironmentVariable("AUTH_JWT_SECRET", "your-secret-key-minimum-32-characters-long", "Machine")
   ```

#### On Linux/Docker Deployment

1. **In `.env` file**:
   ```bash
   LDAP_SERVER_URI=ldaps://ad.corp.example.com:636
   LDAP_BASE_DN=OU=Users,DC=corp,DC=example,DC=com
   LDAP_BIND_DN=CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com
   LDAP_BIND_PASSWORD=ServiceAccountPassword
   LDAP_USER_DOMAIN=corp.example.com
   AUTH_JWT_SECRET=your-secret-key-minimum-32-characters-long
   ```

2. **In `docker-compose.yml`**:
   ```yaml
   services:
     backend:
       environment:
         LDAP_SERVER_URI: ldaps://ad.corp.example.com:636
         LDAP_BASE_DN: OU=Users,DC=corp,DC=example,DC=com
         LDAP_BIND_DN: CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com
         LDAP_BIND_PASSWORD: ${LDAP_BIND_PASSWORD}
         LDAP_USER_DOMAIN: corp.example.com
         AUTH_JWT_SECRET: ${AUTH_JWT_SECRET}
   ```

### Step 5: Configure Role Mappings in Application

1. **Login to ALS50** as demo user
2. **Navigate to Settings → Authentication Settings**
3. **On the General tab**:
   - **Authentication provider**: Select "RSA Authentication Manager + Active Directory LDAP"
   - **Enforce enterprise authentication**: Leave unchecked for now (check after testing)
4. **Add role mappings** under "Directory role mappings":
   - **Directory group**: `CN=ALS50-Admins,OU=Groups,DC=corp,DC=example,DC=com`
   - **Application role**: `Administrator`
   - Click "Save"
   
   - **Directory group**: `CN=ALS50-Users,OU=Groups,DC=corp,DC=example,DC=com`
   - **Application role**: `Service User`
   - Click "Save"

### Step 6: Test LDAP Connection

1. **From deployment server**, test connection:
   ```bash
   # On Linux (requires ldap-utils package)
   ldapsearch -x -H ldaps://ad.corp.example.com:636 \
     -D "CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com" \
     -w "ServiceAccountPassword" \
     -b "OU=Users,DC=corp,DC=example,DC=com" \
     "(&(objectClass=user)(sAMAccountName=testuser))"
   ```

2. **Check application health** in Settings:
   - Navigate to Settings → Authentication Settings → General
   - Under "Authentication posture" should show:
     - Status: "Configured"
     - Message: "Enterprise authentication enforced through rsa_ad"

### Step 7: Enable Enterprise Authentication (Production)

⚠️ **Important: Only do this after thorough testing!**

1. **Test login with an AD user** before enabling enforcement:
   - Logout from demo account
   - Login with an AD user (e.g., `corp\username`)
   - Verify role assignment works correctly

2. **Once tested successfully**, enable enforcement:
   - Navigate to Settings → Authentication Settings → General
   - Check "Enforce enterprise authentication"
   - Click "Save general settings"
   - This will **disable demo access** for all future logins

3. **Verify enforced authentication**:
   - Logout
   - Verify login page only shows enterprise login
   - Login with AD credentials
   - Confirm successful authentication

## Troubleshooting

### Connection Issues

**Error: "DIRECTORY_UNAVAILABLE" or "Connection refused"**
- Verify LDAP_SERVER_URI is correct and accessible
- Test network connectivity: `ping ad.corp.example.com`
- Verify LDAPS port 636 is open: `netstat -an | grep 636` (Windows) or `netstat -tuln | grep 636` (Linux)

**Error: "DIRECTORY_TLS_REQUIRED"**
- Ensure URI uses `ldaps://` not `ldap://`
- Verify TLS certificate is valid

### Authentication Issues

**Error: "DIRECTORY_USER_NOT_FOUND"**
- Verify user exists in specified LDAP_BASE_DN
- Check username format (sAMAccountName is used, not UPN)
- Verify service account has search permissions

**Error: "AUTH_INVALID_CREDENTIALS" after LDAP found user**
- Verify LDAP_USER_DN_TEMPLATE and LDAP_USER_DOMAIN match your AD setup
- Test user account is not locked in AD
- Check service account permissions on user object

### Role Mapping Issues

**Error: "AUTHORIZATION_DENIED - No application role is mapped"**
- Verify user is member of mapped AD group
- Check group DN format matches exactly
- Verify group membership is expanded properly (nested groups may need adjustment)

### Certificate Issues (Self-Signed)

If using self-signed certificates:

1. **Export certificate from AD server**:
   ```bash
   openssl s_client -connect ad.corp.example.com:636 -showcerts < /dev/null 2>/dev/null | openssl x509 -outform PEM > ad-cert.pem
   ```

2. **Add to system certificate store**:
   - **Windows**: Import into Trusted Root Certification Authorities
   - **Linux**: Copy to `/etc/ssl/certs/` and run `update-ca-certificates`

## Security Best Practices

1. **Service Account**:
   - Use a dedicated, read-only service account
   - Set "Password never expires" but ensure strong password
   - Monitor for unauthorized access

2. **Network**:
   - Only allow LDAPS (encrypted) connections
   - Use IP whitelisting if possible
   - Monitor LDAP query logs

3. **Secrets Management**:
   - Store LDAP_BIND_PASSWORD in secure vault (not in code)
   - Rotate service account password periodically
   - Use strong AUTH_JWT_SECRET (minimum 32 characters)

4. **Application Access**:
   - Only enable "Enforce enterprise authentication" after complete testing
   - Have a backup demo account available for emergencies
   - Keep audit logs of authentication events

## Related Configuration

### RSA Authentication Manager (Optional)

If also using RSA for second-factor authentication:
```bash
RSA_AM_SERVER=https://rsa-am.corp.example.com:7001
RSA_AM_API_KEY=your-api-key
RSA_AM_SECRET=your-secret
```

### Entra ID / Azure AD (Future)

Azure AD integration is planned for a future release. When available, you'll also configure:
```bash
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-secret
AZURE_AD_REDIRECT_URI=https://portal.example.com/auth/callback
```

## Verification Checklist

After setup, verify the following:

- [ ] LDAP_SERVER_URI environment variable is set and accessible
- [ ] LDAP_BASE_DN matches your AD structure
- [ ] Service account (LDAP_BIND_DN) can authenticate
- [ ] Service account has read permissions on users and groups
- [ ] Role mappings are configured for each AD group
- [ ] Test user can login with AD credentials
- [ ] Test user gets correct role based on AD group membership
- [ ] Application health shows "Configured" status
- [ ] Authentication audit logs show successful logins

## Deployment Files to Modify

1. **docker-compose.yml**: Add LDAP environment variables
2. **Kubernetes secrets** (if using K8s): Create secrets for LDAP_BIND_PASSWORD and AUTH_JWT_SECRET
3. **Deployment documentation**: Update with AD server details
4. **Backup plan**: Document demo account credentials for emergency access

## Contact & Support

For authentication issues at the vclient location:
- Check the Troubleshooting section above
- Review Application Audit Logs in Settings for detailed error messages
- Ensure all environment variables are properly set after any deployment restart
