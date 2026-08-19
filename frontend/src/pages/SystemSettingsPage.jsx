import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Database, Bell as BellIcon, Globe, Save, UsersRound } from 'lucide-react'

export default function SystemSettingsPage({ assignmentGroups = [], incidentCreationGroupIds = [], onSaveIncidentCreationGroups }) {
  const [draftGroupIds, setDraftGroupIds] = useState(incidentCreationGroupIds)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => setDraftGroupIds(incidentCreationGroupIds), [incidentCreationGroupIds])
  const moveGroup = (groupId, allowed) => {
    setNotice('')
    setDraftGroupIds((current) => current.includes(String(groupId))
      ? allowed ? current : current.filter((id) => id !== String(groupId))
      : allowed ? [...current, String(groupId)] : current)
  }
  const saveGroups = async () => {
    setSaving(true)
    setNotice('')
    try {
      await onSaveIncidentCreationGroups(draftGroupIds)
      setNotice('Incident Creation access saved.')
    } catch (error) {
      setNotice(`Could not save Incident Creation access: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  const activeGroups = assignmentGroups.filter((group) => group.active)
  const availableGroups = activeGroups.filter((group) => !draftGroupIds.includes(String(group.id)))
  const allowedGroups = activeGroups.filter((group) => draftGroupIds.includes(String(group.id)))
  const handleDrop = (event, allowed) => {
    event.preventDefault()
    const groupId = event.dataTransfer.getData('application/als50-group-id')
    if (groupId) moveGroup(groupId, allowed)
  }
  const groupRow = (group, allowed) => <li key={group.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/als50-group-id', String(group.id))}>
    <span><UsersRound size={15} /> {group.name}</span>
    <button type="button" title={allowed ? 'Remove Incident Creation access' : 'Grant Incident Creation access'} aria-label={allowed ? `Remove ${group.name}` : `Grant ${group.name}`} onClick={() => moveGroup(group.id, !allowed)}>{allowed ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</button>
  </li>
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
      <section className="incident-creation-access">
        <header><div><span><UsersRound size={18} /></span><div><h2>Incident Creation Access</h2><p>Move assignment groups to the access bucket to allow members to create new Incidents. Administrators retain access.</p></div></div><button className="compact-button primary" disabled={saving} onClick={saveGroups}><Save size={15} /> {saving ? 'Saving...' : 'Save access'}</button></header>
        <div className="incident-access-buckets">
          <section onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, false)}><header><div><h3>Available groups</h3><small>No Incident Creation access</small></div><b>{availableGroups.length}</b></header><ul>{availableGroups.map((group) => groupRow(group, false))}{!availableGroups.length && <li className="incident-access-empty">All active groups have access.</li>}</ul></section>
          <div className="incident-access-arrows"><ArrowRight size={18} /><ArrowLeft size={18} /></div>
          <section className="allowed" onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, true)}><header><div><h3>Can create Incidents</h3><small>Selected access groups</small></div><b>{allowedGroups.length}</b></header><ul>{allowedGroups.map((group) => groupRow(group, true))}{!allowedGroups.length && <li className="incident-access-empty">Drag a group here to grant access.</li>}</ul></section>
        </div>
        {notice && <p className={notice.startsWith('Could not') ? 'incident-submit-error' : 'incident-saved-message'}>{!notice.startsWith('Could not') && <CheckCircle2 size={14} />} {notice}</p>}
      </section>
    </>
  )
}
