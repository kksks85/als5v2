import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Bot, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, GripVertical, LayoutDashboard, Plus, Send, Sparkles, Table2, TrendingUp, X } from 'lucide-react'
import GridLayout, { WidthProvider } from 'react-grid-layout'
import { buildReportPromptGuide, createReportRows, getProductCategoryReportCatalog, parseReportPrompt, reportCatalog, runReportDefinition } from '../data/reportEngine'

const ReactGridLayout = WidthProvider(GridLayout)
const palette = ['#2563eb', '#0891b2', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6366f1', '#0d9488', '#ca8a04', '#be185d']

export default function OverviewPage({ user, reports, layout, data, selectedCustomer, onAddReport, onLayoutChange, onRemoveReport, onNavigate, onOpenReport, onOpenNlpReport, onOpenIncidents, onOpenRecords, onCreateIncident }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [nlpPanel, setNlpPanel] = useState(null)
  const dashboardUser = data.users?.find((member) => member.email === user.email) || user
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
  const criticalIncidents = incidents.filter((i) => i.priority === 'Critical').length
  const resolvedThisWeek = incidents.filter((i) => (i.state === 'Resolved' || i.state === 'Closed') && new Date(i.opened) > new Date(Date.now() - 7 * 86400000)).length

  return <section className="custom-dashboard">
    <header className="dashboard-header">
      <div><h1>Dashboard</h1>{selectedCustomer !== 'All customers' && <span className="dash-filter-badge">{selectedCustomer}</span>}</div>
      <div className="dashboard-actions">
        {onCreateIncident && <button className="compact-button primary" onClick={onCreateIncident}><Plus size={14} /> Create incident</button>}
        <button className="compact-button secondary" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add tile</button>
      </div>
    </header>

    <div className="dash-kpi-strip">
      <article role="button" tabIndex={0} onClick={() => onOpenIncidents({})} title="View all incidents"><span className="dash-kpi-icon total"><Activity size={16} /></span><div><strong>{totalIncidents}</strong><small>Total incidents</small></div></article>
      <article role="button" tabIndex={0} onClick={() => onOpenIncidents({ scope: 'Open' })} title="View open incidents"><span className="dash-kpi-icon open"><Clock size={16} /></span><div><strong>{openIncidents}</strong><small>Open</small></div></article>
      <article role="button" tabIndex={0} className={criticalIncidents ? 'alert' : ''} onClick={() => onOpenIncidents({ priorityFilter: 'Critical' })} title="View critical incidents"><span className="dash-kpi-icon critical"><AlertTriangle size={16} /></span><div><strong>{criticalIncidents}</strong><small>Critical</small></div></article>
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
          <DashboardReport report={report} result={report.visualization === 'personal-calendar' ? { rows: (data.calendarEvents || []).filter((event) => [event.createdByUserId, event.createdBy, event.createdByEmail].some((value) => String(value || '').toLowerCase() === String(dashboardUser.id || dashboardUser.name || dashboardUser.email).toLowerCase()) || String(event.createdBy || '').toLowerCase() === String(dashboardUser.name || '').toLowerCase()).map((event) => ({ Date: event.date || event.createdAt?.slice(0, 10) || '--', Note: event.note || '--', 'Created by': event.createdBy || '--', Attachments: String(event.attachments?.length || 0) })), groups: [] } : result} customers={data.customers} onOpen={() => onOpenReport(report.id)} onOpenGroup={(group) => onOpenRecords?.({
            source: report.source,
            label: group.label,
            recordIds: result.rows.filter((row) => Object.entries(group.values).every(([field, value]) => String(row[field] || 'Unspecified') === value)).map((row) => row.Number || row['Serial number']).filter(Boolean),
          })} />
        </div> })}
      </ReactGridLayout>
    </div>}

    <NlpReportingPanel user={user} rowsBySource={rowsBySource} productAssets={data.productAssets} onOpenReport={onOpenNlpReport} panelRef={setNlpPanel} />

    {pickerOpen && <div className="report-dialog-backdrop"><section className="dashboard-picker" role="dialog" aria-modal="true" aria-label="Add reports to dashboard"><header><div><h2>Add a report</h2><p>Your reports and reports shared with you</p></div><button className="icon-button subtle" onClick={() => setPickerOpen(false)} aria-label="Close"><X size={17} /></button></header><div className="dashboard-picker-list">{availableReports.map((report) => <button key={report.id} onClick={() => { onAddReport(report.id); setPickerOpen(false) }}><span><BarChart3 size={17} /></span><div><strong>{report.name}</strong><small>{report.source} · {report.createdBy === user.email ? 'Created by you' : `Shared with ${report.sharedWith.join(', ')}`}</small></div><Plus size={16} /></button>)}{!availableReports.length && <div className="dashboard-picker-empty"><Table2 size={22} /><strong>No reports available</strong><p>Save a report in Reporting or ask a colleague to share one with you.</p><button className="compact-button primary" onClick={() => { setPickerOpen(false); onNavigate('Reporting') }}>Open reporting</button></div>}</div></section></div>}
  </section>
}

function NlpReportingPanel({ user, rowsBySource, productAssets, onOpenReport, panelRef }) {
  const allowedCatalog = useMemo(() => [...reportCatalog, ...getProductCategoryReportCatalog(productAssets)]
    .filter((table) => table.roles.includes(user.role)), [productAssets, user.role])
  const [prompt, setPrompt] = useState('')
  const [generated, setGenerated] = useState(null)
  const runPrompt = (event) => {
    event.preventDefault()
    if (!prompt.trim()) return
    const nextGenerated = parseReportPrompt(prompt, allowedCatalog)
    setGenerated({ ...nextGenerated, result: runReportDefinition(nextGenerated.definition, rowsBySource) })
  }

  return <section ref={panelRef} className="dashboard-nlp" aria-labelledby="dashboard-nlp-title">
    <header><span><Bot size={18} /></span><div><p>Natural language reporting</p><h2 id="dashboard-nlp-title">Ask about your operational data</h2><small>Generate a report from a plain-language question without changing your dashboard tiles.</small></div></header>
    <form onSubmit={runPrompt}><input aria-label="Reporting question" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Show open critical incidents by customer" /><button type="submit" className="compact-button primary"><Send size={14} /> Generate</button></form>
    <DashboardStreamingPromptGuide prompt={prompt} catalog={allowedCatalog} />
    <div className="dashboard-nlp-examples"><span>Try:</span>{['Open incidents by customer', 'Critical incidents by assignment group', 'Contracts by customer'].map((example) => <button key={example} type="button" onClick={() => setPrompt(example)}>{example}</button>)}</div>
    {generated && <div className="dashboard-nlp-result"><div><span><Sparkles size={15} /></span><section><strong>{generated.definition.name}</strong><p>{generated.explanation}</p></section></div><aside><b>{generated.result.rows.length}</b><small>matching records</small></aside>{generated.result.groups.length > 0 && <ul>{generated.result.groups.slice(0, 4).map((group) => <li key={group.label}><span>{group.label}</span><b>{group.value}</b></li>)}</ul>}<button type="button" className="compact-button secondary" onClick={() => onOpenReport?.(generated.definition)}><ExternalLink size={14} /> Open in Reporting</button></div>}
  </section>
}

function DashboardStreamingPromptGuide({ prompt, catalog }) {
  const guide = useMemo(() => buildReportPromptGuide(prompt, catalog), [catalog, prompt])
  const [visibleGuide, setVisibleGuide] = useState('')
  useEffect(() => {
    setVisibleGuide('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 5
      setVisibleGuide(guide.slice(0, index))
      if (index >= guide.length) window.clearInterval(timer)
    }, 12)
    return () => window.clearInterval(timer)
  }, [guide])
  return <div className="dashboard-nlp-guide" aria-live="polite"><Sparkles size={14} /><span>{visibleGuide}<i /></span></div>
}

function DashboardReport({ report, result, customers = [], onOpen, onOpenGroup }) {
  const { rows, groups } = result
  const fields = report.selectedFields?.length ? report.selectedFields : report.fields || Object.keys(rows[0] || {}).slice(0, 5)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8
  if (report.visualization === 'customer-priority-matrix') {
    const priorities = ['Critical', 'High', 'Medium', 'Low']
    const customerIds = [...new Set([...customers.map((customer) => String(customer.id)), ...rows.map((row) => row['Customer ID']).filter(Boolean)])]
    return <div className="dashboard-report-table"><div className="dashboard-table-scroll dash-clickable" onClick={onOpen}><table><thead><tr><th>Customer</th><th>Total</th>{priorities.map((priority) => <th key={priority}>{priority}</th>)}</tr></thead><tbody>{customerIds.map((customerId) => { const customerRows = rows.filter((row) => String(row['Customer ID']) === String(customerId)); const customer = customers.find((item) => String(item.id) === String(customerId)); return <tr key={customerId}><td>{customer?.name || customerRows[0]?.Customer || '--'}</td><td>{customerRows.length}</td>{priorities.map((priority) => <td key={priority}>{customerRows.filter((row) => row.Priority === priority).length}</td>)}</tr> })}{!customerIds.length && <tr><td colSpan="6">No customer data.</td></tr>}</tbody></table></div></div>
  }
  if (report.visualization === 'mail-priority-status-matrix') {
    const priorities = ['Critical', 'High', 'Medium', 'Low']
    const statuses = [...new Set(rows.map((row) => row.Status).filter(Boolean))].sort((left, right) => left.localeCompare(right))
    return <div className="dashboard-report-table"><div className="dashboard-table-scroll dash-clickable" onClick={onOpen}><table><thead><tr><th>Criticality</th><th>Total</th>{statuses.map((status) => <th key={status}>{status}</th>)}</tr></thead><tbody>{priorities.map((priority) => { const priorityRows = rows.filter((row) => row.Priority === priority); return <tr key={priority}><td>{priority}</td><td>{priorityRows.length}</td>{statuses.map((status) => <td key={status}>{priorityRows.filter((row) => row.Status === status).length}</td>)}</tr> })}{!statuses.length && <tr><td colSpan="2">No correspondence data.</td></tr>}</tbody></table></div></div>
  }
  if (report.visualization === 'query-customer-status-matrix') {
    const statuses = ['Open', 'Pending', 'Resolved', 'Closed']
    const customerIds = [...new Set([...customers.map((customer) => String(customer.id)), ...rows.map((row) => row['Customer ID']).filter(Boolean)])]
    return <div className="dashboard-report-table"><div className="dashboard-table-scroll dash-clickable" onClick={onOpen}><table><thead><tr><th>Customer</th><th>Total</th>{statuses.map((status) => <th key={status}>{status}</th>)}</tr></thead><tbody>{customerIds.map((customerId) => { const customerRows = rows.filter((row) => String(row['Customer ID']) === String(customerId)); const customer = customers.find((item) => String(item.id) === String(customerId)); return <tr key={customerId}><td>{customer?.name || customerRows[0]?.Customer || '--'}</td><td>{customerRows.length}</td>{statuses.map((status) => <td key={status}>{customerRows.filter((row) => row.Status === status).length}</td>)}</tr> })}{!customerIds.length && <tr><td colSpan="6">No query data.</td></tr>}</tbody></table></div></div>
  }
  if (report.visualization === 'personal-calendar') {
    const eventMap = rows.reduce((result, row) => { const date = String(row.Date || '').slice(0, 10); if (date) (result[date] ||= []).push(row); return result }, {})
    const dates = Object.keys(eventMap).sort()
    const anchor = dates.length ? new Date(`${dates[0]}T00:00:00`) : new Date()
    const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const offset = (month.getDay() + 6) % 7
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset)
    const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
    return <div className="dashboard-calendar-grid" onClick={onOpen}><header>{month.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</header><div>{days.map((day) => { const key = day.toISOString().slice(0, 10); const events = eventMap[key] || []; return <article key={key} className={day.getMonth() === month.getMonth() ? '' : 'outside'}><span>{day.getDate()}</span>{events.slice(0, 2).map((event, index) => <small key={`${key}-${index}`}>{event.Note}</small>)}</article> })}</div></div>
  }
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
  if (report.visualization === 'pie') {
    const total = visibleGroups.reduce((sum, group) => sum + group.value, 0)
    let running = 0
    const stops = visibleGroups.map((group, index) => { const start = running / total * 100; running += group.value; return `${palette[index % palette.length]} ${start}% ${running / total * 100}%` }).join(', ')
    return <div className="dashboard-pie-chart"><div className="dashboard-pie-ring" style={{ background: `conic-gradient(${stops})` }}><b>{total}</b></div><div>{visibleGroups.slice(0, 5).map((group, index) => <button key={group.label} onClick={() => onOpenGroup(group)}><i style={{ background: palette[index % palette.length] }} />{group.label}<b>{group.value}</b></button>)}</div></div>
  }
  if (report.visualization === 'line') return <div className="dashboard-line-chart">{visibleGroups.slice(0, 12).map((group, index) => <button key={group.label} style={{ height: `${Math.max(12, group.value / maximum * 100)}%` }} title={`${group.label}: ${group.value}`} onClick={() => onOpenGroup(group)}><i style={{ background: palette[index % palette.length] }} /><small>{group.label}</small><b>{group.value}</b></button>)}</div>
  return <div className="dashboard-mini-chart"><div className="dashboard-bars">{visibleGroups.map((group, index) => <button type="button" className="dashboard-bar-drill" key={group.label} title={`Open ${group.value} records for ${group.label}`} onClick={() => onOpenGroup(group)}><small title={group.label}>{group.label}</small><span><i style={{ width: `${group.value / maximum * 100}%`, background: palette[index % palette.length] }} /></span><b>{group.value}</b></button>)}</div></div>
}
