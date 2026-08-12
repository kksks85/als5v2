import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, CheckCircle2, ChevronDown, Download, Edit2, Eye, FileSpreadsheet, Search, Settings2, Trash2, Upload, X } from 'lucide-react'
import { normalizePartNumber, parseConfigurationWorkbook, parseRouteCardWorkbook, reconcileProductImport } from '../data/productImport'

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

export default function ProductMasterPage({ products, setProducts, canManageInventory = false, canImportInventory = false }) {
  const [activeTab, setActiveTab] = useState('products')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState(productColumns.map(({ key }) => key))
  const [showColumns, setShowColumns] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [importIdentity, setImportIdentity] = useState({ productSerialNumber: 'LM-016', productCategory: 'Loitering Munition' })
  const [routeCards, setRouteCards] = useState(null)
  const [configuration, setConfiguration] = useState(null)
  const [importMessage, setImportMessage] = useState('')
  const routeCardInput = useRef(null)
  const configurationInput = useRef(null)

  const activeColumns = productColumns.filter(({ key }) => visibleColumns.includes(key))
  const filteredProducts = useMemo(() => products.filter((product) =>
    !search || productColumns.some(({ key }) => String(product[key] ?? '').toLowerCase().includes(search.toLowerCase()))
  ), [products, search])
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visibleProducts = filteredProducts.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)

  const reconciliation = useMemo(() => routeCards && configuration
    ? reconcileProductImport({ ...importIdentity, routeCards, configuration })
    : null, [configuration, importIdentity, routeCards])

  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key) ? current.filter((column) => column !== key) : [...current, key])

  const handleWorkbook = async (event, parser, setWorkbook, label) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportMessage('')
    try {
      setWorkbook(parser(await file.arrayBuffer(), file.name))
    } catch {
      setImportMessage(`${label} could not be read. Select a valid Excel workbook and try again.`)
    }
  }

  const replaceImportedProductRows = () => {
    if (!reconciliation) {
      setImportMessage('Select both Route Card and Configuration workbooks before importing.')
      return
    }
    if (!importIdentity.productSerialNumber.trim() || !importIdentity.productCategory.trim()) {
      setImportMessage('Enter a Product Serial Number and Product Category before importing.')
      return
    }
    if (reconciliation.invalidRouteRows.length || reconciliation.invalidConfigurationRows.length) {
      setImportMessage('Resolve invalid source rows before importing.')
      return
    }
    const serial = importIdentity.productSerialNumber.trim()
    const existingCount = products.filter((product) => normalizePartNumber(product.product_serial_number) === normalizePartNumber(serial)).length
    if (!window.confirm(`Replace ${existingCount} existing Product Master row(s) for ${serial} with ${reconciliation.assembledRows.length} reconciled component row(s)?`)) return
    setProducts((current) => [
      ...reconciliation.assembledRows,
      ...current.filter((product) => normalizePartNumber(product.product_serial_number) !== normalizePartNumber(serial)),
    ])
    setImportMessage(`${reconciliation.assembledRows.length} component row(s) imported for ${serial}; ${reconciliation.unmatchedRouteRows.length} route-card row(s) were retained without a configuration serial.`)
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

  if (selectedProduct) return <ProductRecordView product={selectedProduct} canManageInventory={canManageInventory} onBack={() => setSelectedProduct(null)} onEdit={() => { setEditingProduct(selectedProduct); setSelectedProduct(null) }} />
  if (editingProduct) return <ProductRecordEditor product={editingProduct} onBack={() => setEditingProduct(null)} onSave={saveProduct} />

  return (
    <>
      <div className="incident-list-head product-master-heading">
        <div className="incident-list-title"><h1>Product master</h1><p>Fixed product, material, and subsystem inventory register.</p></div>
        {canImportInventory && <button className="compact-button secondary" onClick={exportTemplate}><Download size={15} /> Download Excel template</button>}
      </div>

      <div className="tab-bar product-master-tabs" role="tablist">
        <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>Product register <span>{products.length}</span></button>
        {canImportInventory && <button className={`tab-btn ${activeTab === 'imports' ? 'active' : ''}`} onClick={() => setActiveTab('imports')}>Excel imports</button>}
      </div>

      {activeTab === 'products' && (
        <section className="incident-list-page product-register-page" aria-label="Product register">
          <div className="incident-command-bar product-command-bar">
            <div className="incident-search"><Search size={15} /><input placeholder="Search all product fields..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
            <span className="incident-list-count">{filteredProducts.length} of {products.length} records</span>
            <div className="incident-command-actions product-command-actions">
              <button className="compact-button secondary" onClick={() => setShowColumns((open) => !open)}><Settings2 size={15} /> Columns <ChevronDown size={14} /></button>
              {canImportInventory && <button className="compact-button primary" onClick={() => setActiveTab('imports')}><Upload size={15} /> Import Excel</button>}
            </div>
            {showColumns && <div className="column-picker product-column-picker"><div className="column-picker-head"><strong>Display columns</strong><button onClick={() => setShowColumns(false)}><X size={15} /></button></div>{productColumns.map(({ key, label }) => <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => toggleColumn(key)} /> {label}</label>)}</div>}
          </div>
          <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table product-register-table"><colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 104 }} /></colgroup><thead><tr>{activeColumns.map(({ key, label }) => <th key={key}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.productRecordId || `${product.product_serial_number}-${product.material_serial_number}-${product.part_number}`}>{activeColumns.map(({ key }) => <td key={key}>{key === 'product_serial_number' ? <button className="incident-number" onClick={() => setSelectedProduct(product)}>{product[key]}</button> : product[key] || <span className="table-empty">--</span>}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View product" onClick={() => setSelectedProduct(product)}><Eye size={15} /></button>{canManageInventory && <><button className="action-btn" title="Edit product" onClick={() => setEditingProduct(product)}><Edit2 size={15} /></button><button className="action-btn delete" title="Delete product" onClick={() => deleteProduct(product)}><Trash2 size={15} /></button></>}</div></td></tr>)}{!filteredProducts.length && <tr><td colSpan={Math.max(activeColumns.length + 1, 1)} className="empty-row">No products match the current search.</td></tr>}</tbody></table></div></div>
          <footer className="incident-pagination"><span>Showing {filteredProducts.length ? `${(Math.min(page, totalPages) - 1) * pageSize + 1}-${Math.min(Math.min(page, totalPages) * pageSize, filteredProducts.length)} of ${filteredProducts.length}` : '0'} record{filteredProducts.length === 1 ? '' : 's'}</span><div className="incident-page-controls"><button className="compact-button secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {Math.min(page, totalPages)} of {totalPages}</span><button className="compact-button secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></footer>
        </section>
      )}

      {activeTab === 'imports' && <ProductImportWorkbench importIdentity={importIdentity} setImportIdentity={setImportIdentity} routeCards={routeCards} configuration={configuration} reconciliation={reconciliation} importMessage={importMessage} routeCardInput={routeCardInput} configurationInput={configurationInput} onRouteCardFile={(event) => handleWorkbook(event, parseRouteCardWorkbook, setRouteCards, 'Route Card workbook')} onConfigurationFile={(event) => handleWorkbook(event, parseConfigurationWorkbook, setConfiguration, 'Configuration workbook')} onImport={replaceImportedProductRows} />}
    </>
  )
}

function ProductImportWorkbench({ importIdentity, setImportIdentity, routeCards, configuration, reconciliation, importMessage, routeCardInput, configurationInput, onRouteCardFile, onConfigurationFile, onImport }) {
  const updateIdentity = (key, value) => setImportIdentity((current) => ({ ...current, [key]: value }))
  const invalidCount = reconciliation ? reconciliation.invalidRouteRows.length + reconciliation.invalidConfigurationRows.length : 0
  const canImport = reconciliation && !invalidCount && importIdentity.productSerialNumber.trim() && importIdentity.productCategory.trim()

  return <section className="import-workspace product-import-workspace">
    <div className="import-step-card">
      <div className="import-step-heading"><span>1</span><div><h2>Product identity</h2><p>Every assembled component is assigned to this product before it is saved.</p></div></div>
      <div className="product-import-identity">
        <label><span>Product serial number</span><input value={importIdentity.productSerialNumber} onChange={(event) => updateIdentity('productSerialNumber', event.target.value)} /></label>
        <label><span>Product category</span><input value={importIdentity.productCategory} onChange={(event) => updateIdentity('productCategory', event.target.value)} /></label>
      </div>
    </div>

    <div className="product-import-sources">
      <div className="import-step-card">
        <div className="import-step-heading"><span>2</span><div><h2>Route Card workbook</h2><p>All route-card sheets are inspected for component rows.</p></div></div>
        <div className="import-file-row"><input ref={routeCardInput} type="file" accept=".xlsx,.xls" onChange={onRouteCardFile} hidden /><button className="compact-button primary" onClick={() => routeCardInput.current?.click()}><FileSpreadsheet size={16} /> Select Route Cards</button><span>{routeCards?.fileName || 'No file selected'}</span></div>
        {routeCards && <p className="import-source-summary">{routeCards.sheetNames.length} sheets, {routeCards.rows.length} valid component rows, {routeCards.invalidRows.length} invalid rows.</p>}
      </div>
      <div className="import-step-card">
        <div className="import-step-heading"><span>3</span><div><h2>Configuration workbook</h2><p>Part Numbers provide serial numbers and subsystem assignments.</p></div></div>
        <div className="import-file-row"><input ref={configurationInput} type="file" accept=".xlsx,.xls" onChange={onConfigurationFile} hidden /><button className="compact-button primary" onClick={() => configurationInput.current?.click()}><FileSpreadsheet size={16} /> Select Configuration</button><span>{configuration?.fileName || 'No file selected'}</span></div>
        {configuration && <p className="import-source-summary">{configuration.sheetNames.length} sheets, {configuration.rows.length} valid serial rows, {configuration.invalidRows.length} invalid rows.</p>}
      </div>
    </div>

    {reconciliation && <>
      <div className="import-step-card import-reconciliation-summary">
        <div className="import-step-heading"><span>4</span><div><h2>Reconciliation review</h2><p>Components are joined by normalized Part Number. One-to-many serial assignments are expanded into separate Product Master records.</p></div></div>
        <div className="import-summary-grid">
          <div><span>Assembled records</span><strong>{reconciliation.assembledRows.length}</strong></div>
          <div><span>Matched route rows</span><strong>{reconciliation.routeCards.rows.length - reconciliation.unmatchedRouteRows.length}</strong></div>
          <div className={reconciliation.unmatchedRouteRows.length ? 'warning' : ''}><span>Unmatched route rows</span><strong>{reconciliation.unmatchedRouteRows.length}</strong></div>
          <div className={reconciliation.duplicateConfigurationMatches.length ? 'warning' : ''}><span>Repeated part numbers</span><strong>{reconciliation.duplicateConfigurationMatches.length}</strong></div>
          <div className={invalidCount ? 'error' : ''}><span>Invalid source rows</span><strong>{invalidCount}</strong></div>
        </div>
        {reconciliation.unmatchedRouteRows.length > 0 && <p className="import-review-note">Unmatched Route Card components will be imported with a blank Material Serial No and remain visible for follow-up.</p>}
        {invalidCount > 0 && <p className="import-review-note error">Import is blocked until all source rows missing required values are corrected.</p>}
      </div>

      <div className="import-preview"><div className="panel-head"><div><h2>Assembled component preview</h2><p>Showing the first 15 of {reconciliation.assembledRows.length} records.</p></div></div><div className="enterprise-table-scroll"><table className="enterprise-table"><thead><tr><th>Route card</th><th>Part number</th><th>Material description</th><th>Serial number</th><th>Subsystem</th><th>Match</th></tr></thead><tbody>{reconciliation.assembledRows.slice(0, 15).map((row) => <tr key={row.productRecordId}><td>{row.route_card_description}</td><td>{row.part_number}</td><td>{row.material_description}</td><td>{row.material_serial_number || <span className="table-empty">--</span>}</td><td>{row.subsystems || <span className="table-empty">--</span>}</td><td><span className={`priority-label ${row.importSource.matchStatus === 'matched' ? 'normal' : 'critical'}`}>{row.importSource.matchStatus}</span></td></tr>)}</tbody></table></div></div>

      <div className="import-step-card import-commit-card">
        <div className="import-step-heading"><span>5</span><div><h2>Replace product components</h2><p>This replaces only existing rows for {importIdentity.productSerialNumber || 'the selected product serial'}; its lifecycle asset is not changed.</p></div></div>
        <div className="import-actions-row"><button className="compact-button primary" disabled={!canImport} onClick={onImport}><Upload size={15} /> Validate and replace {importIdentity.productSerialNumber || 'product'}</button></div>
      </div>
    </>}
    {importMessage && <div className={`import-message ${importMessage.includes('imported') ? 'success' : ''}`}><CheckCircle2 size={15} /> {importMessage}</div>}
  </section>
}

function ProductRecordView({ product, canManageInventory, onBack, onEdit }) {
  return <section className="product-record-page"><header className="group-config-header"><div><button className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product master</button><h1>{product.material_serial_number}</h1><p>{product.material_description || 'Product material record'}</p></div><div><button className="incident-cancel-button" onClick={onBack}>Close</button>{canManageInventory && <button className="incident-submit-button" onClick={onEdit}>Edit product</button>}</div></header><section className="product-record-sheet">{productColumns.map(({ key, label }) => <div key={key}><span>{label}</span><strong>{product[key] || '--'}</strong></div>)}</section>{(product.productJournal || []).length > 0 && <section className="product-journal"><h2>Product journal</h2><ol>{[...product.productJournal].reverse().map((entry) => <li key={entry.id}><strong>{entry.field}</strong><span><s>{entry.previous}</s> to <b>{entry.next}</b></span><small>{entry.incidentNumber} · {entry.updatedBy} · {new Date(entry.updatedAt).toLocaleString('en-GB')}</small></li>)}</ol></section>}</section>
}

function ProductRecordEditor({ product, onBack, onSave }) {
  const [form, setForm] = useState(product)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="product-record-page" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Product master</button><h1>Edit product record</h1><p>Update the product, material, and subsystem attributes.</p></div><div><button type="button" className="incident-cancel-button" onClick={onBack}>Cancel</button><button className="incident-submit-button" type="submit">Save changes</button></div></header><section className="product-record-sheet product-record-editor">{productColumns.map(({ key, label, required }) => <label key={key}><span>{label}{required && ' *'}</span><input value={form[key] || ''} onChange={(event) => update(key, event.target.value)} required={required} /></label>)}</section></form>
}
