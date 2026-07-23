# Aerofix Service Management

Internal post-delivery drone service-management application.

## Current implementation

- React operations dashboard with customer, contract, Product Master, and incident navigation.
- FastAPI application with a versioned health endpoint, PostgreSQL persistence API, and validated API schemas for customers, sites/contacts, contracts with AMC/CMC coverage, configurable product fields, and incidents.
- PostgreSQL tables for customers, contracts, products, incidents, knowledge documents, users, assignment groups, and Microsoft Entra ID configuration.
- Docker Compose deployment with a private PostgreSQL service, API service, and web gateway on port `5173`.

## Run locally

Frontend:

```powershell
Set-Location frontend
npm run dev
```

API:

```powershell
Set-Location backend
python -m uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:5173` for the interface and `http://localhost:8000/docs` for the API specification. The health endpoint is `http://localhost:8000/api/v1/health`.

## Docker deployment

1. Copy `.env.example` to `.env` and replace `POSTGRES_PASSWORD` with a long, unique value. Do not commit `.env`.
2. Set the Microsoft Entra environment values in `.env` when they are available. `ENTRA_CLIENT_SECRET` is an environment-only secret and is never stored in PostgreSQL or shown in the UI.
3. Start the application:

```powershell
docker compose up --build -d
```

Open `http://localhost:5173`. The API runs only on the Docker network and is proxied by the web container under `/api`. PostgreSQL has no host port mapping.

The API runs `alembic upgrade head` and initializes secret-handling notices before it starts. On the first connected application session, the dashboard migrates its current Customers, Contracts, Product Master, Incidents, Knowledge documents, Users, and Assignment Groups to their corresponding PostgreSQL tables. Thereafter it synchronizes edits and deletions to PostgreSQL.

Useful commands:

```powershell
docker compose logs -f api
docker compose down
docker compose down -v # Removes the PostgreSQL volume; use only when deliberately resetting data.
```

## Microsoft Entra ID SSO setup

1. In Microsoft Entra admin center, register a single-page application for this portal.
2. Add the deployed web address as a **Single-page application** redirect URI, for example `http://localhost:5173/` for local Docker testing.
3. Create or select an API registration and expose a delegated scope such as `access_as_user`.
4. Create Entra security groups for application administrators and service coordinators, then copy each group object ID.
5. Add `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, and `ENTRA_API_SCOPE` to the deployment environment. Store the client secret in a secret manager in production.
6. In **System settings**, complete the Microsoft Entra ID form with the tenant ID, application ID, redirect URI, API scope, and group object IDs. The form persists non-secret configuration in the `entra_configuration` table.
7. Leave enforcement disabled until the application registration, redirect URI, API scope, and deployment secret have all been validated. The current form is an administrative configuration placeholder; token acquisition and API JWT enforcement are the next authentication integration step.