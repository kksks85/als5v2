import { useMemo, useState } from 'react'
import { Download, Plus, Search, ArrowLeft, Trash2, Edit2, Eye, X } from 'lucide-react'

export const initialCustomers = [
  { id: 1, name: 'Indian Air Force', number: 'TASL-CUST-001', address: 'Air Force Headquarters, Vayu Bhawan, New Delhi 110001', primaryContact: { name: 'Rajesh Kumar', designation: 'Technical Director', email: 'rajesh.kumar@indianairforce.in', phone: '+91 9010012345', rank: 'Group Captain', site: 'Head Office' }, contacts: [{ id: 1, name: 'Rajesh Kumar', designation: 'Technical Director', phone: '+91 9010012345', email: 'rajesh.kumar@indianairforce.in', rank: 'Group Captain', site: 'Head Office', address: 'Main Complex, New Delhi, India' }, { id: 2, name: 'Suresh Patel', designation: 'Operations Manager', phone: '+91 9010012346', email: 'suresh.patel@indianairforce.in', rank: 'Wing Commander', site: 'Regional Office', address: 'Regional Hub, Bangalore, India' }, { id: 3, name: 'Rohit Verma', designation: 'Support Lead', phone: '+91 9010012347', email: 'rohit.verma@indianairforce.in', rank: 'Squadron Leader', site: 'Support Center', address: 'Technical Support, Pune, India' }, { id: 4, name: 'Anil Bhat', designation: 'Maintenance Engineer', phone: '+91 9010012348', email: 'anil.bhat@indianairforce.in', rank: 'Flight Lieutenant', site: 'Service Center', address: 'Maintenance Facility, Hyderabad, India' }] },
  { id: 2, name: 'Indian Army', number: 'TASL-CUST-002', address: 'Army Headquarters, New Delhi 110010', primaryContact: { name: 'Vikram Singh', designation: 'Chief Operations Officer', email: 'vikram.singh@indianarmy.in', phone: '+91 9011001234', rank: 'Colonel', site: 'Army HQ' }, contacts: [{ id: 1, name: 'Vikram Singh', designation: 'Chief Operations Officer', phone: '+91 9011001234', email: 'vikram.singh@indianarmy.in', rank: 'Colonel', site: 'Army HQ', address: 'New Delhi 110010' }, { id: 2, name: 'Priya Sharma', designation: 'Logistics Manager', phone: '+91 9011001235', email: 'priya.sharma@indianarmy.in', rank: 'Major', site: 'Agra Cantonment', address: 'Agra, Uttar Pradesh' }, { id: 3, name: 'Arjun Mehta', designation: 'Technical Lead', phone: '+91 9011001236', email: 'arjun.mehta@indianarmy.in', rank: 'Captain', site: 'Delhi Cantonment', address: 'New Delhi' }] },
  { id: 3, name: 'Indian Navy', number: 'TASL-CUST-003', address: 'Naval Headquarters, South Block, New Delhi 110011', primaryContact: { name: 'Ramesh', designation: 'Chief Naval Operations', email: 'ramesh@indiannavy.in', phone: '+91 9012001234', rank: 'Rear Admiral', site: 'Naval HQ' }, contacts: [{ id: 1, name: 'Ramesh', designation: 'Chief Naval Operations', phone: '+91 9012001234', email: 'ramesh@indiannavy.in', rank: 'Rear Admiral', site: 'Naval HQ', address: 'New Delhi 110011' }, { id: 2, name: 'Desai', designation: 'Fleet Commander', phone: '+91 9012001235', email: 'desai@indiannavy.in', rank: 'Captain', site: 'Naval Base Kochi', address: 'Kochi, Kerala' }, { id: 3, name: 'Nair', designation: 'Support Services', phone: '+91 9012001236', email: 'nair@indiannavy.in', rank: 'Commander', site: 'Naval Base Mumbai', address: 'Mumbai, Maharashtra' }, { id: 4, name: 'Pillai', designation: 'Communications', phone: '+91 9012001237', email: 'pillai@indiannavy.in', rank: 'Lt. Commander', site: 'Air Station Kochi', address: 'Kochi, Kerala' }, { id: 5, name: 'Bhat', designation: 'Operations', phone: '+91 9012001238', email: 'bhat@indiannavy.in', rank: 'Commander', site: 'Eastern Naval', address: 'Visakhapatnam, Andhra Pradesh' }] },
  { id: 4, name: 'Indian Army Special Forces', number: 'TASL-CUST-004', address: 'Special Forces Command, Delhi Cantonment, New Delhi 110010', primaryContact: { name: 'Rao', designation: 'Command Head', email: 'rao@specialforces.in', phone: '+91 9013001234', rank: 'Colonel', site: 'Command Centre' }, contacts: [{ id: 1, name: 'Rao', designation: 'Command Head', phone: '+91 9013001234', email: 'rao@specialforces.in', rank: 'Colonel', site: 'Command Centre', address: 'Delhi Cantonment, New Delhi' }, { id: 2, name: 'Singh', designation: 'Training Head', phone: '+91 9013001235', email: 'singh.major@specialforces.in', rank: 'Major', site: 'Mountain Training', address: 'Auli, Uttarakhand' }, { id: 3, name: 'Patel', designation: 'Operations Officer', phone: '+91 9013001236', email: 'patel.captain@specialforces.in', rank: 'Captain', site: 'Commando Base', address: 'Agra Cantonment, Uttar Pradesh' }] },
]

const columns = [
  { key: 'name', label: 'Customer Name', width: 220, minWidth: 160 },
  { key: 'number', label: 'Customer Number', width: 160, minWidth: 130 },
  { key: 'address', label: 'Primary Address', width: 280, minWidth: 200 },
  { key: 'contact_name', label: 'Primary Contact', width: 180, minWidth: 130 },
  { key: 'contact_phone', label: 'Phone', width: 140, minWidth: 120 },
  { key: 'contact_email', label: 'Email', width: 220, minWidth: 160 },
  { key: 'actions', label: 'Actions', width: 180, minWidth: 150 },
]

const emptyForm = { name: '', number: '', address: '', primaryContact: { name: '', designation: '', email: '', phone: '', rank: '', site: '' }, contacts: [] }

export default function CustomersPage({ customers, setCustomers }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [search, setSearch] = useState('')
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map(({ key, width }) => [key, width])))
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const filtered = useMemo(() => customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.number.toLowerCase().includes(search.toLowerCase())), [customers, search])

  const startColumnResize = (event, column) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = columnWidths[column.key]
    const resizeColumn = (moveEvent) => setColumnWidths((current) => ({ ...current, [column.key]: Math.max(column.minWidth, startWidth + moveEvent.clientX - startX) }))
    const stopResize = () => { document.removeEventListener('mousemove', resizeColumn); document.removeEventListener('mouseup', stopResize) }
    document.addEventListener('mousemove', resizeColumn)
    document.addEventListener('mouseup', stopResize)
  }

  const createCustomer = (form) => {
    const newCustomer = { id: Math.max(...customers.map(c => c.id), 0) + 1, ...form }
    setCustomers((current) => [newCustomer, ...current])
    setShowForm(false)
  }

  const updateCustomer = (form) => {
    setCustomers((current) => current.map(c => c.id === editingCustomer.id ? { ...form, id: c.id } : c))
    setEditingCustomer(null)
  }

  const deleteCustomer = (id) => {
    setCustomers((current) => current.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const exportColumns = columns.filter(({ key }) => key !== 'actions')
    const getValue = (c, key) => key === 'contact_name' ? c.primaryContact?.name : key === 'contact_phone' ? c.primaryContact?.phone : key === 'contact_email' ? c.primaryContact?.email : c[key]
    const data = [exportColumns.map(({ label }) => csv(label)), ...filtered.map((c) => exportColumns.map(({ key }) => csv(getValue(c, key))))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (showForm) return <CustomerForm onCancel={() => setShowForm(false)} onSubmit={createCustomer} />
  if (editingCustomer) return <CustomerForm customer={editingCustomer} onCancel={() => setEditingCustomer(null)} onSubmit={updateCustomer} />
  if (selectedCustomer) return <CustomerDetail customer={selectedCustomer} onCancel={() => setSelectedCustomer(null)} onEdit={() => { setEditingCustomer(selectedCustomer); setSelectedCustomer(null) }} />
  if (deleteConfirm) return <DeleteConfirmation customer={deleteConfirm} onConfirm={(id) => deleteCustomer(id)} onCancel={() => setDeleteConfirm(null)} />

  return (
    <section className="customer-list-page">
      <div className="customer-list-head"><div className="customer-list-title"><h1>Customers</h1></div><div className="user-list-actions"><button className="compact-button secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Extract data</button><button className="customer-create-button" onClick={() => setShowForm(true)}><Plus size={15} /> New customer</button></div></div>
      <div className="customer-command-bar">
        <div className="customer-search"><Search size={15} /><input aria-label="Search customers" placeholder="Search customers..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <span className="customer-list-count">{filtered.length ? `${filtered.length} customer${filtered.length === 1 ? '' : 's'}` : '0 results'}</span>
      </div>
      <div className="customer-table-frame"><div className="customer-table-scroll"><table className="customer-table"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}</colgroup><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}{column.key !== 'actions' && <button className="column-resize-handle" aria-label={`Resize ${column.label} column`} onMouseDown={(event) => startColumnResize(event, column)} />}</th>)}</tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.number}</td><td className="truncate">{customer.address}</td><td>{customer.primaryContact?.name || '—'}</td><td>{customer.primaryContact?.phone || '—'}</td><td className="truncate">{customer.primaryContact?.email || '—'}</td><td className="action-buttons"><button className="icon-button" title="View" onClick={() => setSelectedCustomer(customer)}><Eye size={14} /></button><button className="icon-button" title="Edit" onClick={() => setEditingCustomer(customer)}><Edit2 size={14} /></button><button className="icon-button danger" title="Delete" onClick={() => setDeleteConfirm(customer)}><Trash2 size={14} /></button></td></tr>)}{!filtered.length && <tr><td colSpan="7" className="empty-row">No customers match the search criteria.</td></tr>}</tbody></table></div></div>
      <footer className="customer-pagination"><span>Total: {customers.length} customer{customers.length === 1 ? '' : 's'}</span></footer>
    </section>
  )
}

function CustomerForm({ customer, onCancel, onSubmit }) {
  const [form, setForm] = useState(customer || emptyForm)
  const [newContact, setNewContact] = useState({ name: '', designation: '', phone: '', email: '', rank: '', site: '', address: '' })
  const [editingContactId, setEditingContactId] = useState(null)
  const [errors, setErrors] = useState({})

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const updatePrimary = (key, value) => setForm((current) => ({ ...current, primaryContact: { ...current.primaryContact, [key]: value } }))
  const addContact = () => {
    if (!newContact.name.trim()) return
    if (editingContactId) {
      setForm((current) => ({ ...current, contacts: current.contacts.map((contact) => contact.id === editingContactId ? { ...contact, ...newContact } : contact) }))
    } else {
      const contact = { id: Math.max(...form.contacts.map(c => c.id || 0), 0) + 1, ...newContact }
      setForm((current) => ({ ...current, contacts: [...current.contacts, contact] }))
    }
    setNewContact({ name: '', designation: '', phone: '', email: '', rank: '', site: '', address: '' })
    setEditingContactId(null)
  }
  const removeContact = (id) => setForm((current) => ({ ...current, contacts: current.contacts.filter(c => c.id !== id) }))
  const editContact = (contact) => {
    setEditingContactId(contact.id)
    setNewContact({ name: contact.name || '', designation: contact.designation || '', phone: contact.phone || '', email: contact.email || '', rank: contact.rank || '', site: contact.site || '', address: contact.address || '' })
  }
  const cancelContactEdit = () => {
    setEditingContactId(null)
    setNewContact({ name: '', designation: '', phone: '', email: '', rank: '', site: '', address: '' })
  }

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(['name', 'number', 'address'].filter((key) => !form[key].trim()).map((key) => [key, 'Required']))
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) onSubmit(form)
  }

  return <form className="customer-form-page" onSubmit={submit}>
    <header className="customer-form-header"><div><button type="button" className="customer-back-button" onClick={onCancel}><ArrowLeft size={15} /> Customers</button><h1>{customer ? 'Edit customer' : 'New customer'}</h1><p>{customer ? 'Update customer details and contacts.' : 'Create a new customer and configure contacts.'}</p></div><div className="customer-form-actions"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></div></header>
    <section className="customer-form-sheet">
      <section className="customer-form-section"><h2>Customer details</h2><div className="customer-form-grid"><label className={`customer-field ${errors.name ? 'has-error' : ''}`}><span>Customer name {errors.name && <em>*</em>}</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Indian Air Force" />{errors.name && <small>{errors.name}</small>}</label><label className={`customer-field ${errors.number ? 'has-error' : ''}`}><span>Customer number {errors.number && <em>*</em>}</span><input value={form.number} onChange={(e) => update('number', e.target.value)} placeholder="e.g. TASL-CUST-001" />{errors.number && <small>{errors.number}</small>}</label><label className={`customer-field full-width ${errors.address ? 'has-error' : ''}`}><span>Primary address {errors.address && <em>*</em>}</span><input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="e.g. Headquarters location" />{errors.address && <small>{errors.address}</small>}</label></div></section>

      <section className="customer-form-section"><h2>Primary contact</h2><div className="customer-form-grid"><label className="customer-field"><span>Contact name</span><input value={form.primaryContact.name} onChange={(e) => updatePrimary('name', e.target.value)} placeholder="Contact name" /></label><label className="customer-field"><span>Designation</span><input value={form.primaryContact.designation} onChange={(e) => updatePrimary('designation', e.target.value)} placeholder="e.g., Project Manager" /></label><label className="customer-field"><span>Contact email</span><input value={form.primaryContact.email} onChange={(e) => updatePrimary('email', e.target.value)} type="email" placeholder="email@example.com" /></label><label className="customer-field"><span>Contact phone</span><input value={form.primaryContact.phone} onChange={(e) => updatePrimary('phone', e.target.value)} placeholder="Phone number" /></label><label className="customer-field"><span>Rank</span><input value={form.primaryContact.rank} onChange={(e) => updatePrimary('rank', e.target.value)} placeholder="e.g., Senior" /></label><label className="customer-field"><span>Site</span><input value={form.primaryContact.site} onChange={(e) => updatePrimary('site', e.target.value)} placeholder="e.g., New Delhi" /></label></div></section>

      <section className="customer-form-section"><h2>Additional contacts ({form.contacts.length})</h2>{form.contacts.length > 0 && <div className="contacts-table-wrapper"><table className="contacts-table"><thead><tr><th>Rank</th><th>Contact Name</th><th>Designation</th><th>Phone Number</th><th>Email</th><th>Site Name</th><th>Site Address</th><th>Actions</th></tr></thead><tbody>{form.contacts.map((contact) => <tr key={contact.id}><td>{contact.rank}</td><td>{contact.name}</td><td>{contact.designation}</td><td>{contact.phone}</td><td className="truncate">{contact.email}</td><td>{contact.site}</td><td className="truncate">{contact.address}</td><td className="contact-actions"><button type="button" className="icon-button" title="Edit contact" onClick={() => editContact(contact)}><Edit2 size={14} /></button><button type="button" className="icon-button danger" title="Delete contact" onClick={() => removeContact(contact.id)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>}
      <div className="add-contact-section"><h3>{editingContactId ? 'Edit Contact' : 'Add New Contact'}</h3><div className="customer-form-grid"><label className="customer-field"><span>Rank</span><input value={newContact.rank} onChange={(e) => setNewContact({...newContact, rank: e.target.value})} placeholder="e.g., Colonel" /></label><label className="customer-field"><span>Contact Name *</span><input value={newContact.name} onChange={(e) => setNewContact({...newContact, name: e.target.value})} placeholder="Contact name" /></label><label className="customer-field"><span>Designation</span><input value={newContact.designation} onChange={(e) => setNewContact({...newContact, designation: e.target.value})} placeholder="e.g., Project Manager" /></label><label className="customer-field"><span>Phone Number</span><input value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} placeholder="Phone number" /></label><label className="customer-field"><span>Email</span><input value={newContact.email} onChange={(e) => setNewContact({...newContact, email: e.target.value})} type="email" placeholder="Email address" /></label><label className="customer-field"><span>Site Name</span><input value={newContact.site} onChange={(e) => setNewContact({...newContact, site: e.target.value})} placeholder="Site name" /></label><label className="customer-field"><span>Site Address</span><input value={newContact.address} onChange={(e) => setNewContact({...newContact, address: e.target.value})} placeholder="Site address" /></label></div><div className="contact-form-actions"><button type="button" className="add-contact-btn" onClick={addContact}>{editingContactId ? 'Save Contact' : 'Add Contact'}</button>{editingContactId && <button type="button" className="customer-cancel-button" onClick={cancelContactEdit}>Cancel</button>}</div></div></section>
    </section>
    <footer className="customer-form-footer"><button type="button" className="customer-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="customer-submit-button">Save</button></footer>
  </form>
}

function CustomerDetail({ customer, onCancel, onEdit }) {
  return <section className="customer-detail-page">
    <header className="customer-detail-header"><div><button type="button" className="customer-back-button" onClick={onCancel}><ArrowLeft size={15} /> Customers</button><div><h1>{customer.name}</h1><p className="customer-detail-subtitle">{customer.number} • {customer.address}</p></div></div><div className="customer-detail-actions"><button type="button" className="customer-cancel-button" onClick={onCancel}>Close</button><button type="button" className="customer-edit-button" onClick={onEdit}><Edit2 size={15} /> Edit</button></div></header>
    <section className="customer-detail-sheet">
      <section className="detail-section"><h2>Customer Details</h2><div className="detail-grid"><div className="detail-field"><span className="detail-label">Customer Name</span><span className="detail-value">{customer.name}</span></div><div className="detail-field"><span className="detail-label">Customer Number</span><span className="detail-value">{customer.number}</span></div><div className="detail-field full-width"><span className="detail-label">Primary Address</span><span className="detail-value">{customer.address}</span></div></div></section>
      
      <section className="detail-section"><h2>Primary Contact</h2><div className="detail-grid"><div className="detail-field"><span className="detail-label">Name</span><span className="detail-value">{customer.primaryContact?.name || '—'}</span></div><div className="detail-field"><span className="detail-label">Designation</span><span className="detail-value">{customer.primaryContact?.designation || '—'}</span></div><div className="detail-field"><span className="detail-label">Email</span><span className="detail-value">{customer.primaryContact?.email || '—'}</span></div><div className="detail-field"><span className="detail-label">Phone</span><span className="detail-value">{customer.primaryContact?.phone || '—'}</span></div><div className="detail-field"><span className="detail-label">Rank</span><span className="detail-value">{customer.primaryContact?.rank || '—'}</span></div><div className="detail-field"><span className="detail-label">Site</span><span className="detail-value">{customer.primaryContact?.site || '—'}</span></div></div></section>

      <section className="detail-section"><h2>Additional Contacts ({customer.contacts?.length || 0})</h2>{customer.contacts && customer.contacts.length > 0 ? <div className="contacts-table-wrapper"><table className="contacts-table"><thead><tr><th>Contact Name</th><th>Designation</th><th>Phone</th><th>Email</th><th>Site</th><th>Address</th></tr></thead><tbody>{customer.contacts.map((contact) => <tr key={contact.id}><td>{contact.name}</td><td>{contact.designation}</td><td>{contact.phone}</td><td className="truncate">{contact.email}</td><td>{contact.site}</td><td className="truncate">{contact.address}</td></tr>)}</tbody></table></div> : <p className="empty-contacts">No additional contacts configured.</p>}</section>
    </section>
    <footer className="customer-detail-footer"><button type="button" className="customer-cancel-button" onClick={onCancel}>Close</button><button type="button" className="customer-edit-button" onClick={onEdit}><Edit2 size={15} /> Edit</button></footer>
  </section>
}

function DeleteConfirmation({ customer, onConfirm, onCancel }) {
  return <div className="delete-confirmation-overlay">
    <div className="delete-confirmation-modal">
      <h2>Delete Customer?</h2>
      <p>Are you sure you want to delete <strong>{customer.name}</strong>? This action cannot be undone.</p>
      <div className="delete-confirmation-actions">
        <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        <button className="delete-btn" onClick={() => onConfirm(customer.id)}>Delete</button>
      </div>
    </div>
  </div>
}

