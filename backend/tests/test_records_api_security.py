from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app


class FakeDatabase:
    def scalar(self, *_args, **_kwargs):
        return None


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


def test_lifecycle_attach_requires_authenticated_session() -> None:
    app.dependency_overrides[get_db] = lambda: FakeDatabase()
    try:
        response = TestClient(app).post("/api/v1/component-lifecycle/repairs/attach?source_incident_id=INC-001&repair_incident_id=RPR-001")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401