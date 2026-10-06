import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Edit2, Eye, Plus, Search, Settings2, Trash2, X } from 'lucide-react'
import { authenticationApi } from '../data/api'

const createSeedUser = ({ id, name, role, jobTitle }) => {
  const emailLocalPart = name.toLowerCase().replaceAll(' ', '.')
  return {
    id,
    name,
    employeeId: `ALS-EMP-${String(id).padStart(3, '0')}`,
    email: `${emailLocalPart}@aerofix.in`,
    username: emailLocalPart,
    jobTitle,
    phone: `+91 98${String(10000000 + id).slice(-8)}`,
    role,
    groups: '--',
    status: 'Active',
    provider: 'Local password',
    lastLogin: '22 Jul 2026 09:30',
    created: '01 Jul 2026',
  }
}

const administratorNames = ['Amitabh Sharma', 'Nandini Iyer']
const managerNames = ['Rahul Mehta', 'Priyanka Rao', 'Vivek Nair', 'Sneha Kulkarni', 'Arvind Kapoor', 'Kavita Menon', 'Sanjay Bhatia', 'Deepa Reddy', 'Manish Gupta', 'Anjali Deshmukh']
const serviceFirstNames = ['Aarav', 'Ishaan', 'Vihaan', 'Aditya', 'Rohan', 'Kunal', 'Siddharth', 'Varun', 'Nikhil', 'Pranav']
const serviceLastNames = ['Patel', 'Singh', 'Kumar', 'Sharma', 'Verma']

export const initialUsers = [
  ...administratorNames.map((name, index) => createSeedUser({ id: index + 1, name, role: 'Administrator', jobTitle: 'System Administrator' })),
  ...managerNames.map((name, index) => createSeedUser({ id: index + 3, name, role: 'Manager', jobTitle: 'Service Manager' })),
  ...serviceFirstNames.flatMap((firstName, firstNameIndex) => serviceLastNames.map((lastName, lastNameIndex) => {
    const id = 13 + firstNameIndex * serviceLastNames.length + lastNameIndex
    return createSeedUser({ id, name: `${firstName} ${lastName}`, role: 'Service engineer', jobTitle: 'Service Engineer' })
  })),
]

const columns = [
  { key: 'name', label: 'Name', width: 185 },
  { key: 'email', label: 'Email', width: 235 },
  { key: 'role', label: 'Role', width: 155 },
  { key: 'status', label: 'Status', width: 105 },
  { key: 'groups', label: 'Assignment groups', width: 220 },
  { key: 'provider', label: 'Auth source', width: 120 },
  { key: 'lastLogin', label: 'Last login', width: 155 },
  { key: 'created', label: 'Created', width: 125 },
]

const extractColumns = [
  { key: 'id', label: 'User ID' },
  { key: 'name', label: 'Name' },
  { key: 'username', label: 'Username' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'role', label: 'Role' },
  { key: 'groups', label: 'Assignment groups' },
  { key: 'status', label: 'Status' },
  { key: 'provider', label: 'Auth source' },
  { key: 'lastLogin', label: 'Last login' },
  { key: 'created', label: 'Created' },
]

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function UserManagementPage({ assignmentGroups, users, setUsers }) {
  const [search, setSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState(columns.map(({ key }) => key))
  const [showColumns, setShowColumns] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [createdPasswordNotice, setCreatedPasswordNotice] = useState(false)
  const [resetPasswordNotice, setResetPasswordNotice] = useState('')
  const [newUser, setNewUser] = useState({ name: '', username: '', employeeId: '', email: '', jobTitle: '', phone: '', role: 'Service coordinator', groups: '', status: 'Active' })
  const [sorted, setSorted] = useState({ key: 'name', direction: 'asc' })
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map(({ key, width }) => [key, width])))

  const filteredUsers = useMemo(() => users
    .filter((user) => !search || columns.some(({ key }) => String(user[key] ?? '').toLowerCase().includes(search.toLowerCase())))
    .sort((left, right) => {
      const comparison = String(left[sorted.key] ?? '').localeCompare(String(right[sorted.key] ?? ''), undefined, { numeric: true })
      return sorted.direction === 'asc' ? comparison : -comparison
    }), [search, sorted, users])

  const activeColumns = columns.filter(({ key }) => visibleColumns.includes(key))

  const toggleColumn = (key) => setVisibleColumns((current) => current.includes(key)
    ? current.filter((column) => column !== key)
    : [...current, key])

  const sortBy = (key) => setSorted((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  const startColumnResize = (event, column) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = columnWidths[column.key]
    const resizeColumn = (moveEvent) => setColumnWidths((current) => ({ ...current, [column.key]: Math.max(100, startWidth + moveEvent.clientX - startX) }))
    const stopResize = () => { document.removeEventListener('mousemove', resizeColumn); document.removeEventListener('mouseup', stopResize) }
    document.addEventListener('mousemove', resizeColumn)
    document.addEventListener('mouseup', stopResize)
  }

  const exportCsv = () => {
    const data = [extractColumns.map(({ label }) => csvValue(label))]
    filteredUsers.forEach((user) => data.push(extractColumns.map(({ key }) => csvValue(user[key]))))
    const url = URL.createObjectURL(new Blob([data.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'users.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const removeUser = (id) => {
    if (window.confirm('Delete this user? This action cannot be undone.')) setUsers((current) => current.filter((user) => user.id !== id))
  }

  const resetPassword = async (user) => {
    try {
      const result = await authenticationApi.resetUserPassword(user.username || user.email)
      setResetPasswordNotice(`${user.name}: temporary password ${result.temporary_password}. Deliver it securely and ask the user to change it at first login.`)
    } catch (error) {
      setResetPasswordNotice(error.message || 'Unable to reset the user password.')
    }
  }

  const createUser = (event) => {
    event.preventDefault()
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.email.trim()) return
    if (editingUserId) {
      setUsers((current) => current.map((user) => user.id === editingUserId ? { ...user, name: newUser.name.trim(), username: newUser.username.trim(), employeeId: newUser.employeeId.trim(), email: newUser.email.trim(), jobTitle: newUser.jobTitle.trim(), phone: newUser.phone.trim(), role: newUser.role, groups: newUser.groups || '--', status: newUser.status } : user))
    } else {
      setUsers((current) => [...current, { id: Math.max(0, ...current.map((user) => user.id)) + 1, ...newUser, name: newUser.name.trim(), username: newUser.username.trim(), employeeId: newUser.employeeId.trim(), email: newUser.email.trim(), jobTitle: newUser.jobTitle.trim(), phone: newUser.phone.trim(), groups: newUser.groups || '--', provider: 'Local password', lastLogin: 'Not signed in', created: '22 Jul 2026' }])
    }
    setNewUser({ name: '', username: '', employeeId: '', email: '', jobTitle: '', phone: '', role: 'Service coordinator', groups: '', status: 'Active' })
    setEditingUserId(null)
    setShowCreateForm(false)
    if (!editingUserId) setCreatedPasswordNotice(true)
  }

  const openCreateForm = () => {
    setNewUser({ name: '', username: '', employeeId: '', email: '', jobTitle: '', phone: '', role: 'Service coordinator', groups: '', status: 'Active' })
    setEditingUserId(null)
    setShowCreateForm(true)
  }

  const openEditForm = (user) => {
    setNewUser({ name: user.name, username: user.username || '', employeeId: user.employeeId || '', email: user.email, jobTitle: user.jobTitle || '', phone: user.phone || '', role: user.role, groups: user.groups === '--' ? '' : user.groups || '', status: user.status })
    setEditingUserId(user.id)
    setSelectedUser(null)
    setShowCreateForm(true)
  }

  const renderValue = (user, key) => {
    if (key === 'name') return <button className="table-link">{user.name}</button>
    if (key === 'status') return <span className={`badge ${user.status === 'Active' ? 'active' : user.status === 'Pending' ? 'awaiting-customer' : 'inactive'}`}>{user.status}</span>
    if (key === 'groups') return <button className="table-link">{user.groups}</button>
    if (key === 'provider') return <span className="auth-provider">{user.provider || 'Local password'}</span>
    return user[key]
  }

  if (showCreateForm) return <section className="user-config-page" aria-label={editingUserId ? 'Edit user' : 'New user'}><UserConfigurationForm user={newUser} editing={Boolean(editingUserId)} assignmentGroups={assignmentGroups} onChange={setNewUser} onCancel={() => { setShowCreateForm(false); setEditingUserId(null) }} onSubmit={createUser} /></section>
  if (selectedUser) return <UserDetailPage user={selectedUser} onCancel={() => setSelectedUser(null)} onEdit={() => openEditForm(selectedUser)} />

  return (
    <section className="customer-list-page user-list-page" aria-label="User management">
      {createdPasswordNotice && <div className="user-config-hint" role="status">Temporary password: <strong>Welcome@123</strong>. Deliver it securely and ask the user to change it at first login. <button type="button" onClick={() => setCreatedPasswordNotice(false)}>Dismiss</button></div>}
      {resetPasswordNotice && <div className="user-config-hint" role="status">{resetPasswordNotice} <button type="button" onClick={() => setResetPasswordNotice('')}>Dismiss</button></div>}
      <div className="customer-list-head">
        <div className="customer-list-title"><h1>User management</h1></div>
        <div className="user-list-actions">
          <button className="compact-button secondary" onClick={() => setShowColumns((open) => !open)} aria-expanded={showColumns}><Settings2 size={15} /> Columns</button>
          <button className="compact-button secondary" onClick={exportCsv} disabled={!filteredUsers.length}><Download size={15} /> Extract data</button>
          <button className="customer-create-button" onClick={openCreateForm}><Plus size={15} /> New user</button>
        </div>
        {showColumns && (
          <div className="column-picker user-column-picker" role="dialog" aria-label="Select displayed columns">
            <div className="column-picker-head"><strong>Display columns</strong><button onClick={() => setShowColumns(false)} aria-label="Close column picker"><X size={15} /></button></div>
            {columns.map(({ key, label }) => <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => toggleColumn(key)} /> {label}</label>)}
          </div>
        )}
      </div>

      <div className="customer-command-bar">
        <div className="customer-search"><Search size={15} /><input aria-label="Search users" placeholder="Search users..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <span className="customer-list-count">{filteredUsers.length ? `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}` : '0 results'}</span>
      </div>

      <div className="customer-table-frame">
        <div className="customer-table-scroll">
          <table className="customer-table user-management-table">
            <colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}<col style={{ width: 100 }} /></colgroup>
            <thead>
              <tr>
                {activeColumns.map((column) => <th key={column.key} className={`sortable ${sorted.key === column.key ? `sorted-${sorted.direction}` : ''}`} onClick={() => sortBy(column.key)}>{column.label}<button className="column-resize-handle" aria-label={`Resize ${column.label} column`} onMouseDown={(event) => startColumnResize(event, column)} /></th>)}
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  {activeColumns.map(({ key }) => <td key={key}>{renderValue(user, key)}</td>)}
                  <td className="row-actions-cell"><div className="row-actions"><button className="action-btn" onClick={() => setSelectedUser(user)} title="View user"><Eye size={15} /></button><button className="action-btn" onClick={() => openEditForm(user)} title="Edit user"><Edit2 size={15} /></button><button className="action-btn" onClick={() => resetPassword(user)} title="Reset password">Reset</button><button className="action-btn delete" onClick={() => removeUser(user.id)} title="Delete user"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
              {!filteredUsers.length && <tr><td colSpan={Math.max(activeColumns.length + 1, 1)} className="empty-row">No users match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="customer-pagination"><span>Total: {users.length} user{users.length === 1 ? '' : 's'}</span></footer>
    </section>
  )
}

function UserConfigurationForm({ user, editing, assignmentGroups, onChange, onCancel, onSubmit }) {
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }))
  return <form className="user-config-form" onSubmit={onSubmit}>
    <header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> User management</button><h1>{editing ? 'Edit user' : 'New user'}</h1><p>{editing ? 'Update user details and access configuration.' : 'Create a service user with local username authentication.'}</p></div><div><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button className="incident-submit-button" type="submit">Save user</button></div></header>
    <section className="user-config-sheet"><section className="user-config-section"><h2>User details</h2><div className="user-config-grid"><label>FULL NAME <input autoFocus value={user.name} onChange={(event) => update('name', event.target.value)} placeholder="User full name" required /></label><label>USERNAME <input autoComplete="off" value={user.username} onChange={(event) => update('username', event.target.value)} placeholder="Login username" required /></label><label>EMPLOYEE ID <input value={user.employeeId} onChange={(event) => update('employeeId', event.target.value)} placeholder="e.g., EMP-001" /></label><label>EMAIL <input type="email" value={user.email} onChange={(event) => update('email', event.target.value)} placeholder="name@company.com" required /></label><label>PHONE NUMBER <input value={user.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone number" /></label></div></section><section className="user-config-section"><h2>Access and assignment</h2><div className="user-config-grid"><label>ROLE <select value={user.role} onChange={(event) => update('role', event.target.value)}><option>Service coordinator</option><option>Administrator</option><option>Manager</option><option>Service engineer</option></select></label><label>ASSIGNMENT GROUP <select value={user.groups} onChange={(event) => update('groups', event.target.value)}><option value="">No assignment group</option>{assignmentGroups.map((group) => <option key={group.id}>{group.name}</option>)}</select></label><label>STATUS <select value={user.status} onChange={(event) => update('status', event.target.value)}><option>Active</option><option>Inactive</option><option>Pending</option></select></label><label>JOB TITLE <input value={user.jobTitle} onChange={(event) => update('jobTitle', event.target.value)} placeholder="e.g., Service Engineer" /></label></div></section></section>
  </form>
}

function UserDetailPage({ user, onCancel, onEdit }) {
  return <section className="user-config-page" aria-label="User details"><header className="group-config-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> User management</button><h1>{user.name}</h1><p>{user.jobTitle || user.role}</p></div><div><button type="button" className="incident-cancel-button" onClick={onCancel}>Close</button><button type="button" className="incident-submit-button" onClick={onEdit}><Edit2 size={15} /> Edit user</button></div></header>
    <section className="user-config-sheet"><section className="user-config-section"><h2>User details</h2><div className="user-config-grid"><div><span>FULL NAME</span><strong>{user.name}</strong></div><div><span>USERNAME</span><strong>{user.username || '--'}</strong></div><div><span>EMPLOYEE ID</span><strong>{user.employeeId || '--'}</strong></div><div><span>EMAIL</span><strong>{user.email}</strong></div><div><span>PHONE</span><strong>{user.phone || '--'}</strong></div></div></section><section className="user-config-section"><h2>Access and assignment</h2><div className="user-config-grid"><div><span>ROLE</span><strong>{user.role}</strong></div><div><span>ASSIGNMENT GROUP</span><strong>{user.groups || '--'}</strong></div><div><span>STATUS</span><span className={`badge ${user.status === 'Active' ? 'active' : 'inactive'}`}>{user.status}</span></div><div><span>JOB TITLE</span><strong>{user.jobTitle || '--'}</strong></div><div><span>AUTH SOURCE</span><strong>{user.provider || 'Local password'}</strong></div><div><span>LAST LOGIN</span><strong>{user.lastLogin || '--'}</strong></div><div><span>CREATED</span><strong>{user.created || '--'}</strong></div></div></section></section>
  </section>
}
