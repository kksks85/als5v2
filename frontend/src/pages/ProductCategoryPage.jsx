import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Edit2, Eye, PackageCheck, Plus, Search, ShieldCheck, Trash2, Wrench, X } from 'lucide-react'
import { productCategoryMatches } from '../data/productCategoryRegistry'
import { componentLifecycleApi } from '../data/api'
import LifecycleAudit from './LifecycleAudit'

const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'
const durationToMinutes = (value) => {
  if (typeof value === 'number') return value
  const formattedValue = String(value || '').trim()
  const durationMatch = formattedValue.match(/^(\d+):([0-5]\d)$/)
  if (durationMatch) return Number(durationMatch[1]) * 60 + Number(durationMatch[2])
  const numericValue = Number(formattedValue)
  return Number.isFinite(numericValue) ? numericValue : 0
}
const formatDuration = (value) => {
  const totalMinutes = Math.max(0, durationToMinutes(value))
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}
const componentColumns = [
  ['product_serial_number', 'Product serial number'], ['product_category', 'Product category'], ['route_card_description', 'Route card description'], ['part_number', 'Part number'], ['sap_part_number', 'SAP part number'], ['material_description', 'Material description'], ['batch_or_po_number', 'Batch no / PO no'], ['material_serial_number', 'Material serial no'], ['weight_in_grams', 'Weight in grams'], ['required_quantity', 'Required quantity'], ['unit_of_measurement', 'Unit of measurement'], ['subsystems', 'Subsystem'],
]

export default function ProductCategoryPage({ category, assets, products, contracts, currentUser, canManageInventory = false, selectedCustomer, onUpdateAsset, onDeleteAsset, initialSerialNumbers = [] }) {
  const [search, setSearch] = useState('')
  const [editingAsset, setEditingAsset] = useState(null)
  const [viewingAsset, setViewingAsset] = useState(null)
  const drilledSerialNumbers = useMemo(() => new Set(initialSerialNumbers), [initialSerialNumbers])
  const categoryAssets = useMemo(() => assets
    .filter((asset) => asset.category === category && (selectedCustomer === 'All customers' || !asset.customer || asset.customer === selectedCustomer) && (!drilledSerialNumbers.size || drilledSerialNumbers.has(asset.serialNumber)) && (!search || [asset.serialNumber, asset.contractNumber, asset.customer, asset.warranty].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))))
    .sort((left, right) => String(left.serialNumber || '').localeCompare(String(right.serialNumber || ''), undefined, { numeric: true })), [assets, category, drilledSerialNumbers, search, selectedCustomer])
  const assignedCount = categoryAssets.filter((asset) => asset.contractNumber).length
  const coveredCount = categoryAssets.filter((asset) => asset.warranty && !asset.warranty.toLowerCase().includes('expired')).length

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const data = [['Serial Number', 'Contract', 'Customer', 'Delivered On', 'Warranty', 'Warranty Expiry', 'Last Serviced'].map(csv), ...categoryAssets.map((a) => [a.serialNumber, a.contractNumber || '', a.customer || '', a.deliveredOn || '', a.warranty || '', a.warrantyExpiry || '', a.lastServiced || ''].map(csv))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `${category.toLowerCase().replaceAll(' ', '-')}-assets.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return <section className="product-category-page">
    <header className="product-category-header">
      <div><p>Product category registry</p><h1>{category}</h1><span>One lifecycle record per unique Product Master serial number.</span></div>
      <div className="product-category-metrics"><article><PackageCheck size={17} /><span><strong>{categoryAssets.length}</strong> units</span></article><article><ShieldCheck size={17} /><span><strong>{assignedCount}</strong> contract assigned</span></article><article><Wrench size={17} /><span><strong>{coveredCount}</strong> covered</span></article></div>
    </header>
    <div className="product-category-toolbar"><label><Search size={15} /><input aria-label={`Search ${category} assets`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial, contract, customer, or warranty" /></label><button className="compact-button secondary" onClick={exportCsv} disabled={!categoryAssets.length}><Download size={15} /> Extract data</button><span>{selectedCustomer === 'All customers' ? 'All customers' : selectedCustomer} · {categoryAssets.length} records</span></div>
    <div className="product-category-table"><table><thead><tr><th>Unit serial number</th><th>Delivered under contract</th><th>Customer</th><th>Delivered on</th><th>Warranty / coverage</th><th>Warranty expiry</th><th>Last serviced</th><th>Action</th></tr></thead><tbody>{categoryAssets.map((asset) => <tr key={asset.id}><td><strong>{asset.serialNumber}</strong></td><td>{asset.contractNumber || <span className="table-empty">Unassigned</span>}</td><td>{asset.customer || <span className="table-empty">--</span>}</td><td>{formatDate(asset.deliveredOn)}</td><td><span className={`asset-coverage ${asset.warranty ? '' : 'unassigned'}`}>{asset.warranty || 'Not recorded'}</span></td><td>{formatDate(asset.warrantyExpiry)}</td><td>{formatDate(asset.lastServiced)}</td><td><button className="action-btn" title={`View ${asset.serialNumber}`} onClick={() => setViewingAsset(asset)}><Eye size={15} /></button>{canManageInventory && <><button className="action-btn" title={`Edit ${asset.serialNumber}`} onClick={() => setEditingAsset(asset)}><Edit2 size={15} /></button><button className="action-btn" title={`Delete ${asset.serialNumber}`} onClick={() => { if (confirm(`Delete unit ${asset.serialNumber}?`)) onDeleteAsset(asset.id) }}><Trash2 size={15} /></button></>}</td></tr>)}{!categoryAssets.length && <tr><td colSpan="8" className="empty-row">No serial-number records match this category and customer context.</td></tr>}</tbody></table></div>
    {editingAsset && <AssetForm asset={editingAsset} contracts={contracts} currentUser={currentUser} onClose={() => setEditingAsset(null)} onSave={(asset) => { onUpdateAsset(asset); setEditingAsset(null) }} />}
    {viewingAsset && <AssetDetail asset={viewingAsset} products={products} canManageInventory={canManageInventory} onClose={() => setViewingAsset(null)} onEdit={() => { setViewingAsset(null); setEditingAsset(viewingAsset) }} />}
  </section>
}

function AssetForm({ asset, contracts, currentUser, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...asset,
    preDeliveryFlights: Array.isArray(asset.preDeliveryFlights) ? asset.preDeliveryFlights.map((flight) => ({ ...flight, duration: formatDuration(flight.duration ?? flight.durationMinutes), isNew: false })) : asset.preDeliveryFlight ? [{
      dateOfFlight: asset.preDeliveryFlight.flightDate || '',
      durationMinutes: asset.preDeliveryFlight.durationMinutes || 0,
      duration: formatDuration(asset.preDeliveryFlight.durationMinutes),
      isNew: false,
      divesAndRecoveries: asset.preDeliveryFlight.divesAndRecoveries || 0,
      observationsIssues: asset.preDeliveryFlight.observations || '',
      remarksCorrectiveAction: asset.preDeliveryFlight.result || '',
    }] : [],
  }))
  const [activeTab, setActiveTab] = useState('overview')
  const canManageFlightRecords = ['Administrator', 'CSM', 'Customer Support Manager'].includes(currentUser?.role)
  const hasPreDeliveryFlightData = productCategoryMatches(asset.category, 'Loitering Munition')
  const eligibleContracts = contracts.filter((contract) => (contract.deliverables || []).some((deliverable) => productCategoryMatches(deliverable.product, asset.category)))
  const selectContract = (contractNumber) => {
    const contract = contracts.find((candidate) => candidate.number === contractNumber)
    setForm((current) => ({ ...current, contractNumber, customer: contract?.customer || '', warranty: contract?.warranty || '', warrantyExpiry: contract?.expiryDate || '', deliveredOn: contract?.jriDate || '' }))
  }
  const updateFlight = (index, field, value) => setForm((current) => ({ ...current, preDeliveryFlights: current.preDeliveryFlights.map((flight, flightIndex) => flightIndex === index ? { ...flight, [field]: value } : flight) }))
  const addFlight = () => setForm((current) => ({ ...current, preDeliveryFlights: [...current.preDeliveryFlights, { dateOfFlight: '', duration: '00:00', durationMinutes: 0, divesAndRecoveries: 0, observationsIssues: '', remarksCorrectiveAction: '', isNew: true }] }))
  const removeFlight = (index) => setForm((current) => ({ ...current, preDeliveryFlights: current.preDeliveryFlights.filter((_, flightIndex) => flightIndex !== index) }))
  const submitForm = (event) => {
    event.preventDefault()
    onSave({ ...form, preDeliveryFlights: form.preDeliveryFlights.map(({ duration, isNew, ...flight }) => ({ ...flight, durationMinutes: durationToMinutes(duration) })) })
  }

  if (hasPreDeliveryFlightData && activeTab === 'flight-data') return <div className="report-dialog-backdrop"><form className="asset-record-form asset-flight-record-form" onSubmit={submitForm}>
    <header><div><p>Product lifecycle</p><h2>{asset.serialNumber}</h2><span>{asset.category} · Edit mode</span></div><button type="button" onClick={onClose} aria-label="Close asset form"><X size={17} /></button></header>
    <div className="asset-detail-tabs asset-edit-tabs" role="tablist" aria-label={`${asset.serialNumber} edit views`}><button type="button" role="tab" aria-selected={false} onClick={() => setActiveTab('overview')}>Overview</button><button type="button" className="active" role="tab" aria-selected={true}>Flight Data</button></div>
    <FlightDataEditor flights={form.preDeliveryFlights} canManageFlightRecords={canManageFlightRecords} onAdd={addFlight} onRemove={removeFlight} onUpdate={updateFlight} />
    <footer><button type="button" className="compact-button secondary" onClick={onClose}>Cancel</button><button className="compact-button primary" type="submit">Save unit record</button></footer>
  </form></div>
  return <div className="report-dialog-backdrop"><form className="asset-record-form" onSubmit={submitForm}>
    <header><div><p>Product lifecycle</p><h2>{asset.serialNumber}</h2><span>{asset.category} · Edit mode</span></div><button type="button" onClick={onClose} aria-label="Close asset form"><X size={17} /></button></header>
    <div className="asset-detail-tabs asset-edit-tabs" role="tablist" aria-label={`${asset.serialNumber} edit views`}><button type="button" className="active" role="tab" aria-selected={true}>Overview</button>{hasPreDeliveryFlightData && <button type="button" role="tab" aria-selected={false} onClick={() => setActiveTab('flight-data')}>Flight Data</button>}</div>
    <div className="asset-edit-sections"><section className="asset-compact-section"><h3>Product</h3><div className="asset-form-grid"><label><span>Serial number</span><input value={asset.serialNumber} readOnly /></label><label><span>Category</span><input value={asset.category} readOnly /></label></div></section><section className="asset-compact-section"><h3>Delivery</h3><div className="asset-form-grid"><label><span>Contract</span><select value={form.contractNumber} onChange={(event) => selectContract(event.target.value)}><option value="">Unassigned</option>{eligibleContracts.map((contract) => <option key={contract.number} value={contract.number}>{contract.number} · {contract.customer}</option>)}</select></label><label><span>Customer</span><input value={form.customer} readOnly placeholder="Derived from contract" /></label><label><span>Delivered on</span><input type="date" value={form.deliveredOn || ''} onChange={(event) => setForm((current) => ({ ...current, deliveredOn: event.target.value }))} /></label></div></section><section className="asset-compact-section"><h3>Coverage & service</h3><div className="asset-form-grid"><label><span>Coverage</span><input value={form.warranty} readOnly placeholder="Derived from contract" /></label><label><span>Coverage expiry</span><input type="date" value={form.warrantyExpiry || ''} readOnly /></label><label><span>Last serviced</span><input type="date" value={form.lastServiced || ''} onChange={(event) => setForm((current) => ({ ...current, lastServiced: event.target.value }))} /></label></div></section></div>
    <footer><button type="button" className="compact-button secondary" onClick={onClose}>Cancel</button><button className="compact-button primary" type="submit">Save unit record</button></footer>
  </form></div>
}

function FlightDataEditor({ flights, canManageFlightRecords, onAdd, onRemove, onUpdate }) {
  return <section className="flight-data-editor"><header><div><p>Pre delivery flight data</p><h3>Flight records</h3></div>{canManageFlightRecords && <button type="button" className="compact-button primary" onClick={onAdd}><Plus size={15} /> Add flight</button>}</header><div className="flight-data-editor-table"><table><thead><tr><th>Date</th><th>Duration (HH:MM)</th><th>Dives / recovery</th><th>Observations / issues</th><th>Corrective action</th>{canManageFlightRecords && <th>Actions</th>}</tr></thead><tbody>{flights.map((flight, index) => <tr key={`${flight.dateOfFlight}-${index}`}><td><input type="date" aria-label={`Flight ${index + 1} date`} value={flight.dateOfFlight || ''} disabled={!flight.isNew} onChange={(event) => onUpdate(index, 'dateOfFlight', event.target.value)} /></td><td><input type="text" inputMode="numeric" pattern="[0-9]{1,3}:[0-5][0-9]" title="Use HH:MM, for example 01:30" aria-label={`Flight ${index + 1} duration (HH:MM)`} value={flight.duration ?? formatDuration(flight.durationMinutes)} disabled={!flight.isNew} onChange={(event) => onUpdate(index, 'duration', event.target.value)} onBlur={(event) => onUpdate(index, 'duration', formatDuration(event.target.value))} /></td><td><input type="number" min="0" aria-label={`Flight ${index + 1} dives and recovery`} value={flight.divesAndRecoveries || 0} disabled={!flight.isNew} onChange={(event) => onUpdate(index, 'divesAndRecoveries', Number(event.target.value))} /></td><td><textarea aria-label={`Flight ${index + 1} observations`} value={flight.observationsIssues || ''} disabled={!flight.isNew} onChange={(event) => onUpdate(index, 'observationsIssues', event.target.value)} rows="2" /></td><td><textarea aria-label={`Flight ${index + 1} corrective action`} value={flight.remarksCorrectiveAction || ''} disabled={!flight.isNew} onChange={(event) => onUpdate(index, 'remarksCorrectiveAction', event.target.value)} rows="2" /></td>{canManageFlightRecords && <td><button type="button" className="icon-button danger" title="Remove flight" aria-label={`Remove flight ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={14} /></button></td>}</tr>)}{!flights.length && <tr><td colSpan={canManageFlightRecords ? 6 : 5} className="empty-row">No flight records added.</td></tr>}</tbody></table></div></section>
}

function AssetDetail({ asset, products, canManageInventory, onClose, onEdit }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [routeCard, setRouteCard] = useState('')
  const [subsystem, setSubsystem] = useState('')
  const [expandedRouteCards, setExpandedRouteCards] = useState({})
  const [expandedSubsystems, setExpandedSubsystems] = useState({})
  const [lifecycleDetail, setLifecycleDetail] = useState(null)
  const hasPreDeliveryFlightData = productCategoryMatches(asset.category, 'Loitering Munition')
  const productComponents = useMemo(() => products.filter((product) => asset.category === 'MRLS'
    ? product.material_serial_number === asset.serialNumber
    : product.product_serial_number === asset.serialNumber), [asset.category, asset.serialNumber, products])
  const componentSerialNumber = asset.category === 'MRLS' ? productComponents[0]?.material_serial_number || asset.serialNumber : asset.serialNumber
  useEffect(() => {
    if (asset.category !== 'MRLS' || !componentSerialNumber) return
    componentLifecycleApi.getComponent(componentSerialNumber).then(setLifecycleDetail).catch(() => setLifecycleDetail(null))
  }, [asset.category, componentSerialNumber])
  const routeCards = useMemo(() => [...new Set(productComponents.map((component) => component.route_card_description).filter(Boolean))].sort(), [productComponents])
  const subsystems = useMemo(() => [...new Set(productComponents.map((component) => component.subsystems).filter(Boolean))].sort(), [productComponents])
  const filteredComponents = useMemo(() => productComponents.filter((component) => (!routeCard || component.route_card_description === routeCard) && (!subsystem || component.subsystems === subsystem)), [productComponents, routeCard, subsystem])
  const groupedComponents = useMemo(() => filteredComponents.reduce((groups, component) => {
    const routeCardName = component.route_card_description || 'Unassigned route card'
    const subsystemName = component.subsystems || 'Unassigned subsystem'
    groups[routeCardName] ??= {}
    groups[routeCardName][subsystemName] ??= []
    groups[routeCardName][subsystemName].push(component)
    return groups
  }, {}), [filteredComponents])
  const toggleRouteCard = (name) => setExpandedRouteCards((current) => ({ ...current, [name]: !current[name] }))
  const toggleSubsystem = (key) => setExpandedSubsystems((current) => ({ ...current, [key]: !current[key] }))
  const preDeliveryFlight = asset.preDeliveryFlight
  const preDeliveryFlights = Array.isArray(asset.preDeliveryFlights)
    ? asset.preDeliveryFlights
    : preDeliveryFlight ? [{
        dateOfFlight: preDeliveryFlight.flightDate,
        durationMinutes: preDeliveryFlight.durationMinutes,
        divesAndRecoveries: preDeliveryFlight.divesAndRecoveries || 0,
        observationsIssues: preDeliveryFlight.observations,
        remarksCorrectiveAction: preDeliveryFlight.result,
      }]
      : []

  if (hasPreDeliveryFlightData && activeTab === 'pre-delivery-flight') return <div className="report-dialog-backdrop asset-detail-backdrop"><section className="asset-detail-dialog" role="dialog" aria-modal="true" aria-label={`${asset.serialNumber} product record`}>
    <header className="asset-detail-dialog-header"><div><p>Product record</p><h2>{asset.serialNumber}</h2><span>{asset.category} · Read-only view</span></div><div className="asset-detail-dialog-actions">{canManageInventory && <button className="compact-button secondary" onClick={onEdit}><Edit2 size={15} /> Edit lifecycle</button>}<button type="button" className="asset-detail-close" onClick={onClose} aria-label="Close product record"><X size={17} /></button></div></header>
    <div className="asset-detail-tabs" role="tablist" aria-label={`${asset.serialNumber} record views`}><button role="tab" aria-selected={false} onClick={() => setActiveTab('overview')}>Overview</button><button role="tab" aria-selected={false} onClick={() => setActiveTab('components')}>Components <span>{productComponents.length}</span></button><button className="active" role="tab" aria-selected={true}>Pre Delivery Flight Data</button></div>
    <PreDeliveryFlightData flights={preDeliveryFlights} serialNumber={asset.serialNumber} />
  </section></div>

  return <div className="report-dialog-backdrop asset-detail-backdrop"><section className="asset-detail-dialog" role="dialog" aria-modal="true" aria-label={`${asset.serialNumber} product record`}>
    <header className="asset-detail-dialog-header"><div><p>Product record</p><h2>{componentSerialNumber}</h2><span>{asset.category} · Read-only view</span></div><div className="asset-detail-dialog-actions">{canManageInventory && <button className="compact-button secondary" onClick={onEdit}><Edit2 size={15} /> Edit lifecycle</button>}<button type="button" className="asset-detail-close" onClick={onClose} aria-label="Close product record"><X size={17} /></button></div></header>
    <div className="asset-detail-tabs" role="tablist" aria-label={`${componentSerialNumber} record views`}><button className={activeTab === 'overview' ? 'active' : ''} role="tab" aria-selected={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</button><button className={activeTab === 'components' ? 'active' : ''} role="tab" aria-selected={activeTab === 'components'} onClick={() => setActiveTab('components')}>Components <span>{productComponents.length}</span></button>{asset.category === 'MRLS' && <button className={activeTab === 'lifecycle' ? 'active' : ''} role="tab" aria-selected={activeTab === 'lifecycle'} onClick={() => setActiveTab('lifecycle')}>Lifecycle audit</button>}{hasPreDeliveryFlightData && <button className={activeTab === 'pre-delivery-flight' ? 'active' : ''} role="tab" aria-selected={activeTab === 'pre-delivery-flight'} onClick={() => setActiveTab('pre-delivery-flight')}>Pre Delivery Flight Data</button>}</div>
    <div className="asset-detail-dialog-body">{activeTab === 'lifecycle' ? <LifecycleAudit detail={lifecycleDetail} /> : activeTab === 'overview' ? <section className="asset-detail-overview"><div className="asset-view-sections"><section className="asset-compact-section"><h3>Product</h3><div className="detail-field"><span className="detail-label">Serial number</span><span className="detail-value">{asset.serialNumber}</span></div><div className="detail-field"><span className="detail-label">Category</span><span className="detail-value">{asset.category}</span></div></section><section className="asset-compact-section"><h3>Delivery</h3><div className="detail-field"><span className="detail-label">Contract</span><span className="detail-value">{asset.contractNumber || '--'}</span></div><div className="detail-field"><span className="detail-label">Customer</span><span className="detail-value">{asset.customer || '--'}</span></div><div className="detail-field"><span className="detail-label">Delivered on</span><span className="detail-value">{formatDate(asset.deliveredOn)}</span></div></section><section className="asset-compact-section"><h3>Coverage & service</h3><div className="detail-field"><span className="detail-label">Coverage</span><span className={`detail-value ${asset.warranty?.toLowerCase().includes('expired') ? 'is-expired' : ''}`}>{asset.warranty || 'Not recorded'}</span></div><div className="detail-field"><span className="detail-label">Coverage expiry</span><span className="detail-value">{formatDate(asset.warrantyExpiry)}</span></div><div className="detail-field"><span className="detail-label">Last serviced</span><span className="detail-value">{formatDate(asset.lastServiced)}</span></div></section></div></section> : activeTab === 'pre-delivery-flight' ? <section className="asset-detail-overview" aria-label={`${asset.serialNumber} pre delivery flight data`}>{preDeliveryFlight ? <div className="asset-view-sections"><section className="asset-compact-section"><h3>Flight record</h3><div className="detail-field"><span className="detail-label">Flight reference</span><span className="detail-value">{preDeliveryFlight.flightReference}</span></div><div className="detail-field"><span className="detail-label">Flight date</span><span className="detail-value">{formatDate(preDeliveryFlight.flightDate)}</span></div><div className="detail-field"><span className="detail-label">Result</span><span className="detail-value">{preDeliveryFlight.result}</span></div></section><section className="asset-compact-section"><h3>Flight execution</h3><div className="detail-field"><span className="detail-label">Location</span><span className="detail-value">{preDeliveryFlight.location}</span></div><div className="detail-field"><span className="detail-label">Test pilot</span><span className="detail-value">{preDeliveryFlight.testPilot}</span></div><div className="detail-field"><span className="detail-label">Duration</span><span className="detail-value">{preDeliveryFlight.durationMinutes} minutes</span></div></section><section className="asset-compact-section"><h3>Observations</h3><div className="detail-field"><span className="detail-value">{preDeliveryFlight.observations}</span></div></section></div> : <div className="component-empty-state">No pre-delivery flight data has been recorded for this product.</div>}</section> : <section className="asset-components" aria-label={`${asset.serialNumber} components`}>
      <div className="asset-component-filters"><label>Route Card<select value={routeCard} onChange={(event) => setRouteCard(event.target.value)}><option value="">All Route Cards</option>{routeCards.map((option) => <option key={option}>{option}</option>)}</select></label><label>Subsystem<select value={subsystem} onChange={(event) => setSubsystem(event.target.value)}><option value="">All Subsystems</option>{subsystems.map((option) => <option key={option}>{option}</option>)}</select></label><strong>{filteredComponents.length} of {productComponents.length} components</strong></div>
      <div className="asset-component-groups">{Object.entries(groupedComponents).map(([routeCardName, subsystemGroups]) => {
        const routeCardExpanded = expandedRouteCards[routeCardName] !== false
        return <section className="component-route-card" key={routeCardName}><button className="component-group-toggle route-card" onClick={() => toggleRouteCard(routeCardName)} aria-expanded={routeCardExpanded}>{routeCardExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span>Route Card: {routeCardName}</span><b>{Object.values(subsystemGroups).flat().length}</b></button>{routeCardExpanded && Object.entries(subsystemGroups).map(([subsystemName, components]) => {
          const subsystemKey = `${routeCardName}::${subsystemName}`
          const subsystemExpanded = expandedSubsystems[subsystemKey] !== false
          return <section className="component-subsystem" key={subsystemKey}><button className="component-group-toggle subsystem" onClick={() => toggleSubsystem(subsystemKey)} aria-expanded={subsystemExpanded}>{subsystemExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span>{subsystemName}</span><b>{components.length}</b></button>{subsystemExpanded && <div className="component-record-table"><table><thead><tr>{componentColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{components.map((component) => <tr key={component.material_serial_number}>{componentColumns.map(([key]) => <td key={key}>{component[key] || '--'}</td>)}</tr>)}</tbody></table></div>}</section>
        })}</section>
      })}</div>
      {!filteredComponents.length && <div className="component-empty-state">No components match the selected Route Card and Subsystem filters.</div>}
    </section>}</div>
  </section></div>
}

function PreDeliveryFlightData({ flights, serialNumber }) {
  const totals = flights.reduce((summary, flight) => ({
    durationMinutes: summary.durationMinutes + Number(flight.durationMinutes || 0),
    divesAndRecoveries: summary.divesAndRecoveries + Number(flight.divesAndRecoveries || 0),
  }), { durationMinutes: 0, divesAndRecoveries: 0 })

  return <section className="pre-delivery-flight-data" aria-label={`${serialNumber} pre delivery flight data`}>
    <header className="pre-delivery-flight-summary"><article><span>Number of flights</span><strong>{flights.length}</strong></article><article><span>Total flight duration</span><strong>{formatDuration(totals.durationMinutes)}</strong></article><article><span>Total dives and recovery</span><strong>{totals.divesAndRecoveries}</strong></article></header>
    {flights.length ? <div className="pre-delivery-flight-table"><table><thead><tr><th>Date of flight</th><th>Flight duration</th><th>Number of dives and recovery</th><th>Observations / issues</th><th>Remarks / corrective action</th></tr></thead><tbody>{flights.map((flight, index) => <tr key={`${flight.dateOfFlight}-${index}`}><td>{formatDate(flight.dateOfFlight)}</td><td>{formatDuration(flight.duration ?? flight.durationMinutes)}</td><td className="numeric">{Number(flight.divesAndRecoveries || 0)}</td><td>{flight.observationsIssues || '--'}</td><td>{flight.remarksCorrectiveAction || '--'}</td></tr>)}</tbody></table></div> : <div className="component-empty-state">No pre-delivery flight data has been recorded for this product.</div>}
  </section>
}