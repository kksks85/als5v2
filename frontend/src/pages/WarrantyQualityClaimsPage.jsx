import { useMemo, useState } from 'react'
import { ArrowLeft, Edit2, Eye, Filter, Plus, Search } from 'lucide-react'
import { AttachmentSection } from './IncidentsPage'

const blankClaim = () => ({
  customer: '', contactId: '', requester: '', otherContact: false, otherName: '', otherPhone: '', otherEmail: '',
  customerClaimNumber: '', claimRaisedOn: new Date().toISOString().slice(0, 10), claimRaisedFor: '', relatedIncidentIds: [],
  correspondenceType: '', mailReferenceNumber: '', mailDate: '', remarks: '', status: 'Open', attachments: [],
})
const progressForStatus = (status) => status === 'Settled' ? 'Resolved' : status === 'Pending' ? 'Pending' : 'Raised'
const recordNumber = (customer, claimNumber) => `${String(customer || '').match(/[A-Za-z0-9]+/g)?.map((word) => word[0]).join('').toUpperCase() || 'CUS'}-${String(claimNumber).trim()}`
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

export default function WarrantyQualityClaimsPage({ claims, setClaims, customers, incidents, productCategories, currentUser }) {
  const [showForm, setShowForm] = useState(false)
  const [editingClaimId, setEditingClaimId] = useState(null)
  const [form, setForm] = useState(blankClaim)
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('')
  const [pendingIncidentId, setPendingIncidentId] = useState('')
  const selectedCustomer = customers.find((customer) => customer.name === form.customer)
  const contacts = selectedCustomer?.contacts || []
  const matchingIncidents = incidents.filter((incident) => incident.customer === form.customer && incident.category === form.claimRaisedFor)
  const visibleClaims = useMemo(() => claims.filter((claim) => {
    const related = claim.relatedIncidentIds || [claim.relatedIncidentId]
    const matchesSearch = !search || [claim.id, claim.customerClaimNumber, claim.customer, ...related].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))
    return matchesSearch && (customerFilter === 'All' || claim.customer === customerFilter) && (statusFilter === 'All' || claim.status === statusFilter) && (!dateFilter || String(claim.claimRaisedOn || claim.createdAt).slice(0, 10) === dateFilter)
  }), [claims, customerFilter, dateFilter, search, statusFilter])
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const selectCustomer = (customer) => {
    const firstContact = customers.find((entry) => entry.name === customer)?.contacts?.[0]
    setForm((current) => ({ ...current, customer, contactId: firstContact?.id ? String(firstContact.id) : '', requester: firstContact?.name || '', claimRaisedFor: '', relatedIncidentIds: [] }))
    setPendingIncidentId('')
  }
  const selectContact = (contactId) => {
    const contact = contacts.find((entry) => String(entry.id) === contactId)
    setForm((current) => ({ ...current, contactId, requester: contact?.name || '' }))
  }
  const addRelatedIncident = () => {
    if (!pendingIncidentId) return
    setForm((current) => ({ ...current, relatedIncidentIds: current.relatedIncidentIds.includes(pendingIncidentId) ? current.relatedIncidentIds : [...current.relatedIncidentIds, pendingIncidentId] }))
    setPendingIncidentId('')
  }
  const submit = (event) => {
    event.preventDefault()
    const required = ['customer', 'requester', 'customerClaimNumber', 'claimRaisedOn', 'claimRaisedFor', 'status']
    const nextErrors = Object.fromEntries(required.filter((field) => !String(form[field] || '').trim()).map((field) => [field, 'Required']))
    if (!form.relatedIncidentIds.length) nextErrors.relatedIncidentIds = 'Select at least one incident'
    if (!form.otherContact && !form.contactId) nextErrors.contactId = 'Required'
    if (form.otherContact) ['otherName', 'otherPhone', 'otherEmail'].forEach((field) => { if (!String(form[field] || '').trim()) nextErrors[field] = 'Required' })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const updatedClaim = { ...form, id: editingClaimId || recordNumber(form.customer, form.customerClaimNumber), createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUser.email, progress: progressForStatus(form.status) }
    setClaims((current) => editingClaimId ? current.map((claim) => claim.id === editingClaimId ? updatedClaim : claim) : [updatedClaim, ...current])
    setForm(blankClaim()); setErrors({}); setEditingClaimId(null); setShowForm(false)
  }

  const openClaim = (claim) => { setForm({ ...blankClaim(), ...claim, relatedIncidentIds: claim.relatedIncidentIds || [claim.relatedIncidentId].filter(Boolean) }); setEditingClaimId(claim.id); setShowForm(true) }

  if (showForm) return <form className="incident-create-page" onSubmit={submit} noValidate>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={() => setShowForm(false)}><ArrowLeft size={15} /> Warranty / Quality Claims</button><h1>New Warranty / Quality Claim</h1><p>Record a customer claim against an existing incident.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="incident-submit-button">Create claim</button></div></header>
    <ClaimProgress status={form.status} />
    <section className="incident-form-sheet">
      <section className="incident-detail-section"><h2>Customer & contact</h2><div className="incident-form-grid"><Field label="Customer name" error={errors.customer}><Select value={form.customer} onChange={selectCustomer} options={customers.map((customer) => customer.name)} placeholder="Select customer" /></Field><Field label="Customer contact" error={errors.contactId}><Select value={form.contactId} onChange={selectContact} options={contacts.map((contact) => `${contact.id}|${contact.name}${contact.phone ? ` | ${contact.phone}` : ''}`)} placeholder={form.customer ? 'Select customer contact' : 'Select customer first'} disabled={!form.customer || form.otherContact} /></Field><Field label="Requester" error={errors.requester}><input value={form.requester} readOnly={!form.otherContact} onChange={(event) => update('requester', event.target.value)} /></Field><label className="claim-other-contact"><input type="checkbox" checked={form.otherContact} onChange={(event) => update('otherContact', event.target.checked)} /><span><strong>Other contact</strong><small>Enter a contact not available in the customer master.</small></span></label></div></section>
      {form.otherContact && <section className="incident-detail-section"><h2>Other contact</h2><div className="incident-form-grid"><Field label="Name" error={errors.otherName}><input value={form.otherName} onChange={(event) => { update('otherName', event.target.value); update('requester', event.target.value) }} /></Field><Field label="Phone" error={errors.otherPhone}><input type="tel" inputMode="numeric" maxLength={10} value={form.otherPhone} onChange={(event) => update('otherPhone', event.target.value.replace(/\D/g, '').slice(0, 10))} /></Field><Field label="Email" error={errors.otherEmail}><input type="email" value={form.otherEmail} onChange={(event) => update('otherEmail', event.target.value)} /></Field></div></section>}
      <section className="incident-detail-section"><h2>Claim details</h2><div className="incident-form-grid"><Field label="Customer claim number" error={errors.customerClaimNumber}><input value={form.customerClaimNumber} onChange={(event) => update('customerClaimNumber', event.target.value)} /></Field><Field label="Claim raised on" error={errors.claimRaisedOn}><input type="date" value={form.claimRaisedOn} onChange={(event) => update('claimRaisedOn', event.target.value)} /></Field><Field label="Claim raised for" error={errors.claimRaisedFor}><Select value={form.claimRaisedFor} onChange={(value) => { update('claimRaisedFor', value); update('relatedIncidentIds', []); setPendingIncidentId('') }} options={productCategories} placeholder="Select product category" /></Field><Field label="Status" error={errors.status}><Select value={form.status} onChange={(value) => update('status', value)} options={['Open', 'Pending', 'Settled']} placeholder="Select status" /></Field><Field label="Related incidents" error={errors.relatedIncidentIds}><div className="claim-related-incident"><select value={pendingIncidentId} disabled={!form.customer || !form.claimRaisedFor} onChange={(event) => setPendingIncidentId(event.target.value)}><option value="">-- Select incident number - summary --</option>{matchingIncidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.id} - {incident.title}</option>)}</select><button type="button" className="icon-button" title="Add related incident" disabled={!pendingIncidentId} onClick={addRelatedIncident}><Plus size={15} /></button></div>{form.relatedIncidentIds.length > 0 && <div className="claim-related-list">{form.relatedIncidentIds.map((incidentId) => <span key={incidentId}>{incidentId}<button type="button" onClick={() => update('relatedIncidentIds', form.relatedIncidentIds.filter((entry) => entry !== incidentId))}>x</button></span>)}</div>}</Field></div><Field label="Claim description / remarks"><textarea value={form.remarks} onChange={(event) => update('remarks', event.target.value)} rows="4" /></Field></section>
      <section className="incident-detail-section"><h2>Correspondence</h2><div className="incident-form-grid"><Field label="Correspondence type"><Select value={form.correspondenceType} onChange={(value) => update('correspondenceType', value)} options={['Phone Call', 'Whatsapp', 'Email', 'Letter']} placeholder="Select correspondence type" /></Field><Field label="Mail reference number"><input value={form.mailReferenceNumber} onChange={(event) => update('mailReferenceNumber', event.target.value)} /></Field><Field label="Mail date"><input type="date" value={form.mailDate} onChange={(event) => update('mailDate', event.target.value)} /></Field></div><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} /></section>
    </section>
    <footer className="incident-form-footer"><button type="button" className="incident-cancel-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="incident-submit-button">Create claim</button></footer>
  </form>

  return <section className="incident-list-page"><div className="incident-list-head"><div className="incident-list-title"><h1>Warranty / Quality Claims</h1></div><button className="incident-create-button" onClick={() => { setForm(blankClaim()); setEditingClaimId(null); setShowForm(true) }}><Plus size={15} /> New claim</button></div><div className="incident-command-bar"><div className="incident-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Claim, customer, or incident" /></div><div className="incident-command-actions"><Filter size={15} /><Select value={customerFilter} onChange={setCustomerFilter} options={['All', ...customers.map((customer) => customer.name)]} placeholder="Customer" /><Select value={statusFilter} onChange={setStatusFilter} options={['All', 'Open', 'Pending', 'Settled']} placeholder="Status" /><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></div><div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><thead><tr>{['Claim number', 'Customer', 'Claim raised for', 'Related incidents', 'Claim raised on', 'Status', 'Progress', 'Actions'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleClaims.map((claim) => <tr key={claim.id}><td><button className="incident-number" onClick={() => openClaim(claim)}>{claim.id}</button></td><td>{claim.customer}</td><td>{claim.claimRaisedFor || '--'}</td><td>{(claim.relatedIncidentIds || [claim.relatedIncidentId]).filter(Boolean).join(', ') || '--'}</td><td>{formatDate(claim.claimRaisedOn || claim.createdAt)}</td><td>{claim.status}</td><td>Quality Claim {claim.progress || progressForStatus(claim.status)}</td><td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View claim" onClick={() => openClaim(claim)}><Eye size={15} /></button><button className="action-btn" title="Edit claim" onClick={() => openClaim(claim)}><Edit2 size={15} /></button></div></td></tr>)}{!visibleClaims.length && <tr><td colSpan="8" className="empty-row">No warranty or quality claims match the current filters.</td></tr>}</tbody></table></div></div></section>
}

function ClaimProgress({ status }) { const activeIndex = status === 'Settled' ? 2 : status === 'Pending' ? 1 : 0; return <ol className="incident-lifecycle incident-create-lifecycle compact" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{['Raised', 'Pending', 'Resolved'].map((step, index) => <li key={step} className={index <= activeIndex ? 'current' : ''}><span>{index + 1}</span><strong>Quality Claim {step}</strong></li>)}</ol> }
function Field({ label, error, children }) { return <label className={`incident-field ${error ? 'has-error' : ''}`}><span>{error && <em>*</em>}{label}</span>{children}{error && <small className="incident-field-error">{error}</small>}</label> }
function Select({ value, onChange, options, placeholder, disabled = false }) { return <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value.split('|')[0])}><option value="">-- {placeholder} --</option>{options.map((option) => { const [valuePart, ...label] = String(option).split('|'); return <option key={option} value={valuePart}>{label.length ? label.join('|') : valuePart}</option> })}</select> }
