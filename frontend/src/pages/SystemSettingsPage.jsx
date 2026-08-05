import { Info, Database, Bell as BellIcon, Globe } from 'lucide-react'

export default function SystemSettingsPage() {
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
    </>
  )
}
