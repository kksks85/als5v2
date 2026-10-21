from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1 import records
from app.database import get_db
from app.main import app


class FakeDatabase:
    def scalar(self, *_args, **_kwargs):
        return None


class TicketAccessDatabase:
    def __init__(self, groups: list[dict], ticket: dict | None = None):
        self.groups = [SimpleNamespace(payload=group) for group in groups]
        self.ticket = SimpleNamespace(payload=ticket) if ticket else None

    def scalars(self, *_args, **_kwargs):
        return SimpleNamespace(all=lambda: self.groups)

    def scalar(self, *_args, **_kwargs):
        return self.ticket


def test_records_list_requires_authenticated_session() -> None:
    app.dependency_overrides[get_db] = lambda: FakeDatabase()
    try:
        response = TestClient(app).get("/api/v1/records/incidents")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_records_mutations_require_administrator_session() -> None:
    app.dependency_overrides[get_db] = lambda: FakeDatabase()
    try:
        client = TestClient(app)
        body = {"records": []}
        responses = [
            client.put("/api/v1/records/incidents", json=body),
            client.post("/api/v1/records/incidents/bulk-upsert", json=body),
            client.put("/api/v1/records/incidents/INC-001", json={"record_id": "INC-001", "payload": {}}),
        ]
    finally:
        app.dependency_overrides.clear()
    assert [response.status_code for response in responses] == [401, 401, 401]


def test_csm_member_can_write_ticket_and_non_ticket_records(monkeypatch) -> None:
    user = SimpleNamespace(record_id="USR-1", payload={"id": "1", "email": "manager@example.com"})
    database = TicketAccessDatabase([{"name": "Customer Support Management Group", "memberIds": ["1"]}])
    monkeypatch.setattr(records, "find_local_user", lambda *_args: user)

    records.require_ticket_write_access(
        "incidents",
        [records.RecordInput(record_id="INC-1", payload={})],
        {"sub": "manager", "roles": ["Service engineer"]},
        database,
    )
    records.require_ticket_write_access(
        "customers",
        [records.RecordInput(record_id="CUST-1", payload={})],
        {"sub": "manager", "roles": ["Service engineer"]},
        database,
    )


def test_non_csm_user_cannot_create_ticket(monkeypatch) -> None:
    user = SimpleNamespace(record_id="USR-2", payload={"id": "2", "email": "user@example.com"})
    database = TicketAccessDatabase([])
    monkeypatch.setattr(records, "find_local_user", lambda *_args: user)

    with pytest.raises(HTTPException, match="create tickets"):
        records.require_ticket_write_access(
            "queries",
            [records.RecordInput(record_id="QRY-1", payload={})],
            {"sub": "user", "roles": ["Service engineer"]},
            database,
        )


def test_assigned_user_can_update_only_their_ticket(monkeypatch) -> None:
    user = SimpleNamespace(record_id="USR-3", payload={"id": "3", "email": "assigned@example.com"})
    monkeypatch.setattr(records, "find_local_user", lambda *_args: user)
    claims = {"sub": "assigned", "roles": ["Service engineer"]}
    record = records.RecordInput(record_id="INC-2", payload={})

    records.require_ticket_write_access("incidents", [record], claims, TicketAccessDatabase([], {"assignedTo": "assigned@example.com"}))
    with pytest.raises(HTTPException, match="assigned to you"):
        records.require_ticket_write_access("incidents", [record], claims, TicketAccessDatabase([], {"assignedTo": "other@example.com"}))


def test_lifecycle_attach_requires_authenticated_session() -> None:
    app.dependency_overrides[get_db] = lambda: FakeDatabase()
    try:
        response = TestClient(app).post("/api/v1/component-lifecycle/repairs/attach?source_incident_id=INC-001&repair_incident_id=RPR-001")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401