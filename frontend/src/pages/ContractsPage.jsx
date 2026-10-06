import { useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Download,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Settings,
} from "lucide-react";
import { mrlsProductColumns } from "./ProductMasterGdtPage";

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "--";
const deliverableProducts = [
  "Loitering Munition (LM)",
  "Mission Control Station (MCS)",
  "Ground Data Terminal (GDT)",
  "MAST",
  "Simulator",
  "Tactical Mobility Vehicle (TMV)",
  "Rapid Deployment Vehicle (RDV)",
  "Batteries",
  "Warhead",
  "MRLS",
  "Tools",
  "SMT / STE",
  "Ground Support Equipment (GSE)",
  "RDV-1",
  "RDV-2",
  "Aircraft Batteries",
  "GDT Batteries",
  "SAM",
  "Others",
];
const warrantyExpiryFromJri = (jriDate) => {
  if (!jriDate) return "";
  const [year, month, day] = jriDate.split("-").map(Number);
  return new Date(Date.UTC(year + 2, month - 1, day))
    .toISOString()
    .slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const isWarrantyExpired = (expiryDate) =>
  Boolean(expiryDate) && expiryDate < today();
const subcontractStatus = (subcontract) => {
  if (!subcontract.validFrom || !subcontract.validTo) return "Incomplete";
  if (subcontract.validFrom > today()) return "Upcoming";
  return subcontract.validTo < today() ? "Expired" : "Active";
};
export const normalizeWarrantyStatus = (contract) => {
  const subcontracts = Array.isArray(contract.subcontracts)
    ? contract.subcontracts
    : [];
  const activeCoverage = [
    ...new Set(
      subcontracts
        .filter((subcontract) => subcontractStatus(subcontract) === "Active")
        .map((subcontract) => subcontract.type),
    ),
  ];
  return {
    ...contract,
    subcontracts,
    warranty: contract.expiryDate
      ? isWarrantyExpired(contract.expiryDate)
        ? "Warranty Expired"
        : "Active - Under Warranty"
      : "",
    coverage: subcontracts.length ? activeCoverage : contract.coverage || [],
  };
};

export const initialContracts = [
  // Active - Under Warranty
  {
    id: 1,
    number: "TASL-CTR-2026-001",
    customer: "Indian Air Force",
    signed: "2024-01-15",
    jriDate: "2024-02-01",
    expiryDate: "2026-02-01",
    warranty: "Active - Under Warranty",
    coverage: ["AMC", "CMC"],
    status: "Active",
    minorService: "2024-05-01",
    majorService: "2025-02-01",
    manuals: "v1.0, v1.1, v2.0",
    entryDate: "2024-01-15",
    minorSchedule: "2024-05-01, 2024-08-01, 2024-11-01, 2025-02-01",
    majorSchedule: "2025-02-01, 2026-02-01",
    incidentPrefix: "IAF",
    warrantyIncluded: true,
    maintenance: true,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: false,
    refresherTraining: true,
    visitRecord: "3 personnel, 5 days per visit",
    deliverables: [{ product: "Loitering Munition", quantity: 5 }],
    spares: [
      {
        name: "Battery Pack",
        partNumber: "BP-001",
        serialNumber: "SN-2024-001",
        quantity: 10,
      },
    ],
  },
  {
    id: 2,
    number: "TASL-CTR-2026-002",
    customer: "Indian Army",
    signed: "2023-06-10",
    jriDate: "2023-07-15",
    expiryDate: "2025-07-15",
    warranty: "Active - Under Warranty",
    coverage: ["AMC"],
    status: "Active",
    minorService: "2023-10-15",
    majorService: "2024-07-15",
    manuals: "v1.0, v1.5",
    entryDate: "2023-06-10",
    minorSchedule: "2023-10-15, 2024-01-15, 2024-04-15, 2024-07-15",
    majorSchedule: "2024-07-15, 2025-07-15",
    incidentPrefix: "ARMY",
    warrantyIncluded: true,
    maintenance: true,
    unscheduled: false,
    calibration: false,
    softwareUpgrade: true,
    refresherTraining: true,
    visitRecord: "2 personnel, 3 days per visit",
    deliverables: [{ product: "GCS", quantity: 2 }],
    spares: [
      {
        name: "Power Supply Unit",
        partNumber: "PSU-001",
        serialNumber: "SN-2023-001",
        quantity: 3,
      },
    ],
  },
  {
    id: 3,
    number: "TASL-CTR-2026-003",
    customer: "Indian Navy",
    signed: "2024-03-20",
    jriDate: "2024-04-10",
    expiryDate: "2026-04-10",
    warranty: "Active - Under Warranty",
    coverage: ["AMC", "CMC"],
    status: "Active",
    minorService: "2024-07-10",
    majorService: "2025-04-10",
    manuals: "v1.2, v2.0, v2.1",
    entryDate: "2024-03-20",
    minorSchedule: "2024-07-10, 2024-10-10, 2025-01-10, 2025-04-10",
    majorSchedule: "2025-04-10, 2026-04-10",
    incidentPrefix: "NAVY",
    warrantyIncluded: true,
    maintenance: true,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: true,
    refresherTraining: false,
    visitRecord: "4 personnel, 7 days per visit",
    deliverables: [
      { product: "Simulator", quantity: 1 },
      { product: "LRU", quantity: 3 },
    ],
    spares: [
      {
        name: "Control Module",
        partNumber: "CM-002",
        serialNumber: "SN-2024-002",
        quantity: 5,
      },
      {
        name: "Data Logger",
        partNumber: "DL-001",
        serialNumber: "SN-2024-003",
        quantity: 2,
      },
    ],
  },
  // Active - Under AMC (Warranty Expired)
  {
    id: 4,
    number: "TASL-CTR-2024-001",
    customer: "Indian Army Special Forces",
    signed: "2022-05-10",
    jriDate: "2022-06-15",
    expiryDate: "2024-06-15",
    warranty: "Active - Under AMC",
    coverage: ["AMC"],
    status: "Active",
    minorService: "2022-09-15",
    majorService: "2023-06-15",
    manuals: "v1.0, v1.1",
    entryDate: "2022-05-10",
    minorSchedule:
      "2022-09-15, 2022-12-15, 2023-03-15, 2023-06-15, 2023-09-15, 2023-12-15, 2024-03-15, 2024-06-15",
    majorSchedule: "2023-06-15, 2024-06-15",
    incidentPrefix: "ASFX",
    warrantyIncluded: false,
    maintenance: true,
    unscheduled: false,
    calibration: false,
    softwareUpgrade: false,
    refresherTraining: false,
    visitRecord: "2 personnel, 2 days per visit",
    deliverables: [
      { product: "GCS", quantity: 1 },
      { product: "RDV", quantity: 2 },
    ],
    spares: [
      {
        name: "Communication Module",
        partNumber: "CM-001",
        serialNumber: "SN-2022-001",
        quantity: 4,
      },
    ],
  },
  // Active - Under CMC (Warranty Expired)
  {
    id: 5,
    number: "TASL-CTR-2023-001",
    customer: "Indian Air Force",
    signed: "2021-11-01",
    jriDate: "2021-12-01",
    expiryDate: "2023-12-01",
    warranty: "Active - Under CMC",
    coverage: ["CMC"],
    status: "Active",
    minorService: "2022-03-01",
    majorService: "2022-12-01",
    manuals: "v1.0, v1.5, v2.0",
    entryDate: "2021-11-01",
    minorSchedule:
      "2022-03-01, 2022-06-01, 2022-09-01, 2022-12-01, 2023-03-01, 2023-06-01, 2023-09-01, 2023-12-01",
    majorSchedule: "2022-12-01, 2023-12-01",
    incidentPrefix: "IAF",
    warrantyIncluded: false,
    maintenance: false,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: false,
    refresherTraining: false,
    visitRecord: "3 personnel, 4 days per visit",
    deliverables: [{ product: "MRLS", quantity: 2 }],
    spares: [
      {
        name: "Firing Control Unit",
        partNumber: "FCU-001",
        serialNumber: "SN-2021-001",
        quantity: 2,
      },
      {
        name: "Servo Motor",
        partNumber: "SM-001",
        serialNumber: "SN-2021-002",
        quantity: 5,
      },
    ],
  },
  // Warranty Expired - No Coverage
  {
    id: 6,
    number: "TASL-CTR-2022-001",
    customer: "Indian Navy",
    signed: "2020-08-20",
    jriDate: "2020-09-10",
    expiryDate: "2022-09-10",
    warranty: "Warranty Expired - No Coverage",
    coverage: [],
    status: "Inactive",
    minorService: "2020-12-10",
    majorService: "2021-09-10",
    manuals: "v1.0, v1.2",
    entryDate: "2020-08-20",
    minorSchedule:
      "2020-12-10, 2021-03-10, 2021-06-10, 2021-09-10, 2021-12-10, 2022-03-10, 2022-06-10, 2022-09-10",
    majorSchedule: "2021-09-10, 2022-09-10",
    incidentPrefix: "NAVY",
    warrantyIncluded: false,
    maintenance: false,
    unscheduled: false,
    calibration: false,
    softwareUpgrade: false,
    refresherTraining: false,
    visitRecord: "No visits scheduled",
    deliverables: [{ product: "Simulator", quantity: 1 }],
    spares: [],
  },
  // Warranty Expired - Extended with new AMC
  {
    id: 7,
    number: "TASL-CTR-2024-002",
    customer: "Indian Army",
    signed: "2022-02-14",
    jriDate: "2022-03-01",
    expiryDate: "2024-03-01",
    warranty: "Active - Under AMC",
    coverage: ["AMC", "CMC"],
    status: "Active",
    minorService: "2022-06-01",
    majorService: "2023-03-01",
    manuals: "v1.0, v1.1, v2.0, v2.1",
    entryDate: "2022-02-14",
    minorSchedule:
      "2022-06-01, 2022-09-01, 2022-12-01, 2023-03-01, 2023-06-01, 2023-09-01, 2023-12-01, 2024-03-01",
    majorSchedule: "2023-03-01, 2024-03-01, 2025-03-01",
    incidentPrefix: "ARMY",
    warrantyIncluded: false,
    maintenance: true,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: true,
    refresherTraining: true,
    visitRecord: "4 personnel, 6 days per visit",
    deliverables: [
      { product: "GCS", quantity: 3 },
      { product: "TMV", quantity: 2 },
    ],
    spares: [
      {
        name: "Antenna Array",
        partNumber: "AA-001",
        serialNumber: "SN-2022-001",
        quantity: 1,
      },
      {
        name: "RF Module",
        partNumber: "RF-001",
        serialNumber: "SN-2022-002",
        quantity: 3,
      },
    ],
  },
  // Recently Expired
  {
    id: 8,
    number: "TASL-CTR-2025-001",
    customer: "Indian Air Force",
    signed: "2023-07-01",
    jriDate: "2023-08-01",
    expiryDate: "2025-08-01",
    warranty: "Warranty Expiring Soon",
    coverage: ["AMC"],
    status: "Active",
    minorService: "2023-11-01",
    majorService: "2024-08-01",
    manuals: "v1.0, v2.0, v2.1, v3.0",
    entryDate: "2023-07-01",
    minorSchedule:
      "2023-11-01, 2024-02-01, 2024-05-01, 2024-08-01, 2024-11-01, 2025-02-01, 2025-05-01, 2025-08-01",
    majorSchedule: "2024-08-01, 2025-08-01, 2026-08-01",
    incidentPrefix: "IAF",
    warrantyIncluded: true,
    maintenance: true,
    unscheduled: false,
    calibration: true,
    softwareUpgrade: true,
    refresherTraining: false,
    visitRecord: "2 personnel, 3 days per visit",
    deliverables: [{ product: "Loitering Munition", quantity: 3 }],
    spares: [
      {
        name: "Fuel Cell",
        partNumber: "FC-001",
        serialNumber: "SN-2023-001",
        quantity: 6,
      },
    ],
  },
  // Just signed - New contract
  {
    id: 9,
    number: "TASL-CTR-2026-004",
    customer: "Indian Army Special Forces",
    signed: "2026-01-10",
    jriDate: "2026-02-01",
    expiryDate: "2028-02-01",
    warranty: "Active - Under Warranty",
    coverage: ["AMC", "CMC"],
    status: "Active",
    minorService: "2026-05-01",
    majorService: "2027-02-01",
    manuals: "v1.0",
    entryDate: "2026-01-10",
    minorSchedule: "2026-05-01, 2026-08-01, 2026-11-01, 2027-02-01",
    majorSchedule: "2027-02-01, 2028-02-01",
    incidentPrefix: "ASFX",
    warrantyIncluded: true,
    maintenance: true,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: true,
    refresherTraining: true,
    visitRecord: "3 personnel, 4 days per visit",
    deliverables: [
      { product: "GCS", quantity: 1 },
      { product: "Simulator", quantity: 1 },
      { product: "LRU", quantity: 4 },
    ],
    spares: [
      {
        name: "Display Unit",
        partNumber: "DU-001",
        serialNumber: "SN-2026-001",
        quantity: 2,
      },
      {
        name: "Processing Module",
        partNumber: "PM-001",
        serialNumber: "SN-2026-002",
        quantity: 1,
      },
    ],
  },
  // Long-term extended contract
  {
    id: 10,
    number: "TASL-CTR-2025-002",
    customer: "Indian Navy",
    signed: "2022-10-15",
    jriDate: "2022-11-20",
    expiryDate: "2025-11-20",
    warranty: "Warranty Expiring Soon",
    coverage: ["AMC", "CMC"],
    status: "Active",
    minorService: "2023-02-20",
    majorService: "2023-11-20",
    manuals: "v1.0, v1.1, v2.0, v2.1, v3.0",
    entryDate: "2022-10-15",
    minorSchedule:
      "2023-02-20, 2023-05-20, 2023-08-20, 2023-11-20, 2024-02-20, 2024-05-20, 2024-08-20, 2024-11-20",
    majorSchedule: "2023-11-20, 2024-11-20, 2025-11-20",
    incidentPrefix: "NAVY",
    warrantyIncluded: false,
    maintenance: true,
    unscheduled: true,
    calibration: true,
    softwareUpgrade: true,
    refresherTraining: true,
    visitRecord: "5 personnel, 8 days per visit",
    deliverables: [
      { product: "Simulator", quantity: 2 },
      { product: "GCS", quantity: 1 },
      { product: "LRU", quantity: 5 },
    ],
    spares: [
      {
        name: "Radar Antenna",
        partNumber: "RA-001",
        serialNumber: "SN-2022-001",
        quantity: 1,
      },
      {
        name: "Signal Processor",
        partNumber: "SP-001",
        serialNumber: "SN-2022-002",
        quantity: 2,
      },
      {
        name: "Power Distribution Module",
        partNumber: "PDM-001",
        serialNumber: "SN-2022-003",
        quantity: 3,
      },
    ],
  },
];

const columns = [
  { key: "number", label: "Contract #", width: "120px", minWidth: "100px" },
  { key: "customer", label: "Customer", width: "150px", minWidth: "120px" },
  { key: "signed", label: "Signed", width: "100px", minWidth: "90px" },
  { key: "jriDate", label: "JRI Date", width: "100px", minWidth: "90px" },
  { key: "expiryDate", label: "Expires", width: "100px", minWidth: "90px" },
  { key: "warranty", label: "Warranty", width: "140px", minWidth: "120px" },
  { key: "coverage", label: "Coverage", width: "100px", minWidth: "100px" },
  { key: "status", label: "Status", width: "100px", minWidth: "90px" },
  { key: "system", label: "System", width: "140px", minWidth: "110px" },
  {
    key: "incidentPrefix",
    label: "Incident Prefix",
    width: "120px",
    minWidth: "100px",
  },
  {
    key: "minorService",
    label: "Minor Service",
    width: "120px",
    minWidth: "100px",
  },
  {
    key: "majorService",
    label: "Major Service",
    width: "120px",
    minWidth: "100px",
  },
  {
    key: "minorSchedule",
    label: "Minor Schedule",
    width: "180px",
    minWidth: "140px",
  },
  {
    key: "majorSchedule",
    label: "Major Schedule",
    width: "180px",
    minWidth: "140px",
  },
  {
    key: "warrantyIncluded",
    label: "Warranty Included",
    width: "130px",
    minWidth: "110px",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    width: "115px",
    minWidth: "100px",
  },
  {
    key: "unscheduled",
    label: "Unscheduled Service",
    width: "145px",
    minWidth: "120px",
  },
  {
    key: "calibration",
    label: "Calibration",
    width: "105px",
    minWidth: "90px",
  },
  {
    key: "softwareUpgrade",
    label: "Software Upgrade",
    width: "135px",
    minWidth: "110px",
  },
  {
    key: "refresherTraining",
    label: "Refresher Training",
    width: "140px",
    minWidth: "120px",
  },
  {
    key: "manuals",
    label: "Manuals & Versions",
    width: "180px",
    minWidth: "140px",
  },
  {
    key: "visitRecord",
    label: "Visit Record",
    width: "160px",
    minWidth: "130px",
  },
  {
    key: "deliverables",
    label: "Deliverables",
    width: "190px",
    minWidth: "150px",
  },
  { key: "spares", label: "MRLS", width: "190px", minWidth: "150px" },
  {
    key: "subcontracts",
    label: "Subcontracts",
    width: "180px",
    minWidth: "140px",
  },
  { key: "actions", label: "Actions", width: "100px", minWidth: "100px" },
];

const contractListValue = (contract, key) => {
  if (key === "coverage") return (contract.coverage || []).join(" ");
  if (key === "deliverables")
    return (contract.deliverables || [])
      .map(
        (item) =>
          `${item.product === "Others" ? item.otherDetails || "Others" : item.product || ""} ${item.quantity || ""}`,
      )
      .join(", ");
  if (key === "spares")
    return (contract.spares || [])
      .map((item) =>
        [item.name, item.partNumber, item.serialNumber, item.quantity]
          .filter(Boolean)
          .join(" "),
      )
      .join(", ");
  if (key === "subcontracts")
    return (contract.subcontracts || [])
      .map((item) =>
        [item.type, item.number, item.validFrom, item.validTo]
          .filter(Boolean)
          .join(" "),
      )
      .join(", ");
  if (typeof contract[key] === "boolean") return contract[key] ? "Yes" : "No";
  return contract[key] || "";
};

const defaultSpareCategories = [
  "Propeller FW",
  "Propeller VTOL CCW",
  "Propeller VTOL CW",
  "Landing gears",
  "Landing Gear Bolts",
  "Pitot Tube",
  "Battery VTOL",
  "Battery FW",
  "Gimbal",
  "Airborne Antenna (Front)",
  "Airborne Antenna (Rear)",
  "Ground Antenna Grid",
  "GPS ANTENNA - GCS",
  "GDT Battery",
  "MCS Laptop with charger",
  "Dummy Warheads",
];
const buildSpareCategories = (customCategories) =>
  [...new Set([...defaultSpareCategories, ...customCategories])]
    .sort((first, second) => first.localeCompare(second))
    .map((category) => ({ id: category, name: category, category }));
const newMrlsRequirementId = () => `contract-mrls-${crypto.randomUUID()}`;
const requiredMrlsKeys = [
  ...mrlsProductColumns
    .filter((column) => column.required && column.key !== "product_serial_number")
    .map((column) => column.key),
  "material_serial_number",
];
const normalizeSpareRequirements = (spares = []) =>
  spares.map((spare) => ({
    ...spare,
    requirementId: spare.requirementId || newMrlsRequirementId(),
  }));
const createContractMrlsRecord = (requirement, customer, contractNumber) => ({
  id: `contract-mrls-record-${crypto.randomUUID()}`,
  requirementId: requirement.requirementId,
  spareCategory: requirement.productCategory || requirement.name,
  product_serial_number: "",
  part_number: "",
  sap_part_number: "",
  material_description: requirement.productCategory || requirement.name || "",
  batch_number: "",
  material_serial_number: "",
  customer,
  contract_number: contractNumber,
  quantity: "1",
  unit_of_measurement: "",
  remarks: "",
});
const prepareContractForm = (contract) => ({
  ...(contract ? normalizeWarrantyStatus(contract) : emptyForm),
  spares: normalizeSpareRequirements(contract?.spares || []),
  mrlsRecords: contract?.mrlsRecords || [],
});

const emptyForm = {
  number: "",
  customer: "",
  signed: "",
  jriDate: "",
  expiryDate: "",
  warranty: "",
  coverage: [],
  subcontracts: [],
  status: "Active",
  system: "",
  manuals: "",
  entryDate: "",
  incidentPrefix: "",
  warrantyIncluded: false,
  maintenance: false,
  unscheduled: false,
  calibration: false,
  softwareUpgrade: false,
  refresherTraining: false,
  visitRecord: "",
  deliverables: [{ product: "", quantity: 1 }],
  spares: [],
  mrlsRecords: [],
};

export default function ContractsPage({
  contracts,
  setContracts,
  customSpareCategories = [],
  canManageSpareCategories = false,
  onSaveSpareCategories,
  onSaveContract,
  onDeleteContract,
  onCreateSubcontract,
  canManageCustomersAndContracts = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [editingContract, setEditingContract] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    columns
      .filter((column) => column.key !== "actions")
      .map((column) => column.key),
  );
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortKey, setSortKey] = useState("number");
  const [sortDescending, setSortDescending] = useState(false);
  const [columnWidths, setColumnWidths] = useState(() =>
    Object.fromEntries(columns.map(({ key, width }) => [key, width])),
  );
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = useMemo(
    () =>
      contracts
        .map(normalizeWarrantyStatus)
        .filter((contract) =>
          Object.entries(columnFilters).every(
            ([key, value]) =>
              !value ||
              String(contractListValue(contract, key))
                .toLowerCase()
                .includes(value.toLowerCase()),
          ),
        )
        .sort((first, second) => {
          const comparison = String(
            contractListValue(first, sortKey),
          ).localeCompare(
            String(contractListValue(second, sortKey)),
            undefined,
            { numeric: true },
          );
          return sortDescending ? -comparison : comparison;
        }),
    [columnFilters, contracts, sortDescending, sortKey],
  );

  const updateColumnFilter = (key, value) =>
    setColumnFilters((current) => ({ ...current, [key]: value }));
  const toggleColumn = (key) =>
    setVisibleColumns((current) =>
      current.includes(key)
        ? current.length === 1
          ? current
          : current.filter((column) => column !== key)
        : [...current, key],
    );
  const sortByColumn = (key) => {
    if (sortKey === key) setSortDescending((current) => !current);
    else {
      setSortKey(key);
      setSortDescending(false);
    }
  };

  const startColumnResize = (event, column) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[column.key];
    const resizeColumn = (moveEvent) =>
      setColumnWidths((current) => ({
        ...current,
        [column.key]: Math.max(
          column.minWidth,
          startWidth + moveEvent.clientX - startX,
        ),
      }));
    const stopResize = () => {
      document.removeEventListener("mousemove", resizeColumn);
      document.removeEventListener("mouseup", stopResize);
    };
    document.addEventListener("mousemove", resizeColumn);
    document.addEventListener("mouseup", stopResize);
  };

  const createContract = async (form) => {
    if (!canManageCustomersAndContracts) return;
    const newContract = {
      id: Math.max(...contracts.map((c) => c.id), 0) + 1,
      ...normalizeWarrantyStatus(form),
    };
    await onSaveContract(newContract);
    setShowForm(false);
  };

  const updateContract = async (form) => {
    if (!canManageCustomersAndContracts) return;
    await onSaveContract({ ...form, id: editingContract.id });
    setEditingContract(null);
  };

  const deleteContract = async (id) => {
    if (!canManageCustomersAndContracts) return;
    await onDeleteContract(id);
    setContracts((current) => current.filter((c) => c.id !== id));
    setDeleteConfirm(null);
  };

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const data = [
      [
        "Contract Number",
        "Customer",
        "Entry Date",
        "JRI Date",
        "Expiry Date",
        "Warranty",
        "Coverage",
        "Status",
      ].map(csv),
      ...filtered.map((c) =>
        [
          c.number,
          c.customer,
          formatDate(c.signed),
          formatDate(c.jriDate),
          formatDate(c.expiryDate),
          c.warranty,
          c.coverage.join("; "),
          c.status,
        ].map(csv),
      ),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "contracts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showForm)
    return (
      <ContractForm
        customSpareCategories={customSpareCategories}
        canManageSpareCategories={canManageSpareCategories}
        onSaveSpareCategories={onSaveSpareCategories}
        onCancel={() => setShowForm(false)}
        onSubmit={createContract}
      />
    );
  if (editingContract)
    return (
      <ContractForm
        contract={editingContract}
        customSpareCategories={customSpareCategories}
        canManageSpareCategories={canManageSpareCategories}
        onSaveSpareCategories={onSaveSpareCategories}
        onCancel={() => setEditingContract(null)}
        onSubmit={updateContract}
      />
    );
  if (selectedContract)
    return (
      <ContractDetail
        contract={selectedContract}
        onCancel={() => setSelectedContract(null)}
        canManageCustomersAndContracts={canManageCustomersAndContracts}
        onEdit={() => {
          setEditingContract(selectedContract);
          setSelectedContract(null);
        }}
        onCreateSubcontract={onCreateSubcontract}
      />
    );
  if (deleteConfirm)
    return (
      <DeleteConfirmation
        contract={deleteConfirm}
        onConfirm={(id) => deleteContract(id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    );
  const activeColumns = columns.filter((column) =>
    visibleColumns.includes(column.key),
  );

  return (
    <section className="customer-list-page contracts-list-page">
      <div className="customer-list-head">
        <div className="customer-list-title">
          <h1>Contracts</h1>
          <p>
            Manage contract details, warranty commitments, AMC/CMC services, and
            covered deliverables.
          </p>
        </div>
        <div className="user-list-actions">
          <button
            className="compact-button secondary"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <Download size={15} /> Extract data
          </button>
          {canManageCustomersAndContracts && (
            <button
              className="customer-create-button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={15} /> New contract
            </button>
          )}
          <div className="incident-column-menu">
            <button
              type="button"
              className="icon-button"
              title="Select list columns"
              aria-label="Select list columns"
              onClick={() => setColumnPickerOpen((open) => !open)}
            >
              <Settings size={16} />
            </button>
            {columnPickerOpen && (
              <div className="incident-column-picker">
                <strong>Visible columns</strong>
                {columns
                  .filter((column) => column.key !== "actions")
                  .map((column) => (
                    <label key={column.key}>
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                      />{" "}
                      {column.label}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="customer-command-bar">
        <span className="customer-list-count">
          {filtered.length
            ? `${filtered.length} contract${filtered.length === 1 ? "" : "s"}`
            : "0 results"}
        </span>
      </div>
      <div className="customer-table-frame">
        <div className="customer-table-scroll">
          <table className="customer-table">
            <colgroup>
              {activeColumns.map((column) => (
                <col
                  key={column.key}
                  style={{ width: columnWidths[column.key] }}
                />
              ))}
              <col style={{ width: columnWidths.actions }} />
            </colgroup>
            <thead>
              <tr>
                {activeColumns.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className="contract-column-sort"
                      onClick={() => sortByColumn(column.key)}
                    >
                      {column.label}
                      <ArrowUpDown size={13} />
                      <span className="sr-only">
                        {sortKey === column.key
                          ? sortDescending
                            ? "descending"
                            : "ascending"
                          : "not sorted"}
                      </span>
                    </button>
                    <button
                      className="column-resize-handle"
                      aria-label={`Resize ${column.label} column`}
                      onMouseDown={(event) => startColumnResize(event, column)}
                    />
                  </th>
                ))}
                <th>Actions</th>
              </tr>
              <tr className="contract-column-filters">
                {activeColumns.map((column) => (
                  <th key={column.key}>
                    <input
                      aria-label={`Filter ${column.label}`}
                      value={columnFilters[column.key] || ""}
                      onChange={(event) =>
                        updateColumnFilter(column.key, event.target.value)
                      }
                      placeholder="Search"
                    />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((contract) => (
                <tr key={contract.id}>
                  {activeColumns.map((column) => (
                    <td key={column.key}>
                      {[
                        "signed",
                        "jriDate",
                        "expiryDate",
                        "minorService",
                        "majorService",
                      ].includes(column.key) ? (
                        formatDate(contract[column.key])
                      ) : column.key === "coverage" ? (
                        contract.coverage.map((coverage) => (
                          <span key={coverage} className="badge">
                            {coverage}
                          </span>
                        ))
                      ) : column.key === "status" ? (
                        <span
                          className={`badge ${contract.status === "Active" ? "active" : "inactive"}`}
                        >
                          {contract.status}
                        </span>
                      ) : (
                        contractListValue(contract, column.key)
                      )}
                    </td>
                  ))}
                  <td className="action-buttons">
                    <button
                      className="icon-button"
                      title="View"
                      onClick={() => setSelectedContract(contract)}
                    >
                      <Eye size={14} />
                    </button>
                    {canManageCustomersAndContracts && (
                      <>
                        <button
                          className="icon-button"
                          title="Edit"
                          onClick={() => setEditingContract(contract)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Delete"
                          onClick={() => setDeleteConfirm(contract)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="empty-row">
                    No contracts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="customer-pagination">
        <span>
          Total: {contracts.length} contract{contracts.length === 1 ? "" : "s"}
        </span>
      </footer>
    </section>
  );
}

function ContractForm({
  contract,
  customSpareCategories,
  canManageSpareCategories,
  onSaveSpareCategories,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => prepareContractForm(contract));
  const [errors, setErrors] = useState({});
  const [selectedSpareCategory, setSelectedSpareCategory] = useState("");
  const [spareQuantity, setSpareQuantity] = useState("1");
  const [spareError, setSpareError] = useState("");
  const [newSpareCategory, setNewSpareCategory] = useState("");
  const [categoryNotice, setCategoryNotice] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const availableSpareCategories = useMemo(
    () => buildSpareCategories(customSpareCategories),
    [customSpareCategories],
  );
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateDeliverable = (index, field, value) =>
    setForm((current) => ({
      ...current,
      deliverables: current.deliverables.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  const addDeliverable = () =>
    setForm((current) => ({
      ...current,
      deliverables: [...current.deliverables, { product: "", quantity: 1 }],
    }));
  const removeDeliverable = (index) =>
    setForm((current) => ({
      ...current,
      deliverables: current.deliverables.filter((_, i) => i !== index),
    }));
  const removeSpare = (index) =>
    setForm((current) => {
      const requirement = current.spares[index];
      return {
        ...current,
        spares: current.spares.filter((_, itemIndex) => itemIndex !== index),
        mrlsRecords: current.mrlsRecords.filter(
          (record) => record.requirementId !== requirement.requirementId,
        ),
      };
    });
  const removeMrlsRecord = (recordId) =>
    setForm((current) => ({
      ...current,
      mrlsRecords: current.mrlsRecords.filter(
        (record) => record.id !== recordId,
      ),
    }));
  const updateMrlsRecord = (recordId, key, value) =>
    setForm((current) => ({
      ...current,
      mrlsRecords: current.mrlsRecords.map((record) =>
        record.id === recordId ? { ...record, [key]: value } : record,
      ),
    }));
  const generateMissingMrlsRecords = (requirement) =>
    setForm((current) => {
      const generatedCount = current.mrlsRecords.filter(
        (record) => record.requirementId === requirement.requirementId,
      ).length;
      const missingCount = Math.max(
        0,
        Number(requirement.quantity || 0) - generatedCount,
      );
      if (!missingCount) return current;
      return {
        ...current,
        mrlsRecords: [
          ...current.mrlsRecords,
          ...Array.from({ length: missingCount }, () =>
            createContractMrlsRecord(
              requirement,
              current.customer,
              current.number,
            ),
          ),
        ],
      };
    });
  const updateSubcontract = (index, field, value) =>
    setForm((current) => ({
      ...current,
      subcontracts: current.subcontracts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  const addSubcontract = () =>
    setForm((current) => ({
      ...current,
      subcontracts: [
        ...current.subcontracts,
        {
          id: `subcontract-${Date.now()}`,
          type: "AMC",
          number: "",
          validFrom: "",
          validTo: "",
        },
      ],
    }));
  const removeSubcontract = (index) =>
    setForm((current) => ({
      ...current,
      subcontracts: current.subcontracts.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  const addSpareRequirement = () => {
    const quantity = Number(spareQuantity);
    const product = availableSpareCategories.find(
      (entry) => entry.id === selectedSpareCategory,
    );
    if (!product)
      return setSpareError(
        "Select a product category from the inventory master.",
      );
    if (
      !/^\d+$/.test(spareQuantity) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    )
      return setSpareError(
        "Quantity must be a whole number greater than zero.",
      );
    setForm((current) => {
      const existingIndex = current.spares.findIndex(
        (item) => item.productCategory === product.category,
      );
      const requirement =
        existingIndex < 0
          ? {
              requirementId: newMrlsRequirementId(),
              productId: product.id,
              productCategory: product.category,
              name: product.name,
              partNumber: "",
              quantity,
            }
          : {
              ...current.spares[existingIndex],
              quantity:
                Number(current.spares[existingIndex].quantity || 0) + quantity,
            };
      return {
        ...current,
        spares:
          existingIndex < 0
            ? [...current.spares, requirement]
            : current.spares.map((item, index) =>
                index === existingIndex ? requirement : item,
              ),
        mrlsRecords: [
          ...current.mrlsRecords,
          ...Array.from({ length: quantity }, () =>
            createContractMrlsRecord(
              requirement,
              current.customer,
              current.number,
            ),
          ),
        ],
      };
    });
    setSelectedSpareCategory("");
    setSpareQuantity("1");
    setSpareError("");
  };
  const addSpareCategory = async () => {
    const category = newSpareCategory.trim();
    if (!category) return setCategoryNotice("Enter a category name.");
    if (
      availableSpareCategories.some(
        (entry) => entry.category.toLowerCase() === category.toLowerCase(),
      )
    )
      return setCategoryNotice("This category is already available.");
    setSavingCategory(true);
    setCategoryNotice("");
    try {
      await onSaveSpareCategories([...customSpareCategories, category]);
      setNewSpareCategory("");
      setCategoryNotice("Category added.");
    } catch (error) {
      setCategoryNotice(error.message || "Could not add category.");
    } finally {
      setSavingCategory(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = Object.fromEntries(
      ["number", "customer", "entryDate", "jriDate", "expiryDate", "status"]
        .filter((key) => !form[key])
        .map((key) => [key, "Required"]),
    );
    const invalidSubcontract = form.subcontracts.some(
      (subcontract) =>
        !subcontract.type ||
        !subcontract.number ||
        !subcontract.validFrom ||
        !subcontract.validTo ||
        subcontract.validTo < subcontract.validFrom,
    );
    if (invalidSubcontract)
      nextErrors.subcontracts =
        "Every subcontract needs a type, number, valid dates, and an end date on or after its start date.";
    const mrlsRecords = form.mrlsRecords.map((record) => ({
      ...record,
      customer: form.customer,
      contract_number: form.number,
      quantity: "1",
    }));
    const missingMrlsRows = form.spares.some(
      (requirement) =>
        mrlsRecords.filter(
          (record) => record.requirementId === requirement.requirementId,
        ).length < Number(requirement.quantity || 0),
    );
    const incompleteMrlsRows = mrlsRecords.some((record) =>
      requiredMrlsKeys.some((key) => !String(record[key] || "").trim()),
    );
    const serialNumbers = mrlsRecords
      .map((record) => String(record.material_serial_number || "").trim())
      .filter(Boolean);
    if (missingMrlsRows)
      nextErrors.mrlsRecords =
        "Generate the remaining individual MRLS rows for every spare requirement before saving.";
    else if (incompleteMrlsRows)
      nextErrors.mrlsRecords =
        "Complete every required MRLS field, including the material serial number, before saving.";
    else if (new Set(serialNumbers).size !== serialNumbers.length)
      nextErrors.mrlsRecords =
        "Material serial numbers must be unique within this contract.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSavingContract(true);
    try {
      await onSubmit(normalizeWarrantyStatus({ ...form, mrlsRecords }));
    } catch (error) {
      setErrors({ save: error.message || "Could not save the contract." });
    } finally {
      setSavingContract(false);
    }
  };

  return (
    <form className="customer-form-page contract-form-page" onSubmit={submit}>
      <header className="customer-form-header">
        <div>
          <button
            type="button"
            className="customer-back-button"
            onClick={onCancel}
          >
            <ArrowLeft size={15} /> Contracts
          </button>
          <h1>{contract ? "Edit contract" : "New contract"}</h1>
          <p>
            {contract
              ? "Update contract details and related coverage."
              : "Create a new contract and its covered deliverables."}
          </p>
        </div>
        <div className="customer-form-actions">
          <button
            type="button"
            className="customer-cancel-button"
            onClick={onCancel}
            disabled={savingContract}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="customer-submit-button"
            disabled={savingContract}
          >
            {savingContract ? "Saving..." : "Save contract"}
          </button>
          {errors.save && <p className="contract-subcontract-error" role="alert">{errors.save}</p>}
        </div>
      </header>
      <section className="customer-form-sheet">
        <section className="customer-form-section">
          <h2>Contract Information</h2>
          <div className="customer-form-grid">
            <label
              className={`customer-field ${errors.number ? "has-error" : ""}`}
            >
              <span>{errors.number && <em>*</em>}Contract number</span>
              <input
                value={form.number}
                onChange={(e) => update("number", e.target.value)}
                placeholder="e.g. TASL-CTR-001"
              />
              {errors.number && <small>{errors.number}</small>}
            </label>
            <label
              className={`customer-field ${errors.customer ? "has-error" : ""}`}
            >
              <span>{errors.customer && <em>*</em>}Customer</span>
              <select
                value={form.customer}
                onChange={(e) => update("customer", e.target.value)}
              >
                <option value="">Select customer</option>
                <option>Indian Air Force</option>
                <option>Indian Army</option>
                <option>Indian Navy</option>
                <option>Indian Army Special Forces</option>
              </select>
              {errors.customer && <small>{errors.customer}</small>}
            </label>
          </div>
        </section>
        <section className="customer-form-section">
          <h2>Important Dates</h2>
          <div className="customer-form-grid">
            <label
              className={`customer-field ${errors.entryDate ? "has-error" : ""}`}
            >
              <span>
                {errors.entryDate && <em>*</em>}Entry date (Contract execution)
              </span>
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => update("entryDate", e.target.value)}
              />
              {errors.entryDate && <small>{errors.entryDate}</small>}
            </label>
            <label
              className={`customer-field ${errors.jriDate ? "has-error" : ""}`}
            >
              <span>
                {errors.jriDate && <em>*</em>}JRI date (Product delivery)
              </span>
              <input
                type="date"
                value={form.jriDate}
                onChange={(e) => {
                  const jriDate = e.target.value;
                  setForm((current) =>
                    normalizeWarrantyStatus({
                      ...current,
                      jriDate,
                      expiryDate: warrantyExpiryFromJri(jriDate),
                    }),
                  );
                }}
              />
              {errors.jriDate && <small>{errors.jriDate}</small>}
            </label>
            <label
              className={`customer-field ${errors.expiryDate ? "has-error" : ""}`}
            >
              <span>{errors.expiryDate && <em>*</em>}Warranty expiry date</span>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm((current) =>
                    normalizeWarrantyStatus({
                      ...current,
                      expiryDate: e.target.value,
                    }),
                  )
                }
              />
              {errors.expiryDate && <small>{errors.expiryDate}</small>}
            </label>
            <label
              className={`customer-field ${errors.status ? "has-error" : ""}`}
            >
              <span>{errors.status && <em>*</em>}Contract status</span>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="">Select status</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Expired</option>
              </select>
              {errors.status && <small>{errors.status}</small>}
            </label>
          </div>
        </section>
        <section className="customer-form-section">
          <h2>Warranty & Status</h2>
          <div className="customer-form-grid">
            <label className="customer-field">
              <span>Warranty status</span>
              <input
                value={form.warranty || "Set a warranty expiry date"}
                readOnly
              />
            </label>
            <label className="customer-field">
              <span>System</span>
              <input
                value={form.system || ""}
                onChange={(e) => update("system", e.target.value)}
                placeholder="e.g. Loitering Munition"
              />
            </label>
            <label className="customer-field">
              <span>Incident number prefix</span>
              <input
                value={form.incidentPrefix}
                onChange={(e) => update("incidentPrefix", e.target.value)}
                placeholder="e.g. IAF"
              />
            </label>
          </div>
        </section>
        <section className="customer-form-section">
          <div className="customer-form-section-heading">
            <div>
              <h2>Related subcontracts</h2>
              <p>AMC and CMC coverage is retained under this main contract.</p>
            </div>
            <button
              type="button"
              className="compact-button secondary"
              onClick={addSubcontract}
            >
              <Plus size={14} /> Add subcontract
            </button>
          </div>
          {errors.subcontracts && (
            <p className="contract-subcontract-error">{errors.subcontracts}</p>
          )}
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Subcontract number</th>
                  <th>Valid from</th>
                  <th>Valid to</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {form.subcontracts.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <select
                        value={item.type}
                        onChange={(event) =>
                          updateSubcontract(index, "type", event.target.value)
                        }
                      >
                        <option value="AMC">AMC</option>
                        <option value="CMC">CMC</option>
                      </select>
                    </td>
                    <td>
                      <input
                        value={item.number}
                        onChange={(event) =>
                          updateSubcontract(index, "number", event.target.value)
                        }
                        placeholder="Contract number"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={item.validFrom}
                        onChange={(event) =>
                          updateSubcontract(
                            index,
                            "validFrom",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={item.validTo}
                        onChange={(event) =>
                          updateSubcontract(
                            index,
                            "validTo",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeSubcontract(index)}
                        title="Remove subcontract"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!form.subcontracts.length && (
                  <tr>
                    <td colSpan="5" className="empty-row">
                      No AMC or CMC subcontracts added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="customer-form-section">
          <h2>Deliverables</h2>
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Custom details</th>
                  <th>Quantity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {form.deliverables.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        aria-label={`Deliverable ${idx + 1} product`}
                        value={item.product}
                        onChange={(e) =>
                          updateDeliverable(idx, "product", e.target.value)
                        }
                      >
                        <option value="">Select product</option>
                        {!deliverableProducts.includes(item.product) &&
                          item.product && (
                            <option value={item.product}>{item.product}</option>
                          )}
                        {deliverableProducts.map((product) => (
                          <option key={product} value={product}>
                            {product}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {item.product === "Others" && (
                        <input
                          aria-label={`Deliverable ${idx + 1} custom details`}
                          value={item.otherDetails || ""}
                          onChange={(e) =>
                            updateDeliverable(
                              idx,
                              "otherDetails",
                              e.target.value,
                            )
                          }
                          placeholder="Enter custom details"
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateDeliverable(
                            idx,
                            "quantity",
                            parseInt(e.target.value) || 1,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeDeliverable(idx)}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="add-contact-btn"
            onClick={addDeliverable}
          >
            <Plus size={15} /> Add deliverable
          </button>
        </section>
        <section className="customer-form-section">
          <div className="customer-form-section-heading">
            <div>
              <h2>MRLS / Spares</h2>
              <p>
                Select a spare category to define this contract's requirements.
              </p>
            </div>
          </div>
          <div className="contract-spare-add-row">
            <label className="customer-field">
              <span>Spare category</span>
              <select
                value={selectedSpareCategory}
                onChange={(event) => {
                  setSelectedSpareCategory(event.target.value);
                  setSpareError("");
                }}
              >
                <option value="">Select spare category</option>
                {availableSpareCategories.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="customer-field">
              <span>Quantity</span>
              <input
                inputMode="numeric"
                value={spareQuantity}
                onChange={(event) => {
                  setSpareQuantity(event.target.value);
                  setSpareError("");
                }}
                aria-invalid={Boolean(spareError)}
              />
            </label>
            <button
              type="button"
              className="compact-button secondary"
              onClick={addSpareRequirement}
            >
              <Plus size={14} /> Add spare
            </button>
          </div>
          {canManageSpareCategories && (
            <div className="contract-spare-category-admin">
              <label className="customer-field">
                <span>Add spare category</span>
                <input
                  value={newSpareCategory}
                  onChange={(event) => {
                    setNewSpareCategory(event.target.value);
                    setCategoryNotice("");
                  }}
                  placeholder="Enter additional category"
                />
              </label>
              <button
                type="button"
                className="compact-button secondary"
                onClick={addSpareCategory}
                disabled={savingCategory}
              >
                <Plus size={14} />{" "}
                {savingCategory ? "Adding..." : "Add category"}
              </button>
              {categoryNotice && <small role="status">{categoryNotice}</small>}
            </div>
          )}
          {spareError && (
            <p className="contract-subcontract-error" role="alert">
              {spareError}
            </p>
          )}
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Spare category</th>
                  <th>Quantity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {form.spares.map((item, idx) => (
                  <tr key={item.productId || `${item.name}-${idx}`}>
                    <td>{item.productCategory || item.name}</td>
                    <td className="numeric">{item.quantity}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeSpare(idx)}
                        title="Remove spare requirement"
                        aria-label={`Remove ${item.name || "spare"} requirement`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!form.spares.length && (
                  <tr>
                    <td colSpan="3" className="empty-row">
                      No spare requirements added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {errors.mrlsRecords && (
            <p className="contract-subcontract-error" role="alert">
              {errors.mrlsRecords}
            </p>
          )}
          <ContractMrlsDetails
            requirements={form.spares}
            records={form.mrlsRecords}
            onGenerateMissing={generateMissingMrlsRecords}
            onUpdateRecord={updateMrlsRecord}
            onDeleteRecord={removeMrlsRecord}
          />
        </section>
      </section>
      <footer className="customer-form-footer">
        <button
          type="button"
          className="customer-cancel-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="customer-submit-button"
          disabled={savingContract}
        >
          {savingContract ? "Saving..." : "Save contract"}
        </button>
      </footer>
    </form>
  );
}

function ContractMrlsDetails({
  requirements,
  records,
  onGenerateMissing,
  onUpdateRecord,
  onDeleteRecord,
}) {
  const generatedByRequirement = requirements.map((requirement) => ({
    requirement,
    records: records.filter(
      (record) => record.requirementId === requirement.requirementId,
    ),
  }));
  return (
    <div className="contract-mrls-details">
      <div className="customer-form-section-heading">
        <div>
          <h2>MRLS / Spare Details</h2>
          <p>
            Each row is a contract-scoped physical spare. It will not be added
            to Inventory Master at this stage.
          </p>
        </div>
      </div>
      <div
        className="contract-mrls-requirements"
        aria-label="MRLS requirement status"
      >
        {generatedByRequirement.map(
          ({ requirement, records: requirementRecords }) => {
            const requiredQuantity = Number(requirement.quantity || 0);
            const remainingQuantity = Math.max(
              0,
              requiredQuantity - requirementRecords.length,
            );
            return (
              <div
                className={`contract-mrls-requirement ${remainingQuantity ? "incomplete" : ""}`}
                key={requirement.requirementId}
              >
                <strong>
                  {requirement.productCategory || requirement.name}
                </strong>
                <span>Required: {requiredQuantity}</span>
                <span>Generated/Entered: {requirementRecords.length}</span>
                <span>Remaining: {remainingQuantity}</span>
                {remainingQuantity > 0 && (
                  <button
                    type="button"
                    className="compact-button secondary"
                    onClick={() => onGenerateMissing(requirement)}
                  >
                    <Plus size={14} /> Generate {remainingQuantity} row
                    {remainingQuantity === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            );
          },
        )}
      </div>
      {records.length > 0 && (
        <div className="contacts-table-wrapper">
          <table className="contacts-table contract-mrls-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Spare</th>
                <th>Serial Number *</th>
                <th>Part Number *</th>
                <th>SAP Part Number</th>
                <th>Material Description *</th>
                <th>Batch No.</th>
                <th>UOM *</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id}>
                  <td className="numeric">{index + 1}</td>
                  <td>{record.spareCategory}</td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} serial number`}
                      value={record.material_serial_number}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "material_serial_number",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} part number`}
                      value={record.part_number}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "part_number",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} SAP part number`}
                      value={record.sap_part_number}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "sap_part_number",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} material description`}
                      value={record.material_description}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "material_description",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} batch number`}
                      value={record.batch_number}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "batch_number",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} unit of measurement`}
                      value={record.unit_of_measurement}
                      onChange={(event) =>
                        onUpdateRecord(
                          record.id,
                          "unit_of_measurement",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`MRLS record ${index + 1} remarks`}
                      value={record.remarks}
                      onChange={(event) =>
                        onUpdateRecord(record.id, "remarks", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => onDeleteRecord(record.id)}
                      title="Delete individual MRLS row"
                      aria-label={`Delete MRLS record ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContractDetail({
  contract,
  onCancel,
  onEdit,
  onCreateSubcontract,
  canManageCustomersAndContracts,
}) {
  const normalizedContract = normalizeWarrantyStatus(contract);
  const activeCoverage = normalizedContract.subcontracts.filter(
    (subcontract) => subcontractStatus(subcontract) === "Active",
  );
  return (
    <section className="customer-detail-page">
      <header className="customer-detail-header">
        <div>
          <button
            type="button"
            className="customer-back-button"
            onClick={onCancel}
          >
            <ArrowLeft size={15} /> Contracts
          </button>
          <h1>{contract.number}</h1>
          <p className="customer-detail-subtitle">{contract.customer}</p>
        </div>
        <div className="customer-detail-actions">
          {canManageCustomersAndContracts && (
            <button
              type="button"
              className="customer-cancel-button"
              onClick={() => onCreateSubcontract?.(contract.number)}
            >
              <Plus size={15} /> New sub-contract
            </button>
          )}
          <button
            type="button"
            className="customer-cancel-button"
            onClick={onCancel}
          >
            Close
          </button>
          {canManageCustomersAndContracts && (
            <button
              type="button"
              className="customer-edit-button"
              onClick={onEdit}
            >
              <Edit2 size={15} /> Edit
            </button>
          )}
        </div>
      </header>
      <section className="customer-detail-sheet">
        <section className="detail-section">
          <h2>Contract Details</h2>
          <div className="detail-grid">
            <div className="detail-field">
              <span className="detail-label">Contract Number</span>
              <span className="detail-value">{contract.number}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Customer</span>
              <span className="detail-value">{contract.customer}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Status</span>
              <span
                className={`badge ${contract.status === "Active" ? "active" : "inactive"}`}
              >
                {contract.status}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Warranty</span>
              <span className="detail-value">
                {normalizedContract.warranty}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Active coverage</span>
              <span className="detail-value">
                {activeCoverage.length
                  ? activeCoverage.map((subcontract) => (
                      <span key={subcontract.id} className="badge">
                        {subcontract.type}
                      </span>
                    ))
                  : "--"}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">System</span>
              <span className="detail-value">{contract.system || "--"}</span>
            </div>
          </div>
        </section>
        <section className="detail-section">
          <h2>Important Dates</h2>
          <div className="detail-grid">
            <div className="detail-field">
              <span className="detail-label">Entry Date</span>
              <span className="detail-value">
                {formatDate(contract.entryDate)}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">JRI Date</span>
              <span className="detail-value">
                {formatDate(contract.jriDate)}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Expiry Date</span>
              <span className="detail-value">
                {formatDate(contract.expiryDate)}
              </span>
            </div>
          </div>
        </section>
        <section className="detail-section">
          <h2>Subcontracts ({normalizedContract.subcontracts.length})</h2>
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Subcontract number</th>
                  <th>Valid from</th>
                  <th>Valid to</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {normalizedContract.subcontracts.map((subcontract) => (
                  <tr key={subcontract.id}>
                    <td>{subcontract.type}</td>
                    <td>{subcontract.number}</td>
                    <td>{formatDate(subcontract.validFrom)}</td>
                    <td>{formatDate(subcontract.validTo)}</td>
                    <td>
                      <span className="badge">
                        {subcontractStatus(subcontract)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!normalizedContract.subcontracts.length && (
                  <tr>
                    <td colSpan="5" className="empty-row">
                      No AMC or CMC subcontracts configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="detail-section">
          <h2>Deliverables ({contract.deliverables?.length || 0})</h2>
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {(contract.deliverables || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {item.product === "Others"
                        ? item.otherDetails || "Others"
                        : item.product}
                    </td>
                    <td className="numeric">{item.quantity}</td>
                  </tr>
                ))}
                {!contract.deliverables?.length && (
                  <tr>
                    <td colSpan="2" className="empty-row">
                      No deliverables configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="detail-section">
          <h2>MRLS ({contract.spares?.length || 0})</h2>
          <div className="contacts-table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>MRLS Name</th>
                  <th>Part Number</th>
                  <th>Serial Number</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {(contract.spares || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.name}</td>
                    <td>{item.partNumber}</td>
                    <td>{item.serialNumber}</td>
                    <td className="numeric">{item.quantity}</td>
                  </tr>
                ))}
                {!contract.spares?.length && (
                  <tr>
                    <td colSpan="4" className="empty-row">
                      No MRLS configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <footer className="customer-detail-footer">
        <button
          type="button"
          className="customer-cancel-button"
          onClick={onCancel}
        >
          Close
        </button>
        {canManageCustomersAndContracts && (
          <button
            type="button"
            className="customer-edit-button"
            onClick={onEdit}
          >
            <Edit2 size={15} /> Edit
          </button>
        )}
      </footer>
    </section>
  );
}

function DeleteConfirmation({ contract, onConfirm, onCancel }) {
  return (
    <div className="delete-confirmation-overlay">
      <div className="delete-confirmation-modal">
        <h2>Delete Contract?</h2>
        <p>
          Are you sure you want to delete <strong>{contract.number}</strong>?
          This action cannot be undone.
        </p>
        <div className="delete-confirmation-actions">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-btn" onClick={() => onConfirm(contract.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
