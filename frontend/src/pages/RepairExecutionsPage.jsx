import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

const emptyExecution = { id: '', name: '', active: true }
const columns = [
  { key: 'id', label: 'ID', width: 100 },
  { key: 'name', label: 'Repair execution', width: 520 },
  { key: 'status', label: 'Status', width: 140 },
]

export default function RepairExecutionsPage({ repairExecutions, setRepairExecutions }) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const filtered = useMemo(() => repairExecutions.filter((execution) => !search || execution.name.toLowerCase().includes(search.toLowerCase())), [repairExecutions, search])

  const save = (event) => {
    event.preventDefault()
    const name = editing.name.trim()
    if (!name) return
    setRepairExecutions((current) => {
      const duplicate = current.some((execution) => execution.id !== editing.id && execution.name.toLowerCase() === name.toLowerCase())
      if (duplicate) return current
      return editing.id
        ? current.map((execution) => execution.id === editing.id ? { ...editing, name } : execution)
        : [...current, { id: Math.max(0, ...current.map((execution) => execution.id)) + 1, name, active: true }]
    })
    setEditing(null)
  }

  if (editing) return <form className="customer-form-page" onSubmit={save}>
    <header className="customer-form-header"><div><button type="button" className="customer-back-button" onClick={() => setEditing(null)}>Repair execution</button><h1>{editing.id ? 'Edit repair execution' : 'New repair execution'}</h1></div><div className="customer-form-actions"><button type="button" className="customer-cancel-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></div></header>
    <section className="customer-form-sheet"><section className="customer-form-section"><h2>Repair execution</h2><div className="customer-form-grid"><label className="customer-field"><span>Execution name</span><input autoFocus value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} placeholder="Enter repair execution" /></label><label className="customer-field"><span>Status</span><select value={editing.active ? 'Active' : 'Inactive'} onChange={(event) => setEditing((current) => ({ ...current, active: event.target.value === 'Active' }))}><option>Active</option><option>Inactive</option></select></label></div></section></section>
    <footer className="customer-form-footer"><button type="button" className="customer-cancel-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></footer>
  </form>

  return <section className="customer-list-page" aria-label="Repair execution">
    <div className="customer-list-head"><div className="customer-list-title"><h1>Repair Execution</h1></div><button className="customer-create-button" onClick={() => setEditing(emptyExecution)}><Plus size={15} /> New repair execution</button></div>
    <div className="customer-command-bar"><div className="customer-search"><Search size={15} /><input aria-label="Search repair executions" placeholder="Search repair executions..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="customer-list-count">{filtered.length ? `${filtered.length} execution${filtered.length === 1 ? '' : 's'}` : '0 results'}</span></div>
    <div className="customer-table-frame"><div className="customer-table-scroll"><table className="customer-table"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 108 }} /></colgroup><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map((execution) => <tr key={execution.id}><td>{execution.id}</td><td>{execution.name}</td><td><span className={`badge ${execution.active ? 'active' : 'inactive'}`}>{execution.active ? 'Active' : 'Inactive'}</span></td><td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="Edit repair execution" onClick={() => setEditing(execution)}>Edit</button><button className="action-btn delete" title="Delete repair execution" onClick={() => setRepairExecutions((current) => current.filter((item) => item.id !== execution.id))}><Trash2 size={15} /></button></div></td></tr>)}{!filtered.length && <tr><td colSpan="4" className="empty-row">No repair executions match the current search.</td></tr>}</tbody></table></div></div>
    <footer className="customer-pagination"><span>Total: {repairExecutions.length} execution{repairExecutions.length === 1 ? '' : 's'}</span></footer>
  </section>
}
