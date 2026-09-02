import { useEffect, useState } from 'react'
import { AlertCircle, Building2, CheckCircle2, Edit2, Info, Plus, Save, ServerCog, Trash2, X } from 'lucide-react'
import { authenticationApi } from '../data/api'

const activeDirectoryVariables = [
  ['LDAP_SERVER_URI', 'LDAPS server URI', 'ldaps://ad.company.com:636'],
  ['LDAP_BASE_DN', 'Directory search base', 'OU=Users,DC=company,DC=com'],
  ['LDAP_BIND_DN', 'Read-only service account', 'CN=ServiceAccount,OU=Users,DC=company,DC=com'],
  ['LDAP_BIND_PASSWORD', 'Service account password', 'Stored in the deployment secret store'],
  ['LDAP_USER_DOMAIN', 'Microsoft AD domain', 'company.com'],
]

export default function AuthenticationSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [roleMappings, setRoleMappings] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editingSettings, setEditingSettings] = useState(null)
  const [editingMapping, setEditingMapping] = useState(null)
  const [addingMapping, setAddingMapping] = useState(false)
  const [newMapping, setNewMapping] = useState({ directory_group: '', application_role: '', enabled: true })

  useEffect(() => {
    Promise.all([
      authenticationApi.getSettings().then((result) => { const adSettings = { ...result, provider: 'ldap_ad' }; setSettings(adSettings); setEditingSettings(adSettings) }),
      authenticationApi.listRoleMappings().then(setRoleMappings),
      authenticationApi.getHealth().then(setHealth),
    ]).catch(() => setMessage('Failed to load authentication settings.')).finally(() => setLoading(false))
  }, [])

  const saveSettings = async () => {
    if (!editingSettings) return
    try {
      const updated = await authenticationApi.updateSettings({ ...editingSettings, provider: 'ldap_ad' })
      setSettings(updated); setEditingSettings(updated); setMessage('General authentication settings saved.')
    } catch (error) { setMessage(error.message) }
  }
  const saveMapping = async () => {
    if (!editingMapping) return
    try {
      await authenticationApi.saveRoleMapping(editingMapping.directory_group, editingMapping)
      setRoleMappings((mappings) => mappings.map((mapping) => mapping.directory_group === editingMapping.directory_group ? editingMapping : mapping))
      setEditingMapping(null); setMessage('Role mapping saved.')
    } catch (error) { setMessage(error.message) }
  }
  const addMapping = async () => {
    if (!newMapping.directory_group.trim() || !newMapping.application_role.trim()) return
    try {
      await authenticationApi.saveRoleMapping(newMapping.directory_group, newMapping)
      setRoleMappings((mappings) => [...mappings, newMapping]); setNewMapping({ directory_group: '', application_role: '', enabled: true }); setAddingMapping(false); setMessage('Role mapping added.')
    } catch (error) { setMessage(error.message) }
  }
  const deleteMapping = (directoryGroup) => {
    setRoleMappings((mappings) => mappings.filter((mapping) => mapping.directory_group !== directoryGroup))
    setMessage('Role mapping removed locally. Use the API deletion endpoint to persist this action.')
  }

  if (loading) return <div className="page-heading"><h1>Authentication Settings</h1><p className="subtitle">Loading...</p></div>

  return <div className="authentication-settings-page">
    <div className="page-heading"><div><h1>Microsoft Active Directory</h1><p className="subtitle">Connect this portal to the client’s existing Microsoft Active Directory.</p></div></div>
    {health && <div className="auth-provider-summary"><div className="auth-summary-icon"><Building2 size={20} /></div><div><strong>Active Directory connection</strong><span>{health.ldap_configured ? 'Required directory values are available to the application.' : 'Add the required directory values to the deployment environment before enabling sign-in.'}</span></div><span className={`auth-status ${health.ldap_configured ? 'configured' : 'required'}`}>{health.ldap_configured ? 'Ready' : 'Action required'}</span></div>}
    {message && <div className="auth-message"><AlertCircle size={16} />{message}</div>}
    {settings && editingSettings && <>
      <section className="auth-panel">
      <div className="auth-panel-heading"><div><p className="auth-eyebrow">Directory integration</p><h2>Connection requirements</h2><p>The application reads these values from the deployment environment. Passwords are never displayed here.</p></div><ServerCog size={22} /></div>
      <div className="auth-secret-notice"><Info size={16} /><span>Use LDAPS with the client’s existing read-only service account. The service account needs permission to read users and group membership.</span></div>
      <div className="auth-config-list">{activeDirectoryVariables.map(([variable, label, example]) => <div className="auth-config-row" key={variable}><div><strong>{label}</strong><code>{variable}</code></div><code className="auth-config-example">{example}</code></div>)}</div>
      </section>
      <section className="auth-panel auth-ad-policy-panel">
      <div className="auth-panel-heading"><div><p className="auth-eyebrow">Sign-in policy</p><h2>Active Directory sign-in</h2><p>Users authenticate with their Microsoft Active Directory credentials. The local administrator account always uses its separate password.</p></div></div>
      <div className="auth-policy-grid">
        <div className="auth-readonly-field"><span>Authentication source</span><strong><Building2 size={16} />Microsoft Active Directory (LDAPS)</strong></div>
        <label className="auth-toggle"><input type="checkbox" checked={editingSettings.enabled} onChange={(event) => setEditingSettings({ ...editingSettings, enabled: event.target.checked })} /><span><strong>Enable Active Directory sign-in</strong><small>Require directory authentication for all non-admin users.</small></span></label>
        <label><span>Session timeout (minutes)</span><input type="number" min="5" max="1440" value={editingSettings.session_timeout_minutes} onChange={(event) => setEditingSettings({ ...editingSettings, session_timeout_minutes: Number(event.target.value) })} /></label>
        <label><span>Failed-login lockout threshold</span><input type="number" min="1" max="20" value={editingSettings.lockout_threshold} onChange={(event) => setEditingSettings({ ...editingSettings, lockout_threshold: Number(event.target.value) })} /></label>
        <label><span>Lockout duration (minutes)</span><input type="number" min="1" max="1440" value={editingSettings.lockout_minutes} onChange={(event) => setEditingSettings({ ...editingSettings, lockout_minutes: Number(event.target.value) })} /></label>
        <label><span>Rate limit (attempts per minute)</span><input type="number" min="1" max="120" value={editingSettings.rate_limit_per_minute} onChange={(event) => setEditingSettings({ ...editingSettings, rate_limit_per_minute: Number(event.target.value) })} /></label>
      </div>
      <div className="auth-actions"><button className="compact-button primary" onClick={saveSettings}><Save size={16} />Save Active Directory settings</button><button className="compact-button" onClick={() => setEditingSettings(settings)}><X size={16} />Discard changes</button></div>
      <div className="auth-role-mappings">
        <div className="auth-section-heading"><div><h3>Directory role mappings</h3><p>Map Active Directory group distinguished names to application roles.</p></div><button className="compact-button primary" onClick={() => setAddingMapping(true)}><Plus size={14} />Add mapping</button></div>
        {addingMapping && <div className="auth-add-mapping"><input aria-label="Directory group DN" placeholder="CN=ALS50-Admins,OU=Groups,..." value={newMapping.directory_group} onChange={(event) => setNewMapping({ ...newMapping, directory_group: event.target.value })} /><input aria-label="Application role" placeholder="Application role" value={newMapping.application_role} onChange={(event) => setNewMapping({ ...newMapping, application_role: event.target.value })} /><button className="compact-button primary" onClick={addMapping}><Save size={14} />Save</button><button className="compact-button" onClick={() => setAddingMapping(false)} title="Cancel"><X size={14} /></button></div>}
        {roleMappings.length === 0 ? <p className="auth-empty-state">No role mappings configured.</p> : <div className="auth-table-wrap"><table><thead><tr><th>Directory group</th><th>Application role</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{roleMappings.map((mapping) => <tr key={mapping.directory_group}><td><code>{mapping.directory_group}</code></td><td>{editingMapping?.directory_group === mapping.directory_group ? <input aria-label="Application role" value={editingMapping.application_role} onChange={(event) => setEditingMapping({ ...editingMapping, application_role: event.target.value })} /> : mapping.application_role}</td><td>{editingMapping?.directory_group === mapping.directory_group ? <label className="auth-table-toggle"><input type="checkbox" checked={editingMapping.enabled} onChange={(event) => setEditingMapping({ ...editingMapping, enabled: event.target.checked })} />Enabled</label> : <span className={mapping.enabled ? 'auth-enabled' : 'auth-disabled'}>{mapping.enabled ? 'Enabled' : 'Disabled'}</span>}</td><td className="auth-row-actions">{editingMapping?.directory_group === mapping.directory_group ? <><button className="compact-button primary" onClick={saveMapping} title="Save"><Save size={14} /></button><button className="compact-button" onClick={() => setEditingMapping(null)} title="Cancel"><X size={14} /></button></> : <><button className="compact-button" onClick={() => setEditingMapping(mapping)} title="Edit"><Edit2 size={14} /></button><button className="compact-button" onClick={() => deleteMapping(mapping.directory_group)} title="Remove"><Trash2 size={14} /></button></>}</td></tr>)}</tbody></table></div>}
      </div>
      </section>
      {health && <div className={`auth-admin-status ${health.admin_password_configured ? 'ready' : 'warning'}`}><div>{health.admin_password_configured ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}</div><span><strong>Local administrator password</strong>{health.admin_password_configured ? 'Configured separately from Active Directory.' : 'Not configured. Set UAT_LOCAL_ADMIN_PASSWORD before enabling Active Directory sign-in.'}</span></div>}
    </>}
  </div>
}