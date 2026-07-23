import { useEffect, useState } from 'react'
import { Settings, Info, Shield, Database, Bell as BellIcon, Globe } from 'lucide-react'
import { entraApi } from '../data/api'

export default function SystemSettingsPage() {
  const [entra, setEntra] = useState({ tenant_id: '', client_id: '', api_scope: '', redirect_uri: `${window.location.origin}/`, admin_group_id: '', coordinator_group_id: '', enabled: false, client_secret_configured: false })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    entraApi.getConfiguration().then((configuration) => setEntra((current) => ({ ...current, ...configuration }))).catch(() => setMessage('The Entra configuration service is unavailable. Start the API to save settings.')).finally(() => setLoading(false))
  }, [])
  const updateEntra = (key, value) => setEntra((current) => ({ ...current, [key]: value }))
  const saveEntra = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const configuration = await entraApi.saveConfiguration({ tenant_id: entra.tenant_id, client_id: entra.client_id, api_scope: entra.api_scope, redirect_uri: entra.redirect_uri, admin_group_id: entra.admin_group_id, coordinator_group_id: entra.coordinator_group_id, enabled: entra.enabled })
      setEntra((current) => ({ ...current, ...configuration }))
      setMessage('Microsoft Entra ID configuration saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div><h1>System settings</h1><p className="subtitle">Platform configuration, environment, and deployment options.</p></div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-icon"><Globe size={20} /></div>
          <div><h3>Environment</h3><p>Development mode — authentication is bypassed.</p></div>
          <span className="badge awaiting-customer">Development</span>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><Shield size={20} /></div>
          <div><h3>Authentication</h3><p>Microsoft Entra ID single sign-on configuration.</p></div>
          <span className={`badge ${entra.enabled ? 'new' : 'closed'}`}>{entra.enabled ? 'Enabled' : 'Pending'}</span>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><Database size={20} /></div>
          <div><h3>Database</h3><p>PostgreSQL connection — configured via environment variables.</p></div>
          <span className="badge new">Connected</span>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><BellIcon size={20} /></div>
          <div><h3>Notifications</h3><p>Email and in-app notification channels.</p></div>
          <span className="badge closed">Not configured</span>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><Info size={20} /></div>
          <div><h3>Application</h3><p>Aerofix Service Management v0.1.0</p></div>
          <code>Build 2026.07.21</code>
        </div>
      </div>
      <form className="entra-settings-form" onSubmit={saveEntra}>
        <div className="settings-form-heading"><Shield size={20} /><div><h2>Microsoft Entra ID</h2><p>Register this application in Microsoft Entra ID, then enter the directory, application, redirect, API scope, and role-group identifiers below.</p></div></div>
        <div className="settings-form-grid">
          <label><span>Directory (tenant) ID</span><input value={entra.tenant_id} onChange={(event) => updateEntra('tenant_id', event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
          <label><span>Application (client) ID</span><input value={entra.client_id} onChange={(event) => updateEntra('client_id', event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
          <label><span>Redirect URI</span><input type="url" value={entra.redirect_uri} onChange={(event) => updateEntra('redirect_uri', event.target.value)} placeholder="https://service.example.com/" /></label>
          <label><span>API scope</span><input value={entra.api_scope} onChange={(event) => updateEntra('api_scope', event.target.value)} placeholder="api://&lt;api-client-id&gt;/access_as_user" /></label>
          <label><span>Administrator group object ID</span><input value={entra.admin_group_id} onChange={(event) => updateEntra('admin_group_id', event.target.value)} placeholder="Entra group object ID for administrators" /></label>
          <label><span>Service coordinator group object ID</span><input value={entra.coordinator_group_id} onChange={(event) => updateEntra('coordinator_group_id', event.target.value)} placeholder="Entra group object ID for coordinators" /></label>
        </div>
        <div className="entra-settings-footer"><label className="entra-enable"><input type="checkbox" checked={entra.enabled} onChange={(event) => updateEntra('enabled', event.target.checked)} /> Enforce Microsoft Entra ID sign-in</label><span className={entra.client_secret_configured ? 'entra-secret-ready' : 'entra-secret-missing'}>{entra.client_secret_configured ? 'Client secret is configured in the deployment environment.' : 'Set ENTRA_CLIENT_SECRET in the deployment environment before enabling.'}</span><button className="compact-button primary" disabled={loading} type="submit">Save Entra configuration</button></div>
        {message && <p className="entra-settings-message">{message}</p>}
      </form>
    </>
  )
}
