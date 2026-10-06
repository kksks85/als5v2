from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from pydantic import ValidationError

from app.database import Base
from app.models import ComponentInstance, ContractMrlsRecord, ContractRecord, ProductMasterRecord
from app.schemas.domain import ContractMrlsGenerate, ContractMrlsLineCreate, ContractMrlsRecordInput, ContractSave
from app.services.contract_mrls import create_contract_mrls_line, delete_contract_with_mrls_records, generate_contract_mrls_components, save_contract_with_mrls_records


def test_contract_mrls_line_requires_positive_quantity() -> None:
    try:
        ContractMrlsLineCreate(product_category="Hydraulic", component_type="Hydraulic Pump", quantity=0, created_by="admin")
    except ValidationError:
        return
    raise AssertionError("A zero-quantity contract MRLS line must be rejected.")


def test_contract_mrls_generation_allows_partial_quantity() -> None:
    command = ContractMrlsGenerate(quantity=3, generated_by="admin")
    assert command.quantity == 3


def test_contract_mrls_generation_creates_one_linked_component_per_unit() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    database = sessionmaker(bind=engine)()
    try:
        contract = ContractRecord(record_id="CTR-001", payload={"number": "CTR-001", "customer": "Customer A"})
        database.add(contract)
        database.commit()

        line = create_contract_mrls_line(database, contract.id, ContractMrlsLineCreate(
            product_category="Hydraulics",
            product_reference="HYD-001",
            component_type="Hydraulic Pump",
            part_number="HYD-001",
            quantity=3,
            created_by="administrator",
        ))
        result = generate_contract_mrls_components(database, line["id"], ContractMrlsGenerate(generated_by="administrator"))
        database.commit()

        components = database.scalars(select(ComponentInstance).order_by(ComponentInstance.serial_number)).all()
        assert result["line"]["generated_quantity"] == 3
        assert len(components) == 3
        assert {component.contract_mrls_line_id for component in components} == {line["id"]}
        assert {component.lifecycle_status for component in components} == {"new"}
        assert {component.contract_number for component in components} == {"CTR-001"}
    finally:
        database.close()
        engine.dispose()


def test_contract_save_reconciles_individual_mrls_records_idempotently() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    database = sessionmaker(bind=engine)()
    try:
        first_record = ContractMrlsRecordInput(
            id="mrls-1", requirement_id="requirement-pump", spare_category="Hydraulic Pump",
            product_serial_number="HP-001", material_serial_number="HP-SN-001", part_number="HP-001",
            material_description="Hydraulic Pump", unit_of_measurement="Each",
        )
        second_record = ContractMrlsRecordInput(
            id="mrls-2", requirement_id="requirement-pump", spare_category="Hydraulic Pump",
            product_serial_number="HP-002", material_serial_number="HP-SN-002", part_number="HP-001",
            material_description="Hydraulic Pump", unit_of_measurement="Each",
        )
        command = ContractSave(payload={"number": "C-1001", "customer": "Customer A"}, mrls_records=[first_record, second_record])
        saved = save_contract_with_mrls_records(database, "contract-1001", command, "administrator")
        database.commit()

        assert len(saved["mrls_records"]) == 2
        assert database.scalar(select(ContractRecord).where(ContractRecord.record_id == "contract-1001"))
        assert len(database.scalars(select(ContractMrlsRecord)).all()) == 2
        inventory_records = database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == "mrls_products")).all()
        assert len(inventory_records) == 2
        assert {record.payload["source"] for record in inventory_records} == {"Contract"}

        updated = ContractSave(payload={"number": "C-1001", "customer": "Customer A"}, mrls_records=[first_record.model_copy(update={"remarks": "Updated"})])
        saved = save_contract_with_mrls_records(database, "contract-1001", updated, "administrator")
        database.commit()

        records = database.scalars(select(ContractMrlsRecord)).all()
        assert len(records) == 1
        assert records[0].client_record_id == "mrls-1"
        assert records[0].remarks == "Updated"
        assert saved["mrls_records"][0]["contract_number"] == "C-1001"
        inventory_records = database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == "mrls_products")).all()
        assert len(inventory_records) == 1
        assert inventory_records[0].payload["remarks"] == "Updated"

        delete_contract_with_mrls_records(database, "contract-1001")
        database.commit()

        assert not database.scalar(select(ContractRecord).where(ContractRecord.record_id == "contract-1001"))
        assert not database.scalars(select(ProductMasterRecord).where(ProductMasterRecord.resource == "mrls_products")).all()
    finally:
        database.close()
        engine.dispose()