import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Edit2, Eye, Plus, Search, Settings2, Trash2, UserPlus, X } from 'lucide-react'

const initialGroups = []

const columns = [
  { key: 'name', label: 'Group name', width: 210 },
  { key: 'description', label: 'Description', width: 310 },
  { key: 'members', label: 'Members', width: 100 },
  { key: 'escalatesTo', label: 'Escalates to', width: 170 },
  { key: 'created', label: 'Created', width: 125 },
  { key: 'updated', label: 'Updated', width: 125 },
  { key: 'status', label: 'Status', width: 105 },
]

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function AssignmentGroupsPage({ groups, setGroups, users, onGroupRenamed }) {
  const [search, setSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState(columns.map(({ key }) => key))
  const [showColumns, setShowColumns] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [newGroup, setNewGroup] = useState({ name: '', manager: '', description: '', memberIds: [] })
  const [showMemberBucket, setShowMemberBucket] = useState(false)
  const [selectedAvailableUser, setSelectedAvailableUser] = useState('')
  const [selectedMemberUser, setSelectedMemberUser] = useState('')
  const [sorted, setSorted] = useState({ key: 'name', direction: 'asc' })

  const filteredGroups = useMemo(() => groups
    .filter((group) => !search || columns.some(({ key }) => {
      const value = key === 'status' ? (group.active ? 'Active' : 'Inactive') : group[key] ?? ''
      return String(value).toLowerCase().includes(search.toLowerCase())
    }))
    .sort((left, right) => {
      const leftValue = sorted.key === 'status' ? (left.active ? 'Active' : 'Inactive') : left[sorted.key] ?? ''
      const rightValue = sorted.key === 'status' ? (right.active ? 'Active' : 'Inactive') : right[sorted.key] ?? ''
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true })
      return sorted.direction === 'asc' ? comparison : -comparison
    }), [groups, search, sorted])

  const activeColumns = columns.filter(({ key }) => visibleColumns.includes(key))

  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key)
    ? current.filter((column) => column !== key)
    : [...current, key])

  const sortBy = (key) => setSorted((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  const createGroup = (event) => {
    event.preventDefault()
    if (!newGroup.name.trim()) return
    const date = '22 Jul 2026'
    const updatedGroup = editingGroupId ? { ...groups.find((group) => group.id === editingGroupId), ...newGroup, name: newGroup.name.trim(), description: newGroup.description.trim(), members: newGroup.memberIds.length, updated: date } : null
    setGroups((current) => editingGroupId
      ? current.map((group) => group.id === editingGroupId ? updatedGroup : group)
      : [...current, { id: Math.max(0, ...current.map((group) => group.id)) + 1, ...newGroup, name: newGroup.name.trim(), description: newGroup.description.trim(), members: newGroup.memberIds.length, created: date, updated: date, active: true }])
    if (updatedGroup?.name !== groups.find((group) => group.id === editingGroupId)?.name) onGroupRenamed?.(groups.find((group) => group.id === editingGroupId), updatedGroup)
    setNewGroup({ name: '', manager: '', description: '', memberIds: [] })
    setEditingGroupId(null)
    setShowCreateForm(false)
  }

  const openCreateForm = () => {
    setNewGroup({ name: '', manager: '', description: '', memberIds: [] })
    setSelectedAvailableUser('')
    setSelectedMemberUser('')
    setEditingGroupId(null)
    setShowCreateForm(true)
  }

  const openEditForm = (group) => {
    setNewGroup({ name: group.name, manager: group.manager || '', description: group.description || '', memberIds: [...(group.memberIds || [])] })
    setSelectedAvailableUser('')
    setSelectedMemberUser('')
    setEditingGroupId(group.id)
    setSelectedGroup(null)
    setShowCreateForm(true)
  }

  const deleteGroup = (id) => setGroups((current) => current.filter((group) => group.id !== id))

  const addMember = () => {
    if (!selectedAvailableUser) return
    setNewGroup((current) => ({ ...current, memberIds: [...current.memberIds, Number(selectedAvailableUser)] }))
    setSelectedAvailableUser('')
  }

  const removeMember = () => {
    if (!selectedMemberUser) return
    setNewGroup((current) => ({ ...current, memberIds: current.memberIds.filter((id) => id !== Number(selectedMemberUser)) }))
    setSelectedMemberUser('')
  }

  const exportCsv = () => {
    const exportColumns = columns.filter(({ key }) => visibleColumns.includes(key))
    const data = [exportColumns.map(({ label }) => csvValue(label))]
    filteredGroups.forEach((group) => data.push(exportColumns.map(({ key }) => csvValue(key === 'status' ? (group.active ? 'Active' : 'Inactive') : group[key]))))
    const url = URL.createObjectURL(new Blob([data.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'assignment-groups.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const renderValue = (group, key) => {
    if (key === 'name') return <button className="table-link" onClick={() => setSelectedGroup(group)}>{group.name}</button>
    if (key === 'members') return <span className="table-count">{group.members}</span>
    if (key === 'escalatesTo') return group.escalatesTo ? <button className="table-link">{group.escalatesTo}</button> : <span className="table-empty">--</span>
    if (key === 'status') return <span className={`badge ${group.active ? 'active' : 'inactive'}`}>{group.active ? 'Active' : 'Inactive'}</span>
    return group[key]
  }

  if (showCreateForm) return <section className="group-config-page" aria-label={editingGroupId ? 'Edit assignment group' : 'New assignment group'}><GroupConfigurationForm group={newGroup} users={users} editing={Boolean(editingGroupId)} onChange={setNewGroup} onCancel={() => { setShowCreateForm(false); setEditingGroupId(null) }} onSubmit={createGroup} onOpenMemberBucket={() => setShowMemberBucket(true)} />{showMemberBucket && <MemberBucket availableUsers={users.filter((user) => !newGroup.memberIds.includes(user.id))} members={users.filter((user) => newGroup.memberIds.includes(user.id))} selectedAvailableUser={selectedAvailableUser} selectedMemberUser={selectedMemberUser} onSelectAvailable={setSelectedAvailableUser} onSelectMember={setSelectedMemberUser} onAdd={addMember} onRemove={removeMember} onClose={() => setShowMemberBucket(false)} />}</section>
  if (selectedGroup) return <GroupDetailPage group={selectedGroup} users={users} onCancel={() => setSelectedGroup(null)} onEdit={() => openEditForm(selectedGroup)} />

  return (
    <section className="customer-list-page assignment-groups-list-page" aria-label="Assignment groups">
      <div className="customer-list-head">
        <div className="customer-list-title"><h1>Assignment groups</h1></div>
        <div className="user-list-actions">
          <button className="compact-button secondary" onClick={() => setShowColumns((open) => !open)} aria-expanded={showColumns}><Settings2 size={15} /> Columns</button>
          <button className="compact-button secondary" onClick={exportCsv} disabled={!activeColumns.length || !filteredGroups.length}><Download size={15} /> Export</button>
          <button className="compact-button primary" onClick={openCreateForm}><Plus size={15} /> Add group</button>
        </div>
        {showColumns && (
          <div className="column-picker" role="dialog" aria-label="Select displayed columns">
            <div className="column-picker-head"><strong>Display columns</strong><button onClick={() => setShowColumns(false)} aria-label="Close column picker"><X size={15} /></button></div>
            {columns.map(({ key, label }) => <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => toggleColumn(key)} /> {label}</label>)}
          </div>
        )}
      </div>

      <div className="customer-command-bar"><div className="customer-search"><Search size={15} /><input aria-label="Search assignment groups" placeholder="Search assignment groups..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="customer-list-count">{filteredGroups.length ? `${filteredGroups.length} group${filteredGroups.length === 1 ? '' : 's'}` : '0 results'}</span></div>

      <div className="customer-table-frame">
        <div className="customer-table-scroll">
          <table className="customer-table assignment-groups-table">
            <colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 108 }} /></colgroup>
            <thead>
              <tr>{activeColumns.map((column) => <th key={column.key} className={`sortable ${sorted.key === column.key ? `sorted-${sorted.direction}` : ''}`} onClick={() => sortBy(column.key)}>{column.label}</th>)}<th className="actions-column">Actions</th></tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => <tr key={group.id}>{activeColumns.map(({ key }) => <td key={key}>{renderValue(group, key)}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View group" onClick={() => setSelectedGroup(group)}><Eye size={15} /></button><button className="action-btn" title="Edit group" onClick={() => openEditForm(group)}><Edit2 size={15} /></button><button className="action-btn delete" title="Delete group" onClick={() => deleteGroup(group.id)}><Trash2 size={15} /></button></div></td></tr>)}
              {!filteredGroups.length && <tr><td colSpan={Math.max(activeColumns.length + 1, 1)} className="empty-row">No assignment groups match the current search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="customer-pagination"><span>Total: {groups.length} group{groups.length === 1 ? '' : 's'}</span></footer>
    </section>
  )
}

function GroupConfigurationForm({ group, users, editing, onChange, onCancel, onSubmit, onOpenMemberBucket }) {
  const members = users.filter((user) => group.memberIds.includes(user.id))
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }))
  return <form className="group-config-overlay" onSubmit={onSubmit}>
    <header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Assignment groups</button><h1>{editing ? 'Edit assignment group' : 'New assignment group'}</h1><p>Configure the group and its members.</p></div><div><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button className="incident-submit-button" type="submit">Save group</button></div></header>
    <section className="group-config-sheet"><div className="group-config-fields"><label>NAME OF THE GROUP <input autoFocus value={group.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g., Field Service" required /></label><label>MANAGER NAME <select value={group.manager} onChange={(event) => update('manager', event.target.value)}><option value="">Select manager</option>{users.map((user) => <option key={user.id}>{user.name}</option>)}</select></label><label className="full-row">DESCRIPTION <textarea value={group.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the team's responsibility" rows="3" /></label></div><section className="group-members-section"><div className="group-members-heading"><div><h2>Group users</h2><span>{members.length} member{members.length === 1 ? '' : 's'}</span></div><button type="button" className="compact-button primary" onClick={onOpenMemberBucket}><UserPlus size={15} /> Add user</button></div><table className="group-members-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{members.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td></tr>)}{!members.length && <tr><td className="empty-row" colSpan="3">No users have been added to this group.</td></tr>}</tbody></table></section></section>
  </form>
}

function GroupDetailPage({ group, users, onCancel, onEdit }) {
  const members = users.filter((user) => group.memberIds?.includes(user.id))
  return <section className="group-config-page" aria-label="Assignment group details"><header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Assignment groups</button><h1>{group.name}</h1><p>{group.description || 'No description provided.'}</p></div><div><button type="button" className="incident-cancel-button" onClick={onCancel}>Close</button><button type="button" className="incident-submit-button" onClick={onEdit}>Edit group</button></div></header><section className="group-config-sheet"><section className="group-config-fields"><div><span>MANAGER NAME</span><strong>{group.manager || '--'}</strong></div><div><span>STATUS</span><strong>{group.active ? 'Active' : 'Inactive'}</strong></div></section><section className="group-members-section"><div className="group-members-heading"><div><h2>Group users</h2><span>{members.length} member{members.length === 1 ? '' : 's'}</span></div></div><table className="group-members-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{members.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td></tr>)}{!members.length && <tr><td className="empty-row" colSpan="3">No users have been added to this group.</td></tr>}</tbody></table></section></section></section>
}

function MemberBucket({ availableUsers, members, selectedAvailableUser, selectedMemberUser, onSelectAvailable, onSelectMember, onAdd, onRemove, onClose }) {
  return <div className="member-bucket-backdrop"><section className="member-bucket" role="dialog" aria-modal="true" aria-label="Manage group users"><header><div><h2>Manage group users</h2><p>Select a user, then move them between the lists.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close user selection"><X size={16} /></button></header><div className="member-bucket-lists"><UserBucketList title="Available users" users={availableUsers} selectedId={selectedAvailableUser} onSelect={onSelectAvailable} emptyText="All users are already group members." /><UserBucketList title="Group members" users={members} selectedId={selectedMemberUser} onSelect={onSelectMember} emptyText="No group members yet." /></div><footer><button type="button" className="compact-button secondary" onClick={onRemove} disabled={!selectedMemberUser}>Remove from group</button><button type="button" className="compact-button primary" onClick={onAdd} disabled={!selectedAvailableUser}>Add to group</button></footer></section></div>
}

function UserBucketList({ title, users, selectedId, onSelect, emptyText }) { return <section className="user-bucket-list"><h3>{title}</h3><div>{users.map((user) => <button type="button" key={user.id} className={Number(selectedId) === user.id ? 'selected' : ''} onClick={() => onSelect(String(user.id))}><strong>{user.name}</strong><small>{user.email}</small></button>)}{!users.length && <p>{emptyText}</p>}</div></section> }
