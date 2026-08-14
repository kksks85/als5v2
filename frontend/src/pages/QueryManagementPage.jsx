import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ClipboardList, Eye, MessageSquare, Plus, Send, UserRound } from 'lucide-react'
import { recordApi } from '../data/api'
import { AttachmentSection } from './IncidentsPage'

const queryTypes = ['Document Request', 'Technical Clarification', 'Discrepancy', 'Generic Query', 'Operational Query', 'Spare Request', 'Others']
const statuses = ['Open', 'Pending', 'Resolved', 'Closed']
const emptyForm = { customer: '', contract: '', requestor: '', queryType: '', temporaryQueryCategory: '', description: '', assignmentGroup: '', assignedTo: '', responseToQuery: '', attachments: [] }
const dateLabel = (value) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '--'
const isGroupMember = (group, user, users) => {
  const userRecord = users.find((entry) => entry.name === user.name || entry.email === user.email)
  return group?.manager === user.name || group?.memberIds?.some((id) => String(id) === String(userRecord?.id))
}
const queryNumber = (queries, customer) => {
  const year = new Date().getFullYear()
  const initial = customer.match(/[A-Za-z0-9]+/g)?.map((word) => word[0]).join('').toUpperCase() || 'CUSTOMER'
  const expression = new RegExp(`^${initial}-QRY-(\\d+)-${year}$`)
  const highest = queries.reduce((number, query) => Math.max(number, Number(query.id.match(expression)?.[1] || 0)), 0)
  return `${initial}-QRY-${String(highest + 1).padStart(4, '0')}-${year}`
}

function Field({ label, required, children }) { return <label className="incident-field"><span>{required && <em>*</em>}{label}</span>{children}</label> }
function FormSection({ icon: Icon, title, children }) { return <section className="incident-form-section"><h2><span><Icon size={16} /> {title}</span></h2><div className="incident-form-grid">{children}</div></section> }

export default function QueryManagementPage({ queries, setQueries, currentUser, users, customers, contracts, assignmentGroups }) {
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState('All')
  const [search, setSearch] = useState('')
  const csmGroup = assignmentGroups.find((group) => group.name === 'Customer Support Management Group')
  const isCsm = currentUser.role === 'Administrator' || isGroupMember(csmGroup, currentUser, users)
  const myGroups = assignmentGroups.filter((group) => isGroupMember(group, currentUser, users)).map((group) => group.name)
  const visibleQueries = useMemo(() => queries.filter((query) => {
    const matchesScope = scope === 'All' || (scope === 'Open' && query.status === 'Open') || (scope === 'Assigned to my group' && myGroups.includes(query.assignmentGroup)) || (scope === 'Assigned to me' && query.assignedTo === currentUser.name)
    const haystack = [query.id, query.customer, query.queryType, query.status, query.assignmentGroup].join(' ').toLowerCase()
    return matchesScope && haystack.includes(search.toLowerCase())
  }), [currentUser.name, myGroups, queries, scope, search])
  const persist = async (query) => {
    await recordApi.bulkUpsert('queries', [{ record_id: query.id, payload: query }])
    setQueries((current) => current.some((entry) => entry.id === query.id) ? current.map((entry) => entry.id === query.id ? query : entry) : [query, ...current])
    setSelectedQuery(query)
  }
  const createQuery = async (form) => {
    const id = queryNumber(queries, form.customer)
    const now = new Date().toISOString()
    const query = { ...form, id, status: 'Open', opened: now, auditLog: [{ id: `${Date.now()}-created`, updatedAt: now, updatedBy: currentUser.name, changes: [{ field: 'Query created', previous: '', next: 'Open' }] }] }
    await persist(query)
    setCreating(false)
  }
  if (creating) return <QueryCreateForm customers={customers} contracts={contracts} assignmentGroups={assignmentGroups} onCancel={() => setCreating(false)} onSubmit={createQuery} />
  if (selectedQuery) return <QueryDetail query={selectedQuery} currentUser={currentUser} users={users} assignmentGroups={assignmentGroups} isCsm={isCsm} onBack={() => setSelectedQuery(null)} onSave={persist} />
  return <section className="incident-list-page"><div className="incident-list-head"><div className="incident-list-title"><h1>Query Management</h1></div>{isCsm && <button className="incident-create-button" onClick={() => setCreating(true)}><Plus size={15} /> New query</button>}</div><div className="incident-command-bar"><div className="incident-search"><input aria-label="Search queries" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><nav className="incident-scope-actions" aria-label="Query list scope">{['All', 'Assigned to me', 'Assigned to my group', 'Open'].map((item) => <button key={item} className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>{item}</button>)}</nav></div><div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><thead><tr><th>Query number</th><th>Customer</th><th>Query type</th><th>Assigned group</th><th>Status</th><th>Opened</th><th className="actions-column">Actions</th></tr></thead><tbody>{visibleQueries.map((query) => <tr key={query.id}><td><button className="incident-number" onClick={() => setSelectedQuery(query)}>{query.id}</button></td><td>{query.customer}</td><td>{query.queryType === 'Others' ? query.temporaryQueryCategory : query.queryType}</td><td>{query.assignmentGroup || '--'}</td><td>{query.status}</td><td>{dateLabel(query.opened)}</td><td className="row-actions-cell"><button className="action-btn" title="View query" onClick={() => setSelectedQuery(query)}><Eye size={15} /></button></td></tr>)}{!visibleQueries.length && <tr><td colSpan="7" className="empty-row">No queries match the current list filters.</td></tr>}</tbody></table></div></div></section>
}

function QueryCreateForm({ customers, contracts, assignmentGroups, onCancel, onSubmit }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const customer = customers.find((entry) => entry.name === form.customer)
  const customerContracts = contracts.filter((entry) => entry.customer === form.customer || entry.customerName === form.customer || customer?.contracts?.some((contract) => contract.number === entry.number))
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    const required = ['customer', 'contract', 'requestor', 'queryType', 'description']
    if (form.queryType === 'Others') required.push('temporaryQueryCategory')
    if (required.some((key) => !form[key].trim())) { setError('Complete all required fields before submitting the query.'); return }
    await onSubmit(form)
  }
  return <form className="incident-create-page" noValidate onSubmit={submit}><header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Query Management</button><h1>New Customer Query</h1><p>Register a customer request for assignment and response.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></div></header><section className="incident-form-sheet"><FormSection icon={ClipboardList} title="Query details"><Field label="Query number"><div className="incident-auto-field">Auto-generated on submission</div></Field><Field label="Status"><div className="incident-auto-field">Open</div></Field></FormSection><FormSection icon={UserRound} title="Customer & requestor"><Field label="Customer" required><select value={form.customer} onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value, contract: '', requestor: '' }))}><option value="">-- Select customer --</option>{customers.map((entry) => <option key={entry.id || entry.name}>{entry.name}</option>)}</select></Field><Field label="Contract" required><select value={form.contract} disabled={!form.customer} onChange={(event) => update('contract', event.target.value)}><option value="">-- {form.customer ? 'Select customer contract' : 'Select customer first'} --</option>{customerContracts.map((entry) => <option key={entry.id || entry.number} value={entry.number}>{entry.number}</option>)}</select></Field><Field label="Requester" required><select value={form.requestor} disabled={!form.customer} onChange={(event) => update('requestor', event.target.value)}><option value="">-- Select requester --</option>{customer?.contacts?.map((contact) => <option key={contact.id || contact.name}>{contact.name}</option>)}</select></Field></FormSection><FormSection icon={MessageSquare} title="Query information"><Field label="Query type" required><select value={form.queryType} onChange={(event) => update('queryType', event.target.value)}><option value="">-- Select query type --</option>{queryTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>{form.queryType === 'Others' && <Field label="Temporary Query Category" required><input value={form.temporaryQueryCategory} onChange={(event) => update('temporaryQueryCategory', event.target.value)} placeholder="Enter temporary category" /></Field>}<Field label="Assignment Group"><select value={form.assignmentGroup} onChange={(event) => update('assignmentGroup', event.target.value)}><option value="">-- Assign later --</option>{assignmentGroups.filter((group) => group.active).map((group) => <option key={group.id}>{group.name}</option>)}</select></Field></FormSection><section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details" required><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="5" placeholder="Describe the customer query and required response..." /></Field><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} /></section></section>{error && <p className="incident-submit-error">{error}</p>}<footer className="incident-form-footer"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></footer></form>
}

function QueryDetail({ query, currentUser, users, assignmentGroups, isCsm, onBack, onSave }) {
  const [draft, setDraft] = useState(query)
  const group = assignmentGroups.find((entry) => entry.name === draft.assignmentGroup)
  const canRespond = draft.status === 'Pending' && isGroupMember(group, currentUser, users)
  const assignedToOptions = group ? users.filter((user) => group.memberIds?.some((id) => String(id) === String(user.id))).map((user) => user.name) : []
  const save = async (changes, action) => {
    const now = new Date().toISOString()
    const changesByAction = {
      response: [{ field: 'Response to Query', previous: draft.responseToQuery || '', next: changes.responseToQuery }, { field: 'Status', previous: draft.status, next: 'Resolved' }],
      assign: [{ field: 'Assignment Group', previous: draft.assignmentGroup || '--', next: changes.assignmentGroup }, { field: 'Assigned To', previous: draft.assignedTo || '--', next: changes.assignedTo }, { field: 'Status', previous: 'Open', next: 'Pending' }],
      attachments: [{ field: 'Attachments', previous: `${(draft.attachments || []).length} file(s)`, next: `${(changes.attachments || []).length} file(s)` }],
      close: [{ field: 'Status', previous: draft.status, next: 'Closed' }],
    }
    const next = { ...draft, ...changes, auditLog: [...(draft.auditLog || []), { id: `${Date.now()}-${action}`, updatedAt: now, updatedBy: currentUser.name, changes: changesByAction[action] }] }
    setDraft(next)
    await onSave(next)
  }
  return <section className="incident-create-page"><header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Query Management</button><h1>{draft.id}</h1><p>{draft.status} · Opened {dateLabel(draft.opened)}</p></div></header><ol className="incident-lifecycle compact" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>{statuses.map((status, index) => <li key={status} className={status === draft.status ? 'current' : ''}><span>{index + 1}</span><strong>{status}</strong></li>)}</ol><section className="incident-form-sheet"><FormSection icon={UserRound} title="Customer query"><Field label="Customer"><input value={draft.customer} readOnly /></Field><Field label="Contract"><input value={draft.contract} readOnly /></Field><Field label="Requester"><input value={draft.requestor} readOnly /></Field><Field label="Query type"><input value={draft.queryType === 'Others' ? draft.temporaryQueryCategory : draft.queryType} readOnly /></Field></FormSection><section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details"><textarea value={draft.description} readOnly rows="4" /></Field><AttachmentSection attachments={draft.attachments || []} onChange={(attachments) => setDraft((current) => ({ ...current, attachments }))} /><button className="incident-next-stage-button" onClick={() => save({ attachments: draft.attachments || [] }, 'attachments')}>Save attachments</button></section>{draft.status === 'Open' && isCsm && <FormSection icon={UserRound} title="Assign query"><Field label="Assignment Group" required><select value={draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignmentGroup: event.target.value, assignedTo: '' }))}><option value="">-- Select assignment group --</option>{assignmentGroups.filter((entry) => entry.active).map((entry) => <option key={entry.id}>{entry.name}</option>)}</select></Field><Field label="Assigned To"><select value={draft.assignedTo} disabled={!draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignedTo: event.target.value }))}><option value="">-- Select group member --</option>{assignedToOptions.map((name) => <option key={name}>{name}</option>)}</select></Field><div className="incident-form-actions"><button className="incident-next-stage-button" disabled={!draft.assignmentGroup || !draft.assignedTo} onClick={() => save({ assignmentGroup: draft.assignmentGroup, assignedTo: draft.assignedTo, status: 'Pending' }, 'assign')}>Assign and mark Pending</button></div></FormSection>}{(draft.status === 'Pending' || draft.status === 'Resolved' || draft.status === 'Closed') && <section className="incident-description-section"><h2>Response to Query</h2><Field label="Response to Query"><textarea value={draft.responseToQuery || ''} readOnly={!canRespond} onChange={(event) => setDraft((current) => ({ ...current, responseToQuery: event.target.value }))} rows="5" placeholder={canRespond ? 'Provide the response for CSM review...' : 'Awaiting assigned group response'} /></Field>{canRespond && <button className="incident-next-stage-button" disabled={!draft.responseToQuery.trim()} onClick={() => save({ responseToQuery: draft.responseToQuery, status: 'Resolved', resolvedAt: new Date().toISOString() }, 'response')}><Send size={15} /> Submit response</button>}{draft.status === 'Resolved' && isCsm && <button className="incident-next-stage-button" onClick={() => save({ status: 'Closed', closedAt: new Date().toISOString() }, 'close')}><CheckCircle2 size={15} /> Send to customer and close</button>}</section>}<section className="incident-description-section"><h2>Record Journal</h2><div className="incident-journal">{(draft.auditLog || []).slice().reverse().map((entry) => <article key={entry.id}><header><span>{dateLabel(entry.updatedAt)}</span><strong>{entry.updatedBy}</strong></header>{entry.changes.map((change, index) => <p key={index}><b>{change.field}</b><span>{String(change.previous || '--')} to {String(change.next || '--')}</span></p>)}</article>)}</div></section></section></section>
}