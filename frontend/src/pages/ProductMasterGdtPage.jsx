import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, CheckCircle2, ChevronDown, Download, Edit2, Eye, FileSpreadsheet, Plus, Search, Settings2, Trash2, Upload, X } from 'lucide-react'
import { parseProductMasterWorkbook } from '../data/productImport'

const gdtColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'batch_number', label: 'Batch Number (if applicable)', required: false, width: 190 },
  { key: 'item_serial_number', label: 'Item Serial No. (if applicable)', required: false, width: 205 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const simulatorProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'item_serial_number', label: 'Item Serial No.', required: false, width: 180 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const tmvProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'vehicle_ba_number', label: 'Vehicle BA No.', required: false, width: 170 },
  { key: 'engine_number', label: 'Engine No.', required: false, width: 170 },
  { key: 'chasis_number', label: 'Chasis No.', required: false, width: 170 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const batteryProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Partnumber', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'batch_number', label: 'Batch Number', required: false, width: 165 },
  { key: 'make', label: 'Make', required: false, width: 145 },
  { key: 'battery_type', label: 'Battery Type', required: false, width: 150 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const warheadSamProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'batch_number', label: 'Batch No', required: false, width: 165 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const toolsProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const mrlsProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'batch_number', label: 'Batch No', required: false, width: 165 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const smeSteProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

export const gseProductColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'part_number', label: 'Part Number', required: true, width: 150 },
  { key: 'sap_part_number', label: 'SAP Part number', required: false, width: 165 },
  { key: 'material_description', label: 'Material Description', required: true, width: 230 },
  { key: 'make', label: 'Make', required: false, width: 145 },
  { key: 'item_serial_number', label: 'Item Serial No.', required: false, width: 175 },
  { key: 'quantity', label: 'Quantity', required: true, width: 110 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement (UOM)', required: true, width: 175 },
  { key: 'remarks', label: 'Remarks', required: false, width: 200 },
]

const emptyProductRecord = (recordCount, idPrefix, columns) => ({
  id: `${idPrefix}-${crypto.randomUUID()}`,
  ...Object.fromEntries(columns.map(({ key }) => [key, key === 'product_serial_number' ? `${idPrefix.toUpperCase()}-${String(recordCount + 1).padStart(3, '0')}` : ''])),
})

export default function ProductMasterGdtPage({ records, setRecords, canManageInventory = false, canImportInventory = false, masterName = 'GDT', idPrefix = 'gdt', columns = gdtColumns }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState(columns.map(({ key }) => key))
  const [showColumns, setShowColumns] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importMessage, setImportMessage] = useState('')
  const importInput = useRef(null)
  const activeColumns = columns.filter(({ key }) => visibleColumns.includes(key))
  const filteredRecords = useMemo(() => records.filter((record) => !search || columns.some(({ key }) => String(record[key] ?? '').toLowerCase().includes(search.toLowerCase()))), [columns, records, search])
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const visibleRecords = filteredRecords.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)
  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key) ? current.filter((column) => column !== key) : [...current, key])
  const exportTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([Object.fromEntries(columns.map(({ label }) => [label, '']))])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Product Master ${masterName}`)
    XLSX.writeFile(workbook, `als50-product-master-${idPrefix}-template.xlsx`)
  }
  const saveRecord = (nextRecord) => {
    setRecords((current) => current.some((record) => record.id === nextRecord.id) ? current.map((record) => record.id === nextRecord.id ? nextRecord : record) : [...current, nextRecord])
    setEditingRecord(null)
  }
  const handleImportWorkbook = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportMessage('')
    try {
      setImportPreview(parseProductMasterWorkbook(await file.arrayBuffer(), columns, idPrefix, file.name))
    } catch {
      setImportPreview(null)
      setImportMessage('The workbook could not be read. Select a valid Excel workbook and try again.')
    }
  }
  const commitImport = () => {
    if (!importPreview?.rows.length) return
    if (importPreview.invalidRows.length) {
      setImportMessage('Resolve rows missing required values before importing.')
      return
    }
    setRecords((current) => {
      const recordsById = new Map(current.map((record) => [record.id, record]))
      importPreview.rows.forEach((record) => recordsById.set(record.id, record))
      return [...recordsById.values()]
    })
    setImportMessage(`${importPreview.rows.length} row(s) imported from ${importPreview.fileName}.`)
    setImportPreview(null)
  }

  if (selectedRecord) return <GdtRecordView record={selectedRecord} columns={columns} masterName={masterName} canManageInventory={canManageInventory} onBack={() => setSelectedRecord(null)} onEdit={() => { setEditingRecord(selectedRecord); setSelectedRecord(null) }} />
  if (editingRecord) return <GdtRecordEditor record={editingRecord} columns={columns} masterName={masterName} isNew={!records.some((record) => record.id === editingRecord.id)} onBack={() => setEditingRecord(null)} onSave={saveRecord} />

  return <>
    <div className="incident-list-head product-master-heading"><div className="incident-list-title"><h1>Product Master - {masterName}</h1><p>Material and item inventory register for {masterName}.</p></div>{canImportInventory && <button className="compact-button secondary" onClick={exportTemplate}><Download size={15} /> Download Excel template</button>}</div>
    <section className="incident-list-page product-register-page" aria-label={`${masterName} product register`}>
      <div className="incident-command-bar product-command-bar">
        <div className="incident-search"><Search size={15} /><input placeholder={`Search all ${masterName} product fields...`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div><span className="incident-list-count">{filteredRecords.length} of {records.length} records</span>
        <div className="incident-command-actions product-command-actions"><button className="compact-button secondary" onClick={() => setShowColumns((open) => !open)}><Settings2 size={15} /> Columns <ChevronDown size={14} /></button>{canImportInventory && <><input ref={importInput} type="file" accept=".xlsx,.xls" onChange={handleImportWorkbook} hidden /><button className="compact-button primary" onClick={() => importInput.current?.click()}><Upload size={15} /> Import Excel</button></>}{canManageInventory && <button className="compact-button primary" onClick={() => setEditingRecord(emptyProductRecord(records.length, idPrefix, columns))}><Plus size={15} /> Add material</button>}</div>
        {showColumns && <div className="column-picker product-column-picker"><div className="column-picker-head"><strong>Display columns</strong><button onClick={() => setShowColumns(false)}><X size={15} /></button></div>{columns.map(({ key, label }) => <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => toggleColumn(key)} /> {label}</label>)}</div>}
      </div>
      {importPreview && <section className="import-step-card product-master-import-review"><div className="import-step-heading"><span><FileSpreadsheet size={14} /></span><div><h2>Workbook review</h2><p>{importPreview.fileName}: {importPreview.rows.length} valid row(s), {importPreview.invalidRows.length} invalid row(s), {importPreview.skippedSheets.length} skipped sheet(s).</p></div></div>{importPreview.invalidRows.length > 0 && <p className="import-review-note error">Rows must include: {columns.filter((column) => column.required).map((column) => column.label).join(', ')}.</p>}<div className="import-actions-row"><button className="compact-button primary" disabled={!importPreview.rows.length || importPreview.invalidRows.length > 0} onClick={commitImport}><Upload size={15} /> Import {importPreview.rows.length} row(s)</button></div></section>}
      {importMessage && <div className={`import-message ${importMessage.includes('imported') ? 'success' : ''}`}><CheckCircle2 size={15} /> {importMessage}</div>}
      <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table product-register-table"><colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 104 }} /></colgroup><thead><tr>{activeColumns.map(({ key, label }) => <th key={key}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}>{activeColumns.map(({ key }) => <td key={key}>{key === 'product_serial_number' ? <button className="incident-number" onClick={() => setSelectedRecord(record)}>{record[key]}</button> : record[key] || <span className="table-empty">--</span>}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View material" onClick={() => setSelectedRecord(record)}><Eye size={15} /></button>{canManageInventory && <><button className="action-btn" title="Edit material" onClick={() => setEditingRecord(record)}><Edit2 size={15} /></button><button className="action-btn delete" title="Delete material" onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}><Trash2 size={15} /></button></>}</div></td></tr>)}{!filteredRecords.length && <tr><td colSpan={Math.max(activeColumns.length + 1, 1)} className="empty-row">No {masterName} materials match the current search.</td></tr>}</tbody></table></div></div>
      <footer className="incident-pagination"><span>Showing {filteredRecords.length ? `${(Math.min(page, totalPages) - 1) * pageSize + 1}-${Math.min(Math.min(page, totalPages) * pageSize, filteredRecords.length)} of ${filteredRecords.length}` : '0'} record{filteredRecords.length === 1 ? '' : 's'}</span><div className="incident-page-controls"><button className="compact-button secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {Math.min(page, totalPages)} of {totalPages}</span><button className="compact-button secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></footer>
    </section>
  </>
}

function GdtRecordView({ record, columns, masterName, canManageInventory, onBack, onEdit }) {
  return <section className="product-record-page"><header className="group-config-header"><div><button className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product Master - {masterName}</button><h1>{record.material_description || `${masterName} material record`}</h1><p>{record.part_number || 'Material details'}</p></div><div><button className="incident-cancel-button" onClick={onBack}>Close</button>{canManageInventory && <button className="incident-submit-button" onClick={onEdit}>Edit material</button>}</div></header><section className="product-record-sheet">{columns.map(({ key, label }) => <div key={key}><span>{label}</span><strong>{record[key] || '--'}</strong></div>)}</section></section>
}

function GdtRecordEditor({ record, columns, masterName, isNew, onBack, onSave }) {
  const [form, setForm] = useState(record)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="product-record-page" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product Master - {masterName}</button><h1>{isNew ? `Add ${masterName} material` : `Edit ${masterName} material`}</h1><p>Maintain material and item inventory details for {masterName}.</p></div><div><button type="button" className="incident-cancel-button" onClick={onBack}>Cancel</button><button className="incident-submit-button" type="submit">{isNew ? 'Add material' : 'Save changes'}</button></div></header><section className="product-record-sheet product-record-editor">{columns.map(({ key, label, required }) => <label key={key}><span>{label}{required && ' *'}</span><input value={form[key] || ''} onChange={(event) => update(key, event.target.value)} required={required} /></label>)}</section></form>
}