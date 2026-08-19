import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, PackagePlus, RefreshCw, Search, Wrench, XCircle } from 'lucide-react'
import { componentLifecycleApi } from '../data/api'

const emptyReceipt = { serial_number: '', component_type: '', subsystem: '', part_number: '', sap_part_number: '', purchase_order_number: '', supplier: '', customer: '', contract_number: '', notes: '' }
const statusLabel = (value) => String(value || '').replaceAll('_', ' ')

export default function ComponentLifecyclePage({ currentUser, canManageInventory = false, initialTab = 'components', repairOnly = false, onOpenIncident }) {
  const [tab, setTab] = useState(initialTab)
  const [components, setComponents] = useState([])
  const [repairs, setRepairs] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [receipt, setReceipt] = useState(emptyReceipt)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const actor = currentUser.name || currentUser.email

  const refresh = async () => {
    setLoading(true)
    try {
      const [nextComponents, nextRepairs] = await Promise.all([componentLifecycleApi.listComponents(), componentLifecycleApi.listRepairs()])
      setComponents(nextComponents)
      setRepairs(nextRepairs)
      if (selected) setSelected(await componentLifecycleApi.getComponent(selected.component.serial_number))
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])
  const available = components.filter((component) => component.lifecycle_status === 'mrls_available')
  const visible = (tab === 'mrls' ? available : components).filter((component) => !search || Object.values(component).some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))
  const byType = useMemo(() => available.reduce((result, component) => ({ ...result, [component.component_type]: (result[component.component_type] || 0) + 1 }), {}), [available])
  const openDetail = async (component) => {
    try { setSelected(await componentLifecycleApi.getComponent(component.serial_number)) } catch (requestError) { setError(requestError.message) }
  }
  const quality = async (serialNumber, accepted) => {
    try {
      await componentLifecycleApi.decideQuality(serialNumber, { performed_by: actor, accepted })
      setNotice(`${serialNumber} ${accepted ? 'accepted into MRLS' : 'rejected from quality inspection'}.`)
      await refresh()
    } catch (requestError) { setError(requestError.message) }
  }
  const progressRepair = async (repairId, action) => {
    try {
      await componentLifecycleApi.updateRepair(repairId, action, { performed_by: actor, notes: action === 'start' ? 'Repair work started.' : action === 'complete' ? 'Repair completed and submitted for quality acceptance.' : 'Classified beyond repair and scrapped.' })
      setNotice(`Repair ${action} recorded.`)
      await refresh()
    } catch (requestError) { setError(requestError.message) }
  }
  const submitReceipt = async (event) => {
    event.preventDefault()
    try {
      await componentLifecycleApi.receiveComponent({ ...receipt, received_by: actor })
      setReceipt(emptyReceipt)
      setNotice('Serialized component received and placed in quality inspection.')
      setTab('components')
      await refresh()
    } catch (requestError) { setError(requestError.message) }
  }

  const displayedRepairs = repairOnly ? repairs.filter((repair) => repair.repair_status === 'sent_for_repair') : repairs
  return <section className="incident-list-page product-register-page">
    <header className="incident-list-head product-master-heading"><div className="incident-list-title"><h1>{repairOnly ? 'Components Sent for Repair' : 'Serialized Component Lifecycle'}</h1><p>{repairOnly ? 'Repair incidents generated from approved component replacements.' : 'Current UAV configuration, MRLS availability, repairs, procurement, and traceability.'}</p></div><button className="compact-button secondary" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh</button></header>
    {!repairOnly && <div className="tab-bar product-master-tabs" role="tablist">{[['components', 'Component master'], ['mrls', 'MRLS available'], ['repairs', 'Repair management'], ['receive', 'Receive component']].map(([key, label]) => <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}{key === 'mrls' && <span>{available.length}</span>}{key === 'repairs' && <span>{repairs.length}</span>}</button>)}</div>}
    {(notice || error) && <div className={error ? 'report-notice error' : 'report-notice'}>{error || notice}<button onClick={() => { setError(''); setNotice('') }} aria-label="Dismiss">x</button></div>}
    {loading ? <div className="empty-row">Loading component lifecycle...</div> : <>
      {(tab === 'components' || tab === 'mrls') && <><div className="incident-command-bar product-command-bar"><div className="incident-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial, component, customer, contract, status, or location..." /></div><span className="incident-list-count">{visible.length} serialized component{visible.length === 1 ? '' : 's'}</span></div>{tab === 'mrls' && <div className="import-summary-grid">{Object.entries(byType).map(([type, count]) => <div key={type}><span>{type}</span><strong>{count}</strong></div>)}{!available.length && <div><span>Available components</span><strong>0</strong></div>}</div>}<div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table product-register-table"><thead><tr><th>Serial number</th><th>Component type</th><th>Customer</th><th>Contract</th><th>Lifecycle status</th><th>Location</th><th>Action</th></tr></thead><tbody>{visible.map((component) => <tr key={component.serial_number}><td><button className="incident-number" onClick={() => void openDetail(component)}>{component.serial_number}</button></td><td>{component.component_type}</td><td>{component.customer || '--'}</td><td>{component.contract_number || '--'}</td><td><span className="status-badge">{statusLabel(component.lifecycle_status)}</span></td><td>{component.location_reference || component.location_type}</td><td>{component.lifecycle_status === 'quality_check' && canManageInventory ? <div className="row-actions"><button className="action-btn" title="Accept quality" onClick={() => void quality(component.serial_number, true)}><CheckCircle2 size={15} /></button><button className="action-btn delete" title="Reject quality" onClick={() => void quality(component.serial_number, false)}><XCircle size={15} /></button></div> : '--'}</td></tr>)}{!visible.length && <tr><td colSpan="7" className="empty-row">No matching serialized components.</td></tr>}</tbody></table></div></div></>}
      {(tab === 'repairs' || repairOnly) && <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><thead><tr><th>Component</th><th>Original incident</th><th>Repair incident</th><th>Failure</th><th>Status</th><th>Action</th></tr></thead><tbody>{displayedRepairs.map((repair) => <tr key={repair.repair_id}><td><button className="incident-number" onClick={() => void openDetail(repair.component)}>{repair.component.serial_number}</button><br />{repair.component.component_type}</td><td>{repair.original_incident_id ? <button className="incident-number" onClick={() => onOpenIncident?.(repair.original_incident_id)}>{repair.original_incident_id}</button> : '--'}</td><td>{repair.incident_record_id}</td><td>{repair.failure_description}</td><td><span className="status-badge">{statusLabel(repair.repair_status)}</span></td><td>{repairOnly ? <button className="compact-button primary" onClick={() => onOpenIncident?.(repair.incident_record_id)}>Open repair incident</button> : canManageInventory && <div className="row-actions">{repair.repair_status === 'sent_for_repair' && <button className="compact-button secondary" onClick={() => void progressRepair(repair.repair_id, 'start')}><Wrench size={14} /> Start</button>}{repair.repair_status === 'under_repair' && <><button className="compact-button primary" onClick={() => void progressRepair(repair.repair_id, 'complete')}><CheckCircle2 size={14} /> Complete</button><button className="compact-button secondary" onClick={() => void progressRepair(repair.repair_id, 'scrap')}>Scrap</button></>}</div>}</td></tr>)}{!displayedRepairs.length && <tr><td colSpan="6" className="empty-row">No components are currently sent for repair.</td></tr>}</tbody></table></div></div>}
      {tab === 'receive' && <form className="incident-form-sheet" onSubmit={submitReceipt}><section className="incident-form-section"><h2><span><PackagePlus size={16} /> Receive serialized component</span></h2><div className="incident-form-grid">{[['serial_number', 'Serial number', true], ['component_type', 'Component type', true], ['subsystem', 'Subsystem'], ['part_number', 'Part number'], ['sap_part_number', 'SAP part number'], ['purchase_order_number', 'Purchase order'], ['supplier', 'Supplier'], ['customer', 'Allocated customer', true], ['contract_number', 'Allocated contract', true]].map(([key, label, required]) => <label className="incident-field" key={key}><span>{required && <em>*</em>}{label}</span><input required={required} value={receipt[key]} onChange={(event) => setReceipt((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="incident-field"><span>Receipt notes</span><textarea value={receipt.notes} onChange={(event) => setReceipt((current) => ({ ...current, notes: event.target.value }))} rows="3" /></label></div></section><button className="compact-button primary" type="submit"><PackagePlus size={15} /> Receive for quality inspection</button></form>}
      {selected && <ComponentDetail detail={selected} onClose={() => setSelected(null)} />}
    </>}
  </section>
}

function ComponentDetail({ detail, onClose }) {
  const { component, movements, installations, repairs } = detail
  return <div className="report-dialog-backdrop"><section className="dashboard-picker" role="dialog" aria-modal="true" aria-label="Component traceability"><header><div><h2>{component.serial_number}</h2><p>{component.component_type} · {statusLabel(component.lifecycle_status)} · {component.location_reference || component.location_type}</p></div><button className="icon-button subtle" onClick={onClose} aria-label="Close">x</button></header><div className="dashboard-picker-list"><strong>Installation history</strong>{installations.map((item) => <div key={`${item.uav_serial_number}-${item.installed_at}`}><strong>{item.uav_serial_number} · {item.component_position}</strong><small>{String(item.installed_at)} {item.removed_at ? `to ${String(item.removed_at)}` : '· Currently installed'}</small></div>)}<strong>Movement history</strong>{movements.map((item, index) => <div key={`${item.moved_at}-${index}`}><strong>{statusLabel(item.to_status)} · {item.to_location || item.to_location_type}</strong><small>{item.reason} · {String(item.moved_at)}</small></div>)}<strong>Repair history</strong>{repairs.map((item) => <div key={item.id}><strong>{statusLabel(item.repair_status)}</strong><small>{item.failure_description}</small></div>)}{!movements.length && <div className="dashboard-picker-empty">No lifecycle history has been recorded.</div>}</div></section></div>
}
