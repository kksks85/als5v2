export default function LifecycleAudit({ detail }) {
  if (!detail) return <div className="component-empty-state">Loading component lifecycle history...</div>
  const { component, movements = [], repairs = [] } = detail
  return <section className="asset-detail-components">
    <div className="asset-component-groups">
      <section className="component-route-card">
        <header className="component-group-toggle route-card"><span>{component.serial_number} lifecycle</span><b>{component.lifecycle_status.replaceAll('_', ' ')}</b></header>
        <div className="component-record-table"><table><thead><tr><th>When</th><th>Movement</th><th>Location</th><th>Reason</th><th>Performed by</th></tr></thead><tbody>{movements.map((movement, index) => <tr key={`${movement.moved_at}-${index}`}><td>{new Date(movement.moved_at).toLocaleString('en-GB')}</td><td>{movement.from_status || 'received'} to {movement.to_status}</td><td>{movement.to_location || '--'}</td><td>{movement.reason}</td><td>{movement.performed_by}</td></tr>)}{!movements.length && <tr><td colSpan="5" className="empty-row">No component movement history has been recorded.</td></tr>}</tbody></table></div>
      </section>
      {repairs.map((repair) => <section className="component-route-card" key={repair.id}><header className="component-group-toggle route-card"><span>Repair {repair.incident_record_id}</span><b>{repair.repair_status.replaceAll('_', ' ')}</b></header><div className="component-record-table"><table><tbody><tr><th>Failure</th><td>{repair.failure_description}</td></tr><tr><th>Diagnosis</th><td>{repair.technician_diagnosis || '--'}</td></tr><tr><th>Outcome</th><td>{repair.repair_outcome || repair.final_disposition || '--'}</td></tr></tbody></table></div></section>)}
    </div>
  </section>
}
