import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, GripVertical, LayoutDashboard, Plus, Table2, TrendingUp, X } from 'lucide-react'
import GridLayout, { WidthProvider } from 'react-grid-layout'
import { createReportRows, runReportDefinition } from '../data/reportEngine'

const ReactGridLayout = WidthProvider(GridLayout)
const palette = ['#2563eb', '#0891b2', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6366f1', '#0d9488', '#ca8a04', '#be185d']

export default function OverviewPage({ user, reports, layout, data, selectedCustomer, onAddReport, onLayoutChange, onRemoveReport, onNavigate, onOpenReport, onOpenIncidents }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const rowsBySource = useMemo(() => {
    const rows = createReportRows(data)
    if (!selectedCustomer || selectedCustomer === 'All customers') return rows
    return Object.fromEntries(Object.entries(rows).map(([source, sourceRows]) => {
      const customerField = sourceRows.some((row) => Object.hasOwn(row, 'Customer')) ? 'Customer' : sourceRows.some((row) => Object.hasOwn(row, 'Customer name')) ? 'Customer name' : null
      return [source, customerField ? sourceRows.filter((row) => row[customerField] === selectedCustomer) : sourceRows]
    }))
  }, [data, selectedCustomer])
  const dashboardReports = layout.map((item) => reports.find((report) => report.id === item.i)).filter(Boolean)
  const availableReports = reports.filter((report) => !layout.some((item) => item.i === report.id) && (report.createdBy === user.email || report.sharedWith?.includes(user.role) || report.sharedWith?.includes(user.name)))

  const incidents = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'All customers') return data.incidents
    return data.incidents.filter((i) => i.customer === selectedCustomer)
  }, [data.incidents, selectedCustomer])
  const filteredContracts = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'All customers') return data.contracts
    return data.contracts.filter((c) => c.customer === selectedCustomer)
  }, [data.contracts, selectedCustomer])

  const totalIncidents = incidents.length
  const openIncidents = incidents.filter((i) => i.state !== 'Resolved' && i.state !== 'Closed').length
  const criticalIncidents = incidents.filter((i) => i.priority === 'Critical (AOG)').length
  const resolvedThisWeek = incidents.filter((i) => (i.state === 'Resolved' || i.state === 'Closed') && new Date(i.opened) > new Date(Date.now() - 7 * 86400000)).length

  return <section className="custom-dashboard">
    <header className="dashboard-header">
      <div><h1>Dashboard</h1>{selectedCustomer !== 'All customers' && <span className="dash-filter-badge">{selectedCustomer}</span>}</div>
      <div className="dashboard-actions">
        <button className="compact-button secondary" onClick={() => onNavigate('Reporting')}><BarChart3 size={14} /> Reports</button>
        <button className="compact-button primary" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add tile</button>
      </div>
    </header>

    <div className="dash-kpi-strip">
      <article role="button" tabIndex={0} onClick={() => onOpenIncidents({})} title="View all incidents"><span className="dash-kpi-icon total"><Activity size={16} /></span><div><strong>{totalIncidents}</strong><small>Total incidents</small></div></article>
      <article role="button" tabIndex={0} onClick={() => onOpenIncidents({ scope: 'Open' })} title="View open incidents"><span className="dash-kpi-icon open"><Clock size={16} /></span><div><strong>{openIncidents}</strong><small>Open</small></div></article>
      <article role="button" tabIndex={0} className={criticalIncidents ? 'alert' : ''} onClick={() => onOpenIncidents({ priorityFilter: 'Critical (AOG)' })} title="View critical incidents"><span className="dash-kpi-icon critical"><AlertTriangle size={16} /></span><div><strong>{criticalIncidents}</strong><small>Critical (AOG)</small></div></article>
      <article role="button" tabIndex={0} onClick={() => onOpenIncidents({ stateFilter: 'Resolved' })} title="View resolved incidents"><span className="dash-kpi-icon resolved"><CheckCircle2 size={16} /></span><div><strong>{resolvedThisWeek}</strong><small>Resolved (7d)</small></div></article>
      <article role="button" tabIndex={0} onClick={() => onNavigate('Contracts')} title="View active contracts"><span className="dash-kpi-icon trend"><TrendingUp size={16} /></span><div><strong>{filteredContracts.filter((c) => c.status === 'Active').length}</strong><small>Active contracts</small></div></article>
    </div>

    {!dashboardReports.length ? <div className="dashboard-empty">
      <span><LayoutDashboard size={22} /></span>
      <h2>Add report tiles</h2>
      <p>Pin reports from the Reporting module to build your operational view.</p>
      <button className="compact-button primary" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add tile</button>
    </div> : <div className="dashboard-grid-wrap">
      <ReactGridLayout layout={layout} cols={12} rowHeight={56} margin={[10, 10]} containerPadding={[0, 0]} draggableHandle=".dashboard-tile-handle" isResizable resizeHandles={['se']} onLayoutChange={onLayoutChange}>
        {dashboardReports.map((report) => { const result = runReportDefinition(report, rowsBySource); return <div key={report.id} className="dashboard-report-tile">
          <header>
            <button className="dashboard-tile-handle" aria-label={`Move ${report.name}`} title="Drag to move"><GripVertical size={14} /></button>
            <div><h2 className="dash-tile-title" onClick={() => onOpenReport(report.id)} title={`Open ${report.name}`}>{report.name}</h2></div>
            <b className="dash-tile-count">{result.rows.length}</b>
            <div className="dashboard-tile-actions">
              <button className="icon-button subtle dash-drill-btn" onClick={() => onOpenReport(report.id)} aria-label={`Open ${report.name}`} title="Open full report"><ExternalLink size={13} /></button>
              <button className="icon-button subtle" onClick={() => onRemoveReport(report.id)} aria-label={`Remove ${report.name}`} title="Remove"><X size={14} /></button>
            </div>
          </header>
          <DashboardReport report={report} result={result} onOpen={() => onOpenReport(report.id)} />
        </div> })}
      </ReactGridLayout>
    </div>}

    {pickerOpen && <div className="report-dialog-backdrop"><section className="dashboard-picker" role="dialog" aria-modal="true" aria-label="Add reports to dashboard"><header><div><h2>Add a report</h2><p>Your reports and reports shared with you</p></div><button className="icon-button subtle" onClick={() => setPickerOpen(false)} aria-label="Close"><X size={17} /></button></header><div className="dashboard-picker-list">{availableReports.map((report) => <button key={report.id} onClick={() => { onAddReport(report.id); setPickerOpen(false) }}><span><BarChart3 size={17} /></span><div><strong>{report.name}</strong><small>{report.source} · {report.createdBy === user.email ? 'Created by you' : `Shared with ${report.sharedWith.join(', ')}`}</small></div><Plus size={16} /></button>)}{!availableReports.length && <div className="dashboard-picker-empty"><Table2 size={22} /><strong>No reports available</strong><p>Save a report in Reporting or ask a colleague to share one with you.</p><button className="compact-button primary" onClick={() => { setPickerOpen(false); onNavigate('Reporting') }}>Open reporting</button></div>}</div></section></div>}
  </section>
}

function DashboardReport({ report, result, onOpen }) {
  const { rows, groups } = result
  const fields = report.selectedFields?.length ? report.selectedFields : report.fields || Object.keys(rows[0] || {}).slice(0, 5)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8
  if (report.visualization === 'table') {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    const from = rows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
    const to = Math.min(safePage * PAGE_SIZE, rows.length)
    return <div className="dashboard-report-table">
      <div className="dashboard-table-scroll dash-clickable" onClick={onOpen}><table><thead><tr>{fields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{pageRows.map((row, index) => <tr key={row.Number || row[fields[0]] || index} className="dash-drill-row">{fields.map((field) => <td key={field}>{row[field] ?? '--'}</td>)}</tr>)}{!rows.length && <tr><td colSpan={fields.length} style={{ textAlign:'center', color:'#94a3b8', padding:'20px 0' }}>No matching records.</td></tr>}</tbody></table></div>
      {rows.length > PAGE_SIZE && <div className="dash-table-pagination"><span>{from}–{to} of {rows.length}</span><div><button onClick={(e) => { e.stopPropagation(); setPage((p) => Math.max(1, p - 1)) }} disabled={safePage === 1} aria-label="Previous page"><ChevronLeft size={12} /></button><span>{safePage}/{totalPages}</span><button onClick={(e) => { e.stopPropagation(); setPage((p) => Math.min(totalPages, p + 1)) }} disabled={safePage === totalPages} aria-label="Next page"><ChevronRight size={12} /></button></div></div>}
    </div>
  }
  const visibleGroups = groups.slice(0, 20)
  const maximum = Math.max(1, ...visibleGroups.map((group) => group.value))
  if (!groups.length) return <div className="dashboard-report-empty dash-clickable" onClick={onOpen}><BarChart3 size={18} /><p>No data – click to open report</p></div>
  return <div className="dashboard-mini-chart dash-clickable" onClick={onOpen}><div className="dashboard-bars">{visibleGroups.map(({ label, value }, index) => <div key={label} title={`${label}: ${value}`}><small title={label}>{label}</small><span><i style={{ width: `${value / maximum * 100}%`, background: palette[index % palette.length] }} /></span><b>{value}</b></div>)}</div></div>
}
