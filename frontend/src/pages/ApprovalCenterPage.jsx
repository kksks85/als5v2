import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, Download, Eye, GitBranch, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

const APPROVAL_TYPES = ['Document release', 'Change request', 'Service waiver', 'Contract amendment', 'Incident closure', 'Asset write-off']
const APPROVAL_PRIORITIES = ['Critical', 'High', 'Normal', 'Low']

const seedApprovals = (currentUser, users, incidents, contracts, knowledgeDocuments) => {
  const approvers = users.filter((user) => user.role === 'Manager' || user.role === 'Administrator')
  const delegates = users.filter((user) => user.role === 'Manager')
  const subjects = [
    ...incidents.slice(0, 8).map((incident) => ({ ref: incident.id, title: `Closure approval: ${incident.title.slice(0, 55)}`, type: 'Incident closure' })),
    ...contracts.slice(0, 4).map((contract) => ({ ref: contract.number, title: `Amendment approval: ${contract.number} – ${contract.customer}`, type: 'Contract amendment' })),
    ...knowledgeDocuments.slice(0, 4).map((doc) => ({ ref: doc.code || doc.id, title: `Release approval: ${doc.title}`, type: 'Document release' })),
  ]
  const statuses = ['Pending', 'Pending', 'Pending', 'Approved', 'Rejected', 'Delegated']
  const now = new Date('2026-07-23T00:00:00')
  const base = Array.from({ length: Math.min(16, subjects.length) }, (_, index) => {
    const subject = subjects[index]
    const approver = approvers[index % approvers.length]
    const delegateTo = delegates[(index + 2) % delegates.length]
    const status = statuses[index % statuses.length]
    const requestedDays = (index + 1) * 2
    const dueDays = requestedDays + 7
    const requestedDate = new Date(now - requestedDays * 86400000).toISOString().slice(0, 10)
    const dueDate = new Date(now.getTime() + (dueDays - requestedDays) * 86400000).toISOString().slice(0, 10)
    return {
      id: `APR-2026-${String(index + 1).padStart(4, '0')}`,
      ref: subject.ref,
      title: subject.title,
      type: subject.type || APPROVAL_TYPES[index % APPROVAL_TYPES.length],
      priority: APPROVAL_PRIORITIES[index % APPROVAL_PRIORITIES.length],
      status,
      requestedBy: approvers[(index + 1) % approvers.length].name,
      assignedTo: approver.name,
      assignedToEmail: approver.email,
      delegatedTo: status === 'Delegated' ? delegateTo.name : '',
      requestedOn: requestedDate,
      dueBy: dueDate,
      remarks: status === 'Approved' ? 'Approved as per review.' : status === 'Rejected' ? 'Returned – additional documentation required.' : '',
    }
  })

  // Always inject two contextual delegation entries so both directions are visible for any signed-in user
  const otherApprover = approvers.find((user) => user.email !== currentUser.email) || approvers[0]
  const otherDelegate = delegates.find((user) => user.email !== currentUser.email && user.name !== otherApprover.name) || delegates[0]
  const contextual = [
    {
      id: 'APR-2026-D001',
      ref: subjects[0]?.ref || 'CTX-001',
      title: `Service waiver delegated by you: ${subjects[0]?.title?.slice(0, 50) || 'Pending review'}`,
      type: 'Service waiver',
      priority: 'High',
      status: 'Delegated',
      requestedBy: otherApprover.name,
      assignedTo: currentUser.name,
      assignedToEmail: currentUser.email,
      delegatedTo: otherDelegate.name,
      requestedOn: new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10),
      dueBy: new Date(now.getTime() + 11 * 86400000).toISOString().slice(0, 10),
      remarks: '',
    },
    {
      id: 'APR-2026-D002',
      ref: subjects[1]?.ref || 'CTX-002',
      title: `Change request delegated to you: ${subjects[1]?.title?.slice(0, 50) || 'Pending review'}`,
      type: 'Change request',
      priority: 'Normal',
      status: 'Delegated',
      requestedBy: otherDelegate.name,
      assignedTo: otherApprover.name,
      assignedToEmail: otherApprover.email,
      delegatedTo: currentUser.name,
      requestedOn: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10),
      dueBy: new Date(now.getTime() + 8 * 86400000).toISOString().slice(0, 10),
      remarks: '',
    },
  ]
  return [...base, ...contextual]
}

const statusClass = (status) => ({ Pending: 'approval-badge-pending', Approved: 'approval-badge-approved', Rejected: 'approval-badge-rejected', Delegated: 'approval-badge-delegated' }[status] || '')
const priorityClass = (priority) => ({ Critical: 'priority-critical', High: 'priority-high', Normal: 'priority-normal', Low: 'priority-low' }[priority] || '')

export default function ApprovalCenterPage({ currentUser, view, users = [], incidents = [], contracts = [], knowledgeDocuments = [] }) {
  const allApprovals = useMemo(() => seedApprovals(currentUser, users, incidents, contracts, knowledgeDocuments), [currentUser, users, incidents, contracts, knowledgeDocuments])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const approvals = useMemo(() => {
    let list = allApprovals
    if (view === 'mine') {
      list = list.filter((approval) => approval.assignedToEmail === currentUser.email || approval.assignedTo === currentUser.name)
    } else {
      const isMe = (name) => name === currentUser.name ||
        users.find((u) => u.name === name)?.email === currentUser.email
      list = list.filter((approval) =>
        // delegated BY me to someone else
        (approval.delegatedTo && isMe(approval.assignedTo)) ||
        // delegated TO me by someone else
        (approval.delegatedTo && isMe(approval.delegatedTo))
      )
    }
    if (statusFilter !== 'All') list = list.filter((approval) => approval.status === statusFilter)
    if (typeFilter !== 'All') list = list.filter((approval) => approval.type === typeFilter)
    if (search) list = list.filter((approval) => [approval.id, approval.title, approval.ref, approval.type, approval.requestedBy].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))
    return list
  }, [allApprovals, currentUser, search, statusFilter, typeFilter, users, view])

  const pendingCount = approvals.filter((approval) => approval.status === 'Pending').length

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const headers = ['Approval ID', 'Reference', 'Title', 'Type', 'Priority', 'Status', 'Requested by', 'Assigned to', 'Delegated to', 'Requested on', 'Due by']
    const rows = approvals.map((approval) => [approval.id, approval.ref, approval.title, approval.type, approval.priority, approval.status, approval.requestedBy, approval.assignedTo, approval.delegatedTo || '--', formatDate(approval.requestedOn), formatDate(approval.dueBy)])
    const content = [headers, ...rows].map((row) => row.map(csv).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    link.download = `approvals-${view}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (selected) return <ApprovalDetail approval={selected} currentUser={currentUser} onClose={() => setSelected(null)} />

  const viewLabel = view === 'mine' ? 'My Current Approvals' : 'My Delegated Approvals'
  const viewDescription = view === 'mine'
    ? 'Approval requests directly assigned to you.'
    : 'Approvals you delegated to others and approvals others have delegated to you.'

  return (
    <section className="approval-center-page">
      <header className="approval-header">
        <div>
          <p>Approval center</p>
          <h1>{viewLabel}</h1>
          <span>{viewDescription}</span>
        </div>
        <div className="approval-header-meta">
          {pendingCount > 0 && <span className="approval-pending-badge"><Clock size={14} /> {pendingCount} pending</span>}
          <button className="compact-button secondary" onClick={exportCsv} disabled={!approvals.length}><Download size={14} /> Extract data</button>
        </div>
      </header>

      <div className="approval-toolbar">
        <label className="approval-search"><Search size={15} /><input aria-label="Search approvals" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${viewLabel.toLowerCase()}…`} /></label>
        <label className="approval-filter-select"><SlidersHorizontal size={14} /><select value={statusFilter} aria-label="Filter by status" onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option><option>Delegated</option></select><ChevronDown size={13} /></label>
        <label className="approval-filter-select"><SlidersHorizontal size={14} /><select value={typeFilter} aria-label="Filter by type" onChange={(event) => setTypeFilter(event.target.value)}><option value="All">All types</option>{APPROVAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select><ChevronDown size={13} /></label>
        <span className="approval-count">{approvals.length} record{approvals.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="approval-table-wrap">
        <table className="approval-table">
          <thead>
            <tr>
              <th>Approval ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>{view === 'mine' ? 'Requested by' : 'Direction'}</th>
              {view === 'delegated' && <th>Counterpart</th>}
              <th>Due by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.id}>
                <td><button className="approval-id-link" onClick={() => setSelected(approval)}>{approval.id}</button></td>
                <td><span className="approval-title" title={approval.title}>{approval.title}</span></td>
                <td><span className="approval-type-tag">{approval.type}</span></td>
                <td><span className={`approval-priority ${priorityClass(approval.priority)}`}>{approval.priority}</span></td>
                <td><span className={`approval-badge ${statusClass(approval.status)}`}>{approval.status}</span></td>
                <td>{view === 'mine' ? approval.requestedBy : (
                  (approval.assignedTo === currentUser.name || users.find((u) => u.name === approval.assignedTo)?.email === currentUser.email)
                    ? <span className="delegation-direction by-me">By me →</span>
                    : <span className="delegation-direction to-me">← To me</span>
                )}</td>
                {view === 'delegated' && <td>{(approval.assignedTo === currentUser.name || users.find((u) => u.name === approval.assignedTo)?.email === currentUser.email) ? approval.delegatedTo : approval.assignedTo}</td>}
                <td>{formatDate(approval.dueBy)}</td>
                <td>
                  <div className="row-actions">
                    <button className="action-btn" title="View approval" onClick={() => setSelected(approval)}><Eye size={15} /></button>
                    {approval.status === 'Pending' && (
                      <>
                        <button className="action-btn approve" title="Approve" onClick={() => alert(`Approved: ${approval.id}`)}><CheckCircle2 size={15} /></button>
                        <button className="action-btn delete" title="Reject" onClick={() => alert(`Rejected: ${approval.id}`)}><XCircle size={15} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!approvals.length && (
              <tr><td colSpan="8" className="empty-row">No approvals match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ApprovalDetail({ approval, currentUser, onClose }) {
  return (
    <section className="approval-detail-page">
      <header className="customer-detail-header">
        <button className="compact-button secondary" onClick={onClose}><ArrowLeft size={15} /> Back</button>
        <h1>{approval.id}</h1>
        <span className={`approval-badge ${statusClass(approval.status)}`}>{approval.status}</span>
      </header>

      <div className="approval-detail-body">
        <section className="approval-detail-section">
          <h3>Request details</h3>
          <div className="customer-detail-grid">
            <div className="detail-field"><span className="detail-label">Approval ID</span><span className="detail-value">{approval.id}</span></div>
            <div className="detail-field"><span className="detail-label">Reference</span><span className="detail-value">{approval.ref}</span></div>
            <div className="detail-field" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Title</span><span className="detail-value">{approval.title}</span></div>
            <div className="detail-field"><span className="detail-label">Type</span><span className="detail-value">{approval.type}</span></div>
            <div className="detail-field"><span className="detail-label">Priority</span><span className={`detail-value approval-priority ${priorityClass(approval.priority)}`}>{approval.priority}</span></div>
            <div className="detail-field"><span className="detail-label">Status</span><span className={`detail-value approval-badge ${statusClass(approval.status)}`}>{approval.status}</span></div>
          </div>
        </section>

        <section className="approval-detail-section">
          <h3>Assignment</h3>
          <div className="customer-detail-grid">
            <div className="detail-field"><span className="detail-label">Requested by</span><span className="detail-value">{approval.requestedBy}</span></div>
            <div className="detail-field"><span className="detail-label">Assigned to</span><span className="detail-value">{approval.assignedTo}</span></div>
            {approval.delegatedTo && <div className="detail-field"><span className="detail-label">Delegated to</span><span className="detail-value">{approval.delegatedTo}</span></div>}
            <div className="detail-field"><span className="detail-label">Requested on</span><span className="detail-value">{formatDate(approval.requestedOn)}</span></div>
            <div className="detail-field"><span className="detail-label">Due by</span><span className="detail-value">{formatDate(approval.dueBy)}</span></div>
          </div>
        </section>

        {approval.remarks && (
          <section className="approval-detail-section">
            <h3>Remarks</h3>
            <p className="approval-remarks">{approval.remarks}</p>
          </section>
        )}

        {approval.status === 'Pending' && (
          <section className="approval-detail-section approval-actions-section">
            <h3>Actions</h3>
            <div className="approval-action-buttons">
              <button className="compact-button primary" onClick={() => alert(`Approved: ${approval.id}`)}><CheckCircle2 size={15} /> Approve</button>
              <button className="compact-button secondary danger" onClick={() => alert(`Rejected: ${approval.id}`)}><XCircle size={15} /> Reject</button>
              <button className="compact-button secondary" onClick={() => alert(`Delegated: ${approval.id}`)}><GitBranch size={15} /> Delegate</button>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
