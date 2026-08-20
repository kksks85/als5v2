"""Initializes required configuration and deterministic development records."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import ApplicationSecretNotice, AssignmentGroupRecord, ContractRecord, CustomerRecord, IncidentRecord, ProductRecord, ProductAssetRecord, UserRecord


NOTICES = [
    ("ENTRA_CLIENT_SECRET", "Microsoft Entra client secret. Set only in deployment environment variables; never store it in the database."),
    ("DATABASE_URL", "Database connection string. Supports PostgreSQL and Microsoft SQL Server through deployment environment variables."),
]

WORKFLOWS = {
    "Repair at Factory": [
        "Query Registered", "Pending Dispatch", "Item Received", "Under IQC",
        "Work in Progress In-House", "Work in Progress - Vendor",
        "Post repair Quality Review", "Item Dispatched", "Received by Customer", "Closed",
    ],
    "Repair at site": [
        "Query Registered", "Resource Assignment", "Diagnosis", "Work in Progress",
        "Post repair Quality Review", "Closed",
    ],
    "Repair at site - Vendor": [
        "Query Registered", "Assigned Vendor", "Work in Progress - Vendor",
        "Post repair Review", "Closed",
    ],
    "Pre Delivery Flight": [
        "Pre-flight Inspection", "Flight Preparation", "Test Flight",
        "Post-flight Inspection", "Delivery Clearance",
    ],
}
CUSTOMERS = [
    ("Indian Air Force", "IAF"),
    ("Indian Army", "IA"),
    ("Indian Navy", "IN"),
    ("Indian Army Special Forces", "IASF"),
]
PRIORITIES = ["Critical", "High", "Medium", "Low"]
ISSUES = [
    ("Electrical", "Intermittent power loss reported during system initialization"),
    ("Mechanical", "Actuator movement is restricted during pre-operation checks"),
    ("Electronics", "Control module reports an out-of-range diagnostic value"),
    ("Software", "Mission console does not complete the synchronization sequence"),
    ("Communication", "Telemetry link drops under normal operating conditions"),
    ("Sensors", "Navigation sensor output is unstable after calibration"),
    ("Camera & Imaging", "Imaging payload produces degraded frames during operation"),
    ("Payload", "Payload interface fails the functional acceptance check"),
    ("Maintenance", "Scheduled inspection identified a serviceable component defect"),
    ("Physical Damage", "External damage found during post-operation inspection"),
]
FALLBACK_PRODUCTS = [
    {"product_serial_number": "LM-001", "product_category": "Loitering Munition", "subsystems": "AIRFRAME"},
    {"product_serial_number": "LM-002", "product_category": "Loitering Munition", "subsystems": "AVIONICS"},
    {"product_serial_number": "LM-003", "product_category": "Loitering Munition", "subsystems": "PROPULSION"},
]
FALLBACK_GROUPS = ["Customer Support Manager", "Engineering Team", "Flight Team", "Hardware", "Quality Management", "Radio"]
DEMO_USERS = [
    {
        "record_id": "1",
        "payload": {
            "id": 1,
            "name": "Amitabh Sharma",
            "employeeId": "ALS-EMP-001",
            "email": "amitabh.sharma@aerofix.in",
            "entraId": "7c8f4a10-2b65-4e9a-ae50-000000000001",
            "jobTitle": "System Administrator",
            "phone": "+91 9810000001",
            "role": "Administrator",
            "groups": "Admin Team",
            "status": "Active",
            "provider": "Entra ID",
            "lastLogin": "22 Jul 2026 09:30",
            "created": "01 Jul 2026",
        },
    },
    {
        "record_id": "3",
        "payload": {
            "id": 3,
            "name": "Rahul Mehta",
            "employeeId": "ALS-EMP-003",
            "email": "rahul.mehta@aerofix.in",
            "entraId": "7c8f4a10-2b65-4e9a-ae50-000000000003",
            "jobTitle": "Service Manager",
            "phone": "+91 9810000003",
            "role": "Manager",
            "groups": "Customer Support Management Group",
            "status": "Active",
            "provider": "Entra ID",
            "lastLogin": "22 Jul 2026 09:30",
            "created": "01 Jul 2026",
        },
    },
]
DEMO_ASSIGNMENT_GROUPS = [
    {
        "record_id": "1",
        "payload": {
            "id": 1,
            "name": "Customer Support Management Group",
            "manager": "Rahul Mehta",
            "description": "Customer support operations group.",
            "memberIds": [3],
            "members": 1,
            "escalatesTo": "",
            "created": "01 Jul 2026",
            "updated": "22 Jul 2026",
            "active": True,
        },
    },
]
DEMO_GROUP_NAMES = [
    "Program Management",
    "Flight Team",
    "Engineering Team",
    "Design Team",
    "GCS",
    "Production Management",
    "Hardware",
    "Manufacturing Engineering",
    "Radio",
    "Quality Management",
    "Supply Chain management",
    "Store Management",
    "System Administration",
    "Admin Team",
    "Advisory Group",
]

for group_id, group_name in enumerate(DEMO_GROUP_NAMES, start=2):
    user_id = group_id + 100
    account_name = f"{group_name} Demo"
    account_slug = group_name.lower().replace(" ", ".")
    DEMO_USERS.append({
        "record_id": str(user_id),
        "payload": {
            "id": user_id,
            "name": account_name,
            "employeeId": f"ALS-EMP-{user_id:03d}",
            "email": f"{account_slug}.demo@aerofix.in",
            "entraId": f"7c8f4a10-2b65-4e9a-ae50-{user_id:012d}",
            "jobTitle": "Demo Service Representative",
            "phone": f"+91 98100{user_id:05d}",
            "role": "Administrator" if group_name == "Admin Team" else "Service engineer",
            "groups": group_name,
            "status": "Active",
            "provider": "Entra ID",
            "lastLogin": "22 Jul 2026 09:30",
            "created": "01 Jul 2026",
        },
    })
    DEMO_ASSIGNMENT_GROUPS.append({
        "record_id": str(group_id),
        "payload": {
            "id": group_id,
            "name": group_name,
            "manager": account_name,
            "description": f"{group_name} demo support group.",
            "memberIds": [user_id],
            "members": 1,
            "escalatesTo": "",
            "created": "01 Jul 2026",
            "updated": "22 Jul 2026",
            "active": True,
        },
    })


def incident_state(stage: str, stage_index: int) -> str:
    if stage == "Closed":
        return "Closed"
    if stage.startswith("Post repair") or stage in {"Item Dispatched", "Received by Customer"}:
        return "Resolved"
    return "New" if stage_index == 0 else "In progress"


def upsert_payload_records(database, model, records: list[dict]) -> None:
    existing = {record.record_id: record for record in database.scalars(select(model).where(model.record_id.in_([item["record_id"] for item in records]))).all()}
    for item in records:
        target = existing.get(item["record_id"])
        if target:
            target.payload = item["payload"]
        else:
            database.add(model(record_id=item["record_id"], payload=item["payload"]))


def seed_incidents(database) -> None:
    if database.scalar(select(IncidentRecord.record_id).limit(1)):
        return

    customer_payloads = database.scalars(select(CustomerRecord.payload).order_by(CustomerRecord.record_id)).all()
    customer_names = {payload.get("name") for payload in customer_payloads}
    customers = [customer for customer in CUSTOMERS if not customer_names or customer[0] in customer_names]
    products = database.scalars(select(ProductRecord.payload).where(ProductRecord.payload["product_serial_number"].astext != "").order_by(ProductRecord.record_id).limit(60)).all()
    products = products or FALLBACK_PRODUCTS
    group_payloads = database.scalars(select(AssignmentGroupRecord.payload).order_by(AssignmentGroupRecord.record_id)).all()
    groups = [payload.get("name") for payload in group_payloads if payload.get("name")]
    groups = groups or FALLBACK_GROUPS
    users_by_id = {payload.get("id"): payload for payload in database.scalars(select(UserRecord.payload)).all()}
    workflow_entries = [(execution, stage_index, stage) for execution, stages in WORKFLOWS.items() for stage_index, stage in enumerate(stages)]
    base_time = datetime(2026, 7, 22, 14, 30, tzinfo=UTC)
    records = []
    group_assignment_counts = {}

    for index in range(60):
        customer, customer_code = customers[index % len(customers)]
        execution, stage_index, stage = workflow_entries[index % len(workflow_entries)]
        product = products[(index * 7) % len(products)]
        group_name = groups[index % len(groups)]
        group_payload = next((payload for payload in group_payloads if payload.get("name") == group_name), {})
        member_ids = group_payload.get("memberIds", [])
        member_index = group_assignment_counts.get(group_name, 0)
        assignee = users_by_id.get(member_ids[member_index % len(member_ids)], {}).get("name", "") if member_ids else ""
        group_assignment_counts[group_name] = member_index + 1
        issue_type, title = ISSUES[index % len(ISSUES)]
        record_id = f"TASL-{customer_code}-INCIDENT-2026-{index + 2:04d}"
        opened = base_time - timedelta(hours=index * 18 + index % 5)
        records.append({
            "record_id": record_id,
            "payload": {
                "id": record_id,
                "opened": opened.strftime("%d %b %Y %H:%M"),
                "title": title,
                "description": f"{title}. Seeded for workflow and reporting validation.",
                "customer": customer,
                "priority": PRIORITIES[index % len(PRIORITIES)],
                "state": incident_state(stage, stage_index),
                "stage": stage,
                "status": stage,
                "repairExecution": execution,
                "group": group_name,
                "assignmentGroup": group_name,
                "assignedTo": assignee,
                "favorite": index % 11 == 0,
                "attachments": [],
                "serialNumber": product.get("product_serial_number", ""),
                "system": "SRLM" if str(product.get("product_serial_number", "")).startswith("LM-") else "",
                "category": product.get("product_category", ""),
                "subsystem": product.get("subsystems", ""),
                "issueType": issue_type,
            },
        })

    upsert_payload_records(database, IncidentRecord, records)


def seed_product_assets(database) -> None:
    """Seed product assets for Loitering Munition units linked to contracts."""
    if database.scalar(select(ProductAssetRecord.record_id).limit(1)):
        return

    # Define asset allocations: (serial_number, contract_number, customer, delivered_on, warranty, warranty_expiry, last_serviced)
    assets_config = [
        # Indian Air Force - Contract TASL-CTR-2026-001 (Batch 1 - Delivered Feb 2024)
        ("LM-001", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-01", "Expired", "2026-06-30", "2026-03-15"),
        ("LM-002", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-01", "Active - Under Warranty", "2026-07-27", "2026-04-28"),
        ("LM-003", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-01", "Active - Under Warranty", "2026-07-31", "2026-04-30"),
        ("LM-004", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-15", "Active - Under Warranty", "2026-08-10", "2026-05-12"),
        ("LM-005", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-15", "Active - Under Warranty", "2026-08-21", "2026-05-24"),
        ("LM-006", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-20", "Active - Under Warranty", "2026-08-29", "2026-05-30"),
        ("LM-007", "TASL-CTR-2026-001", "Indian Air Force", "2024-02-20", "Active - Under Warranty", "2026-09-05", "2026-06-07"),
        
        # Indian Navy - Contract TASL-CTR-2026-003 (Delivered Apr 2024)
        ("LM-008", "TASL-CTR-2026-003", "Indian Navy", "2024-04-10", "Active - Under Warranty", "2026-09-22", "2026-06-24"),
        ("LM-009", "TASL-CTR-2026-003", "Indian Navy", "2024-04-10", "Active - Under Warranty", "2026-10-02", "2026-07-04"),
        ("LM-010", "TASL-CTR-2026-003", "Indian Navy", "2024-04-15", "Active - Under Warranty", "2026-10-21", "2026-07-23"),
        ("LM-011", "TASL-CTR-2026-003", "Indian Navy", "2024-04-15", "Active - Under Warranty", "2026-11-05", "2026-07-15"),
        
        # Indian Army - Contract TASL-CTR-2026-002 (Delivered Mar 2024)
        ("LM-012", "TASL-CTR-2026-002", "Indian Army", "2024-03-05", "Active - Under Warranty", "2026-11-18", "2026-07-15"),
        ("LM-013", "TASL-CTR-2026-002", "Indian Army", "2024-03-05", "Active - Under Warranty", "2026-11-30", "2026-07-20"),
        ("LM-014", "TASL-CTR-2026-002", "Indian Army", "2024-03-10", "Active - Under Warranty", "2026-12-15", "2026-07-22"),
        ("LM-015", "TASL-CTR-2026-002", "Indian Army", "2024-03-10", "Active - Under Warranty", "2027-01-10", ""),
        ("LM-016", "TASL-CTR-2026-002", "Indian Army", "2024-03-15", "Active - Under Warranty", "2026-03-15", "2026-06-25"),
        
        # Indian Army Special Forces - Contract TASL-CTR-2026-004 (Delivered May 2024)
        ("LM-017", "TASL-CTR-2026-004", "Indian Army Special Forces", "2024-05-01", "Active - Under Warranty", "2026-05-01", "2026-07-15"),
        ("LM-018", "TASL-CTR-2026-004", "Indian Army Special Forces", "2024-05-01", "Active - Under Warranty", "2026-05-01", "2026-06-20"),
        ("LM-019", "TASL-CTR-2026-004", "Indian Army Special Forces", "2024-05-08", "Active - Under Warranty", "2026-05-08", "2026-05-30"),
        ("LM-020", "TASL-CTR-2026-004", "Indian Army Special Forces", "2024-05-08", "Active - Under Warranty", "2026-05-08", "2026-07-02"),
        
        # Additional units for spare/unassigned inventory
        ("LM-021", "", "Indian Air Force", "2024-06-01", "In Stock - Not Deployed", "2027-06-01", ""),
        ("LM-022", "", "Indian Navy", "2024-06-15", "In Stock - Not Deployed", "2027-06-15", ""),
        ("LM-023", "", "Indian Army", "2024-07-01", "In Stock - Not Deployed", "2027-07-01", ""),
    ]
    
    records = []
    for serial_number, contract_number, customer, delivered_on, warranty, warranty_expiry, last_serviced in assets_config:
        asset_id = f"loitering-munition::{serial_number}"
        delivery_date = datetime.strptime(delivered_on, "%Y-%m-%d").date()
        records.append({
            "record_id": asset_id,
            "payload": {
                "id": asset_id,
                "serialNumber": serial_number,
                "category": "Loitering Munition",
                "contractNumber": contract_number,
                "customer": customer,
                "deliveredOn": delivered_on,
                "warranty": warranty,
                "warrantyExpiry": warranty_expiry,
                "lastServiced": last_serviced,
                "preDeliveryFlight": {
                    "flightReference": f"PDF-{serial_number}-2024",
                    "flightDate": (delivery_date - timedelta(days=2)).isoformat(),
                    "location": "TASL Flight Test Range",
                    "testPilot": "Flight Test Team",
                    "durationMinutes": 28 + int(serial_number.rsplit("-", 1)[-1]),
                    "result": "Passed",
                    "observations": "Flight controls, telemetry, payload release, and recovery checks completed without deviation.",
                },
            },
        })
    
    upsert_payload_records(database, ProductAssetRecord, records)


def seed_demo_identities(database) -> None:
    existing_users = {record.record_id for record in database.scalars(select(UserRecord)).all()}
    existing_groups = {record.record_id for record in database.scalars(select(AssignmentGroupRecord)).all()}
    for record in DEMO_USERS:
        if record["record_id"] not in existing_users:
            database.add(UserRecord(record_id=record["record_id"], payload=record["payload"]))
    for record in DEMO_ASSIGNMENT_GROUPS:
        if record["record_id"] not in existing_groups:
            database.add(AssignmentGroupRecord(record_id=record["record_id"], payload=record["payload"]))


def migrate_contract_lifecycle(database) -> None:
    """Bring persisted contracts forward without replacing customer-entered data."""
    current_date = datetime.now(UTC).date().isoformat()
    for record in database.scalars(select(ContractRecord)).all():
        payload = dict(record.payload)
        changed = False
        subcontracts = payload.get("subcontracts")

        if not isinstance(subcontracts, list):
            payload["subcontracts"] = []
            changed = True

        expiry_date = str(payload.get("expiryDate") or "")
        if expiry_date:
            warranty = "Warranty Expired" if expiry_date < current_date else "Active - Under Warranty"
            if payload.get("warranty") != warranty:
                payload["warranty"] = warranty
                changed = True

        if changed:
            record.payload = payload


def seed() -> None:
    with SessionLocal() as database:
        for key, description in NOTICES:
            if not database.scalar(select(ApplicationSecretNotice).where(ApplicationSecretNotice.key == key)):
                database.add(ApplicationSecretNotice(key=key, description=description))
        seed_demo_identities(database)
        seed_incidents(database)
        seed_product_assets(database)
        database.commit()


if __name__ == "__main__":
    seed()
