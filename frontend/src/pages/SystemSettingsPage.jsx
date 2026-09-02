import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Database, Bell as BellIcon, Globe, KeyRound, Save, UsersRound } from 'lucide-react'
import { authenticationApi } from '../data/api'

export default function SystemSettingsPage({ assignmentGroups = [], incidentCreationGroupIds = [], onSaveIncidentCreationGroups }) {
  const [draftGroupIds, setDraftGroupIds] = useState(incidentCreationGroupIds)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [passwordNotice, setPasswordNotice] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  useEffect(() => setDraftGroupIds(incidentCreationGroupIds), [incidentCreationGroupIds])
  useEffect(() => {
    authenticationApi.getLocalAdminPasswordStatus().then(setPasswordStatus).catch((error) => setPasswordNotice(error.message || 'Could not load administrator password status.'))
  }, [])
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
  const saveAdminPassword = async (event) => {
    event.preventDefault()
    setPasswordNotice('')
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordNotice('New passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const status = await authenticationApi.updateLocalAdminPassword({ current_password: passwords.current_password, new_password: passwords.new_password })
      setPasswordStatus(status)
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
      setPasswordNotice('Administrator password updated. It expires in 180 days.')
    } catch (error) {
      setPasswordNotice(error.message || 'Could not update administrator password.')
    } finally {
      setSavingPassword(false)
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
      <section className="admin-password-settings">
        <header><div><span><KeyRound size={18} /></span><div><h2>Administrator password</h2><p>Local administrator access is independent of Active Directory. The password must be changed every 180 days.</p></div></div>{passwordStatus && <b className={passwordStatus.expired ? 'password-policy-status expired' : 'password-policy-status'}>{passwordStatus.expired ? 'Change required' : `${passwordStatus.days_remaining} days remaining`}</b>}</header>
        <form onSubmit={saveAdminPassword} className="admin-password-form">
          <label>Current password<input type="password" autoComplete="current-password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} required /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength="8" value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} required /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength="8" value={passwords.confirm_password} onChange={(event) => setPasswords({ ...passwords, confirm_password: event.target.value })} required /></label>
          <button type="submit" className="compact-button primary" disabled={savingPassword}><Save size={15} /> {savingPassword ? 'Updating...' : 'Update password'}</button>
        </form>
        {passwordNotice && <p className={passwordNotice.startsWith('Administrator password updated') ? 'admin-password-notice success' : 'admin-password-notice error'} role="status">{passwordNotice.startsWith('Administrator password updated') && <CheckCircle2 size={16} />} {passwordNotice}</p>}
      </section>
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
