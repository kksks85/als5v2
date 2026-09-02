# Client Authentication Deployment Runbook

Use this runbook on the client server when VS Code and Copilot are unavailable. It fixes the browser error displayed as `[object Object]`, enables direct Active Directory LDAP authentication, and preserves a rollback path.

## Before You Start

- Run commands from the folder containing `docker-compose.yml`.
- Use an approved maintenance window.
- Back up `.env` before changing it. Never commit or share its secrets.
- Do not enforce enterprise authentication until an AD test user signs in successfully.

## 1. Deploy the Application Fixes

Deploy the approved release containing these changes:

- API errors display their message instead of `[object Object]`.
- The frontend sends the CSRF header required for settings, role mappings, and logout.
- `Active Directory LDAP` is available as the direct provider (`ldap_ad`).
- Authentication health reports LDAP readiness.

Build and restart the application services:

```sh
docker compose up -d --build api web
docker compose ps
```

Both `api` and `web` must show `Up`. Open the portal at the port configured by `APP_PORT` in `.env`, normally `http://localhost:5173`. Hard-refresh the page with `Ctrl+F5` on Windows/Linux or `Cmd+Shift+R` on macOS.

## 2. Configure Active Directory

Obtain the LDAPS server details and a read-only service account from the client AD administrator. The service account needs access to user and group membership attributes.

Update the client `.env` with actual values:

```dotenv
APP_ENV=production
AUTH_JWT_SECRET=<unique-random-secret-at-least-32-characters>
LDAP_SERVER_URI=ldaps://<domain-controller-fqdn>:636
LDAP_BASE_DN=DC=<company>,DC=<domain>
LDAP_BIND_DN=CN=<als50-service-account>,OU=<service-accounts>,DC=<company>,DC=<domain>
LDAP_BIND_PASSWORD=<service-account-password>
LDAP_USER_DN_TEMPLATE={username}@{domain}
LDAP_USER_DOMAIN=<company-domain>
```

Generate a JWT secret when an approved secret does not already exist:

```sh
openssl rand -base64 48
```

Restrict the environment file and reload it:

```sh
chmod 600 .env
docker compose up -d --build api web
```

## 3. Verify LDAP Readiness

Substitute the portal port when it is not `5173`:

```sh
curl -fsS http://localhost:5173/api/v1/authentication/health
```

Do not continue unless the response reports:

```json
{
  "provider": "ldap_ad",
  "enforced": false,
  "auth_secret_configured": true,
  "ldap_configured": true,
  "live_provider_configured": true
}
```

If `ldap_configured` is `false`, verify every `LDAP_*` value in `.env` and rebuild `api` again. Do not expose `LDAP_BIND_PASSWORD` in logs, screenshots, or support tickets.

## 4. Configure and Test the Portal

1. Sign in with the approved administrator or break-glass account.
2. Open **Administration > Authentication settings > General**.
3. Select **Active Directory LDAP**, not **RSA Authentication Manager + Active Directory LDAP**. RSA requires an additional approved connector.
4. Keep **Enforce enterprise authentication** unchecked and save.
5. Add each AD group-to-role mapping using the exact AD group Distinguished Name, for example:

```text
CN=ALS50-Administrators,OU=Groups,DC=company,DC=example  ->  Administrator
CN=ALS50-Service-Users,OU=Groups,DC=company,DC=example   ->  Service User
```

6. Sign out and sign in with a test AD account in a mapped group.
7. Confirm the assigned portal role and successful audit-log entry.
8. Repeat with a second role where applicable.
9. Only after successful tests, enable **Enforce enterprise authentication** and save.

## Troubleshooting

| Symptom | Cause and action |
| --- | --- |
| `[object Object]` | An old frontend is served. Run `docker compose up -d --build web`, then hard-refresh. |
| `CSRF validation failed` | The browser has an old bundle or session. Hard-refresh, sign out, sign back in, and retry. |
| `ldap_configured: false` | One or more required LDAP values are absent. Update `.env` and rebuild `api`. |
| `DIRECTORY_TLS_REQUIRED` | Use `ldaps://<server>:636`; plain LDAP is rejected. |
| `DIRECTORY_UNAVAILABLE` | Verify DNS/firewall access to port 636, bind-account credentials, and the domain-controller TLS certificate. |
| `AUTHORIZATION_DENIED` | Add the user's exact AD group DN to a portal role mapping. |
| `AUTH_PROVIDER_UNAVAILABLE` | RSA was selected without an RSA connector. Select **Active Directory LDAP**. |

## Emergency Rollback

When an AD outage or configuration error blocks access after enforcement, restore demo access from the client server:

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE authentication_settings SET provider = '\''ldap_ad'\'', enabled = false WHERE id = 1;"'
curl -fsS http://localhost:5173/api/v1/authentication/health
```

The response must report `"enforced": false`. Correct the LDAP issue, repeat testing, then re-enable enterprise authentication.