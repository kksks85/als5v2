import os

from fastapi.testclient import TestClient

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