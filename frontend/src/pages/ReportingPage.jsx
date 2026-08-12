import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, BarChart3, Bot, CalendarClock, Check, ChevronRight, Database,
  Download, FileSpreadsheet, FileText, Filter, LayoutList, LineChart, Palette,
  PieChart, Play, Plus, Save, Send, Share2, SlidersHorizontal, Sparkles,
  Trash2, WandSparkles, X,
} from 'lucide-react'
import {
  buildReportPromptGuide, createBlankReport, createReportRows, getProductCategoryReportCatalog, parseReportPrompt, reportCatalog,
  reportOperators, reportTypes, runReportDefinition,
} from '../data/reportEngine'

const wizardSteps = [
  { key: 'data', label: 'Data', icon: Database },
  { key: 'type', label: 'Type', icon: BarChart3 },
  { key: 'configure', label: 'Configure', icon: SlidersHorizontal },
  { key: 'style', label: 'Style', icon: Palette },
  { key: 'review', label: 'Review & run', icon: Play },
]
const typeIcons = { table: LayoutList, bar: BarChart3, line: LineChart, pie: PieChart }
const palettes = [
  { key: 'operational', label: 'Operational', colors: ['#2f70b7', '#43a6a0', '#e2a33a', '#d85c57'] },
  { key: 'aviation', label: 'Aviation', colors: ['#183b5b', '#5b89b4', '#b8d1e5', '#d6a84b'] },
  { key: 'signal', label: 'Signal', colors: ['#167d68', '#6cad5c', '#d4a72c', '#c84c4c'] },
]

export default function ReportingPage({ user, data, reports = [], onSaveReport, onShareReport, initialReportId, initialReportDefinition }) {
  const allowedCatalog = useMemo(() => [...reportCatalog, ...getProductCategoryReportCatalog(data.productAssets)]
    .filter((table) => table.roles.includes(user.role)), [data.productAssets, user.role])
  const [view, setView] = useState('list')
  const [step, setStep] = useState(0)
  const [definition, setDefinition] = useState(() => createBlankReport(allowedCatalog))
  const [nlpPrompt, setNlpPrompt] = useState('')
  const [nlpExplanation, setNlpExplanation] = useState('')
  const [notice, setNotice] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const rowsBySource = useMemo(() => createReportRows(data), [data])
  const result = useMemo(() => runReportDefinition(definition, rowsBySource), [definition, rowsBySource])
  const selectedTable = allowedCatalog.find((table) => table.key === definition.source) || allowedCatalog[0]
  const visibleReports = reports.filter((report) => report.createdBy === user.email || report.sharedWith?.includes(user.role) || report.sharedWith?.includes(user.name))

  const updateDefinition = (updates) => setDefinition((current) => ({ ...current, ...updates }))
  const startNew = () => {
    setDefinition(createBlankReport(allowedCatalog))
    setStep(0)
    setNlpPrompt('')
    setNlpExplanation('')
    setNotice('')
    setView('wizard')
  }
  const openReport = (report) => {
    const table = allowedCatalog.find((item) => item.key === report.source) || allowedCatalog[0]
    setDefinition({
      ...createBlankReport(allowedCatalog),
      ...report,
      source: table.key,
      fields: table.fields,
      selectedFields: report.selectedFields?.length ? report.selectedFields : (report.fields || table.fields).slice(0, 5),
      groupBy: report.groupBy || [],
      style: { showLegend: true, showValues: true, palette: 'operational', ...report.style },
    })
    setStep(4)
    setNlpPrompt('')
    setNlpExplanation('')
    setNotice('')
    setView('wizard')
  }
  // Auto-open a report when drilled into from the dashboard
  useEffect(() => {
    if (initialReportDefinition) {
      openReport(initialReportDefinition)
      return
    }
    if (!initialReportId) return
    const target = reports.find((r) => r.id === initialReportId)
    if (target) openReport(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const generateFromPrompt = () => {
    if (!nlpPrompt.trim()) return
    const generated = parseReportPrompt(nlpPrompt, allowedCatalog)
    setDefinition(generated.definition)
    setNlpExplanation(generated.explanation)
    setNotice('AI created a complete draft. Review the highlighted configuration before running it.')
    setStep(2)
  }
  const selectSource = (source) => {
    const table = allowedCatalog.find((item) => item.key === source)
    updateDefinition({ source, fields: table.fields, selectedFields: table.fields.slice(0, 5), filters: [], groupBy: [], sortBy: '' })
  }
  const toggleField = (field) => {
    const selected = definition.selectedFields || []
    updateDefinition({ selectedFields: selected.includes(field) ? selected.filter((item) => item !== field) : [...selected, field] })
  }
  const addFilter = () => updateDefinition({ filters: [...definition.filters, { id: `filter-${Date.now()}`, field: selectedTable.fields[0], operator: 'is', value: '' }] })
  const updateFilter = (id, key, value) => updateDefinition({ filters: definition.filters.map((filter) => filter.id === id ? { ...filter, [key]: value } : filter) })
  const removeFilter = (id) => updateDefinition({ filters: definition.filters.filter((filter) => filter.id !== id) })
  const toggleGroup = (field) => {
    const groups = definition.groupBy || []
    updateDefinition({ groupBy: groups.includes(field) ? groups.filter((item) => item !== field) : [...groups, field].slice(-2) })
  }
  const saveReport = () => {
    const savedDefinition = { ...definition, name: definition.name.trim() || 'Untitled report', fields: selectedTable.fields }
    onSaveReport(savedDefinition)
    setDefinition(savedDefinition)
    setNotice('Report saved and available in the report library and dashboard picker.')
  }
  const exportReport = (format) => {
    const fields = definition.selectedFields?.length ? definition.selectedFields : selectedTable.fields.slice(0, 5)
    const rows = result.rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? '--'])))
    const fileName = (definition.name || 'report').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
    if (format === 'Excel') {
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Report data')
      XLSX.writeFile(workbook, `${fileName}.xlsx`)
    } else {
      const content = [fields.join(','), ...rows.map((row) => fields.map((field) => JSON.stringify(row[field])).join(','))].join('\n')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
      link.download = `${fileName}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    }
    setNotice(`${format} export prepared with ${rows.length} rows.`)
  }

  if (view === 'list') return <ReportLibrary reports={visibleReports} user={user} onNew={startNew} onOpen={openReport} />

  return <section className="reporting-page report-wizard-page">
    <header className="report-wizard-topbar">
      <button className="report-builder-back" onClick={() => setView('list')}><ArrowLeft size={15} /> All reports</button>
      <div className="report-wizard-title"><span>Report designer</span><input aria-label="Report name" value={definition.name} onChange={(event) => updateDefinition({ name: event.target.value })} /></div>
      <div className="report-wizard-actions"><button className="compact-button secondary" onClick={() => setShowShare(true)}><Share2 size={15} /> Share</button><ExportMenu onExport={exportReport} /><button className="compact-button primary" onClick={saveReport}><Save size={15} /> Save</button></div>
    </header>

    <nav className="report-wizard-steps" aria-label="Report creation steps">{wizardSteps.map(({ key, label, icon: Icon }, index) => <button key={key} className={`${index === step ? 'active' : ''} ${index < step ? 'complete' : ''}`} onClick={() => setStep(index)}><span>{index < step ? <Check size={14} /> : <Icon size={14} />}</span><b>{index + 1}. {label}</b></button>)}</nav>

    {notice && <div className="report-notice"><Check size={14} /> {notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}

    <section className="report-ai-copilot">
      <span><Sparkles size={18} /></span>
      <div><strong>Ask Report Assist</strong><small>Describe the data, conditions, grouping, and visualization you need.</small></div>
      <input aria-label="Describe your report" value={nlpPrompt} onChange={(event) => setNlpPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generateFromPrompt()} placeholder="Example: Show open incidents older than one month by customer as a bar chart" />
      <button className="compact-button primary" onClick={generateFromPrompt}><WandSparkles size={15} /> Generate</button>
    </section>
    <StreamingPromptGuide prompt={nlpPrompt} catalog={allowedCatalog} />
    {nlpExplanation && <div className="report-ai-explanation"><Bot size={16} /><span><strong>Generated from your request</strong>{nlpExplanation}</span><button onClick={() => setNlpExplanation('')} aria-label="Dismiss AI explanation"><X size={14} /></button></div>}

    <div className="report-wizard-workspace">
      <main className="report-wizard-main">
        {step === 0 && <DataStep catalog={allowedCatalog} definition={definition} selectedTable={selectedTable} onSelectSource={selectSource} onToggleField={toggleField} />}
        {step === 1 && <TypeStep definition={definition} onChange={(visualization) => updateDefinition({ visualization })} />}
        {step === 2 && <ConfigureStep definition={definition} table={selectedTable} onAddFilter={addFilter} onUpdateFilter={updateFilter} onRemoveFilter={removeFilter} onToggleGroup={toggleGroup} onChange={updateDefinition} />}
        {step === 3 && <StyleStep definition={definition} onChange={(style) => updateDefinition({ style: { ...definition.style, ...style } })} />}
        {step === 4 && <ReviewStep definition={definition} table={selectedTable} result={result} onSchedule={() => setShowSchedule(true)} />}
      </main>
      <aside className="report-wizard-preview"><div className="report-preview-head"><div><span>Live preview</span><strong>{result.rows.length} matching record{result.rows.length === 1 ? '' : 's'}</strong></div><i>{selectedTable.label}</i></div><ReportVisualization definition={definition} table={selectedTable} result={result} compact={step !== 4} /></aside>
    </div>

    <footer className="report-wizard-footer"><button className="compact-button secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft size={14} /> Back</button><span>Step {step + 1} of {wizardSteps.length}</span>{step < wizardSteps.length - 1 ? <button className="compact-button primary" onClick={() => setStep((current) => current + 1)}>Next <ChevronRight size={14} /></button> : <button className="compact-button primary" onClick={() => setNotice(`Report ran successfully with ${result.rows.length} matching records.`)}><Play size={14} /> Run report</button>}</footer>

    {showShare && <ShareDialog reportName={definition.name} onClose={() => setShowShare(false)} onShare={(audience) => { onShareReport({ ...definition, fields: selectedTable.fields }, audience); setShowShare(false); setNotice(`Report saved and shared with ${audience}.`) }} />}
    {showSchedule && <ScheduleDialog reportName={definition.name} onClose={() => setShowSchedule(false)} onSchedule={() => { setShowSchedule(false); setNotice('Recurring delivery schedule saved.') }} />}
  </section>
}

function StreamingPromptGuide({ prompt, catalog }) {
  const guide = useMemo(() => buildReportPromptGuide(prompt, catalog), [catalog, prompt])
  const [visibleGuide, setVisibleGuide] = useState('')
  useEffect(() => {
    setVisibleGuide('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 4
      setVisibleGuide(guide.slice(0, index))
      if (index >= guide.length) window.clearInterval(timer)
    }, 12)
    return () => window.clearInterval(timer)
  }, [guide])
  const examples = catalog.slice(0, 4).map((table) => `List ${table.label.toLowerCase()} by ${table.fields[1]?.toLowerCase() || table.fields[0]?.toLowerCase()}`)
  return <section className="report-prompt-guide" aria-live="polite"><Bot size={15} /><div><strong>Prompt coach</strong><p>{visibleGuide}<i /></p><span>{examples.map((example) => <code key={example}>{example}</code>)}</span></div></section>
}

function ReportLibrary({ reports, user, onNew, onOpen }) {
  const [query, setQuery] = useState('')
  const filtered = reports.filter((report) => !query || [report.name, report.source, report.createdByName].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase())))
  return <section className="reporting-page report-library-page"><header className="reporting-header"><div><p>Analytics workspace</p><h1>Reports</h1><span>Open reports you created or that were shared with you.</span></div><button className="compact-button primary" onClick={onNew}><Plus size={15} /> New report</button></header><div className="report-library-toolbar"><label><Filter size={14} /><input aria-label="Search reports" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports" /></label><span>{filtered.length} of {reports.length} reports</span></div><div className="report-library-table"><table><thead><tr><th>Report name</th><th>Data source</th><th>Visualization</th><th>Owner</th><th>Access</th><th>Updated</th></tr></thead><tbody>{filtered.map((report) => <tr key={report.id} onClick={() => onOpen(report)}><td><button onClick={() => onOpen(report)}><FileText size={16} /><span><strong>{report.name}</strong><small>{report.filters?.length || 0} condition{report.filters?.length === 1 ? '' : 's'} · {(report.groupBy || []).join(', ') || 'No grouping'}</small></span></button></td><td>{report.source}</td><td>{reportTypes.find((item) => item.key === report.visualization)?.label || 'List'}</td><td>{report.createdBy === user.email ? 'You' : report.createdByName || report.createdBy}</td><td>{report.createdBy === user.email ? 'Owner' : 'Shared with you'}</td><td>{report.updatedAt ? new Date(report.updatedAt).toLocaleDateString('en-GB') : '--'}</td></tr>)}{!filtered.length && <tr><td colSpan="6"><div className="report-library-empty"><FileText size={24} /><strong>No reports found</strong><span>Change the search or create a new report.</span><button className="compact-button primary" onClick={onNew}><Plus size={15} /> New report</button></div></td></tr>}</tbody></table></div></section>
}

function DataStep({ catalog, definition, selectedTable, onSelectSource, onToggleField }) {
  return <section className="report-step"><header><span>1</span><div><h2>Choose report data</h2><p>Select an authorized table and the fields available to the report.</p></div></header><h3>Data source</h3><div className="report-source-grid">{catalog.map((table) => <button key={table.key} className={definition.source === table.key ? 'selected' : ''} onClick={() => onSelectSource(table.key)}><Database size={18} /><span><strong>{table.label}</strong><small>{table.description}</small></span>{definition.source === table.key && <Check size={15} />}</button>)}</div><div className="report-field-heading"><div><h3>Available fields</h3><p>Selected fields become columns in list output and exports.</p></div><span>{definition.selectedFields?.length || 0} selected</span></div><div className="report-field-grid">{selectedTable.fields.map((field) => <label key={field}><input type="checkbox" checked={definition.selectedFields?.includes(field)} onChange={() => onToggleField(field)} /><span>{field}</span></label>)}</div></section>
}

function TypeStep({ definition, onChange }) {
  return <section className="report-step"><header><span>2</span><div><h2>Select visualization</h2><p>Choose how the report should communicate its result.</p></div></header><div className="report-type-grid">{reportTypes.map((type) => { const Icon = typeIcons[type.key]; return <button key={type.key} className={definition.visualization === type.key ? 'selected' : ''} onClick={() => onChange(type.key)}><span><Icon size={24} /></span><strong>{type.label}</strong><small>{type.description}</small>{definition.visualization === type.key && <i><Check size={13} /></i>}</button> })}</div><div className="report-step-tip"><Sparkles size={16} /><div><strong>Selection guidance</strong><p>Use List for operational detail, Bar for category comparison, Trend for time-oriented data, and Donut for a small number of proportional groups.</p></div></div></section>
}

function ConfigureStep({ definition, table, onAddFilter, onUpdateFilter, onRemoveFilter, onToggleGroup, onChange }) {
  const groupingFields = table.fields.filter((field) => !['Number', 'Short description', 'Opened', 'Resolved', 'Age days'].includes(field))
  return <section className="report-step"><header><span>3</span><div><h2>Configure the report</h2><p>Apply conditions, grouping, and result ordering.</p></div></header><div className="report-config-section"><div className="report-config-heading"><div><h3>Conditions</h3><p>All conditions are combined with AND.</p></div><button onClick={onAddFilter}><Plus size={14} /> Add condition</button></div><div className="wizard-filter-list">{definition.filters.map((filter, index) => <div className="wizard-filter" key={filter.id}><b>{index ? 'AND' : 'WHERE'}</b><select aria-label={`Condition ${index + 1} field`} value={filter.field} onChange={(event) => onUpdateFilter(filter.id, 'field', event.target.value)}>{table.fields.map((field) => <option key={field}>{field}</option>)}</select><select aria-label={`Condition ${index + 1} operator`} value={filter.operator} onChange={(event) => onUpdateFilter(filter.id, 'operator', event.target.value)}>{reportOperators.map((operator) => <option key={operator}>{operator}</option>)}</select><input aria-label={`Condition ${index + 1} value`} value={filter.value} onChange={(event) => onUpdateFilter(filter.id, 'value', event.target.value)} disabled={['is empty', 'is not empty'].includes(filter.operator)} placeholder="Value" /><button onClick={() => onRemoveFilter(filter.id)} aria-label={`Remove condition ${index + 1}`}><Trash2 size={14} /></button></div>)}{!definition.filters.length && <div className="report-config-empty">No conditions. The report includes every accessible record.</div>}</div></div><div className="report-config-section"><div className="report-config-heading"><div><h3>Group results</h3><p>Select up to two fields. Order determines the group label.</p></div><span>{definition.groupBy?.length || 0}/2</span></div><div className="report-group-options">{groupingFields.map((field) => <button key={field} className={definition.groupBy?.includes(field) ? 'selected' : ''} onClick={() => onToggleGroup(field)}>{field}{definition.groupBy?.includes(field) && <Check size={13} />}</button>)}</div></div><div className="report-config-section two-column"><label><span>Sort by</span><select value={definition.sortBy || ''} onChange={(event) => onChange({ sortBy: event.target.value })}><option value="">Default</option>{table.fields.map((field) => <option key={field}>{field}</option>)}</select></label><label><span>Direction</span><select value={definition.sortDirection || 'descending'} onChange={(event) => onChange({ sortDirection: event.target.value })}><option value="ascending">Ascending</option><option value="descending">Descending</option></select></label></div></section>
}

function StyleStep({ definition, onChange }) {
  return <section className="report-step"><header><span>4</span><div><h2>Style the visualization</h2><p>Apply restrained presentation settings without changing the data.</p></div></header><div className="report-style-section"><h3>Color palette</h3><div className="report-palette-grid">{palettes.map((palette) => <button key={palette.key} className={definition.style?.palette === palette.key ? 'selected' : ''} onClick={() => onChange({ palette: palette.key })}><span>{palette.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{palette.label}</strong>{definition.style?.palette === palette.key && <Check size={14} />}</button>)}</div></div><div className="report-style-section"><h3>Display options</h3><label className="report-style-toggle"><span><strong>Show legend</strong><small>Display category names beside the visualization.</small></span><input type="checkbox" checked={definition.style?.showLegend !== false} onChange={(event) => onChange({ showLegend: event.target.checked })} /></label><label className="report-style-toggle"><span><strong>Show values</strong><small>Display the calculated count for each group.</small></span><input type="checkbox" checked={definition.style?.showValues !== false} onChange={(event) => onChange({ showValues: event.target.checked })} /></label></div></section>
}

function ReviewStep({ definition, table, result, onSchedule }) {
  return <section className="report-step"><header><span>5</span><div><h2>Review and run</h2><p>Confirm the report definition before saving, sharing, or scheduling.</p></div></header><div className="report-review-grid"><article><span>Source</span><strong>{table.label}</strong></article><article><span>Type</span><strong>{reportTypes.find((item) => item.key === definition.visualization)?.label}</strong></article><article><span>Conditions</span><strong>{definition.filters.length}</strong></article><article><span>Matching records</span><strong>{result.rows.length}</strong></article></div><div className="report-review-definition"><h3>Definition</h3><dl><div><dt>Fields</dt><dd>{definition.selectedFields?.join(', ') || 'Default fields'}</dd></div><div><dt>Grouped by</dt><dd>{definition.groupBy?.join(' then ') || 'No grouping'}</dd></div><div><dt>Conditions</dt><dd>{definition.filters.length ? definition.filters.map((filter) => `${filter.field} ${filter.operator} ${filter.value}`).join(' AND ') : 'No conditions'}</dd></div></dl></div><button className="compact-button secondary" onClick={onSchedule}><CalendarClock size={14} /> Schedule delivery</button></section>
}

function ReportVisualization({ definition, table, result, compact }) {
  if (definition.visualization === 'table' || !definition.groupBy?.length) return <ReportTable rows={result.rows} fields={definition.selectedFields?.length ? definition.selectedFields : table.fields} compact={compact} />
  if (!result.groups.length) return <div className="wizard-chart-empty"><BarChart3 size={24} /><strong>No matching grouped data</strong><span>Adjust the conditions or grouping fields.</span></div>
  const maximum = Math.max(...result.groups.map((group) => group.value), 1)
  const palette = palettes.find((item) => item.key === definition.style?.palette) || palettes[0]
  if (definition.visualization === 'pie') {
    const total = result.groups.reduce((sum, group) => sum + group.value, 0)
    return <div className="wizard-donut"><div className="wizard-donut-ring"><strong>{total}</strong><span>records</span></div>{definition.style?.showLegend !== false && <div className="wizard-chart-legend">{result.groups.slice(0, 6).map((group, index) => <p key={group.label}><i style={{ background: palette.colors[index % palette.colors.length] }} /><span>{group.label}</span>{definition.style?.showValues !== false && <b>{group.value}</b>}</p>)}</div>}</div>
  }
  return <div className={`wizard-bars ${definition.visualization}`}>{result.groups.slice(0, compact ? 6 : 12).map((group, index) => <div key={group.label}><small title={group.label}>{group.label}</small><span><i style={{ width: `${Math.max(4, group.value / maximum * 100)}%`, background: palette.colors[index % palette.colors.length] }} /></span>{definition.style?.showValues !== false && <b>{group.value}</b>}</div>)}</div>
}

function ReportTable({ rows, fields, compact }) {
  const columns = fields.slice(0, compact ? 4 : 7)
  return <div className="wizard-report-table"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, compact ? 8 : 20).map((row, index) => <tr key={row.Number || row[columns[0]] || index}>{columns.map((column) => <td key={column}>{row[column] ?? '--'}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length}>No records match the report conditions.</td></tr>}</tbody></table>{rows.length > (compact ? 8 : 20) && <p>Previewing {compact ? 8 : 20} of {rows.length} records</p>}</div>
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false)
  return <div className="report-export"><button className="compact-button secondary" onClick={() => setOpen((current) => !current)}><Download size={15} /> Export</button>{open && <div><button onClick={() => { onExport('CSV'); setOpen(false) }}><FileSpreadsheet size={14} /> CSV data</button><button onClick={() => { onExport('Excel'); setOpen(false) }}><FileSpreadsheet size={14} /> Excel workbook</button></div>}</div>
}

function ShareDialog({ reportName, onClose, onShare }) {
  const [audience, setAudience] = useState('Manager')
  return <div className="report-dialog-backdrop"><form className="report-dialog" onSubmit={(event) => { event.preventDefault(); onShare(audience.trim()) }}><header><div><h2>Share report</h2><p>{reportName}</p></div><button type="button" onClick={onClose}><X size={17} /></button></header><label>RECIPIENT NAME OR ROLE<input value={audience} onChange={(event) => setAudience(event.target.value)} required /></label><label>ACCESS<select><option>Can view</option><option>Can edit definition</option></select></label><p className="report-dialog-note">Recipients see only data permitted by their own role.</p><footer><button type="button" className="compact-button secondary" onClick={onClose}>Cancel</button><button className="compact-button primary" type="submit"><Send size={14} /> Share report</button></footer></form></div>
}

function ScheduleDialog({ reportName, onClose, onSchedule }) {
  return <div className="report-dialog-backdrop"><form className="report-dialog" onSubmit={(event) => { event.preventDefault(); onSchedule() }}><header><div><h2>Schedule report</h2><p>{reportName}</p></div><button type="button" onClick={onClose}><X size={17} /></button></header><label>FREQUENCY<select><option>Every Monday at 08:00</option><option>Daily at 08:00</option><option>First day of each month</option></select></label><label>DELIVERY FORMAT<select><option>Excel workbook</option><option>CSV data</option></select></label><label>DELIVER TO<input defaultValue="customer-support@aerofix.in" /></label><footer><button type="button" className="compact-button secondary" onClick={onClose}>Cancel</button><button className="compact-button primary" type="submit"><CalendarClock size={14} /> Save schedule</button></footer></form></div>
}
