import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, CheckCircle2, ChevronDown, Download, Edit2, Eye, FileSpreadsheet, Search, Settings2, Trash2, Upload, X } from 'lucide-react'

const productColumns = [
  { key: 'product_serial_number', label: 'Product Serial Number', required: true, width: 175 },
  { key: 'product_category', label: 'Product Category', required: true, width: 165 },
  { key: 'route_card_description', label: 'Route Card Description', required: false, width: 210 },
  { key: 'part_number', label: 'Part Number', required: true, width: 145 },
  { key: 'sap_part_number', label: 'SAP Part Number', required: false, width: 160 },
  { key: 'material_description', label: 'Material Description', required: true, width: 220 },
  { key: 'batch_or_po_number', label: 'Batch No / PO No', required: false, width: 155 },
  { key: 'material_serial_number', label: 'Material Serial No', required: false, width: 170 },
  { key: 'weight_in_grams', label: 'Weight in Grams', required: false, width: 135 },
  { key: 'required_quantity', label: 'Required Quantity', required: true, width: 145 },
  { key: 'unit_of_measurement', label: 'Unit of Measurement', required: true, width: 165 },
  { key: 'subsystems', label: 'Subsystems', required: false, width: 160 },
]

const routeCardAssemblies = [
  { routeCard: 'FUSELAGE', description: 'FUSELAGE INTEGRATION ASSEMBLY', partNumber: '24386416', sapPartNumber: '967670019457196', material: 'FUSS LAAGE ASSEMBLY', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'CENTER WING', description: 'CENTER WING INTEGRATION ASSEMBLY', partNumber: '48366595', sapPartNumber: '367545085296588', material: 'CENT AAR WIND ASBLY', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'BOOM LH', description: 'VTOL BOOM INTEGRATION ASSEMBLY-LH', partNumber: '32846269', sapPartNumber: '365320805991501', material: 'BOOMER ASSEM-Ligh', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'BOOM RH', description: 'VTOL BOOM INTEGRATION ASSEMBLY-RH', partNumber: '75486038', sapPartNumber: '538135772906013', material: 'BOOMER ASSAMBL -Rgt', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'LH SIDE WING', description: 'LH SIDE WING INTEGRATION ASSEMBLY', partNumber: '56320098', sapPartNumber: '140104030000069', material: 'LH-SAI WINDI AIRFRA ASSEMBL', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'RH SIDE WING', description: 'RH SIDE WING INTEGRATION ASSEMBLY', partNumber: '56320101', sapPartNumber: '140104030000064', material: 'RH-SAI WINDI AIRFRA ASSEMBL', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'LH ENPENNAGE', description: 'LH ENPENNAGE INTEGRATION ASSEMBLY', partNumber: '45468899', sapPartNumber: '741262660664557', material: 'LH ENPA NAJI AFME ASSEMBLY', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'RH ENPENNAGE', description: 'RH ENPENNAGE INTEGRATION ASSEMBLY', partNumber: '57741326', sapPartNumber: '105168151875532', material: 'RH ENPA NAJI AFME ASSEMBLY', quantity: '1', uom: 'EA', subsystem: 'AIR' },
  { routeCard: 'AIRCRAFT ASSEMBLY', description: 'AIRCRAFT ASSEMBLY', partNumber: '46168658', sapPartNumber: '786773292703919', material: 'FUSS LAAGE INTEGER ASSAMBLES', quantity: '1', uom: 'EA', subsystem: 'FINAL ASSEMBLY' },
  { routeCard: 'AIRCRAFT ASSEMBLY WPROP', description: 'AIRCRAFT ASSEMBLY WITH PROPELLERS', partNumber: '24492779', sapPartNumber: '736282419201543', material: 'AIRCRAFT XXX ASSEMBLY', quantity: '1', uom: 'EA', subsystem: 'FINAL ASSEMBLY' },
]

const subsystemDefinitions = [
  { name: 'AIRFRAME', code: 'AIR', recordsPerUnit: 160 },
  { name: 'HARNESS', code: 'HAR', recordsPerUnit: 80 },
  { name: 'PROPULSION', code: 'PRO', recordsPerUnit: 100 },
  { name: 'DATALINK', code: 'DAT', recordsPerUnit: 60 },
  { name: 'AVIONICS & HARWARE', code: 'AVH', recordsPerUnit: 120 },
  { name: 'GIMBAL', code: 'GIM', recordsPerUnit: 60 },
  { name: 'CONSUMABLES', code: 'CON', recordsPerUnit: 100 },
]
const routeCardLabels = {
  FUSELAGE: 'Fuselage',
  'CENTER WING': 'Center Wing',
  'BOOM LH': 'Left Boom',
  'BOOM RH': 'Right Boom',
  'LH SIDE WING': 'Left Side Wing',
  'RH SIDE WING': 'Right Side Wing',
  'LH ENPENNAGE': 'Left Empennage',
  'RH ENPENNAGE': 'Right Empennage',
  'AIRCRAFT ASSEMBLY': 'Aircraft Assembly',
  'AIRCRAFT ASSEMBLY WPROP': 'Aircraft Assembly Propeller',
}
const componentNames = {
  AIRFRAME: ['Carbon Fiber Panel', 'Structural Rib', 'Mounting Bracket', 'Access Cover', 'Bonded Fastener'],
  HARNESS: ['Wiring Harness', 'Connector Assembly', 'Cable Loom', 'Junction Connector', 'Grounding Lead'],
  PROPULSION: ['Motor Assembly', 'Propeller Hub', 'Electronic Speed Controller', 'Motor Mount', 'Propulsion Cable'],
  DATALINK: ['Radio Transceiver', 'Antenna Assembly', 'RF Cable', 'Telemetry Modem', 'Data Link Connector'],
  'AVIONICS & HARWARE': ['Flight Controller', 'Navigation Module', 'Power Distribution Board', 'Inertial Sensor', 'Avionics Mount'],
  GIMBAL: ['Gimbal Frame', 'Payload Camera', 'Gimbal Motor', 'Stabilization Controller', 'Payload Cable'],
  CONSUMABLES: ['Fastener Kit', 'Bonding Adhesive', 'Protective Sealant', 'Thermal Interface Pad', 'Cable Tie Set'],
}
const componentDescription = (routeCard, subsystem, componentIndex) => `${routeCardLabels[routeCard]} ${componentNames[subsystem][componentIndex % componentNames[subsystem].length]}`
const recordsPerUnit = 680

export const seedProducts = Array.from({ length: 15 }, (_, unitIndex) => {
  const unitNumber = String(unitIndex + 1).padStart(3, '0')
  let recordOffset = 0
  return subsystemDefinitions.flatMap(({ name: subsystem, code, recordsPerUnit: subsystemRecordCount }) => {
    const records = Array.from({ length: subsystemRecordCount }, (_, subsystemIndex) => {
      const recordIndex = recordOffset + subsystemIndex
      const assembly = routeCardAssemblies[recordIndex % routeCardAssemblies.length]
      const routeSequence = String(recordIndex + 1).padStart(3, '0')
      return {
        product_serial_number: `LM-${unitNumber}`,
        product_category: 'Loitering Munition',
        route_card_description: assembly.routeCard,
        part_number: `${assembly.partNumber}-${routeSequence}`,
        sap_part_number: `${assembly.sapPartNumber}${routeSequence}`,
        material_description: componentDescription(assembly.routeCard, subsystem, subsystemIndex),
        batch_or_po_number: `LM-PO-2026-${unitNumber}-${String(Math.floor(recordIndex / 20) + 1).padStart(2, '0')}`,
        material_serial_number: `LM-${unitNumber}-${code}-${routeSequence}`,
        weight_in_grams: '',
        required_quantity: assembly.quantity,
        unit_of_measurement: assembly.uom,
        subsystems: subsystem,
      }
    })
    recordOffset += subsystemRecordCount
    return records
  })
}).flat()

const normalize = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const blankMapping = () => Object.fromEntries(productColumns.map(({ key }) => [key, '']))

export default function ProductMasterPage({ products, setProducts }) {
  const [activeTab, setActiveTab] = useState('products')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState(productColumns.map(({ key }) => key))
  const [showColumns, setShowColumns] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [fileName, setFileName] = useState('')
  const [sourceHeaders, setSourceHeaders] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [mapping, setMapping] = useState(blankMapping)
  const [importSetName, setImportSetName] = useState('')
  const [importSets, setImportSets] = useState([])
  const [importMessage, setImportMessage] = useState('')
  const fileInput = useRef(null)

  const activeColumns = productColumns.filter(({ key }) => visibleColumns.includes(key))
  const filteredProducts = useMemo(() => products.filter((product) =>
    !search || productColumns.some(({ key }) => String(product[key] ?? '').toLowerCase().includes(search.toLowerCase()))
  ), [products, search])
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visibleProducts = filteredProducts.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)

  const mappedRows = useMemo(() => sourceRows.map((row) => Object.fromEntries(productColumns.map(({ key }) => [key, mapping[key] ? row[mapping[key]] ?? '' : '']))), [mapping, sourceRows])
  const requiredUnmapped = productColumns.filter(({ key, required }) => required && !mapping[key])
  const invalidRows = mappedRows.filter((row) => productColumns.some(({ key, required }) => required && !String(row[key] ?? '').trim()))

  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key) ? current.filter((column) => column !== key) : [...current, key])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportMessage('')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    const headers = rows.length ? Object.keys(rows[0]) : []
    const autoMapping = Object.fromEntries(productColumns.map(({ key, label }) => {
      const source = headers.find((header) => normalize(header) === normalize(key) || normalize(header) === normalize(label))
      return [key, source ?? '']
    }))
    setFileName(file.name)
    setSourceRows(rows)
    setSourceHeaders(headers)
    setMapping(autoMapping)
  }

  const saveImportSet = () => {
    if (!importSetName.trim()) {
      setImportMessage('Enter a name before saving the import set.')
      return
    }
    setImportSets((current) => [{ id: Date.now(), name: importSetName.trim(), mapping, sourceHeaders, created: new Date().toLocaleDateString() }, ...current])
    setImportMessage(`Import set "${importSetName.trim()}" saved.`)
  }

  const applyImportSet = (importSet) => {
    setMapping(importSet.mapping)
    setImportSetName(importSet.name)
    setImportMessage(`Applied import set "${importSet.name}".`)
  }

  const importRows = () => {
    if (!sourceRows.length) {
      setImportMessage('Choose an Excel workbook first.')
      return
    }
    if (requiredUnmapped.length) {
      setImportMessage(`Map required columns: ${requiredUnmapped.map(({ label }) => label).join(', ')}.`)
      return
    }
    if (invalidRows.length) {
      setImportMessage(`${invalidRows.length} row(s) are missing a required mapped value. Review the preview before importing.`)
      return
    }
    setProducts((current) => [...mappedRows, ...current])
    setImportMessage(`${mappedRows.length} product row(s) imported successfully.`)
    setActiveTab('products')
  }

  const exportTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([Object.fromEntries(productColumns.map(({ label }) => [label, '']))])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Master')
    XLSX.writeFile(workbook, 'als50-product-master-template.xlsx')
  }

  const saveProduct = (nextProduct) => {
    setProducts((current) => current.map((product) => product === editingProduct ? nextProduct : product))
    setEditingProduct(null)
  }

  const deleteProduct = (product) => setProducts((current) => current.filter((item) => item !== product))

  if (selectedProduct) return <ProductRecordView product={selectedProduct} onBack={() => setSelectedProduct(null)} onEdit={() => { setEditingProduct(selectedProduct); setSelectedProduct(null) }} />
  if (editingProduct) return <ProductRecordEditor product={editingProduct} onBack={() => setEditingProduct(null)} onSave={saveProduct} />

  return (
    <>
      <div className="incident-list-head product-master-heading">
        <div className="incident-list-title"><h1>Product master</h1><p>Fixed product, material, and subsystem inventory register.</p></div>
        <button className="compact-button secondary" onClick={exportTemplate}><Download size={15} /> Download Excel template</button>
      </div>

      <div className="tab-bar product-master-tabs" role="tablist">
        <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>Product register <span>{products.length}</span></button>
        <button className={`tab-btn ${activeTab === 'imports' ? 'active' : ''}`} onClick={() => setActiveTab('imports')}>Excel imports</button>
      </div>

      {activeTab === 'products' && (
        <section className="incident-list-page product-register-page" aria-label="Product register">
          <div className="incident-command-bar product-command-bar">
            <div className="incident-search"><Search size={15} /><input placeholder="Search all product fields..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
            <span className="incident-list-count">{filteredProducts.length} of {products.length} records</span>
            <div className="incident-command-actions product-command-actions">
              <button className="compact-button secondary" onClick={() => setShowColumns((open) => !open)}><Settings2 size={15} /> Columns <ChevronDown size={14} /></button>
              <button className="compact-button primary" onClick={() => setActiveTab('imports')}><Upload size={15} /> Import Excel</button>
            </div>
            {showColumns && <div className="column-picker product-column-picker"><div className="column-picker-head"><strong>Display columns</strong><button onClick={() => setShowColumns(false)}><X size={15} /></button></div>{productColumns.map(({ key, label }) => <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => toggleColumn(key)} /> {label}</label>)}</div>}
          </div>
          <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table product-register-table"><colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 104 }} /></colgroup><thead><tr>{activeColumns.map(({ key, label }) => <th key={key}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.material_serial_number}>{activeColumns.map(({ key }) => <td key={key}>{key === 'product_serial_number' ? <button className="incident-number" onClick={() => setSelectedProduct(product)}>{product[key]}</button> : product[key] || <span className="table-empty">--</span>}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View product" onClick={() => setSelectedProduct(product)}><Eye size={15} /></button><button className="action-btn" title="Edit product" onClick={() => setEditingProduct(product)}><Edit2 size={15} /></button><button className="action-btn delete" title="Delete product" onClick={() => deleteProduct(product)}><Trash2 size={15} /></button></div></td></tr>)}{!filteredProducts.length && <tr><td colSpan={Math.max(activeColumns.length + 1, 1)} className="empty-row">No products match the current search.</td></tr>}</tbody></table></div></div>
          <footer className="incident-pagination"><span>Showing {filteredProducts.length ? `${(Math.min(page, totalPages) - 1) * pageSize + 1}-${Math.min(Math.min(page, totalPages) * pageSize, filteredProducts.length)} of ${filteredProducts.length}` : '0'} record{filteredProducts.length === 1 ? '' : 's'}</span><div className="incident-page-controls"><button className="compact-button secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {Math.min(page, totalPages)} of {totalPages}</span><button className="compact-button secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></footer>
        </section>
      )}

      {activeTab === 'imports' && (
        <section className="import-workspace">
          <div className="import-step-card">
            <div className="import-step-heading"><span>1</span><div><h2>Choose workbook</h2><p>Upload an Excel workbook. The first worksheet is used for mapping.</p></div></div>
            <div className="import-file-row"><input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={handleFile} hidden /><button className="compact-button primary" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={16} /> Select Excel file</button><span>{fileName || 'No file selected'}</span></div>
          </div>

          <div className={`import-step-card ${!sourceHeaders.length ? 'disabled-step' : ''}`}>
            <div className="import-step-heading"><span>2</span><div><h2>Map source columns</h2><p>Match each Excel column to the fixed Product Master database schema.</p></div></div>
            <div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>Product Master field</th><th>Required</th><th>Excel column</th></tr></thead><tbody>{productColumns.map(({ key, label, required }) => <tr key={key}><td>{label}</td><td>{required ? <span className="priority-label critical">Required</span> : <span className="priority-label normal">Optional</span>}</td><td><select value={mapping[key]} disabled={!sourceHeaders.length} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}><option value="">Do not import</option>{sourceHeaders.map((header) => <option key={header} value={header}>{header}</option>)}</select></td></tr>)}</tbody></table></div>
          </div>

          <div className={`import-step-card ${!sourceHeaders.length ? 'disabled-step' : ''}`}>
            <div className="import-step-heading"><span>3</span><div><h2>Save or run import</h2><p>Save a reusable mapping as an import set, then validate and import the current workbook.</p></div></div>
            <div className="import-actions-row"><input value={importSetName} onChange={(event) => setImportSetName(event.target.value)} placeholder="Import set name, e.g. SAP material register" disabled={!sourceHeaders.length} /><button className="compact-button secondary" onClick={saveImportSet} disabled={!sourceHeaders.length}>Save import set</button><button className="compact-button primary" onClick={importRows} disabled={!sourceHeaders.length}><Upload size={15} /> Validate and import</button></div>
            {importMessage && <div className={`import-message ${importMessage.includes('successfully') || importMessage.includes('saved') ? 'success' : ''}`}><CheckCircle2 size={15} /> {importMessage}</div>}
            {importSets.length > 0 && <div className="saved-import-sets"><strong>Saved import sets</strong>{importSets.map((importSet) => <button key={importSet.id} onClick={() => applyImportSet(importSet)}>{importSet.name}<span>{importSet.created}</span></button>)}</div>}
          </div>

          {sourceRows.length > 0 && <div className="import-preview"><div className="panel-head"><div><h2>Import preview</h2><p>{sourceRows.length} rows detected. {invalidRows.length ? `${invalidRows.length} require correction.` : 'All mapped required values are present.'}</p></div></div><div className="enterprise-table-scroll"><table className="enterprise-table"><thead><tr>{productColumns.filter(({ key }) => mapping[key]).map(({ key, label }) => <th key={key}>{label}</th>)}</tr></thead><tbody>{mappedRows.slice(0, 5).map((row, index) => <tr key={index}>{productColumns.filter(({ key }) => mapping[key]).map(({ key }) => <td key={key}>{row[key] || <span className="table-empty">--</span>}</td>)}</tr>)}</tbody></table></div></div>}
        </section>
      )}
    </>
  )
}

function ProductRecordView({ product, onBack, onEdit }) {
  return <section className="product-record-page"><header className="group-config-header"><div><button className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product master</button><h1>{product.material_serial_number}</h1><p>{product.material_description || 'Product material record'}</p></div><div><button className="incident-cancel-button" onClick={onBack}>Close</button><button className="incident-submit-button" onClick={onEdit}>Edit product</button></div></header><section className="product-record-sheet">{productColumns.map(({ key, label }) => <div key={key}><span>{label}</span><strong>{product[key] || '--'}</strong></div>)}</section>{(product.productJournal || []).length > 0 && <section className="product-journal"><h2>Product journal</h2><ol>{[...product.productJournal].reverse().map((entry) => <li key={entry.id}><strong>{entry.field}</strong><span><s>{entry.previous}</s> to <b>{entry.next}</b></span><small>{entry.incidentNumber} · {entry.updatedBy} · {new Date(entry.updatedAt).toLocaleString('en-GB')}</small></li>)}</ol></section>}</section>
}

function ProductRecordEditor({ product, onBack, onSave }) {
  const [form, setForm] = useState(product)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="product-record-page" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product master</button><h1>Edit product record</h1><p>Update the product, material, and subsystem attributes.</p></div><div><button type="button" className="incident-cancel-button" onClick={onBack}>Cancel</button><button className="incident-submit-button" type="submit">Save changes</button></div></header><section className="product-record-sheet product-record-editor">{productColumns.map(({ key, label, required }) => <label key={key}><span>{label}{required && ' *'}</span><input value={form[key] || ''} onChange={(event) => update(key, event.target.value)} required={required} /></label>)}</section></form>
}
