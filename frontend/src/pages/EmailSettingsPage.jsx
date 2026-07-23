import { useState } from 'react'
import {
  Mail, Send, ArrowDownToLine, ArrowUpFromLine, FileCode, FlaskConical,
  Plus, Trash2, Pencil, CheckCircle2, XCircle, Play, Save, ChevronRight
} from 'lucide-react'

/* ── Tab definitions ── */
const tabs = [
  { key: 'inbound', label: 'Inbound settings', icon: ArrowDownToLine },
  { key: 'outbound', label: 'Outbound settings', icon: ArrowUpFromLine },
  { key: 'inbound-rules', label: 'Inbound rules', icon: FileCode },
  { key: 'outbound-rules', label: 'Outbound rules', icon: FileCode },
  { key: 'templates', label: 'Email templates', icon: Mail },
  { key: 'testing', label: 'Testing', icon: FlaskConical },
]

/* ── Sample data ── */
const sampleInboundRules = []

const sampleOutboundRules = []

const sampleTemplates = []

export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState('inbound')
  const [inbound, setInbound] = useState({ protocol: 'IMAP', host: '', port: '993', ssl: true, email: '', password: '', folder: 'INBOX', pollInterval: '5' })
  const [outbound, setOutbound] = useState({ host: '', port: '587', ssl: true, auth: true, email: '', password: '', fromName: 'Aerofix Service', fromEmail: '' })
  const [inboundRules, setInboundRules] = useState(sampleInboundRules)
  const [outboundRules, setOutboundRules] = useState(sampleOutboundRules)
  const [templates, setTemplates] = useState(sampleTemplates)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testEmail, setTestEmail] = useState('')

  const runTest = (type) => {
    setTestResult({ type, status: 'running', message: `Testing ${type} connection...` })
    setTimeout(() => {
      setTestResult({ type, status: 'success', message: `${type === 'inbound' ? 'Inbound' : type === 'outbound' ? 'Outbound' : 'Test email'} — connection successful.` })
    }, 1500)
  }

  return (
    <>
      <div className="page-heading">
        <div><h1>Email settings</h1><p className="subtitle">Configure inbound and outbound email, rules, and notification templates.</p></div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* ── INBOUND SETTINGS ── */}
        {activeTab === 'inbound' && (
          <div className="form-panel no-border">
            <div className="form-panel-head"><h2><ArrowDownToLine size={18} /> Inbound email configuration</h2></div>
            <p className="form-desc">Configure the mailbox that Aerofix monitors for incoming support emails.</p>
            <div className="form-grid">
              <div className="field">
                <label>Protocol</label>
                <select className="toolbar-select full" value={inbound.protocol} onChange={e => setInbound({...inbound, protocol: e.target.value})}>
                  <option>IMAP</option><option>POP3</option>
                </select>
              </div>
              <div className="field"><label>Mail server host</label><input placeholder="e.g. imap.office365.com" value={inbound.host} onChange={e => setInbound({...inbound, host: e.target.value})} /></div>
              <div className="field"><label>Port</label><input placeholder="993" value={inbound.port} onChange={e => setInbound({...inbound, port: e.target.value})} /></div>
              <div className="field">
                <label>Use SSL/TLS</label>
                <select className="toolbar-select full" value={inbound.ssl ? 'yes' : 'no'} onChange={e => setInbound({...inbound, ssl: e.target.value === 'yes'})}>
                  <option value="yes">Yes</option><option value="no">No</option>
                </select>
              </div>
              <div className="field"><label>Email address</label><input type="email" placeholder="support@company.com" value={inbound.email} onChange={e => setInbound({...inbound, email: e.target.value})} /></div>
              <div className="field"><label>Password / App password</label><input type="password" placeholder="••••••••" value={inbound.password} onChange={e => setInbound({...inbound, password: e.target.value})} /></div>
              <div className="field"><label>Folder to monitor</label><input placeholder="INBOX" value={inbound.folder} onChange={e => setInbound({...inbound, folder: e.target.value})} /></div>
              <div className="field"><label>Poll interval (minutes)</label><input type="number" min="1" max="60" value={inbound.pollInterval} onChange={e => setInbound({...inbound, pollInterval: e.target.value})} /></div>
            </div>
            <div className="form-actions"><button className="primary-button"><Save size={16} /> Save inbound settings</button><button className="secondary-button" onClick={() => runTest('inbound')}><Play size={14} /> Test connection</button></div>
          </div>
        )}

        {/* ── OUTBOUND SETTINGS ── */}
        {activeTab === 'outbound' && (
          <div className="form-panel no-border">
            <div className="form-panel-head"><h2><ArrowUpFromLine size={18} /> Outbound email configuration</h2></div>
            <p className="form-desc">Configure the SMTP server used for sending notifications and updates.</p>
            <div className="form-grid">
              <div className="field"><label>SMTP host</label><input placeholder="e.g. smtp.office365.com" value={outbound.host} onChange={e => setOutbound({...outbound, host: e.target.value})} /></div>
              <div className="field"><label>Port</label><input placeholder="587" value={outbound.port} onChange={e => setOutbound({...outbound, port: e.target.value})} /></div>
              <div className="field">
                <label>Use SSL/TLS</label>
                <select className="toolbar-select full" value={outbound.ssl ? 'yes' : 'no'} onChange={e => setOutbound({...outbound, ssl: e.target.value === 'yes'})}>
                  <option value="yes">Yes</option><option value="no">No</option>
                </select>
              </div>
              <div className="field">
                <label>Require authentication</label>
                <select className="toolbar-select full" value={outbound.auth ? 'yes' : 'no'} onChange={e => setOutbound({...outbound, auth: e.target.value === 'yes'})}>
                  <option value="yes">Yes</option><option value="no">No</option>
                </select>
              </div>
              <div className="field"><label>Email address</label><input type="email" placeholder="notifications@company.com" value={outbound.email} onChange={e => setOutbound({...outbound, email: e.target.value})} /></div>
              <div className="field"><label>Password / App password</label><input type="password" placeholder="••••••••" value={outbound.password} onChange={e => setOutbound({...outbound, password: e.target.value})} /></div>
              <div className="field"><label>From name</label><input placeholder="Aerofix Service" value={outbound.fromName} onChange={e => setOutbound({...outbound, fromName: e.target.value})} /></div>
              <div className="field"><label>From email</label><input type="email" placeholder="no-reply@company.com" value={outbound.fromEmail} onChange={e => setOutbound({...outbound, fromEmail: e.target.value})} /></div>
            </div>
            <div className="form-actions"><button className="primary-button"><Save size={16} /> Save outbound settings</button><button className="secondary-button" onClick={() => runTest('outbound')}><Play size={14} /> Test connection</button></div>
          </div>
        )}

        {/* ── INBOUND RULES ── */}
        {activeTab === 'inbound-rules' && (
          <>
            <div className="rules-header">
              <div><h2>Inbound rules</h2><p>Define how incoming emails are processed and routed to incidents.</p></div>
              <button className="primary-button" onClick={() => setShowRuleForm(!showRuleForm)}><Plus size={16} /> Add rule</button>
            </div>
            {showRuleForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>New inbound rule</h2><button className="text-button" onClick={() => setShowRuleForm(false)}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field full-width"><label>Rule name</label><input placeholder="e.g. VIP customer routing" /></div>
                  <div className="field full-width"><label>Condition</label><input placeholder='e.g. From domain = "army.ug" AND Subject contains "service"' /><p className="field-hint">Use AND/OR logic with field matching</p></div>
                  <div className="field full-width"><label>Action</label>
                    <select className="toolbar-select full">
                      <option>Create incident — assign to group</option><option>Create incident — set priority</option><option>Forward to email</option><option>Ignore / archive</option>
                    </select>
                  </div>
                  <div className="field"><label>Target group</label>
                    <select className="toolbar-select full"><option>Tier 1 Support</option><option>Tier 2 Support</option><option>Management</option></select>
                  </div>
                  <div className="field"><label>Priority</label>
                    <select className="toolbar-select full"><option>Normal</option><option>High</option><option>Critical</option><option>Low</option></select>
                  </div>
                </div>
                <div className="form-actions"><button className="primary-button">Save rule</button></div>
              </div>
            )}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Rule name</th><th>Condition</th><th>Action</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {inboundRules.map(r => (
                    <tr key={r.id} className={r.active ? '' : 'row-disabled'}>
                      <td className="td-title">{r.name}</td>
                      <td className="td-condition"><code>{r.condition}</code></td>
                      <td>{r.action}</td>
                      <td><span className={`badge ${r.active ? 'new' : 'closed'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="action-group">
                          <button className="row-action" title="Edit"><Pencil size={14} /></button>
                          <button className="row-action danger" title="Delete" onClick={() => setInboundRules(inboundRules.filter(x => x.id !== r.id))}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── OUTBOUND RULES ── */}
        {activeTab === 'outbound-rules' && (
          <>
            <div className="rules-header">
              <div><h2>Outbound rules</h2><p>Define when and to whom notification emails are sent.</p></div>
              <button className="primary-button" onClick={() => setShowRuleForm(!showRuleForm)}><Plus size={16} /> Add rule</button>
            </div>
            {showRuleForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>New outbound rule</h2><button className="text-button" onClick={() => setShowRuleForm(false)}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field"><label>Rule name</label><input placeholder="e.g. Assignment notification" /></div>
                  <div className="field"><label>Trigger event</label>
                    <select className="toolbar-select full">
                      <option>On incident creation</option><option>On status change</option><option>On assignment change</option><option>Before SLA breach</option><option>On resolution</option><option>On closure</option>
                    </select>
                  </div>
                  <div className="field"><label>Recipients</label>
                    <select className="toolbar-select full">
                      <option>Assignee</option><option>Assigned group members</option><option>Assignee + group lead</option><option>Primary site contact</option><option>All site contacts</option><option>Custom email</option>
                    </select>
                  </div>
                  <div className="field"><label>Email template</label>
                    <select className="toolbar-select full">{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  </div>
                </div>
                <div className="form-actions"><button className="primary-button">Save rule</button></div>
              </div>
            )}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Rule name</th><th>Trigger</th><th>Recipients</th><th>Template</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {outboundRules.map(r => (
                    <tr key={r.id} className={r.active ? '' : 'row-disabled'}>
                      <td className="td-title">{r.name}</td>
                      <td>{r.trigger}</td>
                      <td>{r.recipients}</td>
                      <td><code>{r.template}</code></td>
                      <td><span className={`badge ${r.active ? 'new' : 'closed'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="action-group">
                          <button className="row-action" title="Edit"><Pencil size={14} /></button>
                          <button className="row-action danger" title="Delete" onClick={() => setOutboundRules(outboundRules.filter(x => x.id !== r.id))}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── EMAIL TEMPLATES ── */}
        {activeTab === 'templates' && (
          <>
            <div className="rules-header">
              <div><h2>Email templates</h2><p>Define reusable notification templates with dynamic placeholders.</p></div>
              <button className="primary-button" onClick={() => setShowTemplateForm(!showTemplateForm)}><Plus size={16} /> New template</button>
            </div>
            {showTemplateForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>New template</h2><button className="text-button" onClick={() => setShowTemplateForm(false)}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field"><label>Template name</label><input placeholder="e.g. Weekly digest" /></div>
                  <div className="field"><label>Template ID</label><input placeholder="e.g. weekly_digest" /></div>
                  <div className="field full-width"><label>Subject line</label><input placeholder='e.g. Weekly summary — {{date}}' /><p className="field-hint">Available: {'{{incident_id}}'}, {'{{title}}'}, {'{{status}}'}, {'{{customer}}'}, {'{{assignee}}'}, {'{{date}}'}</p></div>
                  <div className="field full-width"><label>Body</label><textarea rows={6} placeholder={'Dear {{assignee}},\n\nIncident {{incident_id}} has been {{status}}.\n\nTitle: {{title}}\nCustomer: {{customer}}\n\nPlease take appropriate action.\n\nRegards,\nAerofix Service Team'} className="template-textarea" /></div>
                </div>
                <div className="form-actions"><button className="primary-button">Save template</button></div>
              </div>
            )}
            <div className="template-grid">
              {templates.map(t => (
                <div className="template-card" key={t.id}>
                  <div className="template-card-head">
                    <Mail size={18} />
                    <div><h3>{t.name}</h3><p>{t.description}</p></div>
                  </div>
                  <div className="template-subject"><label>Subject:</label><code>{t.subject}</code></div>
                  <div className="template-card-foot">
                    <span className="badge in-progress">Used by {t.usedBy} rule{t.usedBy !== 1 ? 's' : ''}</span>
                    <div className="action-group">
                      <button className="row-action" title="Edit"><Pencil size={14} /></button>
                      <button className="row-action danger" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TESTING ── */}
        {activeTab === 'testing' && (
          <div className="testing-section">
            <h2>Connection & delivery testing</h2>
            <p className="form-desc">Verify your inbound and outbound email configuration.</p>

            <div className="test-cards">
              <div className="test-card">
                <div className="test-card-head"><ArrowDownToLine size={20} /><h3>Test inbound connection</h3></div>
                <p>Connects to the configured mail server, authenticates, and checks the monitored folder.</p>
                <button className="secondary-button" onClick={() => runTest('inbound')}><Play size={14} /> Run inbound test</button>
              </div>
              <div className="test-card">
                <div className="test-card-head"><ArrowUpFromLine size={20} /><h3>Test outbound connection</h3></div>
                <p>Connects to the SMTP server and verifies authentication credentials.</p>
                <button className="secondary-button" onClick={() => runTest('outbound')}><Play size={14} /> Run outbound test</button>
              </div>
              <div className="test-card full">
                <div className="test-card-head"><Send size={20} /><h3>Send test email</h3></div>
                <p>Send a test notification to verify end-to-end delivery.</p>
                <div className="test-email-row">
                  <input placeholder="recipient@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                  <button className="primary-button" onClick={() => runTest('send')}><Send size={14} /> Send test</button>
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`test-result ${testResult.status}`}>
                {testResult.status === 'running' && <div className="spinner" />}
                {testResult.status === 'success' && <CheckCircle2 size={18} />}
                {testResult.status === 'error' && <XCircle size={18} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
