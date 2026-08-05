import { useEffect, useState } from 'react'
import { AlertCircle, Building2, Cloud, Edit2, Info, KeyRound, Plus, Save, Settings, Shield, Trash2, X } from 'lucide-react'
import { authenticationApi } from '../data/api'

const providerTabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'rsa', label: 'RSA Authentication Manager', icon: KeyRound },
  { id: 'ldap', label: 'Active Directory LDAP', icon: Building2 },
  { id: 'azure', label: 'Azure AD', icon: Cloud },
  { id: 'okta', label: 'Okta', icon: Shield },
]

const providerDetails = {
  rsa: {
    title: 'RSA Authentication Manager',
    description: 'Configure the approved RSA adapter before enabling RSA-backed enterprise sign-in.',
    status: 'Adapter required',
    variables: [
      ['RSA_AM_SERVER', 'RSA Authentication Manager base URL', 'https://rsa-am.corp.example.com:7001'],
      ['RSA_AM_API_KEY', 'Adapter API key', 'Stored as a deployment secret'],
      ['RSA_AM_SECRET', 'Adapter client secret', 'Stored as a deployment secret'],
    ],
    notes: ['Use the approved REST or SOAP adapter for the installed RSA Authentication Manager version.', 'The service fails closed until the adapter and all secrets are configured.'],
  },
  ldap: {
    title: 'Active Directory LDAP',
    description: 'Connect to Active Directory over LDAPS for profile lookup and group-based authorization.',
    status: 'LDAPS required',
    variables: [
      ['LDAP_SERVER_URI', 'Directory server URI', 'ldaps://ad.corp.example.com:636'],
      ['LDAP_BASE_DN', 'User-search base DN', 'OU=Users,DC=corp,DC=example,DC=com'],
      ['LDAP_BIND_DN', 'Read-only service account DN', 'CN=ServiceAccount,OU=Users,DC=corp,DC=example,DC=com'],
      ['LDAP_BIND_PASSWORD', 'Service account password', 'Stored as a deployment secret'],
    ],
    notes: ['Use a trusted TLS certificate and port 636. Plain LDAP is not accepted.', 'Grant the service account read access to users and their group membership.'],
  },
  azure: {
    title: 'Azure AD',
    description: 'Reserved for the upcoming OpenID Connect integration. These values are not active in this release.',
    status: 'Planned',
    variables: [
      ['AZURE_AD_TENANT_ID', 'Microsoft Entra tenant ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'],
      ['AZURE_AD_CLIENT_ID', 'Application (client) ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'],
      ['AZURE_AD_CLIENT_SECRET', 'Application client secret', 'Stored as a deployment secret'],
      ['AZURE_AD_REDIRECT_URI', 'Approved redirect URI', 'https://portal.example.com/auth/callback'],
    ],
    notes: ['Create a single-tenant app registration and configure only approved redirect URIs.', 'Do not enable this provider until the OpenID Connect adapter is deployed.'],
  },
  okta: {
    title: 'Okta',
    description: 'Reserved for the upcoming OpenID Connect integration. These values are not active in this release.',
    status: 'Planned',
    variables: [
      ['OKTA_ISSUER', 'Okta authorization server issuer', 'https://company.okta.com/oauth2/default'],
      ['OKTA_CLIENT_ID', 'OIDC application client ID', 'Provided by Okta'],
      ['OKTA_CLIENT_SECRET', 'OIDC application client secret', 'Stored as a deployment secret'],
      ['OKTA_REDIRECT_URI', 'Approved sign-in redirect URI', 'https://portal.example.com/auth/callback'],
    ],
    notes: ['Restrict the OIDC application to the production portal redirect URI.', 'Do not enable this provider until the OpenID Connect adapter is deployed.'],
  },
}

function ProviderSetupTab({ provider }) {
  const detail = providerDetails[provider]
  return <section className="auth-panel" aria-labelledby={`${provider}-title`}>
    <div className="auth-panel-heading"><div><p className="auth-eyebrow">Production setup</p><h2 id={`${provider}-title`}>{detail.title}</h2><p>{detail.description}</p></div><span className={`auth-status ${detail.status === 'Planned' ? 'planned' : 'required'}`}>{detail.status}</span></div>
    <div className="auth-secret-notice"><Info size={16} /><span>Set provider values in the deployment environment or secrets vault. Secret values are intentionally never displayed or stored in this browser.</span></div>
    <div className="auth-config-list">{detail.variables.map(([variable, label, example]) => <div className="auth-config-row" key={variable}><div><strong>{label}</strong><code>{variable}</code></div><code className="auth-config-example">{example}</code></div>)}</div>
    <div className="auth-requirements"><h3>Production requirements</h3><ul>{detail.notes.map((note) => <li key={note}>{note}</li>)}</ul></div>
  </section>
}

export default function AuthenticationSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [roleMappings, setRoleMappings] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [editingSettings, setEditingSettings] = useState(null)
  const [editingMapping, setEditingMapping] = useState(null)
  const [addingMapping, setAddingMapping] = useState(false)
  const [newMapping, setNewMapping] = useState({ directory_group: '', application_role: '', enabled: true })

  useEffect(() => {
    Promise.all([
      authenticationApi.getSettings().then((result) => { setSettings(result); setEditingSettings(result) }),
      authenticationApi.listRoleMappings().then(setRoleMappings),
      authenticationApi.getHealth().then(setHealth),
    ]).catch(() => setMessage('Failed to load authentication settings.')).finally(() => setLoading(false))
  }, [])

  const saveSettings = async () => {
    if (!editingSettings) return
    try {
      const updated = await authenticationApi.updateSettings(editingSettings)
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
    <div className="page-heading"><div><h1>Authentication Settings</h1><p className="subtitle">Manage policy, provider readiness, and directory role access.</p></div></div>
    {health && <div className="auth-provider-summary"><div className="auth-summary-icon"><Shield size={20} /></div><div><strong>Authentication posture</strong><span>{health.enforced ? `Enterprise authentication enforced through ${health.provider}` : 'Demo access is active. Enterprise authentication is not enforced.'}</span></div><span className={`auth-status ${health.live_provider_configured ? 'configured' : 'required'}`}>{health.live_provider_configured ? 'Configured' : 'Not configured'}</span></div>}
    {message && <div className="auth-message"><AlertCircle size={16} />{message}</div>}
    <div className="auth-tabs" role="tablist" aria-label="Authentication configuration">{providerTabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={16} />{label}</button>)}</div>
    {activeTab !== 'general' && <ProviderSetupTab provider={activeTab} />}
    {activeTab === 'general' && settings && editingSettings && <section className="auth-panel">
      <div className="auth-panel-heading"><div><p className="auth-eyebrow">Policy controls</p><h2>General settings</h2><p>These controls are persisted in the application database and apply to all supported authentication flows.</p></div></div>
      <div className="auth-policy-grid">
        <label><span>Authentication provider</span><select value={editingSettings.provider} onChange={(event) => setEditingSettings({ ...editingSettings, provider: event.target.value })}><option value="demo">Demo (Click-to-login)</option><option value="rsa_ad">RSA Authentication Manager + Active Directory LDAP</option></select></label>
        <label className="auth-toggle"><input type="checkbox" checked={editingSettings.enabled} onChange={(event) => setEditingSettings({ ...editingSettings, enabled: event.target.checked })} /><span><strong>Enforce enterprise authentication</strong><small>Disable demo access for all sign-ins.</small></span></label>
        <label><span>Session timeout (minutes)</span><input type="number" min="5" max="1440" value={editingSettings.session_timeout_minutes} onChange={(event) => setEditingSettings({ ...editingSettings, session_timeout_minutes: Number(event.target.value) })} /></label>
        <label><span>Failed-login lockout threshold</span><input type="number" min="1" max="20" value={editingSettings.lockout_threshold} onChange={(event) => setEditingSettings({ ...editingSettings, lockout_threshold: Number(event.target.value) })} /></label>
        <label><span>Lockout duration (minutes)</span><input type="number" min="1" max="1440" value={editingSettings.lockout_minutes} onChange={(event) => setEditingSettings({ ...editingSettings, lockout_minutes: Number(event.target.value) })} /></label>
        <label><span>Rate limit (attempts per minute)</span><input type="number" min="1" max="120" value={editingSettings.rate_limit_per_minute} onChange={(event) => setEditingSettings({ ...editingSettings, rate_limit_per_minute: Number(event.target.value) })} /></label>
      </div>
      <div className="auth-actions"><button className="compact-button primary" onClick={saveSettings}><Save size={16} />Save general settings</button><button className="compact-button" onClick={() => setEditingSettings(settings)}><X size={16} />Discard changes</button></div>
      <div className="auth-role-mappings">
        <div className="auth-section-heading"><div><h3>Directory role mappings</h3><p>Map Active Directory group distinguished names to application roles.</p></div><button className="compact-button primary" onClick={() => setAddingMapping(true)}><Plus size={14} />Add mapping</button></div>
        {addingMapping && <div className="auth-add-mapping"><input aria-label="Directory group DN" placeholder="CN=ALS50-Admins,OU=Groups,..." value={newMapping.directory_group} onChange={(event) => setNewMapping({ ...newMapping, directory_group: event.target.value })} /><input aria-label="Application role" placeholder="Application role" value={newMapping.application_role} onChange={(event) => setNewMapping({ ...newMapping, application_role: event.target.value })} /><button className="compact-button primary" onClick={addMapping}><Save size={14} />Save</button><button className="compact-button" onClick={() => setAddingMapping(false)} title="Cancel"><X size={14} /></button></div>}
        {roleMappings.length === 0 ? <p className="auth-empty-state">No role mappings configured.</p> : <div className="auth-table-wrap"><table><thead><tr><th>Directory group</th><th>Application role</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{roleMappings.map((mapping) => <tr key={mapping.directory_group}><td><code>{mapping.directory_group}</code></td><td>{editingMapping?.directory_group === mapping.directory_group ? <input aria-label="Application role" value={editingMapping.application_role} onChange={(event) => setEditingMapping({ ...editingMapping, application_role: event.target.value })} /> : mapping.application_role}</td><td>{editingMapping?.directory_group === mapping.directory_group ? <label className="auth-table-toggle"><input type="checkbox" checked={editingMapping.enabled} onChange={(event) => setEditingMapping({ ...editingMapping, enabled: event.target.checked })} />Enabled</label> : <span className={mapping.enabled ? 'auth-enabled' : 'auth-disabled'}>{mapping.enabled ? 'Enabled' : 'Disabled'}</span>}</td><td className="auth-row-actions">{editingMapping?.directory_group === mapping.directory_group ? <><button className="compact-button primary" onClick={saveMapping} title="Save"><Save size={14} /></button><button className="compact-button" onClick={() => setEditingMapping(null)} title="Cancel"><X size={14} /></button></> : <><button className="compact-button" onClick={() => setEditingMapping(mapping)} title="Edit"><Edit2 size={14} /></button><button className="compact-button" onClick={() => deleteMapping(mapping.directory_group)} title="Remove"><Trash2 size={14} /></button></>}</td></tr>)}</tbody></table></div>}
      </div>
    </section>}
  </div>
}