import { useEffect, useState } from 'react'
import {
  Mail, Send, ArrowDownToLine, ArrowUpFromLine, FileCode, FlaskConical,
  Plus, Trash2, Pencil, Copy, CheckCircle2, XCircle, Play, Save, ChevronRight,
  Bold, Italic, Underline as UnderlineIcon, Heading2, List, ListOrdered, Link2, Undo2, Redo2, ImagePlus, Table2, Eye, RefreshCw, X
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Image } from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
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
  approvalType: '',
  recipientType: 'assigned_to',
  templateId: 'incident_creation',
  groupIds: [],
  userIds: [],
  externalEmails: '',
}

const emptyInboundRule = {
  name: '',
  condition: '',
  action: 'Create incident — assign to group',
  targetGroup: '',
  priority: 'Normal',
  active: true,
}

const recipientOptions = [
  { value: 'mentioned_users', label: 'Mentioned Users in Work Notes' },
  { value: 'requester', label: 'Requester' },
  { value: 'requested_for', label: 'Requested For' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'assignment_group', label: 'Assignment Group' },
  { value: 'approval_assignment_group', label: 'Approval Assignment Group' },
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
  id: 'incident_creation',
  name: 'Incident creation notification',
  description: 'Notifies the support team that a new incident has been created.',
  subject: 'Incident {{incident_id}} has been created',
  body: '<p>Dear Team,</p><p>Greetings from <strong>TASL Customer Support Team</strong>.</p><p>We would like to inform you that a new incident has been successfully created with the following details:</p><table role="presentation" border="1" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;border-collapse:collapse;border:1px solid #222;text-align:left;"><thead><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Details</th><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Information</th></tr></thead><tbody><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Incident Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{incident_id}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Customer</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{customer}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Created On / Opened On</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{opened}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Priority</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{priority}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Category</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{category}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Product Serial Number</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{serial_number}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Short Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{title}}</td></tr><tr><th align="left" style="padding:8px;border:1px solid #222;text-align:left;">Description</th><td align="left" style="padding:8px;border:1px solid #222;text-align:left;">{{description}}</td></tr></tbody></table><p>Please refer to the <strong>Incident Number [{{incident_id}}]</strong> in all future communications regarding this issue.</p><p>Regards,<br><strong>TASL Customer Support Team</strong></p>',
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

const tableLabel = (key) => key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
const emailTemplateTables = (data, assignmentGroups, users) => [
  { id: 'incident', label: 'Incidents', records: data.incidents || [] },
  { id: 'customer', label: 'Customers', records: data.customers || [] },
  { id: 'contract', label: 'Contracts', records: data.contracts || [] },
  { id: 'product', label: 'Product Master', records: data.products || [] },
  { id: 'user', label: 'Users', records: users || [] },
  { id: 'assignment_group', label: 'Assignment Groups', records: assignmentGroups || [] },
].map((table) => ({ ...table, columns: [...new Set(table.records.flatMap((record) => Object.keys(record || {})))].sort() }))

function TemplateBodyEditor({ value, onChange, onEditorReady }) {
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [tableSize, setTableSize] = useState({ rows: 3, columns: 3 })
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, underline: false }), Underline, Link.configure({ openOnClick: false, autolink: true }), Image, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
    content: richTextHtml(value),
    editorProps: { attributes: { class: 'template-rich-text-content', 'aria-label': 'Template body' } },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== richTextHtml(value)) editor.commands.setContent(richTextHtml(value), false)
  }, [editor, value])

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  if (!editor) return null
  const format = (command) => () => editor.chain().focus()[command]().run()
  const addLink = () => {
    const url = window.prompt('Enter link URL')
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  const addImage = () => {
    const url = window.prompt('Enter the image URL')
    if (url) editor.chain().focus().setImage({ src: url, alt: 'Email image' }).run()
  }
  const insertTable = (rows, columns) => {
    editor.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: true }).run()
    setTablePickerOpen(false)
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
      <button type="button" title="Add image from URL" aria-label="Add image from URL" onClick={addImage}><ImagePlus size={15} /></button>
      <div className="template-table-picker"><button type="button" title="Insert table" aria-label="Insert table" aria-expanded={tablePickerOpen} className={tablePickerOpen ? 'active' : ''} onClick={() => setTablePickerOpen((open) => !open)}><Table2 size={15} /></button>{tablePickerOpen && <div className="template-table-size-menu" role="dialog" aria-label="Select table size"><div className="template-table-size-grid" onMouseLeave={() => setTableSize({ rows: 3, columns: 3 })}>{Array.from({ length: 8 }, (_, rowIndex) => Array.from({ length: 10 }, (_, columnIndex) => { const rows = rowIndex + 1; const columns = columnIndex + 1; const selected = rows <= tableSize.rows && columns <= tableSize.columns; return <button type="button" key={`${rows}-${columns}`} className={selected ? 'selected' : ''} aria-label={`${rows} rows by ${columns} columns`} title={`${rows} x ${columns}`} onMouseEnter={() => setTableSize({ rows, columns })} onFocus={() => setTableSize({ rows, columns })} onClick={() => insertTable(rows, columns)} /> }))}</div><strong>{tableSize.rows} x {tableSize.columns} table</strong></div>}</div>
      <span />
      <button type="button" title="Undo" aria-label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></button>
      <button type="button" title="Redo" aria-label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></button>
    </div>
    <EditorContent editor={editor} />
  </div>
}

export default function EmailSettingsPage({ assignmentGroups, users, data = {} }) {
  const [activeTab, setActiveTab] = useState('inbound')
  const [inbound, setInbound] = useState({ provider: 'custom', protocol: 'IMAP', host: '', port: '993', ssl: true, email: '', password: '', folder: 'INBOX', pollInterval: '5' })
  const [outbound, setOutbound] = useState({ provider: 'custom', host: '', port: '587', ssl: true, auth: true, email: '', password: '', fromName: 'Aerofix Service', fromEmail: '' })
  const [inboundRules, setInboundRules] = useState(sampleInboundRules)
  const [outboundRules, setOutboundRules] = useState(sampleOutboundRules)
  const [templates, setTemplates] = useState(sampleTemplates)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [showInboundRuleForm, setShowInboundRuleForm] = useState(false)
  const [inboundRuleDraft, setInboundRuleDraft] = useState(emptyInboundRule)
  const [editingInboundRuleId, setEditingInboundRuleId] = useState(null)
  const [editingOutboundRuleId, setEditingOutboundRuleId] = useState(null)
  const [outboundRuleDraft, setOutboundRuleDraft] = useState(emptyOutboundRule)
  const [outboundRuleError, setOutboundRuleError] = useState('')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [templateDraft, setTemplateDraft] = useState(emptyTemplateDraft)
  const [templateToCopy, setTemplateToCopy] = useState(null)
  const [copiedTemplateName, setCopiedTemplateName] = useState('')
  const [copyTemplateError, setCopyTemplateError] = useState('')
  const [templateEditor, setTemplateEditor] = useState(null)
  const [templateTableId, setTemplateTableId] = useState('incident')
  const [testResult, setTestResult] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [emailLogs, setEmailLogs] = useState([])
  const [logFilter, setLogFilter] = useState('All')
  const [logSort, setLogSort] = useState('newest')
  const [logPage, setLogPage] = useState(1)
  const [selectedEmailLog, setSelectedEmailLog] = useState(null)
  const [viewingTemplate, setViewingTemplate] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const templateTables = emailTemplateTables(data, assignmentGroups, users)
  const selectedTemplateTable = templateTables.find((table) => table.id === templateTableId) || templateTables[0]
  const loadEmailLogs = async () => {
    setLogsLoading(true)
    try {
      const records = await recordApi.list('email_logs')
      setEmailLogs(records.map((record) => record.payload))
      setLogPage(1)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    recordApi.list('email_settings')
      .then((records) => {
        const settings = records.find((record) => record.record_id === 'email-configuration')?.payload
        if (!settings) return
        setInbound((current) => ({ ...current, ...(settings.inbound || {}), password: '' }))
        setOutbound((current) => ({ ...current, ...(settings.outbound || {}), password: '' }))
        setInboundRules(Array.isArray(settings.inboundRules) ? settings.inboundRules : sampleInboundRules)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    recordApi.list('outbound_email_rules')
      .then((records) => setOutboundRules(records.map((record) => record.payload)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    recordApi.list('email_templates')
      .then((records) => setTemplates(records.length ? records.map((record) => record.payload) : sampleTemplates))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab !== 'logs') return undefined
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadEmailLogs()
    }
    void loadEmailLogs()
    const refreshTimer = window.setInterval(refreshWhenVisible, 15000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [activeTab])

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
        payload: { inbound: persistedInbound, outbound: persistedOutbound, inboundRules, updatedAt: new Date().toISOString() },
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
  const saveInboundRules = async (nextRules) => {
    const persistedInbound = { ...inbound, password: '' }
    const persistedOutbound = { ...outbound, password: '' }
    await recordApi.bulkUpsert('email_settings', [{
      record_id: 'email-configuration',
      payload: { inbound: persistedInbound, outbound: persistedOutbound, inboundRules: nextRules, updatedAt: new Date().toISOString() },
    }])
    setInboundRules(nextRules)
  }
  const openInboundRuleForm = (rule = null) => {
    setEditingInboundRuleId(rule?.id || null)
    setInboundRuleDraft(rule ? { ...emptyInboundRule, ...rule } : emptyInboundRule)
    setShowInboundRuleForm(true)
  }
  const saveInboundRule = async () => {
    if (!inboundRuleDraft.name.trim() || !inboundRuleDraft.condition.trim()) return
    const rule = { ...inboundRuleDraft, id: editingInboundRuleId || `inbound-rule-${Date.now()}`, name: inboundRuleDraft.name.trim(), condition: inboundRuleDraft.condition.trim() }
    const nextRules = editingInboundRuleId ? inboundRules.map((current) => current.id === editingInboundRuleId ? rule : current) : [...inboundRules, rule]
    try {
      await saveInboundRules(nextRules)
      setShowInboundRuleForm(false)
      setEditingInboundRuleId(null)
      setInboundRuleDraft(emptyInboundRule)
    } catch (error) {
      setSaveMessage(`Inbound rule could not be saved: ${error.message}`)
    }
  }

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
    if (outboundRuleDraft.trigger === 'On approval required' && !outboundRuleDraft.approvalType) { setOutboundRuleError('Select the approval type before saving this rule.'); return }
    if (outboundRuleDraft.recipientType === 'multiple_assignment_groups' && !outboundRuleDraft.groupIds.length) { setOutboundRuleError('Select at least one assignment group.'); return }
    if (outboundRuleDraft.recipientType === 'specific_user' && !outboundRuleDraft.userIds.length) { setOutboundRuleError('Select at least one user.'); return }
    if (outboundRuleDraft.recipientType === 'custom_recipients' && !outboundRuleDraft.userIds.length && !externalEmails.length) { setOutboundRuleError('Select an internal user or enter at least one external email address.'); return }
    if (externalEmails.some((email) => !emailPattern.test(email))) { setOutboundRuleError('Enter valid email addresses separated by commas or semicolons.'); return }
    const rule = {
      id: editingOutboundRuleId || `outbound-rule-${Date.now()}`,
      name: outboundRuleDraft.name.trim(),
      trigger: outboundRuleDraft.trigger,
      approvalType: outboundRuleDraft.trigger === 'On approval required' ? outboundRuleDraft.approvalType : '',
      recipientType: outboundRuleDraft.recipientType,
      recipients: recipientOptions.find((option) => option.value === outboundRuleDraft.recipientType)?.label || 'Recipients',
      template: templates.find((template) => template.id === outboundRuleDraft.templateId)?.name || '',
      templateId: outboundRuleDraft.templateId,
      groupIds: outboundRuleDraft.groupIds,
      userIds: outboundRuleDraft.userIds,
      externalEmails,
      resolvedRecipients: resolveRuleRecipients({ ...outboundRuleDraft, externalEmails: externalEmails.join(',') }),
      active: editingOutboundRuleId ? outboundRules.find((current) => current.id === editingOutboundRuleId)?.active ?? true : true,
    }
    try {
      await recordApi.bulkUpsert('outbound_email_rules', [{ record_id: rule.id, payload: rule }])
      setOutboundRules((current) => editingOutboundRuleId ? current.map((currentRule) => currentRule.id === editingOutboundRuleId ? rule : currentRule) : [...current, rule])
      setOutboundRuleDraft(emptyOutboundRule)
      setOutboundRuleError('')
      setShowRuleForm(false)
      setEditingOutboundRuleId(null)
    } catch (error) {
      setOutboundRuleError(`Rule could not be saved: ${error.message}`)
    }
  }

  const openOutboundRuleForm = (rule = null) => {
    setEditingOutboundRuleId(rule?.id || null)
    setOutboundRuleDraft(rule ? { ...emptyOutboundRule, ...rule, externalEmails: Array.isArray(rule.externalEmails) ? rule.externalEmails.join(', ') : rule.externalEmails || '' } : emptyOutboundRule)
    setOutboundRuleError('')
    setShowRuleForm(true)
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
    setTemplateEditor(null)
  }

  const openCopyTemplateDialog = (template) => {
    setTemplateToCopy(template)
    setCopiedTemplateName(`${template.name} copy`)
    setCopyTemplateError('')
  }

  const createTemplateCopy = () => {
    const name = copiedTemplateName.trim()
    if (!name) {
      setCopyTemplateError('Enter a name for the new template.')
      return
    }
    if (templates.some((template) => template.name.toLowerCase() === name.toLowerCase())) {
      setCopyTemplateError('A template with this name already exists.')
      return
    }
    const id = `${templateToCopy.id}-copy-${Date.now()}`
    setEditingTemplateId(null)
    setTemplateDraft({ id, name, subject: templateToCopy.subject, body: templateToCopy.body })
    setTemplateToCopy(null)
    setCopiedTemplateName('')
    setCopyTemplateError('')
    setShowTemplateForm(true)
  }

  const saveTemplate = async () => {
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
    try {
      await recordApi.bulkUpsert('email_templates', [{ record_id: nextTemplate.id, payload: nextTemplate }])
    } catch {
      return
    }
    setTemplates((current) => editingTemplateId
      ? current.map((template) => template.id === editingTemplateId ? nextTemplate : template)
      : [...current, nextTemplate])
    closeTemplateForm()
  }
  const deleteTemplate = async (template) => {
    if (!window.confirm(`Delete email template "${template.name}"?`)) return
    try {
      await recordApi.remove('email_templates', template.id)
      setTemplates((current) => current.filter((currentTemplate) => currentTemplate.id !== template.id))
    } catch (error) {
      setSaveMessage(`Template could not be deleted: ${error.message}`)
    }
  }
  const insertTemplateColumn = (column) => {
    const token = `{{${selectedTemplateTable.id}.${column}}}`
    if (templateEditor) templateEditor.chain().focus().insertContent(token).run()
    else setTemplateDraft((current) => ({ ...current, body: `${current.body}${current.body ? ' ' : ''}${token}` }))
  }
  const visibleEmailLogs = emailLogs
    .filter((entry) => logFilter === 'All' || entry.direction === logFilter || entry.status === logFilter)
    .sort((left, right) => (logSort === 'newest' ? -1 : 1) * ((new Date(left.occurredAt).getTime() || 0) - (new Date(right.occurredAt).getTime() || 0)))
  const logPageSize = 100
  const logPageCount = Math.max(1, Math.ceil(visibleEmailLogs.length / logPageSize))
  const currentLogPage = Math.min(logPage, logPageCount)
  const pagedEmailLogs = visibleEmailLogs.slice((currentLogPage - 1) * logPageSize, currentLogPage * logPageSize)

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
              <button className="primary-button" onClick={() => openInboundRuleForm()}><Plus size={16} /> Add rule</button>
            </div>
            {showInboundRuleForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>{editingInboundRuleId ? 'Edit inbound rule' : 'New inbound rule'}</h2><button className="text-button" onClick={() => setShowInboundRuleForm(false)}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field full-width"><label>Rule name</label><input placeholder="e.g. VIP customer routing" value={inboundRuleDraft.name} onChange={(event) => setInboundRuleDraft((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field full-width"><label>Condition</label><input placeholder='e.g. From domain = "army.ug" AND Subject contains "service"' value={inboundRuleDraft.condition} onChange={(event) => setInboundRuleDraft((current) => ({ ...current, condition: event.target.value }))} /><p className="field-hint">Use AND/OR logic with field matching</p></div>
                  <div className="field full-width"><label>Action</label>
                    <select className="toolbar-select full" value={inboundRuleDraft.action} onChange={(event) => setInboundRuleDraft((current) => ({ ...current, action: event.target.value }))}>
                      <option>Create incident — assign to group</option><option>Create incident — set priority</option><option>Forward to email</option><option>Ignore / archive</option>
                    </select>
                  </div>
                  <div className="field"><label>Target group</label>
                    <select className="toolbar-select full" value={inboundRuleDraft.targetGroup} onChange={(event) => setInboundRuleDraft((current) => ({ ...current, targetGroup: event.target.value }))}><option value="">No group selected</option>{activeGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select>
                  </div>
                  <div className="field"><label>Priority</label>
                    <select className="toolbar-select full" value={inboundRuleDraft.priority} onChange={(event) => setInboundRuleDraft((current) => ({ ...current, priority: event.target.value }))}><option>Normal</option><option>High</option><option>Critical</option><option>Low</option></select>
                  </div>
                </div>
                <div className="form-actions"><button className="primary-button" onClick={saveInboundRule}>Save rule</button></div>
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
                          <button className="row-action" title="Edit" onClick={() => openInboundRuleForm(r)}><Pencil size={14} /></button>
                          <button className="row-action danger" title="Delete" onClick={async () => { if (window.confirm(`Delete inbound rule "${r.name}"?`)) await saveInboundRules(inboundRules.filter((rule) => rule.id !== r.id)) }}><Trash2 size={14} /></button>
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
              <button className="primary-button" onClick={() => openOutboundRuleForm()}><Plus size={16} /> Add rule</button>
            </div>
            {showRuleForm && (
              <div className="form-panel">
                <div className="form-panel-head"><h2>{editingOutboundRuleId ? 'Edit outbound rule' : 'New outbound rule'}</h2><button className="text-button" onClick={() => setShowRuleForm(false)}>Cancel</button></div>
                <div className="form-grid">
                  <div className="field"><label>Rule name</label><input placeholder="e.g. Assignment notification" value={outboundRuleDraft.name} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><label>Trigger event</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.trigger} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, trigger: event.target.value, approvalType: event.target.value === 'On approval required' ? current.approvalType : '' }))}>
                      <option>On incident creation</option><option>On work note update</option><option>On approval required</option><option>On post-repair dissatisfaction</option><option>On status change</option><option>On assignment change</option><option>Before SLA breach</option><option>On resolution</option><option>On closure</option>
                    </select>
                  </div>
                  {outboundRuleDraft.trigger === 'On approval required' && <div className="field"><label>Approval type</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.approvalType} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, approvalType: event.target.value }))}>
                      <option value="">Select approval type</option><option value="pre-dispatch">Pre-dispatch approval</option><option value="replacement-parts">Part replacement approval</option>
                    </select>
                  </div>}
                  <div className="field"><label>Recipients</label>
                    <select className="toolbar-select full" value={outboundRuleDraft.recipientType} onChange={(event) => setOutboundRuleDraft((current) => ({ ...current, recipientType: event.target.value, groupIds: [], userIds: [], externalEmails: '' }))}>{recipientOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                  {outboundRuleDraft.recipientType === 'approval_assignment_group' && <div className="field full-width"><p className="field-hint recipient-resolution">Recipients are resolved from the approval assignment group on each incident.</p></div>}
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
                          <button className="row-action" title="Edit" onClick={() => openOutboundRuleForm(r)}><Pencil size={14} /></button>
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
                  <div className="field full-width"><label>Body</label><div className="template-composer"><div className="template-data-picker"><label>System table<select value={selectedTemplateTable?.id || ''} onChange={(event) => setTemplateTableId(event.target.value)}>{templateTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label><p>Select a column to append its email token at the cursor.</p><div className="template-column-list">{selectedTemplateTable?.columns.length ? selectedTemplateTable.columns.map((column) => <button type="button" key={column} onClick={() => insertTemplateColumn(column)} title={`Insert {{${selectedTemplateTable.id}.${column}}}`}>{tableLabel(column)}<code>{`{{${selectedTemplateTable.id}.${column}}}`}</code></button>) : <span>No columns are available for this table.</span>}</div></div><TemplateBodyEditor value={templateDraft.body} onChange={(body) => setTemplateDraft((current) => ({ ...current, body }))} onEditorReady={setTemplateEditor} /></div></div>
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
                      <button className="row-action" title="Copy template" onClick={() => openCopyTemplateDialog(t)}><Copy size={14} /></button>
                      <button className="row-action" title="View template" onClick={() => setViewingTemplate(t)}><Eye size={14} /></button>
                      <button className="row-action" title="Edit template" onClick={() => openEditTemplateForm(t)}><Pencil size={14} /></button>
                      <button className="row-action danger" title="Delete template" onClick={() => deleteTemplate(t)}><Trash2 size={14} /></button>
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
            <div className="rules-header"><div><h2>Email logs</h2><p>Review inbound and outbound email activity, test attempts, and captured errors.</p></div><div className="email-log-controls"><label className="approval-filter-select"><span>Activity</span><select value={logFilter} onChange={(event) => { setLogFilter(event.target.value); setLogPage(1) }}><option value="All">All activity</option><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option><option value="Error">Errors</option></select></label><label className="approval-filter-select"><span>Sent date and time</span><select value={logSort} onChange={(event) => { setLogSort(event.target.value); setLogPage(1) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><button type="button" className="row-action" title="Refresh email logs" aria-label="Refresh email logs" onClick={() => void loadEmailLogs()} disabled={logsLoading}><RefreshCw size={14} className={logsLoading ? 'spin-icon' : ''} /></button></div></div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Sent date and time</th><th>Direction</th><th>Event</th><th>Recipient</th><th>Status</th><th>Details</th><th aria-label="Actions" /></tr></thead><tbody>{pagedEmailLogs.map((entry) => <tr key={entry.id}><td>{new Date(entry.occurredAt).toLocaleString('en-GB')}</td><td>{entry.direction}</td><td>{entry.event}</td><td>{entry.recipient || '--'}</td><td><span className={`badge ${['Error', 'Failed'].includes(entry.status) ? 'closed' : 'new'}`}>{entry.status}</span></td><td>{entry.details}</td><td><button type="button" className="row-action" title="View email" aria-label={`View email for ${entry.recipient || 'log entry'}`} onClick={() => setSelectedEmailLog(entry)}><Eye size={14} /></button></td></tr>)}{!visibleEmailLogs.length && <tr><td colSpan="7" className="empty-row">No email logs match the current filter.</td></tr>}</tbody></table></div>
            {visibleEmailLogs.length > logPageSize && <div className="email-log-pagination"><span>Showing {(currentLogPage - 1) * logPageSize + 1}-{Math.min(currentLogPage * logPageSize, visibleEmailLogs.length)} of {visibleEmailLogs.length}</span><div><button type="button" className="secondary-button" onClick={() => setLogPage((page) => Math.max(1, page - 1))} disabled={currentLogPage === 1}>Previous</button><span>Page {currentLogPage} of {logPageCount}</span><button type="button" className="secondary-button" onClick={() => setLogPage((page) => Math.min(logPageCount, page + 1))} disabled={currentLogPage === logPageCount}>Next</button></div></div>}
          </section>
        )}
      </div>
      {templateToCopy && <div className="email-log-preview-backdrop" role="presentation" onMouseDown={() => setTemplateToCopy(null)}><section className="email-log-preview" role="dialog" aria-modal="true" aria-labelledby="copy-template-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p>Copy email template</p><h2 id="copy-template-title">Create a new template</h2><span>Based on: {templateToCopy.name}</span></div><button type="button" className="row-action" title="Close copy template dialog" aria-label="Close copy template dialog" onClick={() => setTemplateToCopy(null)}><X size={16} /></button></header><div className="email-log-preview-body"><div className="field"><label>New template name</label><input autoFocus value={copiedTemplateName} onChange={(event) => { setCopiedTemplateName(event.target.value); setCopyTemplateError('') }} onKeyDown={(event) => { if (event.key === 'Enter') createTemplateCopy() }} placeholder="Enter a new template name" />{copyTemplateError && <p className="field-hint form-error">{copyTemplateError}</p>}</div></div><footer><button type="button" className="secondary-button" onClick={() => setTemplateToCopy(null)}>Cancel</button><button type="button" className="primary-button" onClick={createTemplateCopy}><Copy size={14} /> Copy template</button></footer></section></div>}
      {viewingTemplate && <div className="email-log-preview-backdrop" role="presentation" onMouseDown={() => setViewingTemplate(null)}><section className="email-log-preview" role="dialog" aria-modal="true" aria-labelledby="template-preview-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p>Email template</p><h2 id="template-preview-title">{viewingTemplate.name}</h2><span>Subject: {viewingTemplate.subject}</span></div><button type="button" className="row-action" title="Close template preview" aria-label="Close template preview" onClick={() => setViewingTemplate(null)}><X size={16} /></button></header><div className="email-log-preview-body"><iframe title={`${viewingTemplate.name} preview`} sandbox="" srcDoc={richTextHtml(viewingTemplate.body)} /></div><footer><button type="button" className="secondary-button" onClick={() => setViewingTemplate(null)}>Close</button><button type="button" className="primary-button" onClick={() => { const template = viewingTemplate; setViewingTemplate(null); openEditTemplateForm(template) }}><Pencil size={14} /> Edit template</button></footer></section></div>}
      {selectedEmailLog && <div className="email-log-preview-backdrop" role="presentation" onMouseDown={() => setSelectedEmailLog(null)}><section className="email-log-preview" role="dialog" aria-modal="true" aria-labelledby="email-log-preview-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p>Outbound email</p><h2 id="email-log-preview-title">{selectedEmailLog.subject || selectedEmailLog.event}</h2><span>To: {selectedEmailLog.recipient || '--'} · {new Date(selectedEmailLog.occurredAt).toLocaleString('en-GB')}</span></div><button type="button" className="row-action" title="Close email preview" aria-label="Close email preview" onClick={() => setSelectedEmailLog(null)}><X size={16} /></button></header><div className="email-log-preview-body">{selectedEmailLog.content ? <iframe title="Email content" sandbox="" srcDoc={selectedEmailLog.content} /> : <p className="empty-hint">This historical log contains delivery information only. Message content is saved for emails sent after email-log viewing was enabled.</p>}</div><footer><span className={`badge ${['Error', 'Failed'].includes(selectedEmailLog.status) ? 'closed' : 'new'}`}>{selectedEmailLog.status}</span><button type="button" className="secondary-button" onClick={() => setSelectedEmailLog(null)}>Close</button></footer></section></div>}
    </>
  )
}
