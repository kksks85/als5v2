import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, Download, Eye, GitBranch, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

const APPROVAL_TYPES = ['Document release', 'Change request', 'Service waiver', 'Contract amendment', 'Incident closure', 'Asset write-off', 'Pre-dispatch group approval', 'Material Replacement Approval']
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

const incidentGroupApprovals = (incidents) => incidents.flatMap((incident) => {
  const approval = incident.groupApproval
  if (!approval?.members?.length) return []
  const isMaterialReplacement = approval.approvalType === 'replacement-parts'
  const approvalType = isMaterialReplacement ? 'Material Replacement Approval' : 'Pre-dispatch group approval'
  return approval.members.map((member, index) => ({
    id: `${approval.id}-${member.name}`,
    displayId: `APR-${String(approval.id).slice(-6)}${String(index + 1).padStart(2, '0')}`,
    ref: incident.id,
    title: `${isMaterialReplacement ? 'Material replacement approval' : 'Pre-dispatch approval'}: ${incident.title || incident.id}`,
    type: approvalType,
    priority: incident.priority || 'Normal',
    status: member.status,
    requestedBy: approval.requestedBy || 'System',
    assignedTo: member.name,
    assignedToEmail: '',
    assignmentGroup: approval.assignmentGroup || incident.assignmentGroup || incident.group || '--',
    requestedOn: approval.requestedAt,
    dueBy: approval.dueBy || '',
    remarks: approval.status === 'Approved' ? `Approved by ${approval.approvedBy}.` : '',
    resolutionDetails: incident.resolutionDetails || '',
    incidentId: incident.id,
    groupApproval: true,
  }))
})

const approvalDisplayId = (approval) => approval.displayId || approval.id

const statusClass = (status) => ({ Pending: 'approval-badge-pending', Approved: 'approval-badge-approved', Rejected: 'approval-badge-rejected', Delegated: 'approval-badge-delegated' }[status] || '')
const priorityClass = (priority) => ({ Critical: 'priority-critical', High: 'priority-high', Normal: 'priority-normal', Low: 'priority-low' }[priority] || '')

export default function ApprovalCenterPage({ currentUser, view, users = [], incidents = [], contracts = [], knowledgeDocuments = [], onResolveGroupApproval, onOpenIncident }) {
  const allApprovals = useMemo(() => [...incidentGroupApprovals(incidents), ...seedApprovals(currentUser, users, incidents, contracts, knowledgeDocuments)], [currentUser, users, incidents, contracts, knowledgeDocuments])
  const [selected, setSelected] = useState(null)
  const [decisionRequest, setDecisionRequest] = useState(null)
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
    const headers = ['Approval ID', 'Incident ID', 'Approval type', 'Requested by', 'Assignment group', 'Approval status', 'Requested on']
    const rows = approvals.map((approval) => [approvalDisplayId(approval), approval.ref, approval.type, approval.requestedBy, approval.assignmentGroup || approval.assignedTo, approval.status, formatDate(approval.requestedOn)])
    const content = [headers, ...rows].map((row) => row.map(csv).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    link.download = `approvals-${view}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const requestDecision = (approval, decision) => setDecisionRequest({ approval, decision })
  const submitDecision = async (reason) => {
    if (decisionRequest.approval.groupApproval) await onResolveGroupApproval?.(decisionRequest.approval.incidentId, decisionRequest.decision, reason)
    else alert(`${decisionRequest.decision}: ${decisionRequest.approval.id}\nReason: ${reason}`)
    setDecisionRequest(null)
    setSelected(null)
  }

  if (selected) return <ApprovalDetail approval={selected} currentUser={currentUser} onClose={() => setSelected(null)} onRequestDecision={requestDecision} onOpenIncident={onOpenIncident} decisionRequest={decisionRequest} onCloseDecision={() => setDecisionRequest(null)} onSubmitDecision={submitDecision} />

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
              <th>Incident ID</th>
              <th>Approval type</th>
              <th>Requested by</th>
              <th>Assignment group</th>
              <th>Approval status</th>
              <th>Requested on</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.id}>
                <td><button className="approval-id-link" onClick={() => setSelected(approval)}>{approvalDisplayId(approval)}</button></td>
                <td>{approval.ref}</td>
                <td><span className="approval-type-tag">{approval.type}</span></td>
                <td>{approval.requestedBy}</td>
                <td>{approval.assignmentGroup || approval.assignedTo}</td>
                <td><span className={`approval-badge ${statusClass(approval.status)}`}>{approval.status}</span></td>
                <td>{formatDate(approval.requestedOn)}</td>
                <td>
                  <div className="row-actions">
                    <button className="action-btn" title="View approval" onClick={() => setSelected(approval)}><Eye size={15} /></button>
                    {approval.status === 'Pending' && (
                      <>
                        <button className="action-btn approve" title="Approve" onClick={() => requestDecision(approval, 'Approved')}><CheckCircle2 size={15} /></button>
                        <button className="action-btn delete" title="Reject" onClick={() => requestDecision(approval, 'Rejected')}><XCircle size={15} /></button>
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
      {decisionRequest && <ApprovalDecisionDialog decision={decisionRequest.decision} onClose={() => setDecisionRequest(null)} onSubmit={submitDecision} />}
    </section>
  )
}

function ApprovalDetail({ approval, currentUser, onClose, onRequestDecision, onOpenIncident, decisionRequest, onCloseDecision, onSubmitDecision }) {
  const canAct = approval.status === 'Pending'
  return (
    <section className="approval-detail-page">
      <header className="approval-detail-hero">
        <button className="approval-back-button" onClick={onClose} aria-label="Back to approvals" title="Back to approvals"><ArrowLeft size={16} /></button>
        <div className="approval-detail-heading">
          <p>Approval request</p>
          <h1>{approval.title}</h1>
          <div><span>{approvalDisplayId(approval)}</span><b>{approval.ref}</b></div>
        </div>
        <div className="approval-detail-state"><span className={`approval-badge ${statusClass(approval.status)}`}>{approval.status}</span>{canAct && <small>Decision required</small>}</div>
      </header>

      <div className="approval-detail-layout">
        <main className="approval-detail-main">
          <section className="approval-detail-section approval-request-section">
            <header><h2>Request</h2><span className="approval-type-tag">{approval.type}</span></header>
            <dl className="approval-metadata-grid">
              <div><dt>Incident ID</dt><dd><button type="button" className="approval-incident-link" onClick={() => onOpenIncident?.(approval.incidentId || approval.ref)}>{approval.ref}</button></dd></div>
              <div><dt>Priority</dt><dd><span className={`approval-priority ${priorityClass(approval.priority)}`}>{approval.priority}</span></dd></div>
              <div><dt>Requested by</dt><dd>{approval.requestedBy}</dd></div>
              <div><dt>Requested on</dt><dd>{formatDate(approval.requestedOn)}</dd></div>
            </dl>
          </section>
          <section className="approval-detail-section approval-resolution-section">
            <header><h2>Resolution details</h2><span>Read only</span></header>
            <textarea aria-label="Resolution details" value={approval.resolutionDetails || ''} readOnly placeholder="No resolution notes have been recorded for this incident." />
          </section>
          {approval.remarks && <section className="approval-detail-section approval-remarks-section"><header><h2>Remarks</h2></header><p className="approval-remarks">{approval.remarks}</p></section>}
        </main>
        <aside className="approval-detail-sidebar">
          <section className="approval-detail-section approval-assignment-section">
            <header><h2>Assignment</h2></header>
            <dl className="approval-assignment-list">
              <div><dt>Assignment group</dt><dd>{approval.assignmentGroup || '--'}</dd></div>
              <div><dt>Assigned to</dt><dd>{approval.assignedTo}</dd></div>
              {approval.delegatedTo && <div><dt>Delegated to</dt><dd>{approval.delegatedTo}</dd></div>}
              <div><dt>Due by</dt><dd>{formatDate(approval.dueBy)}</dd></div>
            </dl>
          </section>
          {canAct && <section className="approval-decision-panel">
            <div><h2>Decision</h2><p>Approving this group request closes the remaining pending member approvals.</p></div>
            <div className="approval-action-buttons">
              <button className="compact-button primary" onClick={() => onRequestDecision(approval, 'Approved')}><CheckCircle2 size={15} /> Approve</button>
              <button className="compact-button secondary danger" onClick={() => onRequestDecision(approval, 'Rejected')}><XCircle size={15} /> Reject</button>
            </div>
          </section>}
        </aside>
      </div>
      {decisionRequest && <ApprovalDecisionDialog decision={decisionRequest.decision} onClose={onCloseDecision} onSubmit={onSubmitDecision} />}
    </section>
  )
}

function ApprovalDecisionDialog({ decision, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const action = decision.toLowerCase()
  const commentLabel = decision === 'Approved' ? 'Approval comments' : 'Rejection comments'
  return <div className="stage-confirmation-backdrop"><section className="stage-confirmation-dialog" role="dialog" aria-modal="true" aria-label={commentLabel}><h2>{commentLabel}</h2><p>Enter comments for this decision. They will be recorded in the incident journal.</p><label className="approval-decision-reason"><span>{commentLabel}</span><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder={`Why is this approval being ${action}?`} rows="4" /></label><footer><button type="button" className="incident-cancel-button" onClick={onClose}>Cancel</button><button type="button" className={decision === 'Approved' ? 'incident-next-stage-button' : 'compact-button secondary danger'} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>{decision}</button></footer></section></div>
}
