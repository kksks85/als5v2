# 🚀 SECURITY FIXES DEPLOYMENT GUIDE

## Quick Start: Applying Security Fixes

This guide shows how to deploy the Aerofix application with all critical security fixes applied.

---

## 📋 PREREQUISITE CHECKLIST

Before deploying, ensure you have:

- [ ] Python 3.12+ installed
- [ ] Node.js 22+ installed
- [ ] Docker & Docker Compose installed
- [ ] PostgreSQL 16 (or using Docker)
- [ ] OpenSSL for certificate generation
- [ ] Text editor for configuration
- [ ] Terminal access

---

## 🔐 STEP 1: GENERATE REQUIRED SECRETS

Generate strong secrets that will be used for the deployment:

### Generate JWT Secret (64+ characters)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
# Example output: T4Qh9k2L_vN8xM5pJ1wQ3aBcD7eF6gH9iJ0kL2mN3oP4qR5sT6uV7wX8yZ9aB0cD1eF2gH3iJ4kL5mN6oP7qR8sT9uV0wX1yZ2aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0k
```

### Generate Database Password (32 characters)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Example output: A7k9x2mL_vN8pQ5bJ1wD3hF6iR0sT4uV
```

### Generate Admin Password (32 characters)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Example output: K5m2n9L_xQ8wP3aB7cD0eF6gH2iJ1kL9
```

### Generate SMTP Password (if using email)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Example output: S3uT9v2W_xY1zB6cD7eF0gH4iJ2kL5m
```

---

## 📝 STEP 2: CREATE .env FILE

Copy `.env.example` to `.env` and fill in the generated secrets:

```bash
cp .env.example .env
```

Edit `.env` with your secrets:

```bash
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
POSTGRES_USER=als50
POSTGRES_PASSWORD=A7k9x2mL_vN8pQ5bJ1wD3hF6iR0sT4uV     # ← Your generated DB password
POSTGRES_DB=als50

# ============================================================================
# APPLICATION ENVIRONMENT
# ============================================================================
APP_ENV=production
APP_PUBLIC_URL=https://aerofix.company.com              # ← Your domain

# ============================================================================
# CORS CONFIGURATION
# ============================================================================
CORS_ORIGINS=https://aerofix.company.com                # ← Your domain

# ============================================================================
# JWT AUTHENTICATION
# ============================================================================
AUTH_JWT_SECRET=T4Qh9k2L_vN8xM5pJ1wQ3aBcD7eF6gH9iJ0kL2mN3oP4qR5sT6uV7wX8yZ9aB0cD1eF2gH3iJ4kL5mN6oP7qR8sT9uV0wX1yZ2aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0k  # ← Your generated JWT secret

# ============================================================================
# LDAP / ACTIVE DIRECTORY
# ============================================================================
LDAP_SERVER_URI=ldaps://ad.company.internal:636
LDAP_BASE_DN=DC=company,DC=internal
LDAP_BIND_DN=CN=als50-service,OU=Service Accounts,DC=company,DC=internal
LDAP_BIND_PASSWORD=<Your-AD-Service-Account-Password>
LDAP_USER_DN_TEMPLATE={username}@{domain}
LDAP_USER_DOMAIN=company.internal

# ============================================================================
# LOCAL ADMIN ACCOUNT
# ============================================================================
UAT_LOCAL_ADMIN_USERNAME=admin
UAT_LOCAL_ADMIN_PASSWORD=K5m2n9L_xQ8wP3aB7cD0eF6gH2iJ1kL9  # ← Your generated admin password
UAT_LOCAL_ADMIN_EMAIL=admin@aerofix.local

# ============================================================================
# DEMO LOGIN (Disabled by default)
# ============================================================================
UAT_DEMO_PASSWORD=                                       # ← Leave empty to disable

# ============================================================================
# SMTP CONFIGURATION
# ============================================================================
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USERNAME=noreply@company.com
SMTP_PASSWORD=S3uT9v2W_xY1zB6cD7eF0gH4iJ2kL5m           # ← Your generated SMTP password
SMTP_FROM_EMAIL=noreply@company.com
SMTP_FROM_NAME=Aerofix Service
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

### ✅ IMPORTANT: Protect the .env File
```bash
# Make .env readable only by owner
chmod 600 .env

# Verify .env is in .gitignore
grep "^.env$" .gitignore

# Never commit .env
git status  # Should show .env as untracked or ignored
```

---

## 🔒 STEP 3: SETUP SSL/TLS CERTIFICATES

### Option A: Using Let's Encrypt (Recommended for Production)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d aerofix.company.com -d www.aerofix.company.com

# Certificates saved at:
# /etc/letsencrypt/live/aerofix.company.com/fullchain.pem
# /etc/letsencrypt/live/aerofix.company.com/privkey.pem
```

### Option B: Using Self-Signed Certificate (Development Only)
```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -newkey rsa:2048 -keyout private.key -out certificate.crt -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Company/CN=aerofix.company.com"

# Copy to nginx config directory
mkdir -p frontend/ssl
cp certificate.crt frontend/ssl/
cp private.key frontend/ssl/
```

### Update nginx.conf with Certificate Paths
```nginx
# frontend/nginx.conf
server {
    listen 443 ssl http2;
    server_name aerofix.company.com;
    
    # Update these paths to your certificates
    ssl_certificate /etc/letsencrypt/live/aerofix.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aerofix.company.com/privkey.pem;
    
    # ... rest of configuration
}
```

---

## 🐳 STEP 4: DEPLOY WITH DOCKER COMPOSE

### Build and Start Services
```bash
# Build images
docker-compose build

# Start services (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### Verify Deployment
```bash
# Check PostgreSQL
docker-compose exec db psql -U als50 -d als50 -c "SELECT version();"

# Check FastAPI backend
curl -X GET http://localhost:8000/api/v1/health \
  -H "Content-Type: application/json"

# Check Nginx frontend
curl -I https://localhost/
```

---

## ✅ STEP 5: VERIFY SECURITY FIXES

### Fix #1: JWT Secret Management
```bash
# Verify secret is loaded
docker-compose logs backend | grep -i "secret\|jwt"

# Verify minimum length
python3 -c "from backend.app.services.authentication import get_auth_secret; print(f'Secret length: {len(get_auth_secret())}')"
```

### Fix #2: Authentication on Data Endpoints
```bash
# Test: Unauthenticated request should fail with 401
curl -X GET http://localhost:8000/api/v1/records/customer \
  -H "Content-Type: application/json"
# Expected: 401 Unauthorized

# Test: Authenticated request should work
curl -X GET http://localhost:8000/api/v1/records/customer \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"
# Expected: 200 OK
```

### Fix #3: CSRF Protection
```bash
# Test: Write without CSRF token should fail
curl -X PUT http://localhost:8000/api/v1/records/customer/123 \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'
# Expected: 403 Forbidden (CSRF validation failed)

# Test: Write with CSRF token should work
curl -X PUT http://localhost:8000/api/v1/records/customer/123 \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "X-CSRF-Token: <YOUR_CSRF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'
# Expected: 200 OK or appropriate response
```

### Fix #5: LDAP Injection Prevention
```bash
# Test: Special characters should be properly escaped
# This would be tested with automated security tests
docker-compose logs backend | grep -i "ldap\|escape"
```

### Fix #6: Secrets Management
```bash
# Verify secrets are loaded from environment
docker-compose exec backend env | grep -E "POSTGRES_PASSWORD|AUTH_JWT_SECRET"

# Verify .env file is protected
ls -la .env
# Expected: -rw------- (600 permissions)
```

### Fix #7: Demo Privilege Escalation Prevention
```bash
# Test: Demo login should NOT get Administrator role
# Login as "als-emp-001" (would have gotten admin role before)
# Verify role is "Service User", not "Administrator"

# Check logs for demo session
docker-compose logs backend | grep -i "demo\|issue_demo_session"
```

### Fix #8: HTTPS Enforcement
```bash
# Test: HTTP should redirect to HTTPS
curl -I http://localhost/
# Expected: 301 Moved Permanently to https://

# Test: HSTS header should be present
curl -I https://localhost/
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Test: Security headers present
curl -I https://localhost/ | grep -i "X-Content-Type-Options\|X-Frame-Options\|Strict-Transport-Security"
```

---

## 📊 STEP 6: SECURITY VALIDATION

### Run Security Tests
```bash
# Check Python dependencies for vulnerabilities
pip install safety
safety check -r backend/requirements.txt

# Run Bandit for Python security issues
pip install bandit
bandit -r backend/app/

# Check Node dependencies
npm audit
```

### Test Authentication Flows
```bash
# Test LDAP authentication
# Test Entra ID authentication (if configured)
# Test Local admin authentication
# Test demo login (should be disabled or restricted)

# Run automated tests
cd backend
pytest tests/test_authentication_api.py -v
pytest tests/test_authentication_services.py -v
```

### SSL/TLS Verification
```bash
# Check SSL certificate validity
openssl s_client -connect aerofix.company.com:443 -showcerts

# Verify SSL/TLS configuration
ssl-test-api=$(curl -s -I https://aerofix.company.com/)
echo "$ssl_test_api" | grep -i "strict-transport-security\|x-content-type-options"
```

---

## 🔄 STEP 7: MONITORING & LOGGING

### Setup Monitoring
```bash
# Enable audit logging
docker-compose exec backend python3 -c "from app.services.audit import enable_logging; enable_logging()"

# Monitor authentication attempts
docker-compose logs -f backend | grep -i "login\|auth\|session"

# Monitor errors
docker-compose logs -f backend | grep -i "error\|exception\|critical"
```

### Health Checks
```bash
# Periodic health check
while true; do
  echo "$(date): Checking application health..."
  curl -s http://localhost:8000/api/v1/health | jq .
  sleep 300  # Check every 5 minutes
done
```

---

## 📋 POST-DEPLOYMENT CHECKLIST

- [ ] All services running: `docker-compose ps`
- [ ] Database migrations completed: `docker-compose logs db | grep migration`
- [ ] JWT secret validation passing
- [ ] HTTPS redirect working: `curl -I http://localhost/`
- [ ] HSTS header present: `curl -I https://localhost/`
- [ ] Authentication required on endpoints
- [ ] CSRF protection working on write operations
- [ ] LDAP/AD authentication tested
- [ ] Local admin account tested
- [ ] Email/SMTP working (if configured)
- [ ] Audit logging enabled
- [ ] Monitoring alerts configured
- [ ] Backup procedure documented
- [ ] Incident response plan ready
- [ ] Security headers validated

---

## 🚨 TROUBLESHOOTING

### Service Won't Start
```bash
# Check logs
docker-compose logs

# Check if ports are in use
sudo lsof -i :8000  # FastAPI
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :80   # Nginx HTTP
sudo lsof -i :443  # Nginx HTTPS

# Restart services
docker-compose restart
```

### Authentication Failing
```bash
# Check authentication logs
docker-compose logs backend | grep -i "auth\|session"

# Verify JWT secret is set
docker-compose exec backend env | grep AUTH_JWT_SECRET

# Test JWT validation
curl -X POST http://localhost:8000/api/v1/auth/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### LDAP Connection Failing
```bash
# Check LDAP configuration
docker-compose exec backend env | grep LDAP

# Test LDAP connection
docker-compose exec backend python3 -c "
from app.services.authentication import ActiveDirectoryLdapConnector
connector = ActiveDirectoryLdapConnector()
print('LDAP connection test...')
"

# Check LDAP logs
docker-compose logs backend | grep -i "ldap"
```

### HTTPS Certificate Issues
```bash
# Check certificate validity
openssl x509 -in frontend/ssl/certificate.crt -text -noout

# Check nginx configuration
docker-compose exec nginx nginx -t

# Restart nginx
docker-compose restart nginx
```

---

## 📞 PRODUCTION DEPLOYMENT

For production deployment:

1. **Use managed database** (AWS RDS, Azure Database, etc.)
2. **Use secrets management** (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
3. **Use CDN** (CloudFront, Azure CDN, etc.)
4. **Enable WAF** (AWS WAF, ModSecurity, etc.)
5. **Setup auto-scaling** (Kubernetes, Docker Swarm, etc.)
6. **Enable logging** (CloudWatch, Application Insights, ELK, etc.)
7. **Setup monitoring** (Datadog, New Relic, Prometheus, etc.)
8. **Enable backup & disaster recovery**
9. **Configure alerting** (PagerDuty, OpsGenie, etc.)
10. **Regular penetration testing**

---

## 📚 NEXT STEPS

After successful deployment:

1. **Schedule security review** - Verify all fixes working correctly
2. **Run penetration test** - Validate security improvements
3. **Implement remaining fixes** - Fix #9 (Rate Limiting), Fix #10+
4. **Setup CI/CD pipeline** - Automated security testing
5. **Document procedures** - Backup, restore, incident response
6. **Train team** - Security best practices
7. **Monitor continuously** - Log analysis, threat detection
8. **Update regularly** - Security patches, dependency updates

---

## 🎯 SUCCESS CRITERIA

Deployment is successful when:

- ✅ All services starting without errors
- ✅ Authentication required on all data endpoints
- ✅ CSRF protection working on all write operations
- ✅ HTTPS enforced with valid certificate
- ✅ Security headers present in all responses
- ✅ No hardcoded secrets in code or config
- ✅ LDAP injection prevention working
- ✅ Demo users cannot access admin functions
- ✅ All tests passing
- ✅ Security scanning shows no critical issues

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-01  
**Applicable Fixes:** #1, #2, #3, #5, #6, #7, #8  

For questions or issues, refer to:
- [SECURITY_TECHNICAL_FIXES.md](SECURITY_TECHNICAL_FIXES.md) - Implementation details
- [FIXES_IMPLEMENTATION_SUMMARY.md](FIXES_IMPLEMENTATION_SUMMARY.md) - Summary of all fixes
- [README.md](README.md) - General project documentation
