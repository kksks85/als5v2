# AUTOMATED SECURITY TESTING GUIDE
## Aerofix Service Management API
**Version:** 1.0  
**Date:** 2026-09-01

---

## QUICK START

```bash
# Run all security checks
./scripts/security-check.sh

# Run specific checks
pytest tests/security/  # Unit tests
bandit -r backend/app   # Code scanning
safety check            # Dependency scanning
semgrep -r backend/app  # Pattern matching
```

---

## 1. UNIT TEST SECURITY TESTS

### File: `backend/tests/test_security_authentication.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from sqlalchemy.orm import Session

client = TestClient(app)

class TestAuthenticationSecurity:
    """Security tests for authentication endpoints."""
    
    def test_login_requires_valid_credentials(self, db: Session):
        """Test that login rejects invalid credentials."""
        response = client.post("/api/v1/authentication/login", json={
            "username": "invalid-user",
            "password": "invalid-password"
        })
        assert response.status_code in (401, 403)
        assert "detail" in response.json()
    
    def test_jwt_secret_validation(self, monkeypatch):
        """Test that weak JWT secrets are rejected."""
        monkeypatch.setenv("AUTH_JWT_SECRET", "tooshort")
        monkeypatch.setenv("APP_ENV", "production")
        
        with pytest.raises(RuntimeError):
            from app.services.authentication import get_auth_secret
            get_auth_secret()
    
    def test_session_token_expiration(self, db: Session, client):
        """Test that expired tokens are rejected."""
        from datetime import UTC, datetime, timedelta
        from app.models import UserSession
        
        # Create expired session
        expired_session = UserSession(
            session_id="expired-token",
            username="testuser",
            roles=["Service User"],
            expires_at=datetime.now(UTC) - timedelta(hours=1)
        )
        db.add(expired_session)
        db.commit()
        
        # Try to use expired token
        headers = {"Authorization": "Bearer expired-token"}
        response = client.get("/api/v1/records/customers", headers=headers)
        assert response.status_code == 401
    
    def test_ldap_injection_protection(self):
        """Test that LDAP special characters are properly escaped."""
        from app.services.authentication import ActiveDirectoryLdapConnector
        from ldap3.utils.dn import escape_rdn
        
        malicious_inputs = [
            "*",           # Wildcard
            "(uid=*",      # LDAP injection
            ")(uid=*",     # Filter injection
            "admin*",      # Partial wildcard
            "&(uid=*",     # AND injection
            "|(uid=*",     # OR injection
        ]
        
        for malicious in malicious_inputs:
            # Should not raise exception, should escape properly
            escaped = escape_rdn(malicious)
            assert "*" not in escaped or escaped.startswith("\\")
            assert "(" not in escaped or escaped.startswith("\\")
            assert ")" not in escaped or escaped.startswith("\\")

class TestAuthenticationDataSecurity:
    """Security tests for data endpoint authentication."""
    
    def test_list_records_requires_authentication(self):
        """Test that list_records endpoint requires authentication."""
        response = client.get("/api/v1/records/customers")
        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["code"] == "SESSION_INVALID"
    
    def test_list_components_requires_authentication(self):
        """Test that component endpoints require authentication."""
        response = client.get("/api/v1/component-lifecycle/components")
        assert response.status_code == 401
    
    def test_list_repairs_requires_authentication(self):
        """Test that repair endpoints require authentication."""
        response = client.get("/api/v1/component-lifecycle/repairs")
        assert response.status_code == 401

class TestAuthorizationSecurity:
    """Security tests for authorization."""
    
    def test_demo_login_no_privilege_escalation(self, db: Session):
        """Test that demo login cannot escalate privileges."""
        from app.services.authentication import issue_demo_session
        from app.services.authentication import DirectoryProfile
        
        # Attempt privilege escalation
        malicious_profile = DirectoryProfile(
            username="als-emp-001-attacker",
            display_name="Attacker",
            email="attacker@test.com",
            groups=[]
        )
        
        token, roles, expires_at = issue_demo_session(db, malicious_profile, "127.0.0.1")
        
        # Should NOT contain Administrator role
        assert "Administrator" not in roles
        assert "Service User" in roles
    
    def test_service_user_cannot_access_admin_endpoints(self, client, auth_token_service_user):
        """Test that service users cannot access admin endpoints."""
        headers = {"Authorization": f"Bearer {auth_token_service_user}"}
        response = client.get("/api/v1/authentication/settings", headers=headers)
        assert response.status_code == 403
    
    def test_admin_user_can_access_admin_endpoints(self, client, auth_token_admin):
        """Test that admin users can access admin endpoints."""
        headers = {"Authorization": f"Bearer {auth_token_admin}"}
        response = client.get("/api/v1/authentication/settings", headers=headers)
        assert response.status_code == 200

class TestCSRFSecurity:
    """Security tests for CSRF protection."""
    
    def test_write_operation_requires_csrf_token(self, client, auth_token):
        """Test that write operations require CSRF token."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = client.put(
            "/api/v1/records/customers/CUST-001",
            json={"record_id": "CUST-001", "payload": {"name": "Test"}},
            headers=headers
        )
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "CSRF_MISSING"
    
    def test_invalid_csrf_token_rejected(self, client, auth_token):
        """Test that invalid CSRF tokens are rejected."""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-CSRF-Token": "invalid-csrf-token"
        }
        # Set CSRF cookie to different value
        client.cookies.set("als50_csrf", "different-value")
        
        response = client.put(
            "/api/v1/records/customers/CUST-001",
            json={"record_id": "CUST-001", "payload": {"name": "Test"}},
            headers=headers
        )
        assert response.status_code == 403

class TestInputValidationSecurity:
    """Security tests for input validation."""
    
    def test_username_with_control_characters_rejected(self):
        """Test that usernames with control characters are rejected."""
        response = client.post("/api/v1/authentication/login", json={
            "username": "user\x00name",
            "password": "password"
        })
        assert response.status_code == 422
    
    def test_extremely_long_input_rejected(self):
        """Test that excessively long inputs are rejected."""
        response = client.post("/api/v1/authentication/login", json={
            "username": "a" * 1000,
            "password": "password"
        })
        assert response.status_code == 422
    
    def test_sql_injection_payload_handled_safely(self):
        """Test that SQL injection payloads don't cause errors."""
        payloads = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'--",
            "\\'; DROP TABLE users; --"
        ]
        
        for payload in payloads:
            response = client.post("/api/v1/authentication/login", json={
                "username": payload,
                "password": "test"
            })
            # Should not raise 500 error, should reject gracefully
            assert response.status_code != 500

class TestRateLimitingSecurity:
    """Security tests for rate limiting."""
    
    def test_login_rate_limiting(self, client):
        """Test that login attempts are rate limited."""
        for i in range(15):
            response = client.post("/api/v1/authentication/login", json={
                "username": f"user{i}",
                "password": "test"
            })
            if i >= 10:
                # Should be rate limited after 10 attempts
                assert response.status_code == 429
    
    def test_bulk_upload_rate_limiting(self, client, auth_token):
        """Test that bulk uploads are rate limited."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        for i in range(15):
            response = client.post(
                "/api/v1/records/customers/bulk-upsert",
                json={"records": [{"record_id": f"CUST-{i}", "payload": {}}]},
                headers=headers
            )
            if i >= 10:
                # Should be rate limited
                assert response.status_code == 429

class TestSecurityHeaders:
    """Security tests for HTTP headers."""
    
    def test_security_headers_present(self, client):
        """Test that all security headers are present."""
        response = client.get("/")
        
        required_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "Content-Security-Policy",
            "X-XSS-Protection"
        ]
        
        for header in required_headers:
            assert header in response.headers, f"Missing {header}"
    
    def test_csrf_cookie_is_httponly(self, client):
        """Test that CSRF cookie is HTTPOnly."""
        response = client.post("/api/v1/authentication/login", json={
            "username": "testuser",
            "password": "test"
        })
        
        cookies = response.cookies
        assert "als50_csrf" in cookies
        # Check HTTPOnly flag (this is set via Set-Cookie header)
        # The testclient doesn't fully expose this, so check via headers
        assert "HttpOnly" in response.headers.get("Set-Cookie", "")

class TestAuditLogging:
    """Security tests for audit logging."""
    
    def test_login_events_are_logged(self, db: Session):
        """Test that login events are logged."""
        from app.models import AuthenticationAuditLog
        
        # Perform login
        response = client.post("/api/v1/authentication/login", json={
            "username": "testuser",
            "password": "test"
        })
        
        # Check audit log
        log_entry = db.query(AuthenticationAuditLog).filter_by(
            event_type="login"
        ).first()
        
        assert log_entry is not None
        assert log_entry.username == "testuser"
    
    def test_failed_login_attempts_logged(self, db: Session):
        """Test that failed login attempts are logged."""
        # Attempt login with wrong password
        response = client.post("/api/v1/authentication/login", json={
            "username": "testuser",
            "password": "wrongpassword"
        })
        
        from app.models import AuthenticationAuditLog
        log_entry = db.query(AuthenticationAuditLog).filter_by(
            outcome="failure"
        ).first()
        
        assert log_entry is not None
```

---

## 2. STATIC ANALYSIS - BANDIT

### Installation

```bash
pip install bandit
```

### Run Bandit

```bash
# Scan entire backend
bandit -r backend/app -f json -o bandit-report.json

# Scan specific directory
bandit -r backend/app/services/

# Scan with custom severity
bandit -r backend/app -ll  # Medium and higher
```

### Key Checks

- Hardcoded passwords and secrets
- SQL injection vulnerabilities
- Insecure temporary file usage
- Assert statements in production code
- Weak cryptography

### Sample `.bandit` configuration

```yaml
# .bandit
exclude_dirs:
  - tests
  - venv
  - __pycache__

tests:
  - B101  # assert_used
  - B102  # exec_used
  - B201  # flask_debug_true
  - B301  # pickle
  - B302  # marshal
  - B303  # md5
  - B304  # des
  - B305  # cipher
  - B306  # temp_file
  - B307  # eval
  - B308  # mark_safe
  - B309  # httpsconnection
  - B310  # urllib_urlopen
  - B311  # random
  - B312  # telnetlib
  - B313  # xml_bad
  - B314  # xml_defused
  - B315  # xml_etree
  - B316  # xml_expat
  - B317  # xml_pulldom
  - B318  # xml_sax
  - B319  # xml_minidom
  - B320  # xml_xmlrpc
  - B321  # ftplib
  - B322  # unverified_context
  - B323  # unverified_req
  - B324  # tempnam
  - B325  # temporary_directory
  - B401  # import_telnetlib
  - B402  # import_ftplib
  - B403  # import_pickle
  - B404  # import_subprocess
  - B405  # import_xml_etree
  - B406  # import_xml_sax
  - B407  # import_xml_expat
  - B408  # import_xml_minidom
  - B409  # import_xml_pulldom
  - B410  # import_xmlrpc
  - B411  # import_httpoxy
  - B412  # import_httplib
  - B413  # import_pycrypto
  - B501  # request_verify
  - B502  # ssl_with_bad_version
  - B503  # ssl_with_bad_defaults
  - B504  # ssl_with_no_version
  - B505  # weak_cryptographic_key
  - B506  # yaml_load
  - B507  # ssh_no_host_key_verification
  - B601  # paramiko_calls
  - B602  # subprocess_popen_with_shell_equals_true
  - B603  # subprocess_without_shell_equals_true
  - B604  # any_other_function_with_shell_equals_true
  - B605  # start_process_with_a_shell
  - B606  # start_process_with_no_shell
  - B607  # start_process_without_shell
  - B608  # hardcoded_sql_string
  - B609  # paramiko_with_call
  - B610  # django_sql_injection
  - B611  # django_sql_injection_extra
  - B701  # jinja2_autoescape_false
  - B702  # mako_templates
  - B703  # django_mark_safe
```

---

## 3. DEPENDENCY VULNERABILITY SCANNING

### Installation

```bash
pip install safety pip-audit
```

### Run Safety Check

```bash
# Check for known vulnerabilities
safety check --json > safety-report.json

# Check specific package
safety check -o --package sqlalchemy

# Full report
safety check --full-report
```

### Run pip-audit

```bash
# Audit installed packages
pip-audit

# Generate JSON report
pip-audit --format json --output audit-report.json

# Only show severe vulnerabilities
pip-audit --desc
```

### Requirements.txt Best Practices

```bash
# Generate locked requirements file
pip install pip-tools
pip-compile requirements.txt --output-file=requirements.lock

# Use locked requirements in production
# docker-compose.yml
COPY requirements.lock .
RUN pip install -r requirements.lock
```

---

## 4. PATTERN MATCHING - SEMGREP

### Installation

```bash
pip install semgrep
```

### Run Semgrep

```bash
# Scan for OWASP Top 10
semgrep --config=p/owasp-top-ten backend/app

# Scan for security issues
semgrep --config=p/security-audit backend/app

# Custom rules
semgrep --config=custom-rules.yml backend/app

# Generate report
semgrep --config=p/owasp-top-ten --json --output report.json backend/app
```

### Custom Security Rules

```yaml
# custom-rules.yml
rules:
  - id: hardcoded_secrets
    pattern-either:
      - pattern: |
          password = "..."
      - pattern: |
          secret = "..."
      - pattern: |
          api_key = "..."
    message: Hardcoded secret detected
    languages: [python]
    severity: ERROR

  - id: sql_injection
    pattern: |
      f"...{...}..."
    message: Potential SQL injection via f-string
    languages: [python]
    severity: WARNING

  - id: missing_auth
    pattern: |
      @app.get(...)
      def ...:
          ...
    message: Check if endpoint requires authentication
    languages: [python]
    severity: WARNING
```

---

## 5. DYNAMIC APPLICATION SECURITY TESTING (DAST)

### Using OWASP ZAP

```bash
# Install Docker image
docker pull owasp/zap2docker-stable

# Run passive scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8000

# Run full scan (more thorough)
docker run -t owasp/zap2docker-stable zap-full-scan.py -t http://localhost:8000

# Generate HTML report
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:8000 \
  -r report.html
```

### Manual API Testing

```bash
#!/bin/bash

echo "🔍 Manual API Security Tests"

BASE_URL="http://localhost:8000/api/v1"

# Test 1: Unauthenticated data access
echo "Test 1: Unauthenticated access to /records"
curl -s "$BASE_URL/records/customers" | jq .
# Should return 401 Unauthorized

# Test 2: Authentication
echo "Test 2: Login with valid credentials"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/authentication/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}')
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "Token: $TOKEN"

# Test 3: Authenticated data access
echo "Test 3: Authenticated access to /records"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/records/customers" | jq .

# Test 4: CSRF protection
echo "Test 4: Write without CSRF token (should fail)"
curl -s -X PUT "$BASE_URL/records/customers/CUST-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"record_id":"CUST-001","payload":{}}'
# Should return 403 Forbidden (CSRF_MISSING)

# Test 5: Rate limiting
echo "Test 5: Rate limiting test (run 20 requests)"
for i in {1..20}; do
  RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL/records/customers" -o /dev/null)
  echo "Request $i: $RESPONSE"
  if [ $RESPONSE -eq 429 ]; then
    echo "✅ Rate limiting triggered"
    break
  fi
done

# Test 6: SQL Injection attempt
echo "Test 6: SQL Injection test"
curl -s "$BASE_URL/records/customers'; DROP TABLE customers; --"
# Should not cause database errors

# Test 7: LDAP Injection attempt
echo "Test 7: LDAP Injection test"
curl -s -X POST "$BASE_URL/authentication/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin)(|(uid=*","password":"test"}'
# Should handle gracefully

# Test 8: Security Headers
echo "Test 8: Check security headers"
curl -s -i http://localhost:80/ | grep -E "X-Content-Type|X-Frame|Strict-Transport|CSP"
```

---

## 6. CI/CD INTEGRATION

### GitHub Actions Workflow

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install bandit safety semgrep
      
      - name: Run Bandit
        run: bandit -r backend/app -f json -o bandit-report.json
      
      - name: Run Safety Check
        run: safety check --json > safety-report.json
      
      - name: Run Semgrep
        run: semgrep --config=p/owasp-top-ten backend/app --json --output semgrep-report.json
      
      - name: Run Unit Tests
        run: pytest tests/test_security* -v
      
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            bandit-report.json
            safety-report.json
            semgrep-report.json
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const bandit = JSON.parse(fs.readFileSync('bandit-report.json', 'utf8'));
            const safety = JSON.parse(fs.readFileSync('safety-report.json', 'utf8'));
            
            let comment = '## 🔒 Security Check Results\n\n';
            comment += `**Bandit Issues:** ${bandit.metrics.total_lines_of_code > 0 ? '✅ Checked' : '⚠️ No code found'}\n`;
            comment += `**Safety Vulnerabilities:** ${safety.length} found\n`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

## 7. TESTING CHECKLIST

```bash
#!/bin/bash

# Complete security testing script

set -e

echo "🔒 Running Complete Security Test Suite"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

failed=0

# Test 1: Static Analysis with Bandit
echo ""
echo "1️⃣  Running Bandit (Static Analysis)..."
if bandit -r backend/app -q; then
    echo -e "${GREEN}✅ Bandit passed${NC}"
else
    echo -e "${RED}❌ Bandit found issues${NC}"
    failed=$((failed+1))
fi

# Test 2: Dependency Scanning with Safety
echo ""
echo "2️⃣  Running Safety (Dependency Scan)..."
if safety check -q; then
    echo -e "${GREEN}✅ Safety passed${NC}"
else
    echo -e "${YELLOW}⚠️  Safety found vulnerabilities (check manually)${NC}"
fi

# Test 3: Pattern Matching with Semgrep
echo ""
echo "3️⃣  Running Semgrep (Pattern Matching)..."
if semgrep --config=p/owasp-top-ten backend/app -q; then
    echo -e "${GREEN}✅ Semgrep passed${NC}"
else
    echo -e "${YELLOW}⚠️  Semgrep found patterns (review manually)${NC}"
fi

# Test 4: Unit Tests
echo ""
echo "4️⃣  Running Unit Tests..."
if pytest tests/test_security* -q; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
else
    echo -e "${RED}❌ Unit tests failed${NC}"
    failed=$((failed+1))
fi

# Test 5: Check for hardcoded secrets
echo ""
echo "5️⃣  Checking for hardcoded secrets..."
if grep -r "password\s*=\|secret\s*=\|api_key\s*=" backend/app --include="*.py" | grep -v "^Binary" | grep -v ".pyc"; then
    echo -e "${RED}❌ Found hardcoded secrets${NC}"
    failed=$((failed+1))
else
    echo -e "${GREEN}✅ No hardcoded secrets found${NC}"
fi

# Test 6: Check .gitignore
echo ""
echo "6️⃣  Checking .gitignore..."
if grep -q "^\.env$" .gitignore; then
    echo -e "${GREEN}✅ .env in .gitignore${NC}"
else
    echo -e "${RED}❌ .env not in .gitignore${NC}"
    failed=$((failed+1))
fi

# Test 7: Check default secrets in config
echo ""
echo "7️⃣  Checking for default secrets in config..."
if grep -q "development-only-signing-key" docker-compose.yml; then
    echo -e "${RED}❌ Default JWT secret in docker-compose.yml${NC}"
    failed=$((failed+1))
else
    echo -e "${GREEN}✅ No default secrets in docker-compose.yml${NC}"
fi

# Summary
echo ""
echo "========================================"
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ $failed security checks failed${NC}"
    exit 1
fi
```

---

## REPORTING

### Generate Security Report

```bash
#!/bin/bash

REPORT_FILE="security-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << 'EOF'
# Security Test Report
**Generated:** $(date)
**System:** $(uname -a)
**Python:** $(python --version)

## Test Results

### Bandit (Static Analysis)
```
EOF

bandit -r backend/app -f csv >> "$REPORT_FILE" 2>&1

cat >> "$REPORT_FILE" << 'EOF'
```

### Safety (Dependency Scan)
```
EOF

safety check >> "$REPORT_FILE" 2>&1

cat >> "$REPORT_FILE" << 'EOF'
```

### Unit Tests
```
EOF

pytest tests/test_security* -v >> "$REPORT_FILE" 2>&1

echo ""
echo "Report generated: $REPORT_FILE"
```

---

## MAINTENANCE

### Weekly

```bash
# Update dependencies
pip list --outdated
pip install --upgrade -r requirements.txt

# Run security scans
./scripts/security-check.sh
```

### Monthly

```bash
# Full penetration test
./scripts/full-pentest.sh

# Review audit logs
grep -i "security\|error\|failed" logs/*.log

# Check for new CVEs
safety check --db /tmp/safety-db.json --json
```

### Quarterly

```bash
# Dependency audit
pip-audit --desc

# Code review with security focus
# Manual review of authentication and authorization code
```

---

**Last Updated:** 2026-09-01  
**Maintenance Schedule:** Weekly checks, monthly reports, quarterly reviews

