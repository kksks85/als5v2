import { useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { recordApi } from '../data/api'

const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'

export default function DamagedExpiredComponentsPage({ onBack }) {
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      setRecords((await recordApi.list('damaged_expired_components')).map(({ record_id, payload }) => ({ id: record_id, ...payload })))
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])
  const visibleRecords = records.filter((record) => Object.values(record).some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))

  return <section className="incident-list-page product-register-page">
    <header className="incident-list-head product-master-heading"><div className="incident-list-title"><button className="incident-back-button" onClick={onBack}>Product Master - MRLS</button><h1>Damaged/Expired Components</h1><p>Serialized components classified beyond economical repair, scrapped, or expired.</p></div><button className="compact-button secondary" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh</button></header>
    <div className="incident-command-bar product-command-bar"><div className="incident-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial, component, incident, or replacement..." /></div><span className="incident-list-count">{visibleRecords.length} record{visibleRecords.length === 1 ? '' : 's'}</span></div>
    {error && <div className="report-notice error">{error}</div>}
    <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table product-register-table"><thead><tr><th>Removed serial</th><th>Component</th><th>Customer / contract</th><th>BER reason</th><th>Repair incident</th><th>MRLS replacement serial</th><th>Decision</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="empty-row">Loading damaged and expired components...</td></tr> : visibleRecords.map((record) => <tr key={record.id || record.material_serial_number}><td><strong>{record.material_serial_number || '--'}</strong></td><td>{record.material_description || '--'}<br /><span className="table-empty">{record.part_number || '--'}</span></td><td>{record.customer || '--'}<br /><span className="table-empty">{record.contract_number || '--'}</span></td><td>{record.ber_reason || '--'}</td><td>{record.repair_incident_id || '--'}<br /><span className="table-empty">Original: {record.original_incident_id || '--'}</span></td><td><strong>{record.replacement_component_serial || '--'}</strong></td><td>{formatDateTime(record.ber_decided_at)}<br /><span className="table-empty">{record.ber_decided_by || '--'}</span></td></tr>)}{!loading && !visibleRecords.length && <tr><td colSpan="7" className="empty-row">No damaged or expired components have been recorded.</td></tr>}</tbody></table></div></div>
  </section>
}
