import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CheckCircle2, ClipboardList, Download, Eye, MessageSquare, Plus, Send, Settings, Trash2, UserRound } from 'lucide-react'
import { recordApi } from '../data/api'
import { AttachmentSection } from './IncidentsPage'

const queryTypes = ['Document Request', 'Technical Clarification', 'Discrepancy', 'Generic Query', 'Operational Query', 'Spare Request', 'Others']
const statuses = ['Query Registered', 'In-Progress', 'Pending', 'CSM Review', 'Closed']
const queryColumns = [
  { key: 'id', label: 'Query number' },
  { key: 'customer', label: 'Customer' },
  { key: 'contract', label: 'Contract' },
  { key: 'requestor', label: 'Requester' },
  { key: 'queryType', label: 'Query type' },
  { key: 'assignmentGroup', label: 'Assigned group' },
  { key: 'assignedTo', label: 'Assigned to' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Query details' },
  { key: 'workNotes', label: 'Work notes' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'opened', label: 'Opened' },
  { key: 'closedAt', label: 'Closed' },
]
const emptyForm = { customer: '', contract: '', requestor: '', status: 'Query Registered', queryType: '', temporaryQueryCategory: '', description: '', assignmentGroup: '', assignedTo: '', workNotes: '', pendingReason: '', attachments: [] }
const dateLabel = (value) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '--'
const queryListValue = (query, key) => key === 'queryType' ? (query.queryType === 'Others' ? query.temporaryQueryCategory : query.queryType) : ['opened', 'closedAt'].includes(key) ? dateLabel(query[key]) : key === 'attachments' ? `${query.attachments?.length || 0} file(s)` : query[key] || '--'
const uniqueJournalEntries = (entries = []) => [...new Map(entries.map((entry, index) => [entry.id || `${entry.updatedAt}-${entry.updatedBy}-${index}`, entry])).values()]
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

export default function QueryManagementPage({ queries, setQueries, currentUser, users, customers, contracts, assignmentGroups, initialQueryId = '', onCreateAssignmentNotifications, canDelete = false }) {
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState('All')
  const [visibleColumns, setVisibleColumns] = useState(() => queryColumns.map((column) => column.key))
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [columnFilters, setColumnFilters] = useState({})
  const [sortKey, setSortKey] = useState('opened')
  const [sortDescending, setSortDescending] = useState(true)
  const csmGroup = assignmentGroups.find((group) => group.name === 'Customer Support Management Group')
  const isCsm = String(currentUser.role || '').trim().toLowerCase() === 'administrator' || isGroupMember(csmGroup, currentUser, users)
  const myGroups = assignmentGroups.filter((group) => isGroupMember(group, currentUser, users)).map((group) => group.name)
  const visibleQueries = useMemo(() => queries.filter((query) => {
    const matchesScope = scope === 'All' || (scope === 'Query Registered' && query.status === 'Query Registered') || (scope === 'Assigned to my group' && myGroups.includes(query.assignmentGroup)) || (scope === 'Assigned to me' && query.assignedTo === currentUser.name)
    return matchesScope && Object.entries(columnFilters).every(([key, value]) => !value || String(queryListValue(query, key)).toLowerCase().includes(value.toLowerCase()))
  }).sort((first, second) => {
    const firstValue = sortKey === 'opened' ? first.opened || '' : queryListValue(first, sortKey)
    const secondValue = sortKey === 'opened' ? second.opened || '' : queryListValue(second, sortKey)
    const comparison = String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true })
    return sortDescending ? -comparison : comparison
  }), [columnFilters, currentUser.name, myGroups, queries, scope, sortDescending, sortKey])
  const activeColumns = visibleColumns.map((key) => queryColumns.find((column) => column.key === key)).filter(Boolean)
  const updateColumnFilter = (key, value) => setColumnFilters((current) => ({ ...current, [key]: value }))
  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key) ? (current.length === 1 ? current : current.filter((column) => column !== key)) : [...current, key])
  const moveColumn = (key, direction) => setVisibleColumns((current) => {
    const currentIndex = current.indexOf(key)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current
    const reordered = [...current]
    ;[reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]]
    return reordered
  })
  const extractFilteredQueries = () => {
    const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [activeColumns.map((column) => csvValue(column.label)), ...visibleQueries.map((query) => activeColumns.map((column) => csvValue(queryListValue(query, column.key))))].map((row) => row.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'query-management-results.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  const sortByColumn = (key) => {
    if (sortKey === key) setSortDescending((current) => !current)
    else { setSortKey(key); setSortDescending(false) }
  }
  useEffect(() => {
    if (!initialQueryId) return
    setSelectedQuery(queries.find((query) => query.id === initialQueryId) || null)
  }, [initialQueryId, queries])
  const persist = async (query) => {
    await recordApi.bulkUpsert('queries', [{ record_id: query.id, payload: query }])
    setQueries((current) => current.some((entry) => entry.id === query.id) ? current.map((entry) => entry.id === query.id ? query : entry) : [query, ...current])
    setSelectedQuery(query)
  }
  const createQuery = async (form) => {
    const id = queryNumber(queries, form.customer)
    const now = new Date().toISOString()
    const query = { ...form, id, status: 'Query Registered', opened: now, auditLog: [{ id: `${Date.now()}-created`, updatedAt: now, updatedBy: currentUser.name, changes: [{ field: 'Query created', previous: '', next: 'Query Registered' }] }] }
    await persist(query)
    onCreateAssignmentNotifications?.(query, 'Customer Support Management Group')
    setCreating(false)
  }
  if (creating) return <QueryCreateForm customers={customers} contracts={contracts} assignmentGroups={assignmentGroups} onCancel={() => setCreating(false)} onSubmit={createQuery} />
  if (selectedQuery) return <QueryDetail query={selectedQuery} currentUser={currentUser} users={users} assignmentGroups={assignmentGroups} isCsm={isCsm} onBack={() => setSelectedQuery(null)} onSave={persist} onCreateAssignmentNotifications={onCreateAssignmentNotifications} />
  return <section className="incident-list-page">
    <div className="incident-list-head">
      <div className="incident-list-title"><h1>Query Management</h1></div>
      <div className="user-list-actions">
        {isCsm && <button className="incident-create-button" onClick={() => setCreating(true)}><Plus size={15} /> New query</button>}
        <button type="button" className="compact-button secondary" disabled={!visibleQueries.length} onClick={extractFilteredQueries}><Download size={15} /> Extract data</button>
        <div className="incident-column-menu">
          <button type="button" className="icon-button" title="Select list columns" aria-label="Select list columns" onClick={() => setColumnPickerOpen((open) => !open)}><Settings size={16} /></button>
          {columnPickerOpen && <div className="incident-column-picker"><strong>Visible columns</strong>{activeColumns.map((column, index) => <div className="incident-column-picker-option" key={column.key}><label><input type="checkbox" checked onChange={() => toggleColumn(column.key)} /> {column.label}</label><span><button type="button" aria-label={`Move ${column.label} left`} title="Move column left" disabled={!index} onClick={() => moveColumn(column.key, -1)}><ArrowUp size={13} /></button><button type="button" aria-label={`Move ${column.label} right`} title="Move column right" disabled={index === activeColumns.length - 1} onClick={() => moveColumn(column.key, 1)}><ArrowDown size={13} /></button></span></div>)}{queryColumns.filter((column) => !visibleColumns.includes(column.key)).map((column) => <label key={column.key}><input type="checkbox" checked={false} onChange={() => toggleColumn(column.key)} /> {column.label}</label>)}</div>}
        </div>
      </div>
    </div>
    <div className="incident-command-bar"><nav className="incident-scope-actions" aria-label="Query list scope">{['All', 'Assigned to me', 'Assigned to my group', 'Query Registered'].map((item) => <button key={item} className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>{item}</button>)}</nav></div>
    <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><thead>
      <tr>{activeColumns.map((column) => <th key={column.key}><button type="button" className="contract-column-sort" onClick={() => sortByColumn(column.key)}>{column.label}<ArrowUpDown size={13} /><span className="sr-only">{sortKey === column.key ? sortDescending ? 'descending' : 'ascending' : 'not sorted'}</span></button></th>)}<th className="actions-column">Actions</th></tr>
      <tr className="contract-column-filters">{activeColumns.map((column) => <th key={column.key}><input aria-label={`Filter ${column.label}`} value={columnFilters[column.key] || ''} onChange={(event) => updateColumnFilter(column.key, event.target.value)} placeholder="Search" /></th>)}<th /></tr>
    </thead><tbody>{visibleQueries.map((query) => <tr key={query.id}>{activeColumns.map((column) => <td key={column.key}>{column.key === 'id' ? <button className="incident-number" onClick={() => setSelectedQuery(query)}>{query.id}</button> : queryListValue(query, column.key)}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View query" onClick={() => setSelectedQuery(query)}><Eye size={15} /></button>{canDelete && <button className="action-btn delete" title="Delete query" onClick={() => { if (window.confirm(`Delete query ${query.id}? This action cannot be undone.`)) setQueries((current) => current.filter((entry) => entry.id !== query.id)) }}><Trash2 size={15} /></button>}</div></td></tr>)}{!visibleQueries.length && <tr><td colSpan={activeColumns.length + 1} className="empty-row">No queries match the current list filters.</td></tr>}</tbody></table></div></div>
  </section>
}

function QueryCreateForm({ customers, contracts, assignmentGroups, onCancel, onSubmit }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  assignmentGroups = assignmentGroups.filter((group) => !['System Administration', 'Admin Team'].includes(group.name))
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
  return <form className="incident-create-page" noValidate onSubmit={submit}>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Query Management</button><h1>New Customer Query</h1><p>Register a customer request for assignment and response.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></div></header>
    <section className="incident-form-sheet">
      <FormSection icon={ClipboardList} title="Query details"><Field label="Query number"><div className="incident-auto-field">Auto-generated on submission</div></Field></FormSection>
      <FormSection icon={UserRound} title="Customer & requestor">
        <Field label="Customer" required><select value={form.customer} onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value, contract: '', requestor: '' }))}><option value="">-- Select customer --</option>{customers.map((entry) => <option key={entry.id || entry.name}>{entry.name}</option>)}</select></Field>
        <Field label="Contract" required><select value={form.contract} disabled={!form.customer} onChange={(event) => update('contract', event.target.value)}><option value="">-- {form.customer ? 'Select customer contract' : 'Select customer first'} --</option>{customerContracts.map((entry) => <option key={entry.id || entry.number} value={entry.number}>{entry.number}</option>)}</select></Field>
        <Field label="Requester" required><select value={form.requestor} disabled={!form.customer} onChange={(event) => update('requestor', event.target.value)}><option value="">-- Select requester --</option>{customer?.contacts?.map((contact) => <option key={contact.id || contact.name}>{contact.name}</option>)}</select></Field>
        <Field label="Status"><div className="incident-auto-field">{form.status}</div></Field>
      </FormSection>
      <FormSection icon={MessageSquare} title="Query information"><Field label="Query type" required><select value={form.queryType} onChange={(event) => update('queryType', event.target.value)}><option value="">-- Select query type --</option>{queryTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>{form.queryType === 'Others' && <Field label="Temporary Query Category" required><input value={form.temporaryQueryCategory} onChange={(event) => update('temporaryQueryCategory', event.target.value)} placeholder="Enter temporary category" /></Field>}<Field label="Assignment Group"><select value={form.assignmentGroup} onChange={(event) => update('assignmentGroup', event.target.value)}><option value="">-- Assign later --</option>{assignmentGroups.filter((group) => group.active).map((group) => <option key={group.id}>{group.name}</option>)}</select></Field></FormSection>
      <section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details" required><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="5" placeholder="Describe the customer query and required response..." /></Field><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} /></section>
    </section>
    {error && <p className="incident-submit-error">{error}</p>}<footer className="incident-form-footer"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></footer>
  </form>
  return <form className="incident-create-page" noValidate onSubmit={submit}><header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Query Management</button><h1>New Customer Query</h1><p>Register a customer request for assignment and response.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></div></header><section className="incident-form-sheet"><FormSection icon={ClipboardList} title="Query details"><Field label="Query number"><div className="incident-auto-field">Auto-generated on submission</div></Field><Field label="Status"><div className="incident-auto-field">Open</div></Field></FormSection><FormSection icon={UserRound} title="Customer & requestor"><Field label="Customer" required><select value={form.customer} onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value, contract: '', requestor: '' }))}><option value="">-- Select customer --</option>{customers.map((entry) => <option key={entry.id || entry.name}>{entry.name}</option>)}</select></Field><Field label="Contract" required><select value={form.contract} disabled={!form.customer} onChange={(event) => update('contract', event.target.value)}><option value="">-- {form.customer ? 'Select customer contract' : 'Select customer first'} --</option>{customerContracts.map((entry) => <option key={entry.id || entry.number} value={entry.number}>{entry.number}</option>)}</select></Field><Field label="Requester" required><select value={form.requestor} disabled={!form.customer} onChange={(event) => update('requestor', event.target.value)}><option value="">-- Select requester --</option>{customer?.contacts?.map((contact) => <option key={contact.id || contact.name}>{contact.name}</option>)}</select></Field></FormSection><FormSection icon={MessageSquare} title="Query information"><Field label="Query type" required><select value={form.queryType} onChange={(event) => update('queryType', event.target.value)}><option value="">-- Select query type --</option>{queryTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>{form.queryType === 'Others' && <Field label="Temporary Query Category" required><input value={form.temporaryQueryCategory} onChange={(event) => update('temporaryQueryCategory', event.target.value)} placeholder="Enter temporary category" /></Field>}<Field label="Assignment Group"><select value={form.assignmentGroup} onChange={(event) => update('assignmentGroup', event.target.value)}><option value="">-- Assign later --</option>{assignmentGroups.filter((group) => group.active).map((group) => <option key={group.id}>{group.name}</option>)}</select></Field></FormSection><section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details" required><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="5" placeholder="Describe the customer query and required response..." /></Field><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} /></section></section>{error && <p className="incident-submit-error">{error}</p>}<footer className="incident-form-footer"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit query</button></footer></form>
}

function QueryDetail({ query, currentUser, users, assignmentGroups, isCsm, onBack, onSave, onCreateAssignmentNotifications }) {
  const [draft, setDraft] = useState(query)
  const [savedDraft, setSavedDraft] = useState(query)
  const [statusSelection, setStatusSelection] = useState(query.status)
  const [savedResponse, setSavedResponse] = useState(query.responseToQuery || '')
  const [savingAction, setSavingAction] = useState('')
  const [saveError, setSaveError] = useState('')
  const group = assignmentGroups.find((entry) => entry.name === draft.assignmentGroup)
  const csmGroupName = assignmentGroups.find((entry) => entry.name === 'Customer Support Management Group')?.name || 'Customer Support Management Group'
  const isRespondingTeamMember = !isCsm && draft.assignmentGroup !== csmGroupName && isGroupMember(group, currentUser, users)
  const assignedToOptions = group ? users.filter((user) => group.memberIds?.some((id) => String(id) === String(user.id))).map((user) => user.name) : []
  const canChangeAssignment = draft.status !== 'Closed' && (isCsm || isGroupMember(group, currentUser, users))
  const canAddWorkNotes = draft.status !== 'Closed' && (isCsm || isGroupMember(group, currentUser, users))
  const canSetPending = isRespondingTeamMember && ['In-Progress', 'Pending'].includes(draft.status)
  const canReturnToCsm = isRespondingTeamMember && ['In-Progress', 'Pending'].includes(draft.status)
  const activeIndex = Math.max(statuses.indexOf(draft.status), 0)
  const hasProgressChanges = Boolean(draft.workNotes?.trim()) || statusSelection !== savedDraft.status || ['assignmentGroup', 'assignedTo', 'pendingReason', 'responseToQuery'].some((field) => (draft[field] || '') !== (savedDraft[field] || ''))
  assignmentGroups = assignmentGroups.filter((group) => !['System Administration', 'Admin Team'].includes(group.name))
  const save = async (changes, action) => {
    if (action === 'close' && !draft.responseToQuery?.trim()) return
    if (savingAction) return
    const { auditChanges, ...updates } = changes
    const now = new Date().toISOString()
    const changesByAction = {
      response: [{ field: 'Response to Query', previous: draft.responseToQuery || '', next: changes.responseToQuery }, { field: 'Status', previous: draft.status, next: 'Resolved' }],
      assign: [
        ...(draft.assignmentGroup === changes.assignmentGroup ? [] : [{ field: 'Assignment Group', previous: draft.assignmentGroup || '--', next: changes.assignmentGroup }]),
        ...(draft.assignedTo === changes.assignedTo ? [] : [{ field: 'Assigned To', previous: draft.assignedTo || '--', next: changes.assignedTo }]),
        ...(draft.status === 'In-Progress' ? [] : [{ field: 'Status', previous: draft.status, next: 'In-Progress' }]),
      ],
      attachments: [{ field: 'Attachments', previous: `${(draft.attachments || []).length} file(s)`, next: `${(changes.attachments || []).length} file(s)` }],
      save: [{ field: 'Progress', previous: '', next: 'Saved' }],
      workNote: [{ field: 'Work notes', previous: '', next: draft.workNotes.trim() }],
      pending: [{ field: 'Status', previous: draft.status, next: 'Pending' }, { field: 'Pending reason', previous: '', next: changes.pendingReason?.trim() || '' }],
      resume: [{ field: 'Status', previous: draft.status, next: 'In-Progress' }],
      returnToCsm: [{ field: 'Work notes', previous: '', next: draft.workNotes.trim() }, { field: 'Status', previous: draft.status, next: 'CSM Review' }, { field: 'Assignment Group', previous: draft.assignmentGroup || '--', next: csmGroupName }, { field: 'Assigned To', previous: draft.assignedTo || '--', next: '--' }],
      status: [{ field: 'Status', previous: draft.status, next: changes.status }],
      close: [{ field: 'Status', previous: draft.status, next: 'Closed' }],
      saveAll: auditChanges,
    }
    const next = { ...draft, ...updates, auditLog: uniqueJournalEntries([...(draft.auditLog || []), { id: `${Date.now()}-${action}-${Math.random()}`, updatedAt: now, updatedBy: currentUser.name, changes: changesByAction[action] }]) }
    setSavingAction(action)
    setSaveError('')
    try {
      await onSave(next)
      setDraft(next)
      setSavedDraft(next)
      setStatusSelection(next.status)
      setSavedResponse(next.responseToQuery || '')
      if (['assign', 'returnToCsm', 'saveAll'].includes(action) && updates.assignmentGroup && updates.assignmentGroup !== draft.assignmentGroup) onCreateAssignmentNotifications?.(next, updates.assignmentGroup)
    } catch (error) {
      setSaveError(error.message || 'The query could not be saved. Please try again.')
    } finally {
      setSavingAction('')
    }
  }
  const saveAll = async () => {
    if (statusSelection === 'Pending' && !draft.pendingReason?.trim()) return
    const nextAssignmentGroup = canChangeAssignment ? draft.assignmentGroup : savedDraft.assignmentGroup
    const nextAssignedTo = canChangeAssignment ? draft.assignedTo : savedDraft.assignedTo
    const assignmentStarted = draft.status === 'Query Registered' && nextAssignmentGroup && nextAssignedTo
    const sendForReview = isRespondingTeamMember && statusSelection === 'CSM Review'
    const nextStatus = assignmentStarted ? 'In-Progress' : statusSelection
    const routedAssignmentGroup = sendForReview ? csmGroupName : nextAssignmentGroup
    const routedAssignedTo = sendForReview ? '' : nextAssignedTo
    const auditChanges = [
      ...(draft.responseToQuery !== savedResponse ? [{ field: 'Final response to query', previous: savedResponse || '--', next: draft.responseToQuery || '--' }] : []),
      ...(draft.workNotes?.trim() ? [{ field: 'Work notes', previous: '', next: draft.workNotes.trim() }] : []),
      ...(draft.status !== nextStatus ? [{ field: 'Status', previous: draft.status, next: nextStatus }] : []),
      ...(savedDraft.assignmentGroup !== routedAssignmentGroup ? [{ field: 'Assignment Group', previous: savedDraft.assignmentGroup || '--', next: routedAssignmentGroup || '--' }] : []),
      ...(savedDraft.assignedTo !== routedAssignedTo ? [{ field: 'Assigned To', previous: savedDraft.assignedTo || '--', next: routedAssignedTo || '--' }] : []),
      ...(nextStatus === 'Pending' && draft.pendingReason?.trim() ? [{ field: 'Pending reason', previous: query.pendingReason || '--', next: draft.pendingReason.trim() }] : []),
    ]
    if (!auditChanges.length) return
    await save({ status: nextStatus, assignmentGroup: routedAssignmentGroup, assignedTo: routedAssignedTo, workNotes: '', pendingReason: draft.pendingReason || '', responseToQuery: draft.responseToQuery || '', auditChanges }, 'saveAll')
  }
  const closeQuery = () => {
    if (!draft.responseToQuery?.trim()) {
      setSaveError('Enter the final response to the query before closing it.')
      return
    }
    save({ status: 'Closed', closedAt: new Date().toISOString() }, 'close')
  }
  return <section className="incident-create-page">
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Query Management</button><h1>{draft.id}</h1><p>{draft.status} · Opened {dateLabel(draft.opened)}</p>{saveError && <p className="incident-field-error" role="alert">{saveError}</p>}</div><div className="incident-form-actions">{draft.status !== 'Closed' && <button type="button" className="incident-submit-button" disabled={Boolean(savingAction) || !hasProgressChanges || (statusSelection === 'Pending' && !draft.pendingReason?.trim())} onClick={saveAll}>{savingAction === 'saveAll' ? 'Saving...' : 'Save progress'}</button>}{isCsm && draft.status === 'CSM Review' && <button type="button" className="incident-close-button" disabled={Boolean(savingAction)} onClick={closeQuery}>{savingAction === 'close' ? 'Closing...' : 'Close query'}</button>}</div></header>
    <ol className="incident-lifecycle compact" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>{statuses.map((status, index) => <li key={status} className={index < activeIndex ? 'completed' : index === activeIndex ? 'current' : ''}><span>{index + 1}</span><strong>{status}</strong></li>)}</ol>
    <section className="incident-form-sheet">
      <FormSection icon={UserRound} title="Customer query"><Field label="Customer"><input value={draft.customer} readOnly /></Field><Field label="Contract"><input value={draft.contract} readOnly /></Field><Field label="Requester"><input value={draft.requestor} readOnly /></Field><Field label="Status">{(isCsm || isRespondingTeamMember) && draft.status !== 'Closed' ? <select value={statusSelection} onChange={(event) => setStatusSelection(event.target.value)}>{(isCsm ? statuses : ['In-Progress', 'Pending', 'CSM Review']).filter((status) => status !== 'Closed').map((status) => <option key={status}>{status}</option>)}</select> : <input value={draft.status} readOnly />}</Field><Field label="Query type"><input value={draft.queryType === 'Others' ? draft.temporaryQueryCategory : draft.queryType} readOnly /></Field></FormSection>
      {canChangeAssignment && <FormSection icon={UserRound} title="Assignment"><Field label="Assignment Group" required><select value={draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignmentGroup: event.target.value, assignedTo: '' }))}><option value="">-- Select assignment group --</option>{assignmentGroups.filter((entry) => entry.active).map((entry) => <option key={entry.id}>{entry.name}</option>)}</select></Field><Field label="Assigned To"><select value={draft.assignedTo} disabled={!draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignedTo: event.target.value }))}><option value="">-- Select group member --</option>{assignedToOptions.map((name) => <option key={name}>{name}</option>)}</select></Field></FormSection>}
      <section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details"><textarea value={draft.description} readOnly rows="4" /></Field><Field label="Final response to query"><textarea value={draft.responseToQuery || ''} readOnly={!canAddWorkNotes} onChange={(event) => setDraft((current) => ({ ...current, responseToQuery: event.target.value }))} rows="4" placeholder="Enter the final response to the customer query" /></Field></section>
      <section className="incident-description-section"><h2>Work notes</h2>{canAddWorkNotes ? <><Field label="Work notes"><textarea value={draft.workNotes || ''} onChange={(event) => setDraft((current) => ({ ...current, workNotes: event.target.value }))} rows="4" placeholder="Add work notes" /></Field>{statusSelection === 'Pending' && <Field label="Pending reason" required><textarea value={draft.pendingReason || ''} onChange={(event) => setDraft((current) => ({ ...current, pendingReason: event.target.value }))} rows="2" placeholder="Explain why the response is pending" /></Field>}</> : <div className="incident-auto-field">{draft.status === 'Closed' ? 'This query is closed.' : 'Work notes can be added by the assigned group.'}</div>}</section>
      <section className="incident-description-section"><details className="record-journal-details"><summary>Record journal</summary>{draft.auditLog?.length ? <ol className="incident-journal">{uniqueJournalEntries(draft.auditLog).slice().reverse().map((entry) => <li key={entry.id}><article><header><div><strong>{entry.updatedBy || 'System'}</strong><span>Updated query</span></div><time>{dateLabel(entry.updatedAt)}</time></header><dl>{(entry.changes || []).map((change, index) => <div key={index}><dt>{change.field}</dt><dd><s>{String(change.previous || '--')}</s><i>to</i><b>{String(change.next || '--')}</b></dd></div>)}</dl></article></li>)}</ol> : <div className="incident-auto-field">No journal entries recorded.</div>}</details></section>
    </section>
  </section>
  return <section className="incident-create-page"><header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onBack}><ArrowLeft size={15} /> Query Management</button><h1>{draft.id}</h1><p>{draft.status} · Opened {dateLabel(draft.opened)}</p></div><div className="incident-form-actions"><button type="button" className="incident-submit-button" onClick={() => save({}, 'save')}>Save progress</button></div></header><ol className="incident-lifecycle compact" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>{statuses.map((status, index) => <li key={status} className={status === draft.status ? 'current' : ''}><span>{index + 1}</span><strong>{status}</strong></li>)}</ol><section className="incident-form-sheet"><FormSection icon={UserRound} title="Customer query"><Field label="Customer"><input value={draft.customer} readOnly /></Field><Field label="Contract"><input value={draft.contract} readOnly /></Field><Field label="Requester"><input value={draft.requestor} readOnly /></Field><Field label="Query type"><input value={draft.queryType === 'Others' ? draft.temporaryQueryCategory : draft.queryType} readOnly /></Field></FormSection><section className="incident-description-section"><h2>Description / Query Details</h2><Field label="Query details"><textarea value={draft.description} readOnly rows="4" /></Field><AttachmentSection attachments={draft.attachments || []} onChange={(attachments) => setDraft((current) => ({ ...current, attachments }))} /><button className="incident-next-stage-button" onClick={() => save({ attachments: draft.attachments || [] }, 'attachments')}>Save attachments</button></section><FormSection icon={UserRound} title="Assignment"><Field label="Assignment Group" required><select value={draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignmentGroup: event.target.value, assignedTo: '' }))}><option value="">-- Select assignment group --</option>{assignmentGroups.filter((entry) => entry.active).map((entry) => <option key={entry.id}>{entry.name}</option>)}</select></Field><Field label="Assigned To"><select value={draft.assignedTo} disabled={!draft.assignmentGroup} onChange={(event) => setDraft((current) => ({ ...current, assignedTo: event.target.value }))}><option value="">-- Select group member --</option>{assignedToOptions.map((name) => <option key={name}>{name}</option>)}</select></Field>{draft.status === 'Open' && <div className="incident-form-actions"><button className="incident-next-stage-button" disabled={!draft.assignmentGroup || !draft.assignedTo} onClick={() => save({ assignmentGroup: draft.assignmentGroup, assignedTo: draft.assignedTo, status: 'Pending' }, 'assign')}>Assign and mark Pending</button></div>}</FormSection>{(draft.status === 'Pending' || draft.status === 'Resolved' || draft.status === 'Closed') && <section className="incident-description-section"><h2>Response to Query</h2><Field label="Response to Query"><textarea value={draft.responseToQuery || ''} readOnly={!canRespond} onChange={(event) => setDraft((current) => ({ ...current, responseToQuery: event.target.value }))} rows="5" placeholder={canRespond ? 'Provide the response for CSM review...' : 'Awaiting assigned group response'} /></Field>{canRespond && <button className="incident-next-stage-button" disabled={!draft.responseToQuery.trim()} onClick={() => save({ responseToQuery: draft.responseToQuery, status: 'Resolved', resolvedAt: new Date().toISOString() }, 'response')}><Send size={15} /> Submit response</button>}{draft.status === 'Resolved' && isCsm && <button className="incident-next-stage-button" onClick={() => save({ status: 'Closed', closedAt: new Date().toISOString() }, 'close')}><CheckCircle2 size={15} /> Send to customer and close</button>}</section>}<section className="incident-description-section"><h2>Record Journal</h2><div className="incident-journal">{(draft.auditLog || []).slice().reverse().map((entry) => <article key={entry.id}><header><span>{dateLabel(entry.updatedAt)}</span><strong>{entry.updatedBy}</strong></header>{entry.changes.map((change, index) => <p key={index}><b>{change.field}</b><span>{String(change.previous || '--')} to {String(change.next || '--')}</span></p>)}</article>)}</div></section></section></section>
}