import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { ArrowLeft, Edit2, Eye, FileText, Plus, Search, Trash2, Upload } from 'lucide-react'
import { notificationApi } from '../data/api'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'
const subcontractStatus = (subcontract) => !subcontract.validFrom || !subcontract.validTo ? 'Incomplete' : subcontract.validFrom > today() ? 'Upcoming' : subcontract.validTo < today() ? 'Expired' : 'Active'
const packageTypes = [
  ['scheduled', 'Scheduled maintenance'],
  ['assorted', 'Assorted maintenance'],
  ['unscheduled', 'Unscheduled maintenance'],
]
const isMeaningfulInclusion = (item) => /[a-z]/i.test(String(item?.itemDescription || '').replace(/[|_\-]/g, ''))

const blankSubcontract = (contracts, mainContractNumber = '') => {
  const contract = contracts.find((entry) => entry.number === mainContractNumber)
  return { id: '', type: 'AMC', number: '', mainContractNumber, customer: contract?.customer || '', validFrom: '', validTo: '', attachments: [], extractedText: '', maintenancePackages: { scheduled: [], assorted: [], unscheduled: [] } }
}

const normalizeSubcontract = (subcontract, contracts) => {
  const contract = contracts.find((entry) => entry.number === subcontract.mainContractNumber)
  const packages = subcontract.maintenancePackages || {}
  return {
    ...blankSubcontract(contracts, subcontract.mainContractNumber || ''),
    ...subcontract,
    type: subcontract.type === 'CMC' ? 'CAMC' : subcontract.type || 'AMC',
    customer: contract?.customer || subcontract.customer || '',
    maintenancePackages: Object.fromEntries(packageTypes.map(([key]) => [key, (packages[key] || []).filter(isMeaningfulInclusion).map((item) => ({ ...item, totalQuantity: Number(item.totalQuantity) || 0, usedQuantity: Number(item.usedQuantity) || 0 }))])),
  }
}

const coverage = (subcontract) => (subcontract.maintenancePackages?.unscheduled || []).reduce((total, item) => ({ total: total.total + (Number(item.totalQuantity) || 0), used: total.used + (Number(item.usedQuantity) || 0) }), { total: 0, used: 0 })

const readAttachment = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ id: `subcontract-file-${Date.now()}`, name: file.name, type: file.type, size: file.size, content: reader.result })
  reader.readAsDataURL(file)
})

const extractPdfText = async (file, onProgress) => {
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
    onProgress(`Reading page ${index + 1} of ${document.numPages}...`)
    const content = await (await document.getPage(index + 1)).getTextContent()
    const rows = new Map()
    content.items.forEach((item) => {
      const row = Math.round(item.transform[5] / 4) * 4
      rows.set(row, [...(rows.get(row) || []), { x: item.transform[4], text: item.str }])
    })
    return [...rows.entries()].sort(([first], [second]) => second - first).map(([, items]) => items.sort((first, second) => first.x - second.x).map((item) => item.text).join(' | ')).join('\n')
  }))
  const text = pages.join('\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return text
}

const detectPackageInclusions = (text) => {
  const groups = { scheduled: [], assorted: [], unscheduled: [] }
  let current = 'scheduled'
  const seen = new Set()
  text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((line, index) => {
    if (/unscheduled|breakdown|emergency\s+maintenance/i.test(line)) { current = 'unscheduled'; return }
    if (/assorted|corrective|miscellaneous\s+maintenance/i.test(line)) { current = 'assorted'; return }
    if (/scheduled|preventive|routine\s+maintenance/i.test(line)) { current = 'scheduled'; return }
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
    const quantityCell = [...cells].reverse().find((cell) => /^\d+(?:\.0+)?$/.test(cell))
    const quantity = Number(quantityCell)
    const descriptionCells = cells.filter((cell) => cell !== quantityCell && !/^(?:s\.?no\.?|item|description|quantity|qty|sl\.?\s*no\.?)$/i.test(cell) && !/^\d+$/.test(cell))
    const fallback = line.match(/^(?:\d+[.)-]?\s*)?(.{3,}?)\s+(?:qty(?:uantity)?\s*[:.-]?\s*)?(\d+)$/i)
    const itemDescription = (descriptionCells.join(' ') || fallback?.[1] || '').replace(/[|_\-]{2,}/g, ' ').replace(/\|/g, ' ').replace(/^\d+[.)-]?\s*/, '').replace(/\s+/g, ' ').trim()
    const totalQuantity = quantity || Number(fallback?.[2]) || 0
    const itemKey = `${current}:${itemDescription.toLowerCase()}:${totalQuantity}`
    if (isMeaningfulInclusion({ itemDescription }) && totalQuantity > 0 && !/^(?:maintenance|package|inclusions?)$/i.test(itemDescription) && !seen.has(itemKey)) {
      seen.add(itemKey)
      groups[current].push({ id: `parsed-${current}-${index}-${Date.now()}`, itemDescription, totalQuantity, usedQuantity: 0, sourceText: line })
    }
  })
  return groups
}

export default function SubcontractsPage({ subcontracts, setSubcontracts, contracts, onCreateNotifications, initialMainContract, onInitialMainContractHandled }) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const filtered = useMemo(() => subcontracts.map((record) => normalizeSubcontract(record, contracts)).filter((record) => !search || [record.number, record.mainContractNumber, record.customer, record.type].some((value) => String(value).toLowerCase().includes(search.toLowerCase()))), [contracts, search, subcontracts])

  useEffect(() => {
    if (!initialMainContract) return
    setEditing(blankSubcontract(contracts, initialMainContract))
    onInitialMainContractHandled?.()
  }, [contracts, initialMainContract, onInitialMainContractHandled])

  const save = (record) => {
    const normalized = normalizeSubcontract({ ...record, id: record.id || `subcontract-${Date.now()}` }, contracts)
    setSubcontracts((current) => current.some((item) => item.id === normalized.id) ? current.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current])
    setEditing(null)
    setViewing(normalized)
  }

  if (editing) return <SubcontractForm record={normalizeSubcontract(editing, contracts)} contracts={contracts} onCancel={() => setEditing(null)} onSave={save} />
  if (viewing) return <SubcontractDetail record={normalizeSubcontract(viewing, contracts)} onBack={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} onUsage={(updated, notifications) => { setSubcontracts((current) => current.map((item) => item.id === updated.id ? updated : item)); onCreateNotifications?.(notifications); setViewing(updated) }} />

  return <section className="customer-list-page subcontract-list-page">
    <div className="customer-list-head"><div className="customer-list-title"><h1>Sub-contracts</h1><p>Manage AMC and CAMC maintenance coverage linked to main contracts.</p></div><div className="user-list-actions"><button className="customer-create-button" onClick={() => setEditing(blankSubcontract(contracts))}><Plus size={15} /> New sub-contract</button></div></div>
    <div className="customer-command-bar"><div className="customer-search"><Search size={15} /><input aria-label="Search sub-contracts" placeholder="Search subcontract, contract or customer..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="customer-list-count">{filtered.length} sub-contract{filtered.length === 1 ? '' : 's'}</span></div>
    <div className="customer-table-frame"><div className="customer-table-scroll"><table className="customer-table subcontract-table"><thead><tr><th>Sub-contract</th><th>Type</th><th>Main contract</th><th>Customer</th><th>Valid from</th><th>Valid to</th><th>Coverage</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((record) => { const totals = coverage(record); return <tr key={record.id}><td>{record.number || '--'}</td><td><span className="badge">{record.type}</span></td><td>{record.mainContractNumber || '--'}</td><td>{record.customer || '--'}</td><td>{formatDate(record.validFrom)}</td><td>{formatDate(record.validTo)}</td><td>{totals.used} / {totals.total}</td><td><span className={`badge ${subcontractStatus(record) === 'Active' ? 'active' : 'inactive'}`}>{subcontractStatus(record)}</span></td><td className="action-buttons"><button className="icon-button" title="View sub-contract" onClick={() => setViewing(record)}><Eye size={14} /></button><button className="icon-button" title="Edit sub-contract" onClick={() => setEditing(record)}><Edit2 size={14} /></button><button className="icon-button danger" title="Delete sub-contract" onClick={() => setSubcontracts((current) => current.filter((item) => item.id !== record.id))}><Trash2 size={14} /></button></td></tr> })}{!filtered.length && <tr><td colSpan="9" className="empty-row">No sub-contracts have been created.</td></tr>}</tbody></table></div></div>
  </section>
}

function SubcontractForm({ record, contracts, onCancel, onSave }) {
  const [form, setForm] = useState(record)
  const [errors, setErrors] = useState({})
  const update = (key, value) => setForm((current) => {
    const contract = key === 'mainContractNumber' ? contracts.find((entry) => entry.number === value) : null
    return { ...current, [key]: value, ...(contract ? { customer: contract.customer } : {}) }
  })
  const submit = (event) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(['type', 'number', 'mainContractNumber', 'validFrom', 'validTo'].filter((key) => !form[key]).map((key) => [key, 'Required']))
    if (form.validFrom && form.validTo && form.validTo < form.validFrom) nextErrors.validTo = 'Must be on or after valid from date.'
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) onSave(form)
  }
  return <form className="customer-form-page subcontract-form-page" onSubmit={submit}><header className="customer-form-header"><div><button type="button" className="customer-back-button" onClick={onCancel}><ArrowLeft size={15} /> Sub-contracts</button><h1>{record.id ? 'Edit sub-contract' : 'New sub-contract'}</h1><p>Link AMC or CAMC coverage to an existing main contract.</p></div><div className="customer-form-actions"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save sub-contract</button></div></header><section className="customer-form-sheet"><section className="customer-form-section"><h2>Sub-contract Information</h2><div className="customer-form-grid"><Field label="Sub-contract type" error={errors.type}><select value={form.type} onChange={(event) => update('type', event.target.value)}><option value="AMC">AMC</option><option value="CAMC">CAMC</option></select></Field><Field label="Sub-contract number" error={errors.number}><input value={form.number} onChange={(event) => update('number', event.target.value)} placeholder="e.g. TASL-AMC-2026-001" /></Field><Field label="Main contract" error={errors.mainContractNumber}><select value={form.mainContractNumber} onChange={(event) => update('mainContractNumber', event.target.value)}><option value="">Select main contract</option>{contracts.map((contract) => <option key={contract.number} value={contract.number}>{contract.number}</option>)}</select></Field><Field label="Customer"><input value={form.customer} readOnly /></Field><Field label="Valid from" error={errors.validFrom}><input type="date" value={form.validFrom} onChange={(event) => update('validFrom', event.target.value)} /></Field><Field label="Valid to" error={errors.validTo}><input type="date" value={form.validTo} onChange={(event) => update('validTo', event.target.value)} /></Field></div></section>{record.id ? <MaintenancePackageEditor form={form} setForm={setForm} /> : <section className="customer-form-section"><h2>Maintenance Package</h2><p className="subcontract-placeholder">Save the sub-contract first. The saved maintenance section will read the package document and create its inclusion entries.</p></section>}</section><footer className="customer-form-footer"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save sub-contract</button></footer></form>
}

function MaintenancePackageEditor({ form, setForm }) {
  const input = useRef(null)
  const [reading, setReading] = useState('')
  const updateItem = (packageKey, index, field, value) => setForm((current) => ({ ...current, maintenancePackages: { ...current.maintenancePackages, [packageKey]: current.maintenancePackages[packageKey].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'totalQuantity' ? Number(value) || 0 : value } : item) } }))
  const addItem = (packageKey) => setForm((current) => ({ ...current, maintenancePackages: { ...current.maintenancePackages, [packageKey]: [...current.maintenancePackages[packageKey], { id: `inclusion-${Date.now()}`, itemDescription: '', totalQuantity: 0, usedQuantity: 0 }] } }))
  const readPdf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setReading('Preparing maintenance package...')
      const [attachment, text] = await Promise.all([readAttachment(file), extractPdfText(file, setReading)])
      const detected = detectPackageInclusions(text)
      setForm((current) => ({ ...current, attachments: [...(current.attachments || []), attachment], extractedText: text, maintenancePackages: Object.fromEntries(packageTypes.map(([key]) => [key, [...current.maintenancePackages[key], ...detected[key]]])) }))
      setReading('PDF read. Review the detected inclusions below before saving.')
    } catch { setReading('The PDF could not be read. Add inclusions manually below.') }
    event.target.value = ''
  }
  return <section className="customer-form-section"><div className="customer-form-section-heading"><div><h2>Maintenance Package</h2><p>Upload the package PDF, then review every detected inclusion before saving.</p></div><input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={readPdf} /><button type="button" className="compact-button secondary" onClick={() => input.current?.click()}><Upload size={14} /> Upload PDF</button></div>{form.attachments?.length > 0 && <p className="subcontract-file"><FileText size={14} /> {form.attachments.map((attachment) => attachment.name).join(', ')}</p>}{reading && <p className="subcontract-placeholder">{reading}</p>}{packageTypes.map(([key, label]) => <div className="subcontract-package" key={key}><div><h3>{label}</h3><button type="button" className="compact-button secondary" onClick={() => addItem(key)}><Plus size={14} /> Add inclusion</button></div><div className="contacts-table-wrapper"><table className="contacts-table"><thead><tr><th>Item description</th><th>Part number</th><th>Total coverage</th>{key === 'unscheduled' && <th>Used</th>}{key === 'unscheduled' && <th>Remaining</th>}<th /></tr></thead><tbody>{form.maintenancePackages[key].map((item, index) => <tr key={item.id}><td><input value={item.itemDescription} onChange={(event) => updateItem(key, index, 'itemDescription', event.target.value)} placeholder="e.g. Fixed wing propeller" /></td><td><input value={item.partNumber || ''} onChange={(event) => updateItem(key, index, 'partNumber', event.target.value)} /></td><td><input type="number" min="0" value={item.totalQuantity} onChange={(event) => updateItem(key, index, 'totalQuantity', event.target.value)} /></td>{key === 'unscheduled' && <td>{item.usedQuantity || 0}</td>}{key === 'unscheduled' && <td>{Math.max(0, (Number(item.totalQuantity) || 0) - (Number(item.usedQuantity) || 0))}</td>}<td><button type="button" className="icon-button danger" title="Remove inclusion" onClick={() => setForm((current) => ({ ...current, maintenancePackages: { ...current.maintenancePackages, [key]: current.maintenancePackages[key].filter((_, itemIndex) => itemIndex !== index) } }))}><Trash2 size={14} /></button></td></tr>)}{!form.maintenancePackages[key].length && <tr><td colSpan={key === 'unscheduled' ? 6 : 4} className="empty-row">No inclusions added.</td></tr>}</tbody></table></div></div>)}</section>
}

function Field({ label, error, children }) { return <label className={`customer-field ${error ? 'has-error' : ''}`}><span>{error && <em>*</em>}{label}</span>{children}{error && <small>{error}</small>}</label> }

function PackageDocumentReader({ record, onImported }) {
  const input = useRef(null)
  const [status, setStatus] = useState('')
  const importDocument = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setStatus('Reading maintenance package...')
      const [attachment, text] = await Promise.all([readAttachment(file), extractPdfText(file, setStatus)])
      const detected = detectPackageInclusions(text)
      const count = Object.values(detected).flat().length
      const updated = {
        ...record,
        attachments: [...(record.attachments || []), attachment],
        extractedText: text,
        maintenancePackages: Object.fromEntries(packageTypes.map(([key]) => [key, [...(record.maintenancePackages?.[key] || []), ...detected[key]]])),
      }
      onImported(updated)
      setStatus(count ? `${count} maintenance inclusion${count === 1 ? '' : 's'} created from ${file.name}. Review or edit the entries as needed.` : `The document was stored, but no table rows could be identified. Use Edit to add the inclusions manually.`)
    } catch {
      setStatus('The document could not be read. Use Edit to add the maintenance inclusions manually.')
    }
    event.target.value = ''
  }
  return <section className="detail-section"><div className="customer-form-section-heading"><div><h2>Maintenance Package</h2><p>Read the uploaded package and create coverage entries from its inclusion tables.</p></div><input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={importDocument} /><button type="button" className="compact-button secondary" onClick={() => input.current?.click()}><Upload size={14} /> Read package document</button></div>{record.attachments?.length > 0 && <p className="subcontract-file"><FileText size={14} /> {record.attachments.map((attachment) => attachment.name).join(', ')}</p>}{status && <p className="subcontract-placeholder">{status}</p>}{packageTypes.map(([key, label]) => <div className="subcontract-package" key={key}><div><h3>{label}</h3><span>{record.maintenancePackages?.[key]?.length || 0} inclusion{record.maintenancePackages?.[key]?.length === 1 ? '' : 's'}</span></div><div className="contacts-table-wrapper"><table className="contacts-table"><thead><tr><th>Item description</th><th>Part number</th><th>Total coverage</th>{key === 'unscheduled' && <th>Used</th>}{key === 'unscheduled' && <th>Remaining</th>}</tr></thead><tbody>{(record.maintenancePackages?.[key] || []).map((item) => <tr key={item.id}><td>{item.itemDescription || '--'}</td><td>{item.partNumber || '--'}</td><td>{item.totalQuantity || 0}</td>{key === 'unscheduled' && <td>{item.usedQuantity || 0}</td>}{key === 'unscheduled' && <td>{Math.max(0, (Number(item.totalQuantity) || 0) - (Number(item.usedQuantity) || 0))}</td>}</tr>)}{!(record.maintenancePackages?.[key] || []).length && <tr><td colSpan={key === 'unscheduled' ? 5 : 3} className="empty-row">No inclusions identified for this maintenance section.</td></tr>}</tbody></table></div></div>)}</section>
}

function UsageAudit({ entries }) {
  const formatTimestamp = (value) => value ? new Date(value).toLocaleString('en-GB') : '--'
  return <section className="detail-section"><h2>Unscheduled Maintenance Usage Audit</h2><div className="contacts-table-wrapper"><table className="contacts-table"><thead><tr><th>Recorded</th><th>Maintenance inclusion</th><th>Reference number</th><th>Usage change</th><th>Used coverage</th><th>Remaining coverage</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{formatTimestamp(entry.usedAt)}</td><td>{entry.itemDescription || '--'}</td><td>{entry.reference || '--'}</td><td>+{entry.quantity}</td><td>{entry.previousUsedQuantity} to {entry.newUsedQuantity}</td><td>{entry.previousRemainingQuantity} to {entry.newRemainingQuantity}</td></tr>)}{!entries.length && <tr><td colSpan="6" className="empty-row">No unscheduled maintenance usage has been recorded.</td></tr>}</tbody></table></div></section>
}

function SubcontractDetail({ record, onBack, onEdit, onUsage }) {
  const totals = coverage(record)
  const [selected, setSelected] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [message, setMessage] = useState('')
  const inclusions = (record.maintenancePackages?.unscheduled || []).map((item) => ({ ...item, packageKey: 'unscheduled' }))
  const auditEntries = inclusions.flatMap((item) => {
    const history = [...(item.usageHistory || [])].sort((first, second) => String(first.usedAt).localeCompare(String(second.usedAt)))
    let usedQuantity = Math.max(0, (Number(item.usedQuantity) || 0) - history.reduce((total, entry) => total + (Number(entry.quantity) || 0), 0))
    return history.map((entry) => {
      const previousUsedQuantity = entry.previousUsedQuantity ?? usedQuantity
      const newUsedQuantity = entry.newUsedQuantity ?? previousUsedQuantity + (Number(entry.quantity) || 0)
      const previousRemainingQuantity = entry.previousRemainingQuantity ?? Math.max(0, (Number(item.totalQuantity) || 0) - previousUsedQuantity)
      const newRemainingQuantity = entry.newRemainingQuantity ?? Math.max(0, (Number(item.totalQuantity) || 0) - newUsedQuantity)
      usedQuantity = newUsedQuantity
      return { ...entry, itemDescription: item.itemDescription, previousUsedQuantity, newUsedQuantity, previousRemainingQuantity, newRemainingQuantity }
    })
  }).sort((first, second) => String(second.usedAt).localeCompare(String(first.usedAt)))
  const consume = async () => { try { const result = await notificationApi.consumeSubcontractCoverage({ subcontractId: record.id, inclusionId: selected, quantity: Number(quantity), reference }); onUsage(result.subcontract, result.notifications); setMessage('Coverage usage recorded.'); setSelected(''); setQuantity(''); setReference('') } catch (error) { setMessage(error.message) } }
  return <section className="customer-detail-page"><header className="customer-detail-header"><div><button type="button" className="customer-back-button" onClick={onBack}><ArrowLeft size={15} /> Sub-contracts</button><h1>{record.number}</h1><p className="customer-detail-subtitle">{record.customer}</p></div><div className="customer-detail-actions"><button type="button" className="customer-cancel-button" onClick={onBack}>Close</button><button type="button" className="customer-edit-button" onClick={onEdit}><Edit2 size={15} /> Edit</button></div></header><section className="customer-detail-sheet"><section className="detail-section"><h2>Coverage Details</h2><div className="detail-grid"><div className="detail-field"><span className="detail-label">Type</span><span className="detail-value">{record.type}</span></div><div className="detail-field"><span className="detail-label">Main contract</span><span className="detail-value">{record.mainContractNumber}</span></div><div className="detail-field"><span className="detail-label">Valid period</span><span className="detail-value">{formatDate(record.validFrom)} to {formatDate(record.validTo)}</span></div><div className="detail-field"><span className="detail-label">Coverage used</span><span className="detail-value">{totals.used} / {totals.total}</span></div></div></section><PackageDocumentReader record={record} onImported={(updated) => onUsage(updated, [])} /><section className="detail-section"><h2>Record coverage usage</h2><div className="customer-form-grid"><Field label="Maintenance inclusion"><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select inclusion</option>{inclusions.map((item) => <option key={item.id} value={item.id}>{item.itemDescription} ({item.usedQuantity || 0}/{item.totalQuantity})</option>)}</select></Field><Field label="Quantity"><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label="Reference"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Work order or visit reference" /></Field></div><div className="subcontract-usage-action"><span>{message}</span><button type="button" className="customer-submit-button" disabled={!selected || Number(quantity) < 1} onClick={consume}>Record usage</button></div></section><UsageAudit entries={auditEntries} /></section></section>
}