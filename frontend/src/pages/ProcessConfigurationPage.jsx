import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Edit2, Eye, Plus, Search, Trash2, X } from 'lucide-react'
import { defaultStageInstruction } from '../data/processConfiguration'

const emptyProcess = { repairExecution: '', status: '', assignmentGroup: '', order: '', instruction: '' }
const columns = [
  { key: 'id', label: 'ID', width: 80, minWidth: 70 },
  { key: 'repairExecution', label: 'Repair Execution', width: 240, minWidth: 180 },
  { key: 'status', label: 'Status', width: 320, minWidth: 220 },
  { key: 'assignmentGroup', label: 'Assignment Group', width: 240, minWidth: 180 },
  { key: 'order', label: 'Order', width: 110, minWidth: 90 },
  { key: 'actions', label: 'Actions', width: 120, minWidth: 110 },
]

export default function ProcessConfigurationPage({ assignmentGroups, repairExecutions, processes, setProcesses }) {
  const [search, setSearch] = useState('')
  const [editingProcess, setEditingProcess] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [viewProcess, setViewProcess] = useState(null)
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map(({ key, width }) => [key, width])))
  const [sorted, setSorted] = useState({ key: 'id', direction: 'asc' })

  const assignmentGroupOptions = assignmentGroups.filter((group) => group.active).map((group) => group.name)
  const repairExecutionOptions = repairExecutions.filter((execution) => execution.active).map((execution) => execution.name)
  const filteredProcesses = useMemo(() => processes
    .filter((process) => !search || [process.id, process.repairExecution, process.status, process.assignmentGroup, process.order].some((value) => String(value).toLowerCase().includes(search.toLowerCase())))
    .sort((left, right) => {
      const comparison = String(left[sorted.key] ?? '').localeCompare(String(right[sorted.key] ?? ''), undefined, { numeric: true })
      return sorted.direction === 'asc' ? comparison : -comparison
    }), [processes, search, sorted])

  const sortBy = (key) => setSorted((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  const startColumnResize = (event, column) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = columnWidths[column.key]
    const resizeColumn = (moveEvent) => setColumnWidths((current) => ({ ...current, [column.key]: Math.max(column.minWidth, startWidth + moveEvent.clientX - startX) }))
    const stopResize = () => { document.removeEventListener('mousemove', resizeColumn); document.removeEventListener('mouseup', stopResize) }
    document.addEventListener('mousemove', resizeColumn)
    document.addEventListener('mouseup', stopResize)
  }

  const saveProcess = (process) => {
    if (editingProcess) {
      setProcesses((current) => current.map((item) => item.id === editingProcess.id ? { ...process, id: item.id } : item))
    } else {
      setProcesses((current) => [...current, { ...process, id: Math.max(...current.map((item) => item.id), 0) + 1 }])
    }
    setEditingProcess(null)
    setShowForm(false)
  }

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const data = [['ID', 'Repair Execution', 'Status', 'Assignment Group', 'Order'].map(csv), ...filteredProcesses.map((p) => [p.id, p.repairExecution, p.status, p.assignmentGroup, p.order].map(csv))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'process-configuration.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (showForm || editingProcess) return <ProcessForm process={editingProcess} assignmentGroupOptions={assignmentGroupOptions} repairExecutionOptions={repairExecutionOptions} onCancel={() => { setShowForm(false); setEditingProcess(null) }} onSubmit={saveProcess} />
  if (viewProcess) return <section className="customer-detail-page"><header className="customer-detail-header"><div><button type="button" className="customer-back-button" onClick={() => setViewProcess(null)}><ArrowLeft size={15} /> Process configuration</button><h1>{viewProcess.status}</h1><p className="customer-detail-subtitle">{viewProcess.repairExecution}</p></div><div className="customer-detail-actions"><button type="button" className="customer-cancel-button" onClick={() => setViewProcess(null)}>Close</button><button type="button" className="customer-edit-button" onClick={() => { setEditingProcess(viewProcess); setViewProcess(null) }}><Edit2 size={15} /> Edit</button></div></header><section className="customer-detail-sheet"><section className="detail-section"><h2>Process details</h2><div className="detail-grid"><div className="detail-field"><span className="detail-label">ID</span><span className="detail-value">{viewProcess.id}</span></div><div className="detail-field"><span className="detail-label">Repair execution</span><span className="detail-value">{viewProcess.repairExecution}</span></div><div className="detail-field"><span className="detail-label">Status</span><span className="detail-value">{viewProcess.status}</span></div><div className="detail-field"><span className="detail-label">Assignment group</span><span className="detail-value">{viewProcess.assignmentGroup}</span></div><div className="detail-field"><span className="detail-label">Order</span><span className="detail-value">{viewProcess.order}</span></div></div></section><section className="detail-section"><h2>Stage instruction</h2><p className="process-instruction-preview">{viewProcess.instruction || defaultStageInstruction(viewProcess.status)}</p></section></section></section>

  return <section className="customer-list-page process-list-page" aria-label="Process configuration">
    <div className="customer-list-head"><div className="customer-list-title"><h1>Process configuration</h1></div><div className="user-list-actions"><button className="compact-button secondary" onClick={exportCsv} disabled={!filteredProcesses.length}><Download size={15} /> Extract data</button><button className="customer-create-button" onClick={() => setShowForm(true)}><Plus size={15} /> New process</button></div></div>
    <div className="customer-command-bar"><div className="customer-search"><Search size={15} /><input aria-label="Search processes" placeholder="Search processes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="customer-list-count">{filteredProcesses.length ? `${filteredProcesses.length} process${filteredProcesses.length === 1 ? '' : 'es'}` : '0 results'}</span></div>
    <div className="customer-table-frame"><div className="customer-table-scroll"><table className="customer-table"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}</colgroup><thead><tr>{columns.map((column) => <th key={column.key} className={column.key === 'actions' ? '' : `sortable ${sorted.key === column.key ? `sorted-${sorted.direction}` : ''}`} onClick={column.key === 'actions' ? undefined : () => sortBy(column.key)}>{column.label}{column.key !== 'actions' && <button className="column-resize-handle" aria-label={`Resize ${column.label} column`} onMouseDown={(event) => { event.stopPropagation(); startColumnResize(event, column) }} />}</th>)}</tr></thead><tbody>{filteredProcesses.map((process) => <tr key={process.id}><td>{process.id}</td><td>{process.repairExecution}</td><td>{process.status}</td><td>{process.assignmentGroup}</td><td className="numeric">{process.order}</td><td className="action-buttons"><button className="icon-button" title="View" onClick={() => setViewProcess(process)}><Eye size={14} /></button><button className="icon-button" title="Edit" onClick={() => setEditingProcess(process)}><Edit2 size={14} /></button><button className="icon-button danger" title="Delete" onClick={() => setDeleteConfirm(process)}><Trash2 size={14} /></button></td></tr>)}{!filteredProcesses.length && <tr><td colSpan="6" className="empty-row">No processes match the search criteria.</td></tr>}</tbody></table></div></div>
    <footer className="customer-pagination"><span>Total: {processes.length} process{processes.length === 1 ? '' : 'es'}</span></footer>
    {deleteConfirm && <DeleteConfirmation process={deleteConfirm} onCancel={() => setDeleteConfirm(null)} onConfirm={() => { setProcesses((current) => current.filter((process) => process.id !== deleteConfirm.id)); setDeleteConfirm(null) }} />}
  </section>
}

function ProcessForm({ process, assignmentGroupOptions, repairExecutionOptions, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...emptyProcess, ...process, instruction: process?.instruction || defaultStageInstruction(process?.status || '') }))
  const [errors, setErrors] = useState({})
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(['repairExecution', 'status', 'order'].filter((key) => !String(form[key]).trim()).map((key) => [key, 'Required']))
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) onSubmit({ ...form, order: Number(form.order) })
  }

  return <form className="customer-form-page" onSubmit={submit}>
    <header className="customer-form-header"><div><button type="button" className="customer-back-button" onClick={onCancel}><X size={15} /> Process configuration</button><h1>{process ? 'Edit process' : 'New process'}</h1><p>Define the repair workflow sequence for each execution type.</p></div><div className="customer-form-actions"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></div></header>
    <section className="customer-form-sheet"><section className="customer-form-section"><h2>Process details</h2><p className="process-form-intro">Set the workflow, stage name, optional automatic assignment group, and sequence used by incident transitions.</p><div className="customer-form-grid"><label className={`customer-field ${errors.repairExecution ? 'has-error' : ''}`}><span>Repair execution {errors.repairExecution && <em>*</em>}</span><select value={form.repairExecution} onChange={(event) => update('repairExecution', event.target.value)}><option value="">Select repair execution</option>{repairExecutionOptions.map((repairExecution) => <option key={repairExecution}>{repairExecution}</option>)}</select>{errors.repairExecution && <small>{errors.repairExecution}</small>}</label><label className={`customer-field ${errors.status ? 'has-error' : ''}`}><span>Status {errors.status && <em>*</em>}</span><input value={form.status} onChange={(event) => update('status', event.target.value)} placeholder="e.g. Work in Progress" />{errors.status && <small>{errors.status}</small>}</label><label className="customer-field"><span>Assignment group</span><select value={form.assignmentGroup} onChange={(event) => update('assignmentGroup', event.target.value)}><option value="">Manual selection at transition</option>{assignmentGroupOptions.map((group) => <option key={group}>{group}</option>)}</select><small>When blank, the user must select an active Assignment Group before the stage transition can continue.</small></label><label className={`customer-field ${errors.order ? 'has-error' : ''}`}><span>Order {errors.order && <em>*</em>}</span><input type="number" min="1" value={form.order} onChange={(event) => update('order', event.target.value)} placeholder="Sequence number" />{errors.order && <small>{errors.order}</small>}</label></div></section><section className="customer-form-section process-instruction-section"><h2>Stage instruction</h2><p className="process-form-intro">This guidance is shown to users in the incident Process steps dialog for this stage.</p><label className="customer-field"><span>Instruction</span><textarea value={form.instruction} onChange={(event) => update('instruction', event.target.value)} placeholder="Describe the checks, actions, and evidence required before this stage is complete." rows="5" /></label></section></section>
    <footer className="customer-form-footer"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></footer>
  </form>
}

function DeleteConfirmation({ process, onConfirm, onCancel }) {
  return <div className="delete-confirmation-overlay"><div className="delete-confirmation-modal"><h2>Delete Process?</h2><p>Are you sure you want to delete <strong>{process.status}</strong>?</p><div className="delete-confirmation-actions"><button className="cancel-btn" onClick={onCancel}>Cancel</button><button className="delete-btn" onClick={onConfirm}>Delete</button></div></div></div>
}