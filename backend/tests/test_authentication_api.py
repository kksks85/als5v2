import os

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.authentication import require_administrator
from app.database import get_db
from app.main import app


class FakeDatabase:
    def __init__(self) -> None:
        self.items = []

    def get(self, _, identifier):
        return None

    def add(self, item):
        self.items.append(item)

    def commit(self):
        pass

    def refresh(self, _):
        pass


def test_demo_login_returns_standard_session_contract(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_JWT_SECRET", "test-only-signing-secret-with-at-least-thirty-two-bytes")
    database = FakeDatabase()
    app.dependency_overrides[get_db] = lambda: database
    try:
        response = TestClient(app).post("/api/v1/authentication/demo-login", json={"username": "ALS-EMP-001", "display_name": "Demo Administrator", "email": "admin@example.com"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["roles"] == ["Administrator"]
    assert "password" not in body


def test_demo_login_requires_configured_uat_password(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_JWT_SECRET", "test-only-signing-secret-with-at-least-thirty-two-bytes")
    monkeypatch.setenv("UAT_DEMO_PASSWORD", "Welcome@123")
    database = FakeDatabase()
    app.dependency_overrides[get_db] = lambda: database
    try:
        client = TestClient(app)
        rejected = client.post("/api/v1/authentication/demo-login", json={"username": "ALS-EMP-001", "display_name": "Demo Administrator", "password": "wrong-password"})
        accepted = client.post("/api/v1/authentication/demo-login", json={"username": "ALS-EMP-001", "display_name": "Demo Administrator", "password": "Welcome@123"})
    finally:
        app.dependency_overrides.clear()
    assert rejected.status_code == 401
    assert accepted.status_code == 200


def test_non_administrator_cannot_use_direct_inventory_creation() -> None:
    with pytest.raises(HTTPException) as error:
        require_administrator({"roles": ["Service engineer"]})
    assert error.value.status_code == 403