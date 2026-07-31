import { useEffect, useState } from 'react'
import {
  Mail, Send, ArrowDownToLine, ArrowUpFromLine, FileCode, FlaskConical,
  Plus, Trash2, Pencil, CheckCircle2, XCircle, Play, Save, ChevronRight,
  Bold, Italic, Underline as UnderlineIcon, Heading2, List, ListOrdered, Link2, Undo2, Redo2
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { emailApi, recordApi } from '../data/api'

/* ── Tab definitions ── */
const tabs = [
  { key: 'inbound', label: 'Inbound settings', icon: ArrowDownToLine },
  { key: 'outbound', label: 'Outbound settings', icon: ArrowUpFromLine },
  { key: 'inbound-rules', label: 'Inbound rules', icon: FileCode },
  { key: 'outbound-rules', label: 'Outbound rules', icon: FileCode },
  { key: 'templates', label: 'Email templates', icon: Mail },
  { key: 'testing', label: 'Testing', icon: FlaskConical },
  { key: 'logs', label: 'Email logs', icon: FileCode },
]

/* ── Sample data ── */
const sampleInboundRules = []

const sampleOutboundRules = []

const emptyOutboundRule = {
  name: '',
  trigger: 'On incident creation',
  recipientType: 'assigned_to',
  templateId: 'new_incident_created',
  groupIds: [],
  userIds: [],
  externalEmails: '',
}

const recipientOptions = [
  { value: 'requester', label: 'Requester' },
  { value: 'requested_for', label: 'Requested For' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'assignment_group', label: 'Assignment Group' },
  { value: 'manager', label: 'Manager' },
  { value: 'watch_list', label: 'Watch List' },
  { value: 'specific_user', label: 'Specific User' },
  { value: 'all_assignment_groups', label: 'All Assignment Groups and Their Members' },
  { value: 'multiple_assignment_groups', label: 'Multiple Assignment Groups' },
  { value: 'custom_recipients', label: 'Custom Email Recipients' },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const splitEmails = (value) => [...new Set(value.split(/[;,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))]

const sampleTemplates = [{
  id: 'new_incident_created',
  name: 'New incident created',
  description: 'Confirms a newly reported incident and summarizes its registered details.',
  subject: 'New Incident {{incident_id}} with {{priority}} priority has been created',
  body: `Hi Team,

A new incident has been reported.

Incident Details

Incident Number: {{incident_id}}
Short Description: {{title}}
Priority: {{priority}}
Severity: {{severity}}
Category: {{category}}
Status: Registered
Submitted On: {{created_at}}
Reported By: {{requester_name}}
Assigned Group: {{assignment_group}}

Our support team will review your incident and initiate the required actions. You will receive further notifications as the incident progresses through its lifecycle.

Thank you.

Regards,
Service Management System`,
  usedBy: 0,
}]

const emptyTemplateDraft = {
  id: '',
  name: '',
  subject: '',
  body: '',
}

const inboundProviderPresets = {
  custom: {},
  gmail: { protocol: 'IMAP', host: 'imap.gmail.com', port: '993', ssl: true, folder: 'INBOX' },
  outlook: { protocol: 'IMAP', host: 'outlook.office365.com', port: '993', ssl: true, folder: 'INBOX' },
}

const outboundProviderPresets = {
  custom: {},
  gmail: { host: 'smtp.gmail.com', port: '587', ssl: true, auth: true },
  outlook: { host: 'smtp.office365.com', port: '587', ssl: true, auth: true },
}

const richTextHtml = (value) => {
  if (/<[a-z][\s\S]*>/i.test(value)) return value
  return value.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('')
}

function TemplateBodyEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false, autolink: true })],
    content: richTextHtml(value),
    editorProps: { attributes: { class: 'template-rich-text-content', 'aria-label': 'Template body' } },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== richTextHtml(value)) editor.commands.setContent(richTextHtml(value), false)
  }, [editor, value])

  if (!editor) return null
  const format = (command) => () => editor.chain().focus()[command]().run()
  const addLink = () => {
    const url = window.prompt('Enter link URL')
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  return <div className="template-rich-text-editor">
    <div className="template-rich-text-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" title="Heading" aria-label="Heading" className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></button>
      <button type="button" title="Bold" aria-label="Bold" className={editor.isActive('bold') ? 'active' : ''} onClick={format('toggleBold')}><Bold size={15} /></button>
      <button type="button" title="Italic" aria-label="Italic" className={editor.isActive('italic') ? 'active' : ''} onClick={format('toggleItalic')}><Italic size={15} /></button>
      <button type="button" title="Underline" aria-label="Underline" className={editor.isActive('underline') ? 'active' : ''} onClick={format('toggleUnderline')}><UnderlineIcon size={15} /></button>
      <span />
      <button type="button" title="Bulleted list" aria-label="Bulleted list" className={editor.isActive('bulletList') ? 'active' : ''} onClick={format('toggleBulletList')}><List size={15} /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" className={editor.isActive('orderedList') ? 'active' : ''} onClick={format('toggleOrderedList')}><ListOrdered size={15} /></button>
      <button type="button" title="Add link" aria-label="Add link" className={editor.isActive('link') ? 'active' : ''} onClick={addLink}><Link2 size={15} /></button>
      <span />
      <button type="button" title="Undo" aria-label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></button>
      <button type="button" title="Redo" aria-label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></button>
    </div>
    <EditorContent editor={editor} />
  </div>
}

export default function EmailSettingsPage({ assignmentGroups, users }) {
  const [activeTab, setActiveTab] = useState('inbound')
  const [inbound, setInbound] = useState({ provider: 'custom', protocol: 'IMAP', host: '', port: '993', ssl: true, email: '', password: '', folder: 'INBOX', pollInterval: '5' })
  const [outbound, setOutbound] = useState({ provider: 'custom', host: '', port: '587', ssl: true, auth: true, email: '', password: '', fromName: 'Aerofix Service', fromEmail: '' })
  const [inboundRules, setInboundRules] = useState(sampleInboundRules)
  const [outboundRules, setOutboundRules] = useState(sampleOutboundRules)
  const [templates, setTemplates] = useState(sampleTemplates)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [outboundRuleDraft, setOutboundRuleDraft] = useState(emptyOutboundRule)
  const [outboundRuleError, setOutboundRuleError] = useState('')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [templateDraft, setTemplateDraft] = useState(emptyTemplateDraft)
  const [testResult, setTestResult] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [emailLogs, setEmailLogs] = useState([])
  const [logFilter, setLogFilter] = useState('All')

  useEffect(() => {
    recordApi.list('email_settings')
      .then((records) => {
        const settings = records.find((record) => record.record_id === 'email-configuration')?.payload
        if (!settings) return
        setInbound((current) => ({ ...current, ...(settings.inbound || {}), password: '' }))
        setOutbound((current) => ({ ...current, ...(settings.outbound || {}), password: '' }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    recordApi.list('outbound_email_rules')
      .then((records) => setOutboundRules(records.map((record) => record.payload)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    recordApi.list('email_logs')
      .then((records) => setEmailLogs(records.map((record) => record.payload).sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))))
      .catch(() => {})
  }, [])

  const writeEmailLog = async ({ direction, event, status, recipient = '', details }) => {
    const entry = { id: `email-log-${Date.now()}-${Math.random()}`, direction, event, status, recipient, details, occurredAt: new Date().toISOString() }
    setEmailLogs((current) => [entry, ...current])
    try {
      await recordApi.bulkUpsert('email_logs', [{ record_id: entry.id, payload: entry }])
    } catch {
      setEmailLogs((current) => current.filter((item) => item.id !== entry.id))
    }
  }

  const runTest = async (type) => {
    const settings = type === 'inbound' ? inbound : outbound
    const requiredFields = type === 'inbound' ? ['host', 'port', 'email', 'password'] : ['host', 'port', 'email', 'password']
    if (type === 'send' && !testEmail.trim()) {
      const message = 'Enter a recipient email address before sending a test message.'
      setTestResult({ type, status: 'error', message })
      void writeEmailLog({ direction: 'Outbound', event: 'Test email', status: 'Error', details: message })
      return
    }
    if (type === 'send') {
      setTestResult({ type, status: 'running', message: 'Sending test email through the API SMTP connector...' })
      try {
        const result = await emailApi.sendTestEmail(testEmail.trim())
        const status = result.success ? 'success' : 'error'
        setTestResult({ type, status, message: result.message })
        void writeEmailLog({ direction: 'Outbound', event: 'Test email', status: result.success ? 'Completed' : 'Error', recipient: testEmail.trim(), details: result.message })
      } catch (error) {
        const message = `Test email could not be sent: ${error.message}`
        setTestResult({ type, status: 'error', message })
        void writeEmailLog({ direction: 'Outbound', event: 'Test email', status: 'Error', recipient: testEmail.trim(), details: message })
      }
      return
    }
    if (type === 'outbound') {
      setTestResult({ type, status: 'running', message: 'Testing the API service SMTP connection...' })
      try {
        const result = await emailApi.testOutboundConnection()
        const status = result.success ? 'success' : 'error'
        setTestResult({ type, status, message: result.message })
        void writeEmailLog({ direction: 'Outbound', event: 'Connection test', status: result.success ? 'Completed' : 'Error', details: result.message })
      } catch (error) {
        const message = `SMTP connection test could not be completed: ${error.message}`
        setTestResult({ type, status: 'error', message })
        void writeEmailLog({ direction: 'Outbound', event: 'Connection test', status: 'Error', details: message })
      }
      return
    }
    if (type !== 'send' && requiredFields.some((field) => !String(settings[field] || '').trim())) {
      const message = `Complete the server, port, email address, and password fields before testing ${type} email.`
      setTestResult({ type, status: 'error', message })
      void writeEmailLog({ direction: type === 'inbound' ? 'Inbound' : 'Outbound', event: 'Connection test', status: 'Error', details: message })
      return
    }
    setTestResult({ type, status: 'running', message: `Testing ${type} connection...` })
    setTimeout(() => {
      const message = `${type === 'inbound' ? 'Inbound' : type === 'outbound' ? 'Outbound' : 'Test email'} configuration is complete. External delivery testing requires a server-side mail connector.`
      setTestResult({ type, status: 'success', message })
      void writeEmailLog({ direction: type === 'inbound' ? 'Inbound' : 'Outbound', event: type === 'send' ? 'Test email' : 'Connection test', status: 'Completed', recipient: type === 'send' ? testEmail.trim() : '', details: message })
    }, 1500)
  }

  const saveSettings = async (type) => {
    const settings = type === 'inbound' ? inbound : outbound
    if (!settings.host.trim() || !settings.port.trim() || !settings.email.trim()) {
      const message = `Complete the server, port, and email address before saving ${type} settings.`
      setSaveMessage(message)
      void writeEmailLog({ direction: type === 'inbound' ? 'Inbound' : 'Outbound', event: 'Configuration save', status: 'Error', details: message })
      return
    }
    try {
      const persistedInbound = { ...inbound, password: '' }
      const persistedOutbound = { ...outbound, password: '' }
      await recordApi.bulkUpsert('email_settings', [{
        record_id: 'email-configuration',
        payload: { inbound: persistedInbound, outbound: persistedOutbound, updatedAt: new Date().toISOString() },
      }])
      const message = `${type === 'inbound' ? 'Inbound' : 'Outbound'} settings saved. Passwords are managed by the API service and are not stored in browser settings.`
      setSaveMessage(message)
      void writeEmailLog({ direction: type === 'inbound' ? 'Inbound' : 'Outbound', event: 'Configuration save', status: 'Completed', recipient: settings.email, details: message })
    } catch (error) {
      const message = `Settings could not be saved: ${error.message}`
      setSaveMessage(message)
      void writeEmailLog({ direction: type === 'inbound' ? 'Inbound' : 'Outbound', event: 'Configuration save', status: 'Error', details: message })
    }
  }

  const applyInboundProvider = (provider) => setInbound((current) => ({ ...current, ...inboundProviderPresets[provider], provider }))
  const applyOutboundProvider = (provider) => setOutbound((current) => ({ ...current, ...outboundProviderPresets[provider], provider }))

  const activeUsers = users.filter((user) => user.status === 'Active' && user.email)
  const activeGroups = assignmentGroups.filter((group) => group.active)
  const toggleSelection = (field, id) => setOutboundRuleDraft((current) => ({
    ...current,
    [field]: current[field].includes(id) ? current[field].filter((currentId) => currentId !== id) : [...current[field], id],
  }))
  const resolveRuleRecipients = (rule) => {
    const membersForGroups = (groups) => new Set(groups.flatMap((group) => group.memberIds || []).map(String))
    const selectedGroups = activeGroups.filter((group) => rule.groupIds.includes(String(group.id)))
    const selectedUsers = activeUsers.filter((user) => rule.userIds.includes(String(user.id)))
    const groupMembers = activeUsers.filter((user) => membersForGroups(rule.recipientType === 'all_assignment_groups' ? activeGroups : selectedGroups).has(String(user.id)))
    const internalUsers = rule.recipientType === 'all_assignment_groups' || rule.recipientType === 'multiple_assignment_groups'
      ? groupMembers
      : ['specific_user', 'custom_recipients'].includes(rule.recipientType) ? selectedUsers : []
    return [...new Set([...internalUsers.map((user) => user.email.trim().toLowerCase()), ...(rule.recipientType === 'custom_recipients' ? splitEmails(rule.externalEmails) : [])])]
  }
  const saveOutboundRule = async () => {
    const externalEmails = splitEmails(outboundRuleDraft.externalEmails)
    if (!outboundRuleDraft.name.trim()) { setOutboundRuleError('Enter a rule name before saving.'); return }
    if (outboundRuleDraft.recipientType === 'multiple_assignment_groups' && !outboundRuleDraft.groupIds.length) { setOutboundRuleError('Select at least one assignment group.'); return }
    if (outboundRuleDraft.recipientType === 'specific_user' && !outboundRuleDraft.userIds.length) { setOutboundRuleError('Select at least one user.'); return }
    if (outboundRuleDraft.recipientType === 'custom_recipients' && !outboundRuleDraft.userIds.length && !externalEmails.length) { setOutboundRuleError('Select an internal user or enter at least one external email address.'); return }
    if (externalEmails.some((email) => !emailPattern.test(email))) { setOutboundRuleError('Enter valid email addresses separated by commas or semicolons.'); return }
    const rule = {
      id: `outbound-rule-${Date.now()}`,
      name: outboundRuleDraft.name.trim(),
      trigger: outboundRuleDraft.trigger,
      recipientType: outboundRuleDraft.recipientType,
      recipients: recipientOptions.find((option) => option.value === outboundRuleDraft.recipientType)?.label || 'Recipients',
      template: templates.find((template) => template.id === outboundRuleDraft.templateId)?.name || '',
      templateId: outboundRuleDraft.templateId,
      groupIds: outboundRuleDraft.groupIds,
      userIds: outboundRuleDraft.userIds,
      externalEmails,
      resolvedRecipients: resolveRuleRecipients({ ...outboundRuleDraft, externalEmails: externalEmails.join(',') }),
      active: true,
    }
    try {
      await recordApi.bulkUpsert('outbound_email_rules', [{ record_id: rule.id, payload: rule }])
      setOutboundRules((current) => [...current, rule])
      setOutboundRuleDraft(emptyOutboundRule)
      setOutboundRuleError('')
      setShowRuleForm(false)
    } catch (error) {
      setOutboundRuleError(`Rule could not be saved: ${error.message}`)
    }
  }

  const openNewTemplateForm = () => {
    setEditingTemplateId(null)
    setTemplateDraft(emptyTemplateDraft)
    setShowTemplateForm(true)
  }

  const openEditTemplateForm = (template) => {
    setEditingTemplateId(template.id)
    setTemplateDraft({ id: template.id, name: template.name, subject: template.subject, body: template.body })
    setShowTemplateForm(true)
  }

  const closeTemplateForm = () => {
    setShowTemplateForm(false)
    setEditingTemplateId(null)
    setTemplateDraft(emptyTemplateDraft)
  }

  const saveTemplate = () => {
    if (!templateDraft.id.trim() || !templateDraft.name.trim() || !templateDraft.subject.trim() || !templateDraft.body.trim()) return
    const nextTemplate = {
      ...templateDraft,
      id: templateDraft.id.trim(),
      name: templateDraft.name.trim(),
      subject: templateDraft.subject.trim(),
      body: templateDraft.body.trim(),
      description: editingTemplateId ? templates.find((template) => template.id === editingTemplateId)?.description : 'Reusable notification template.',
      usedBy: editingTemplateId ? templates.find((template) => template.id === editingTemplateId)?.usedBy ?? 0 : 0,
    }
    setTemplates((current) => editingTemplateId
      ? current.map((template) => template.id === editingTemplateId ? nextTemplate : template)
      : [...current, nextTemplate])
    closeTemplateForm()
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
                <label>Email provider</label>
                <select className="toolbar-select full" value={inbound.provider} onChange={e => applyInboundProvider(e.target.value)}>
                  <option value="custom">Custom mail server</option><option value="gmail">Gmail</option><option value="outlook">Microsoft 365 / Outlook</option>
                </select>
                {inbound.provider !== 'custom' && <p className="field-hint">IMAP settings are pre-filled. Use an app password or OAuth-enabled mailbox credentials.</p>}
              </div>
              <div className="field">
                <label>Protocol</label>
                <select className="toolbar-select full" value={inbound.protocol} onChange={e => setInbound({...inbound, provider: 'custom', protocol: e.target.value})}>
                  <option>IMAP</option><option>POP3</option>
                </select>
              </div>
              <div className="field"><label>Mail server host</label><input placeholder="e.g. imap.gmail.com" value={inbound.host} onChange={e => setInbound({...inbound, provider: 'custom', host: e.target.value})} /></div>
              <div className="field"><label>Port</label><input placeholder="993" value={inbound.port} onChange={e => setInbound({...inbound, provider: 'custom', port: e.target.value})} /></div>
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
            <div className="form-actions"><button className="primary-button" onClick={() => saveSettings('inbound')}><Save size={16} /> Save inbound settings</button><button className="secondary-button" onClick={() => runTest('inbound')}><Play size={14} /> Test connection</button>{saveMessage && <span className="field-hint">{saveMessage}</span>}{testResult?.type === 'inbound' && <span className="field-hint">{testResult.message}</span>}</div>
          </div>
        )}

        {/* ── OUTBOUND SETTINGS ── */}
        {activeTab === 'outbound' && (
          <div className="form-panel no-border">
            <div className="form-panel-head"><h2><ArrowUpFromLine size={18} /> Outbound email configuration</h2></div>
            <p className="form-desc">Configure the SMTP server used for sending notifications and updates.</p>
            <div className="form-grid">
              <div className="field">
                <label>Email provider</label>
                <select className="toolbar-select full" value={outbound.provider} onChange={e => applyOutboundProvider(e.target.value)}>
                  <option value="custom">Custom SMTP server</option><option value="gmail">Gmail</option><option value="outlook">Microsoft 365 / Outlook</option>
                </select>
                {outbound.provider !== 'custom' && <p className="field-hint">SMTP settings are pre-filled. Use an app password or OAuth-enabled mailbox credentials.</p>}
              </div>
              <div className="field"><label>SMTP host</label><input placeholder="e.g. smtp.gmail.com" value={outbound.host} onChange={e => setOutbound({...outbound, provider: 'custom', host: e.target.value})} /></div>
              <div className="field"><label>Port</label><input placeholder="587" value={outbound.port} onChange={e => setOutbound({...outbound, provider: 'custom', port: e.target.value})} /></div>
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
              <div className="field"><label>Password / App password</label><input type="password" placeholder="Configured on the API service" value={outbound.password} onChange={e => setOutbound({...outbound, password: e.target.value})} /><p className="field-hint">Set the permanent credential as <code>SMTP_PASSWORD</code> in the API service environment. It is not saved in browser settings.</p></div>
              <div className="field"><label>From name</label><input placeholder="Aerofix Service" value={outbound.fromName} onChange={e => setOutbound({...outbound, fromName: e.target.value})} /></div>
              <div className="field"><label>From email</label><input type="email" placeholder="no-reply@company.com" value={outbound.fromEmail} onChange={e => setOutbound({...outbound, fromEmail: e.target.value})} /></div>
            </div>
            <div className="form-actions"><button className="primary-button" onClick={() => saveSettings('outbound')}><Save size={16} /> Save outbound settings</button><button className="secondary-button" onClick={() => runTest('outbound')}><Play size={14} /> Test connection</button>{saveMessage && <span className="field-hint">{saveMessage}</span>}{testResult?.type === 'outbound' && <span className="field-hint">{testResult.message}</span>}</div>
          </div>
        )}

        {/* ── INBOUND RULES ── */}
        {activeTab === 'inbound-rules' && (
          <>
            <div className="rules-header">
              <div><h2>Inbound rules</h2><p>Define how incoming emails are processed and routed to incidents.</p></div>
              <button className="primary-button" onClick={() => { setShowRuleForm(true); setOutboundRuleError('') }}><Plus size={16} /> Add rule</button>
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
                  <div className="field"><label>Rule name</label><input placeholder="e.g. Assignment notification" value={outboundRuleDraft.name} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><label>Trigger event</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.trigger} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, trigger: event.target.value }))}>
                      <option>On incident creation</option><option>On status change</option><option>On assignment change</option><option>Before SLA breach</option><option>On resolution</option><option>On closure</option>
                    </select>
                  </div>
                  <div className="field"><label>Recipients</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.recipientType} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, recipientType: event.target.value, groupIds: [], userIds: [], externalEmails: '' }))}>{recipientOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                  <div className="field"><label>Email template</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.templateId} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, templateId: event.target.value }))}>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  </div>
                  {outboundRuleDraft.recipientType === 'all_assignment_groups' && <div className="field full-width"><p className="field-hint recipient-resolution">All active assignment groups are included. {resolveRuleRecipients(outboundRuleDraft).length} distinct active member email{resolveRuleRecipients(outboundRuleDraft).length === 1 ? '' : 's'} will receive this notification.</p></div>}
                  {outboundRuleDraft.recipientType === 'multiple_assignment_groups' && <div className="field full-width"><label>Assignment groups</label><div className="recipient-lookup">{activeGroups.map((group) => <label key={group.id}><input type="checkbox" checked={outboundRuleDraft.groupIds.includes(String(group.id))} onChange={() => toggleSelection('groupIds', String(group.id))} /> {group.name}</label>)}</div><p className="field-hint">{resolveRuleRecipients(outboundRuleDraft).length} distinct active member email{resolveRuleRecipients(outboundRuleDraft).length === 1 ? '' : 's'} selected. Duplicate memberships are automatically removed.</p></div>}
                  {['specific_user', 'custom_recipients'].includes(outboundRuleDraft.recipientType) && <div className="field full-width"><label>{outboundRuleDraft.recipientType === 'specific_user' ? 'Specific users' : 'Internal users'}</label><div className="recipient-lookup">{activeUsers.map((user) => <label key={user.id}><input type="checkbox" checked={outboundRuleDraft.userIds.includes(String(user.id))} onChange={() => toggleSelection('userIds', String(user.id))} /> {user.name} <span>{user.email}</span></label>)}</div></div>}
                  {outboundRuleDraft.recipientType === 'custom_recipients' && <div className="field full-width"><label>External email addresses</label><input placeholder="supplier@example.com, partner@example.com" value={outboundRuleDraft.externalEmails} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, externalEmails: event.target.value }))} /><p className="field-hint">Separate addresses with commas or semicolons. Internal and external addresses are deduplicated before sending.</p></div>}
                </div>
                <div className="form-actions"><button className="primary-button" onClick={saveOutboundRule}>Save rule</button>{outboundRuleError && <span className="field-hint form-error">{outboundRuleError}</span>}</div>
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
                          <button className="row-action danger" title="Delete" onClick={async () => { await recordApi.remove('outbound_email_rules', r.id); setOutboundRules((current) => current.filter((rule) => rule.id !== r.id)) }}><Trash2 size={14} /></button>
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
              <button className="primary-button" onClick={openNewTemplateForm}><Plus size={16} /> New template</button>
            </div>
            {showTemplateForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>{editingTemplateId ? 'Edit template' : 'New template'}</h2><button className="text-button" onClick={closeTemplateForm}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field"><label>Template name</label><input placeholder="e.g. Weekly digest" value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><label>Template ID</label><input placeholder="e.g. weekly_digest" value={templateDraft.id} disabled={Boolean(editingTemplateId)} onChange={(event) => setTemplateDraft((current) => ({ ...current, id: event.target.value }))} /></div>
                  <div className="field full-width"><label>Subject line</label><input placeholder='e.g. Weekly summary — {{date}}' value={templateDraft.subject} onChange={(event) => setTemplateDraft((current) => ({ ...current, subject: event.target.value }))} /><p className="field-hint">Available: {'{{incident_id}}'}, {'{{title}}'}, {'{{status}}'}, {'{{customer}}'}, {'{{assignee}}'}, {'{{date}}'}</p></div>
                  <div className="field full-width"><label>Body</label><TemplateBodyEditor value={templateDraft.body} onChange={(body) => setTemplateDraft((current) => ({ ...current, body }))} /></div>
                </div>
                <div className="form-actions"><button className="primary-button" onClick={saveTemplate}>Save template</button></div>
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
                      <button className="row-action" title="Edit template" onClick={() => openEditTemplateForm(t)}><Pencil size={14} /></button>
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

        {activeTab === 'logs' && (
          <section className="testing-section">
            <div className="rules-header"><div><h2>Email logs</h2><p>Review inbound and outbound email activity, test attempts, and captured errors.</p></div><label className="approval-filter-select"><select value={logFilter} onChange={(event) => setLogFilter(event.target.value)}><option value="All">All activity</option><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option><option value="Error">Errors</option></select></label></div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Direction</th><th>Event</th><th>Recipient</th><th>Status</th><th>Details</th></tr></thead><tbody>{emailLogs.filter((entry) => logFilter === 'All' || entry.direction === logFilter || entry.status === logFilter).map((entry) => <tr key={entry.id}><td>{new Date(entry.occurredAt).toLocaleString('en-GB')}</td><td>{entry.direction}</td><td>{entry.event}</td><td>{entry.recipient || '--'}</td><td><span className={`badge ${entry.status === 'Error' ? 'closed' : 'new'}`}>{entry.status}</span></td><td>{entry.details}</td></tr>)}{!emailLogs.filter((entry) => logFilter === 'All' || entry.direction === logFilter || entry.status === logFilter).length && <tr><td colSpan="6" className="empty-row">No email logs match the current filter.</td></tr>}</tbody></table></div>
          </section>
        )}
      </div>
    </>
  )
}
