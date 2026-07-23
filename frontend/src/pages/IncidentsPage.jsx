import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Camera, ChevronDown, ClipboardPlus, Download, Edit2, Eye, FileUp, Filter, History, Paperclip, Plus, Search, Star, Trash2, UserRound, Wrench, X } from 'lucide-react'
import { getProcessStages } from '../data/processConfiguration'
import { recordApi } from '../data/api'

const pageSize = 8
const columns = [
  { key: 'id', label: 'Number', width: 300, minWidth: 220 },
  { key: 'opened', label: 'Opened', width: 210, minWidth: 160 },
  { key: 'title', label: 'Short description', width: 380, minWidth: 220 },
  { key: 'priority', label: 'Priority', width: 150, minWidth: 110 },
  { key: 'state', label: 'State', width: 140, minWidth: 100 },
  { key: 'stage', label: 'Stage', width: 140, minWidth: 100 },
]

const emptyForm = { repairExecution: '', status: '', customer: '', customerOther: false, requestor: '', contract: '', contact: '', system: '', category: '', serialNumber: '', subsystem: '', issueType: '', assignmentGroup: '', assignedTo: '', priority: 'Medium', warranty: '', lastServiced: '', shortDescription: '', description: '', attachments: [] }

const customerContracts = {
  'Indian Air Force': [
      { number: 'TASL-CTR-2026-001', warranty: 'Active - Under Warranty' },
      { number: 'TASL-CTR-2023-001', warranty: 'Active - Under CMC' },
      { number: 'TASL-CTR-2025-001', warranty: 'Warranty Expiring Soon' },
  ],
  'Indian Army': [
      { number: 'TASL-CTR-2026-002', warranty: 'Active - Under Warranty' },
      { number: 'TASL-CTR-2024-002', warranty: 'Active - Under AMC' },
  ],
  'Indian Navy': [
      { number: 'TASL-CTR-2026-003', warranty: 'Active - Under Warranty' },
      { number: 'TASL-CTR-2022-001', warranty: 'Warranty Expired - No Coverage' },
      { number: 'TASL-CTR-2025-002', warranty: 'Warranty Expiring Soon' },
  ],
  'Indian Army Special Forces': [
      { number: 'TASL-CTR-2024-001', warranty: 'Active - Under AMC' },
      { number: 'TASL-CTR-2026-004', warranty: 'Active - Under Warranty' },
  ],
}

const findCustomerProfile = (customers, customerName) => {
  const customer = customers.find((entry) => entry.name === customerName)
  return customer ? { ...customer, contracts: customerContracts[customerName] || [] } : undefined
}
const contactValue = (contact) => contact ? `${contact.phone} | ${contact.email}` : ''

export default function IncidentsPage({ currentUser, assignmentGroups, users, customers, products, incidents, setIncidents, onAddCustomerContact, onEditModeChange, initialDrill }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [scope, setScope] = useState(initialDrill?.scope || 'All')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState(initialDrill?.stateFilter || 'All')
  const [priorityFilter, setPriorityFilter] = useState(initialDrill?.priorityFilter || 'All')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortDescending, setSortDescending] = useState(true)
  const [page, setPage] = useState(1)
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map(({ key, width }) => [key, width])))
  const currentUserRecord = useMemo(() => users.find((member) => member.email === currentUser.email) || currentUser, [currentUser, users])
  const myGroupNames = useMemo(() => assignmentGroups
    .filter((group) => group.manager === currentUser.name || group.memberIds?.includes(currentUserRecord.id))
    .map((group) => group.name), [assignmentGroups, currentUser.name, currentUserRecord.id])
  const serialNumberRecords = useMemo(() => Array.from(products.reduce((records, product) => {
    const serialNumber = product.product_serial_number
    if (!serialNumber) return records
    const current = records.get(serialNumber) || { serialNumber, system: serialNumber.startsWith('LM-') ? 'SRLM' : '', category: product.product_category || '', subsystems: [] }
    if (product.product_category) current.category = product.product_category
    if (product.subsystems && !current.subsystems.includes(product.subsystems)) current.subsystems.push(product.subsystems)
    records.set(serialNumber, current)
    return records
  }, new Map()).values()), [products])

  useEffect(() => {
    onEditModeChange(Boolean(showForm || selectedIncident))
    return () => onEditModeChange(false)
  }, [onEditModeChange, selectedIncident, showForm])

  const filtered = useMemo(() => incidents.filter((incident) => {
    const assignee = String(incident.assignedTo || incident.assignee || '').toLowerCase()
    const isAssignedToMe = [currentUser.name, currentUser.email, currentUserRecord.id].filter(Boolean).some((value) => assignee === String(value).toLowerCase())
    const isAssignedToMyGroup = myGroupNames.includes(incident.assignmentGroup || incident.group)
    const inScope = scope === 'All' || (scope === 'Assigned to me' && isAssignedToMe) || (scope === 'Assigned to my group' && isAssignedToMyGroup) || (scope === 'Open' && incident.state !== 'Resolved' && incident.state !== 'Closed')
    const matchesSearch = !search || [incident.id, incident.title, incident.stage].some((value) => value.toLowerCase().includes(search.toLowerCase()))
    const matchesPriority = priorityFilter === 'All' || incident.priority === priorityFilter
    return inScope && matchesSearch && (stateFilter === 'All' || incident.state === stateFilter) && matchesPriority && (!favoritesOnly || incident.favorite)
  }).sort((first, second) => sortDescending ? second.opened.localeCompare(first.opened) : first.opened.localeCompare(second.opened)), [currentUser.email, currentUser.name, currentUserRecord.id, favoritesOnly, incidents, myGroupNames, priorityFilter, scope, search, sortDescending, stateFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const setListScope = (nextScope) => { setScope(nextScope); setPage(1) }
  const startColumnResize = (event, column) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = columnWidths[column.key]
    const resizeColumn = (moveEvent) => setColumnWidths((current) => ({ ...current, [column.key]: Math.max(column.minWidth, startWidth + moveEvent.clientX - startX) }))
    const stopResize = () => { document.removeEventListener('mousemove', resizeColumn); document.removeEventListener('mouseup', stopResize) }
    document.addEventListener('mousemove', resizeColumn)
    document.addEventListener('mouseup', stopResize)
  }
  const createIncident = async (form) => {
    if (form.customerOther) onAddCustomerContact(form.customer, { name: form.requestor, phone: form.contact })
    const id = `TASL-${form.customer === 'Indian Army' ? 'IA' : 'IAF'}-INCIDENT-2026-${String(incidents.length + 1).padStart(4, '0')}`
    const incident = { id, opened: '22 Jul 2026 10:30', title: form.shortDescription, priority: form.priority, state: 'New', stage: 'Triage', group: form.assignmentGroup || 'Advisory Team', assignmentGroup: form.assignmentGroup || 'Advisory Team', assignedTo: form.assignedTo || '', favorite: false, attachments: form.attachments || [], serialNumber: form.serialNumber, system: form.system, category: form.category, subsystem: form.subsystem }
    await recordApi.bulkUpsert('incidents', [{ record_id: id, payload: incident }])
    setIncidents((current) => [incident, ...current])
    setPage(1)
    setShowForm(false)
  }

  const deleteIncident = (id) => setIncidents((current) => current.filter((item) => item.id !== id))

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const data = [['Number', 'Opened', 'Short Description', 'Priority', 'State', 'Stage'].map(csv), ...filtered.map((i) => [i.id, i.opened, i.title, i.priority, i.state, i.stage].map(csv))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'incidents.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (showForm) return <NewIncidentForm customers={customers} serialNumberRecords={serialNumberRecords} onCancel={() => setShowForm(false)} onSubmit={createIncident} />
  if (selectedIncident) return <IncidentDetailForm customers={customers} serialNumberRecords={serialNumberRecords} incident={selectedIncident} onCancel={() => setSelectedIncident(null)} onSave={(updates) => setIncidents((current) => current.map((item) => item.id === selectedIncident.id ? { ...item, ...updates } : item))} />

  return (
    <section className="incident-list-page">
      <div className="incident-list-head"><div className="incident-list-title"><h1>Incidents</h1></div><button className="incident-create-button" onClick={() => setShowForm(true)}><Plus size={15} /> New incident</button></div>
      <div className="incident-command-bar">
        <div className="incident-search"><Search size={15} /><input aria-label="Search incidents" placeholder="Search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
        <nav className="incident-scope-actions" aria-label="Incident list scope">{['All', 'Assigned to me', 'Assigned to my group', 'Open'].map((item) => <button key={item} className={scope === item ? 'active' : ''} onClick={() => setListScope(item)}>{item}</button>)}</nav>
        <div className="incident-command-actions"><button className="compact-button secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Extract data</button><label className="incident-filter-select"><Filter size={14} /><select value={stateFilter} aria-label="Filter incidents by state" onChange={(event) => { setStateFilter(event.target.value); setPage(1) }}><option value="All">State: All</option><option>New</option><option>In progress</option><option>Resolved</option><option>Closed</option></select><ChevronDown size={13} /></label><label className="incident-filter-select" style={{marginLeft:4}}><Filter size={14} /><select value={priorityFilter} aria-label="Filter incidents by priority" onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }}><option value="All">Priority: All</option><option>Critical (AOG)</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={13} /></label><button onClick={() => setListScope('Assigned to my group')}>Group</button><button onClick={() => setSortDescending((value) => !value)}>Sort</button><button className={favoritesOnly ? 'selected' : ''} onClick={() => { setFavoritesOnly((value) => !value); setPage(1) }}><Star size={14} /> Favorites</button></div>
        <span className="incident-list-count">{filtered.length ? `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : '0 results'}</span>
      </div>
      <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}<col style={{ width: 108 }} /></colgroup><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}<button className="column-resize-handle" aria-label={`Resize ${column.label} column`} onMouseDown={(event) => startColumnResize(event, column)} /></th>)}<th className="actions-column">Actions</th></tr></thead><tbody>{pageRows.map((incident) => <tr key={incident.id}>{columns.map((column) => <td key={column.key}>{column.key === 'id' ? <button className="incident-number" onClick={() => setSelectedIncident(incident)}>{incident[column.key]}</button> : incident[column.key]}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View incident" onClick={() => setSelectedIncident(incident)}><Eye size={15} /></button><button className="action-btn" title="Edit incident" onClick={() => setSelectedIncident(incident)}><Edit2 size={15} /></button><button className="action-btn delete" title="Delete incident" onClick={() => deleteIncident(incident.id)}><Trash2 size={15} /></button></div></td></tr>)}{!pageRows.length && <tr><td colSpan="7" className="empty-row">No incidents match the current list filters.</td></tr>}</tbody></table></div></div>
      <footer className="incident-pagination"><span>Showing {filtered.length} result{filtered.length === 1 ? '' : 's'}</span><div><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Prev</button><span>{page}</span><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer>
    </section>
  )
}

function NewIncidentForm({ customers, serialNumberRecords, onCancel, onSubmit }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const workflowStages = getProcessStages(form.repairExecution)
  const selectRepairExecution = (repairExecution) => {
    const stages = getProcessStages(repairExecution)
    setForm((current) => ({ ...current, repairExecution, status: stages[0]?.status || '' }))
  }
  const selectedCustomer = findCustomerProfile(customers, form.customer)
  const selectCustomer = (customerName) => {
    const profile = findCustomerProfile(customers, customerName)
    const primaryContact = profile?.contacts[0]
    const primaryContract = profile?.contracts[0]
    setForm((current) => ({ ...current, customer: customerName, requestor: primaryContact?.name || '', contact: contactValue(primaryContact), contract: primaryContract?.number || '', warranty: primaryContract?.warranty || '' }))
  }
  const toggleCustomerOther = (customerOther) => {
    const primaryContact = selectedCustomer?.contacts[0]
    setForm((current) => ({ ...current, customerOther, requestor: customerOther ? '' : primaryContact?.name || '', contact: customerOther ? '' : contactValue(primaryContact) }))
  }
  const selectRequestor = (requestorName) => {
    const contact = selectedCustomer?.contacts.find((entry) => entry.name === requestorName)
    setForm((current) => ({ ...current, requestor: requestorName, contact: contactValue(contact) }))
  }
  const selectContract = (contractNumber) => {
    const contract = selectedCustomer?.contracts.find((entry) => entry.number === contractNumber)
    setForm((current) => ({ ...current, contract: contractNumber, warranty: contract?.warranty || '' }))
  }
  const selectSerialNumber = (serialNumber) => {
    const record = serialNumberRecords.find((entry) => entry.serialNumber === serialNumber)
    setForm((current) => ({ ...current, serialNumber, system: record?.system || '', category: record?.category || '', subsystem: record?.subsystems[0] || '' }))
  }
  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(['customer', 'requestor', 'issueType', 'shortDescription'].filter((key) => !form[key].trim()).map((key) => [key, 'Required']))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitError('')
    try {
      await onSubmit(form)
    } catch (error) {
      setSubmitError(`Incident was not saved: ${error.message}`)
    }
  }

  return <form className="incident-create-page" onSubmit={submit}>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Incidents</button><h1>New incident</h1><p>Log a new incident for quick resolution.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit incident</button></div></header>
    {workflowStages.length > 0 && <WorkflowProgress stages={workflowStages} currentStatus={form.status} compact />}
    <section className="incident-form-sheet">
      <FormSection icon={ClipboardPlus} title="Incident details"><Field label="Incident number"><div className="incident-auto-field">Auto-generated</div></Field><Field label="Created on"><div className="incident-auto-field">Auto-generated</div></Field><Field label="Repair execution"><SelectField value={form.repairExecution} onChange={selectRepairExecution} options={['Repair at Factory', 'Repair at site', 'Repair at site - Vendor']} placeholder="Select repair execution" /></Field><Field label="Status"><div className="incident-auto-field">{form.status || 'Selected after repair execution'}</div></Field></FormSection>
      <FormSection icon={UserRound} title="Customer & requestor" headerAction={<label className="incident-other-contact"><input type="checkbox" checked={form.customerOther} disabled={!form.customer} onChange={(event) => toggleCustomerOther(event.target.checked)} /> Customer other</label>}><Field label="Customer name" required error={errors.customer}><SelectField value={form.customer} onChange={selectCustomer} options={customers.map((customer) => customer.name)} placeholder="Select customer" /></Field><Field label="Requestor name" required error={errors.requestor}>{form.customerOther ? <input value={form.requestor} onChange={(event) => update('requestor', event.target.value)} placeholder="Enter requestor name" /> : <SelectField value={form.requestor} onChange={selectRequestor} options={selectedCustomer?.contacts.map((contact) => contact.name) || []} placeholder="Select customer first" />}</Field><Field label="Customer contract"><SelectField value={form.contract} onChange={selectContract} options={selectedCustomer?.contracts.map((contract) => contract.number) || []} placeholder="Select customer first" /></Field><Field label="Requestor contact">{form.customerOther ? <input value={form.contact} onChange={(event) => update('contact', event.target.value)} placeholder="Enter phone number or email" /> : <input value={form.contact} readOnly placeholder="Auto-filled from requestor" />}</Field></FormSection>
      <FormSection icon={Wrench} title="Product information"><SerialNumberReference records={serialNumberRecords} value={form.serialNumber} onChange={selectSerialNumber} /><LookupField label="Product category" value={form.category} /><LookupField label="System type" value={form.system} /><SubsystemReference serialNumber={form.serialNumber} value={form.subsystem} records={serialNumberRecords} onChange={(subsystem) => update('subsystem', subsystem)} /></FormSection>
      <FormSection icon={AlertTriangle} title="Issue classification"><Field label="Issue type" required error={errors.issueType}><SelectField value={form.issueType} onChange={(value) => update('issueType', value)} options={['Electrical', 'Mechanical', 'Electronics', 'Software', 'Communication', 'Sensors', 'Camera & Imaging', 'Payload', 'Maintenance', 'Physical Damage', 'General Enquiry', 'Other']} placeholder="Select issue type" /></Field><Field label="Priority"><SelectField value={form.priority} onChange={(value) => update('priority', value)} options={['Critical (AOG)', 'High', 'Medium', 'Low']} placeholder="Select priority" /></Field><Field label="Assignment group"><input value={form.assignmentGroup} onChange={(event) => update('assignmentGroup', event.target.value)} placeholder="e.g., Technical Support, Engineering" /></Field><Field label="Assigned to"><input value={form.assignedTo} onChange={(event) => update('assignedTo', event.target.value)} placeholder="Engineer or team member" /></Field></FormSection>
      <FormSection icon={History} title="Service history"><Field label="Warranty status"><input value={form.warranty} onChange={(event) => update('warranty', event.target.value)} placeholder="e.g., Active, Expired" /></Field><Field label="Last serviced on"><input type="date" value={form.lastServiced} onChange={(event) => update('lastServiced', event.target.value)} /></Field></FormSection>
      <section className="incident-description-section"><h2>Issue description</h2><Field label="Short description" required error={errors.shortDescription} hint="What is the main problem?"><input value={form.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} placeholder="Brief summary of the issue" /></Field><Field label="Detailed description" hint="Include as much detail as possible to aid resolution"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Provide detailed information about the issue, steps to reproduce, error messages, etc." rows="5" /></Field><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} cameraCapture /></section>
    </section>
    <footer className="incident-form-footer">{submitError && <span className="incident-submit-error">{submitError}</span>}<button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit incident</button></footer>
  </form>
}

function FormSection({ icon: Icon, title, headerAction, children }) { return <section className="incident-form-section"><h2><span><Icon size={16} /> {title}</span>{headerAction}</h2><div className="incident-form-grid">{children}</div></section> }
function Field({ label, required, hint, error, children }) { return <label className={`incident-field ${error ? 'has-error' : ''}`}><span>{required && <em>*</em>}{label}</span>{children}{error ? <small className="incident-field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label> }
function SelectField({ value, onChange, options, placeholder }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">-- {placeholder} --</option>{options.map((option) => <option key={option}>{option}</option>)}</select> }
function LookupField({ label, value }) { return <Field label={label}><input value={value} readOnly placeholder="Auto-filled from serial number" /></Field> }
function SerialNumberReference({ records, value, onChange }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const matches = records.filter((record) => record.serialNumber.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  useEffect(() => setQuery(value), [value])
  const select = (serialNumber) => { setQuery(serialNumber); onChange(serialNumber); setOpen(false) }
  return <Field label="Serial number" hint="Search and select an asset serial number"><div className="serial-reference"><Search size={15} /><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { const serialNumber = event.target.value.toUpperCase(); setQuery(serialNumber); setOpen(true); onChange(serialNumber) }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder="Search serial number, e.g. LM-001" role="combobox" aria-expanded={open} aria-controls="serial-number-results" aria-autocomplete="list" />{open && matches.length > 0 && <ul id="serial-number-results" role="listbox">{matches.map((record) => <li key={record.serialNumber} role="option" aria-selected={record.serialNumber === value} onMouseDown={() => select(record.serialNumber)}><strong>{record.serialNumber}</strong><span>{record.system} · {record.category}</span></li>)}</ul>}</div></Field>
}
function SubsystemReference({ serialNumber, value, records, onChange }) { const record = records.find((entry) => entry.serialNumber === serialNumber); return <Field label="Sub-system"><SelectField value={value} onChange={onChange} options={record?.subsystems || []} placeholder={serialNumber ? 'Select sub-system from Product Master' : 'Select serial number first'} /></Field> }
function WorkflowProgress({ stages, currentStatus, compact = false }) { return <ol className={`incident-lifecycle ${compact ? 'incident-create-lifecycle compact' : ''}`} style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(${compact ? 0 : 120}px, 1fr))` }}>{stages.map((stage) => <li key={stage.id} className={stage.status === currentStatus ? 'current' : ''}><span>{stage.order}</span><strong>{stage.status}</strong></li>)}</ol> }

function AttachmentSection({ attachments = [], onChange, cameraCapture = false }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraFallback = useRef(null)
  const addFiles = (files) => onChange([...attachments, ...Array.from(files).map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, type: file.type, size: file.size, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' }))])
  const addCapturedImage = (file) => addFiles([file])
  const openCamera = () => {
    if (navigator.mediaDevices?.getUserMedia) setCameraOpen(true)
    else cameraFallback.current?.click()
  }
  return <section className="incident-attachments"><div><h3><Paperclip size={15} /> Attachments</h3><p>Add reference files, photographs, or evidence for this incident.</p></div><div className="attachment-actions"><label className="compact-button secondary"><FileUp size={14} /> Add files<input type="file" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} /></label>{cameraCapture && <><button type="button" className="compact-button primary" onClick={openCamera}><Camera size={14} /> Capture image</button><input ref={cameraFallback} className="camera-fallback-input" type="file" accept="image/*" capture="environment" onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} /></>}</div>{attachments.length > 0 && <div className="attachment-list">{attachments.map((attachment) => <article key={attachment.id}>{attachment.preview ? <img src={attachment.preview} alt={attachment.name} /> : <Paperclip size={16} />}<span><strong>{attachment.name}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span><button type="button" onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))} title="Remove attachment"><Trash2 size={14} /></button></article>)}</div>}{cameraOpen && <CameraCaptureDialog onCapture={addCapturedImage} onClose={() => setCameraOpen(false)} onFallback={() => { setCameraOpen(false); cameraFallback.current?.click() }} />}</section>
}

function CameraCaptureDialog({ onCapture, onClose, onFallback }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stream
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((nextStream) => { stream = nextStream; video.current.srcObject = nextStream })
      .catch(() => setError('Camera access was unavailable. Use the image picker instead.'))
    return () => stream?.getTracks().forEach((track) => track.stop())
  }, [])
  const capture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = video.current.videoWidth
    canvas.height = video.current.videoHeight
    canvas.getContext('2d').drawImage(video.current, 0, 0)
    canvas.toBlob((blob) => { if (blob) { onCapture(new File([blob], `incident-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })); onClose() } }, 'image/jpeg', .9)
  }
  return <div className="camera-capture-backdrop"><section className="camera-capture-dialog" role="dialog" aria-modal="true" aria-label="Capture incident image"><header><div><h2>Capture image</h2><p>Use the device camera to attach a photograph to this incident.</p></div><button type="button" onClick={onClose} aria-label="Close camera"><X size={17} /></button></header>{error ? <div className="camera-error"><p>{error}</p><button type="button" className="compact-button secondary" onClick={onFallback}>Choose image</button></div> : <video ref={video} autoPlay playsInline muted />}<footer><button type="button" className="incident-cancel-button" onClick={onClose}>Cancel</button>{!error && <button type="button" className="incident-submit-button" onClick={capture}><Camera size={15} /> Capture</button>}</footer></section></div>
}

function IncidentDetailForm({ customers, serialNumberRecords, incident, onCancel, onSave }) {
  const initialCustomer = incident.id.includes('-IAF-') ? 'Indian Air Force' : 'Indian Army'
  const initialProfile = findCustomerProfile(customers, initialCustomer)
  const initialStages = getProcessStages('Repair at site')
  const [activeTab, setActiveTab] = useState('Notes')
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    repairExecution: 'Repair at site', status: initialStages[0]?.status || '', customer: initialCustomer, contract: initialProfile.contracts[0].number, requestor: initialProfile.contacts[0].name, contact: contactValue(initialProfile.contacts[0]), issueType: 'Physical Damage', priority: 'Medium', assignmentGroup: incident.group, assignedTo: '', system: incident.system || 'SRLM', category: incident.category || 'Loitering Munition (LM)', subsystem: incident.subsystem || 'Airframe', serialNumber: incident.serialNumber || '', warranty: initialProfile.contracts[0].warranty, lastServiced: '', shortDescription: incident.title, description: incident.title, attachments: incident.attachments || [],
  })
  const update = (key, value) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })) }
  const selectedCustomer = findCustomerProfile(customers, form.customer)
  const selectCustomer = (customerName) => {
    const profile = findCustomerProfile(customers, customerName)
    const primaryContact = profile?.contacts[0]
    const primaryContract = profile?.contracts[0]
    setSaved(false)
    setForm((current) => ({ ...current, customer: customerName, requestor: primaryContact?.name || '', contact: contactValue(primaryContact), contract: primaryContract?.number || '', warranty: primaryContract?.warranty || '' }))
  }
  const selectRequestor = (requestorName) => {
    const contact = selectedCustomer?.contacts.find((entry) => entry.name === requestorName)
    setSaved(false)
    setForm((current) => ({ ...current, requestor: requestorName, contact: contactValue(contact) }))
  }
  const selectContract = (contractNumber) => {
    const contract = selectedCustomer?.contracts.find((entry) => entry.number === contractNumber)
    setSaved(false)
    setForm((current) => ({ ...current, contract: contractNumber, warranty: contract?.warranty || '' }))
  }
  const selectRepairExecution = (repairExecution) => {
    const stages = getProcessStages(repairExecution)
    setSaved(false)
    setForm((current) => ({ ...current, repairExecution, status: stages[0]?.status || '' }))
  }
  const selectSerialNumber = (serialNumber) => {
    const record = serialNumberRecords.find((entry) => entry.serialNumber === serialNumber)
    setSaved(false)
    setForm((current) => ({ ...current, serialNumber, system: record?.system || '', category: record?.category || '', subsystem: record?.subsystems[0] || '' }))
  }
  const field = (label, key, placeholder, options) => <Field label={label}>{options ? <SelectField value={form[key]} onChange={(value) => update(key, value)} options={options} placeholder={placeholder} /> : <input value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} />}</Field>
  const stages = getProcessStages(form.repairExecution)

  return <form className="incident-detail-page" onSubmit={(event) => { event.preventDefault(); onSave({ title: form.shortDescription, group: form.assignmentGroup, attachments: form.attachments, serialNumber: form.serialNumber, system: form.system, category: form.category, subsystem: form.subsystem }); setSaved(true) }}>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Incidents</button><p className="incident-detail-kicker">Incident</p><h1>{incident.id}</h1></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Save</button></div></header>
    <section className="incident-detail-sheet">
      <WorkflowProgress stages={stages} currentStatus={form.status} />
      <div className="incident-detail-content">
        <section className="incident-detail-section"><h2>Incident details</h2><div className="incident-form-grid"><Field label="Incident number"><div className="incident-auto-field">{incident.id}</div></Field><Field label="Created on"><div className="incident-auto-field">{incident.opened}</div></Field><Field label="Repair execution"><SelectField value={form.repairExecution} onChange={selectRepairExecution} options={['Repair at Factory', 'Repair at site', 'Repair at site - Vendor']} placeholder="Select repair execution" /></Field><Field label="Status"><SelectField value={form.status} onChange={(value) => update('status', value)} options={stages.map((stage) => stage.status)} placeholder="Select status" /></Field></div></section>
        <section className="incident-detail-section"><h2>Customer</h2><div className="incident-form-grid"><Field label="Customer name"><SelectField value={form.customer} onChange={selectCustomer} options={customers.map((customer) => customer.name)} placeholder="Select customer" /></Field><Field label="Customer contract"><SelectField value={form.contract} onChange={selectContract} options={selectedCustomer?.contracts.map((contract) => contract.number) || []} placeholder="Select customer first" /></Field><Field label="Requestor name"><SelectField value={form.requestor} onChange={selectRequestor} options={selectedCustomer?.contacts.map((contact) => contact.name) || []} placeholder="Select customer first" /></Field><Field label="Requestor contact"><input value={form.contact} readOnly placeholder="Auto-filled from requestor" /></Field></div></section>
        <section className="incident-detail-section"><h2>Incident classification</h2><div className="incident-form-grid">{field('Issue type', 'issueType', 'Select issue type', ['Electrical', 'Mechanical', 'Electronics', 'Software', 'Communication', 'Sensors', 'Camera & Imaging', 'Payload', 'Maintenance', 'Physical Damage', 'General Enquiry', 'Other'])}{field('Priority', 'priority', 'Select priority', ['Critical (AOG)', 'High', 'Medium', 'Low'])}{field('Assignment group', 'assignmentGroup', 'Technical Support, Engineering, Field Operations')}{field('Assigned to', 'assignedTo', 'Engineer or team member')}</div></section>
        <section className="incident-detail-section"><h2>Product details</h2><div className="incident-form-grid"><SerialNumberReference records={serialNumberRecords} value={form.serialNumber} onChange={selectSerialNumber} /><LookupField label="Product category" value={form.category} /><LookupField label="System type" value={form.system} /><SubsystemReference serialNumber={form.serialNumber} value={form.subsystem} records={serialNumberRecords} onChange={(subsystem) => update('subsystem', subsystem)} /></div></section>
        <section className="incident-detail-section"><h2>Service history</h2><div className="incident-form-grid">{field('Warranty status', 'warranty', 'Active/Expired/Expiring Soon')}{field('Last serviced on', 'lastServiced', 'YYYY-MM-DD')}</div></section>
        <section className="incident-detail-section"><h2>Issue description</h2><div className="incident-form-grid">{field('Short description', 'shortDescription', 'Short description')}<Field label="Description"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Description" rows="4" /></Field></div><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} /></section>
        <section className="incident-work-area"><div className="incident-work-tabs">{['Notes', 'Components', 'Resolution'].map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{activeTab === 'Notes' && <div className="incident-work-panel"><Field label="Work notes" hint="Document all work performed on this incident"><textarea placeholder="Add work notes here..." rows="4" /></Field><details><summary>Audit log</summary><p>System-generated log of all changes to this incident.</p></details></div>}{activeTab === 'Components' && <div className="incident-work-panel incident-empty-panel">No components have been recorded for this incident.</div>}{activeTab === 'Resolution' && <div className="incident-work-panel"><Field label="Resolution details"><textarea placeholder="Document the resolution and verification details..." rows="4" /></Field></div>}</section>
      </div>
    </section>
    <footer className="incident-form-footer">{saved && <span className="incident-saved-message">Changes saved</span>}<button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Save</button></footer>
  </form>
}
