"""Backfill serialized component lifecycle records from existing Product Master data.

Run inside the backend container after `alembic upgrade head`:
    python scripts/backfill_component_lifecycle.py --report /tmp/component-lifecycle-exceptions.json
"""

import argparse
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import ComponentInstallation, ComponentInstance, ComponentMovement, ProductMasterRecord, ProductRecord


def normalized(value: object) -> str:
    return str(value or "").strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default="component-lifecycle-exceptions.json")
    arguments = parser.parse_args()
    database = SessionLocal()
    exceptions: list[dict[str, str]] = []
    try:
        products = database.scalars(select(ProductRecord)).all()
        mrls = database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == "mrls_products")).all()
        candidates = []
        for record in products:
            payload = record.payload
            candidates.append(("installed", payload, record.record_id))
        for record in mrls:
            candidates.append(("mrls", record.payload, record.record_id))
        serials = [normalized(payload.get("material_serial_number") or payload.get("item_serial_number")) for _, payload, _ in candidates]
        counts = Counter(serial for serial in serials if serial and serial.lower() != "not applicable")
        existing = {component.serial_number for component in database.scalars(select(ComponentInstance)).all()}
        for source, payload, record_id in candidates:
            serial = normalized(payload.get("material_serial_number") or payload.get("item_serial_number"))
            component_type = normalized(payload.get("material_description") or payload.get("description"))
            if not serial or serial.lower() == "not applicable":
                exceptions.append({"record_id": record_id, "reason": "missing_serial_number"})
                continue
            if counts[serial] > 1:
                exceptions.append({"record_id": record_id, "serial_number": serial, "reason": "duplicate_serial_number"})
                continue
            if not component_type:
                exceptions.append({"record_id": record_id, "serial_number": serial, "reason": "missing_component_type"})
                continue
            if serial in existing:
                continue
            uav_serial_number = normalized(payload.get("product_serial_number"))
            position = normalized(payload.get("material_description"))
            if source == "installed":
                occupied = database.scalar(select(ComponentInstallation).where(ComponentInstallation.uav_serial_number == uav_serial_number, ComponentInstallation.component_position == position, ComponentInstallation.removed_at.is_(None)))
                if occupied:
                    exceptions.append({"record_id": record_id, "serial_number": serial, "reason": "duplicate_active_uav_position"})
                    continue
            component = ComponentInstance(
                serial_number=serial,
                component_type=component_type,
                subsystem=normalized(payload.get("subsystems")) or None,
                part_number=normalized(payload.get("part_number")) or None,
                sap_part_number=normalized(payload.get("sap_part_number")) or None,
                lifecycle_status="installed" if source == "installed" else "mrls_available",
                location_type="uav" if source == "installed" else "mrls",
                location_reference=normalized(payload.get("product_serial_number")) if source == "installed" else "MRLS",
                customer=normalized(payload.get("customer")) or None,
                contract_number=normalized(payload.get("contract_number") or payload.get("contract")) or None,
                received_at=datetime.now(UTC),
            )
            database.add(component)
            database.flush()
            database.add(ComponentMovement(
                component_id=component.id,
                from_status=None,
                to_status=component.lifecycle_status,
                from_location_type=None,
                to_location_type=component.location_type,
                from_location_reference=None,
                to_location_reference=component.location_reference,
                reason="Verified legacy Product Master backfill.",
                transaction_id="legacy-backfill",
                incident_record_id=None,
                performed_by="System migration",
                customer=None,
                site=None,
            ))
            if source == "installed":
                database.add(ComponentInstallation(component_id=component.id, uav_serial_number=component.location_reference, component_position=position, installed_at=datetime.now(UTC)))
                # Session autoflush is disabled; persist this position before checking the next legacy row.
                database.flush()
            existing.add(serial)
        database.commit()
    finally:
        database.close()
    Path(arguments.report).write_text(json.dumps(exceptions, indent=2), encoding="utf-8")
    print(f"Lifecycle backfill completed with {len(exceptions)} exception(s). Report: {arguments.report}")


if __name__ == "__main__":
    main()
