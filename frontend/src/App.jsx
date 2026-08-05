import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bell, BookOpen, Building2, CalendarDays, ChevronDown, ChevronRight, CircleHelp,
  ClipboardList, FileText, LayoutDashboard, Lock, LogIn,
  Mail, Menu, Package, Plus, Search, Settings, Shield,
  ShieldCheck, Users, UsersRound, Workflow, Wrench,
} from 'lucide-react'
import './App.css'

import OverviewPage from './pages/OverviewPage'
import IncidentsPage from './pages/IncidentsPage'
import CustomersPage, { initialCustomers } from './pages/CustomersPage'
import ContractsPage, { initialContracts, normalizeWarrantyStatus } from './pages/ContractsPage'
import ProductMasterPage, { seedProducts } from './pages/ProductMasterPage'
import ProductCategoryPage from './pages/ProductCategoryPage'
import UserManagementPage, { initialUsers } from './pages/UserManagementPage'
import AssignmentGroupsPage from './pages/AssignmentGroupsPage'
import ProcessConfigurationPage from './pages/ProcessConfigurationPage'
import RepairExecutionsPage from './pages/RepairExecutionsPage'
import EmailSettingsPage from './pages/EmailSettingsPage'
import MailCorrespondencePage from './pages/MailCorrespondencePage'
import MyCalendarPage from './pages/MyCalendarPage'
import SystemSettingsPage from './pages/SystemSettingsPage'
import AuthenticationSettingsPage from './pages/AuthenticationSettingsPage'
import KnowledgeManagementPage, { seedDocuments } from './pages/KnowledgeManagementPage'
import ReportingPage from './pages/ReportingPage'
import ApprovalCenterPage from './pages/ApprovalCenterPage'
import { authenticationApi, notificationApi, recordApi } from './data/api'
import { getProductCategories, reconcileProductAssets } from './data/productCategoryRegistry'
import { getConfiguredProcesses, getNextProcessStage, processConfigurationStorageKey } from './data/processConfiguration'

/* ──────────────────────────────────────────
   Navigation config
   ────────────────────────────────────────── */
const workspaceNav = [
  { key: 'Overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'Incidents', label: 'Incidents', icon: ClipboardList },
  { key: 'Customers', label: 'Customers', icon: Building2 },
  { key: 'Contracts', label: 'Contracts', icon: FileText },
  { key: 'Product master', label: 'Product master', icon: Package },
  { key: 'Product categories', label: 'Product categories', icon: Package },
  { key: 'Knowledge management', label: 'Knowledge management', icon: BookOpen },
  { key: 'Mail correspondence', label: 'Mail Correspondence', icon: Mail },
  { key: 'My Calendar', label: 'My Calendar', icon: CalendarDays, csmOnly: true },
  { key: 'Reporting', label: 'Reporting', icon: BarChart3 },
  { key: 'Approval center', label: 'Approval center', icon: ShieldCheck },
]

const configNav = [
  { key: 'Authentication settings', label: 'Authentication settings', icon: Shield },
  { key: 'User management', label: 'User management', icon: Users },
  { key: 'Assignment groups', label: 'Assignment groups', icon: UsersRound },
  { key: 'Repair execution', label: 'Repair Execution', icon: Wrench },
  { key: 'Process configuration', label: 'Process configuration', icon: Workflow },
  { key: 'Email settings', label: 'Email settings', icon: Mail },
  { key: 'System settings', label: 'System settings', icon: Settings },
]

const configuredCustomers = ['All customers', 'Indian Air Force', 'Indian Army', 'Indian Navy', 'Indian Army Special Forces']
const customerContactMigrationKey = 'als50-customer-contacts-rank-designation-v1'
const legacyIncidentOpenedValue = '22 Jul 2026 10:30'
const componentSerialJournalMigrationKey = 'als50-product-component-serial-journal-v3'
const initialRepairExecutions = [
  'Incident Registration',
  'Repair at Factory - In-house',
  'Repair at Factory - Vendor',
  'Repair at Site - TASL',
  'Repair at Site - Vendor',
].map((name, index) => ({ id: index + 1, name, active: true }))

const normalizeIncidentOpenedDates = (incidents) => incidents.map((incident) => {
  const workflowDefaults = !incident.repairExecution || !incident.status || incident.stage === 'Triage'
    ? { repairExecution: incident.repairExecution || 'Incident Registration', status: incident.status || 'Registered', stage: incident.stage === 'Triage' || !incident.stage ? incident.status || 'Registered' : incident.stage }
    : {}
  const auditLog = incident.auditLog?.map((entry) => ({ ...entry, changes: (entry.changes || []).filter((change) => change.field) }))
  const auditUpdates = auditLog ? { auditLog } : {}
  if (!incident.opened || incident.opened === legacyIncidentOpenedValue) return { ...incident, ...workflowDefaults, ...auditUpdates, opened: new Date().toISOString() }
  const parsed = new Date(incident.opened)
  return Number.isNaN(parsed.getTime()) ? { ...incident, ...workflowDefaults, ...auditUpdates } : { ...incident, ...workflowDefaults, ...auditUpdates, opened: parsed.toISOString() }
})

const normalizeAssignmentGroupName = (name) => ({
  'Customer Support Management Team': 'Customer Support Management Group',
  'Supply Chain Management': 'Supply Chain management',
}[name] || name)
const normalizeIncidentAssignmentGroups = (incidents) => incidents.map((incident) => {
  const currentAssignmentGroup = incident.assignmentGroup || incident.group || ''
  const assignmentGroup = normalizeAssignmentGroupName(currentAssignmentGroup)
  return assignmentGroup === currentAssignmentGroup
    ? incident
    : { ...incident, assignmentGroup, group: assignmentGroup, assignedTo: '' }
})
const normalizeProcessAssignmentGroups = (processes) => processes.map((process) => {
  const assignmentGroup = normalizeAssignmentGroupName(process.assignmentGroup || '')
  return assignmentGroup === process.assignmentGroup ? process : { ...process, assignmentGroup }
})

const recordMapsEqual = (first, second) => first.size === second.size
  && [...first].every(([recordId, payload]) => second.get(recordId) === payload)

const notificationTimestamp = (notification) => Date.parse(notification.createdAt || '') || 0
const sortNotificationsNewestFirst = (notifications) => [...notifications]
  .sort((first, second) => notificationTimestamp(second) - notificationTimestamp(first))
const isReadNotification = (notification) => notification.recipientUserId
  ? (notification.readByUserIds || []).some((userId) => String(userId) === String(notification.recipientUserId))
  : Boolean(notification.read)
const isStaleReadNotification = (notification, cutoff) => isReadNotification(notification)
  && notificationTimestamp(notification) > 0
  && notificationTimestamp(notification) < cutoff
const assignmentGroupNotifications = (incident, assignmentGroup, groups, users) => {
  const group = groups.find((entry) => entry.active && entry.name === assignmentGroup)
  const createdAt = new Date().toISOString()
  const eventId = Date.now()
  const memberIds = new Set((group?.memberIds || []).map(String))
  return users
    .filter((user) => user.status === 'Active' && memberIds.has(String(user.id)))
    .map((user) => ({
      id: `assignment-group-${incident.id}-${eventId}-${user.id}`,
      type: 'assignment-group',
      title: 'New incident assigned to your group',
      incidentId: incident.id,
      assignmentGroup,
      workNotes: `${incident.id} has been assigned to ${assignmentGroup}.`,
      recipientUserId: user.id,
      recipientName: user.name,
      readByUserIds: [],
      createdAt,
    }))
}

const reseedCustomerContacts = (customers) => {
  if (localStorage.getItem(customerContactMigrationKey)) return customers
  const seededCustomers = new Map(initialCustomers.map((customer) => [customer.name, customer]))
  const reseededCustomers = customers.map((customer) => {
    const seededCustomer = seededCustomers.get(customer.name)
    return seededCustomer ? { ...customer, primaryContact: seededCustomer.primaryContact, contacts: seededCustomer.contacts } : customer
  })
  localStorage.setItem(customerContactMigrationKey, '1')
  return reseededCustomers
}

const operationalGroupNames = [
  'Customer Support Management Group',
  'Program Management',
  'Flight Team',
  'Engineering Team',
  'Design Team',
  'GCS',
  'Production Management',
  'Hardware',
  'Manufacturing Engineering',
  'Radio',
  'Quality Management',
  'Supply Chain management',
  'Store Management',
  'System Administration',
]

const managerUsers = initialUsers.filter((user) => user.role === 'Manager')
const serviceUsers = initialUsers.filter((user) => user.role === 'Service engineer')
const administratorUsers = initialUsers.filter((user) => user.role === 'Administrator')
const initialAssignmentGroups = [
  ...operationalGroupNames.map((name, index) => {
    const memberCount = index < 11 ? 4 : 3
    const serviceStartIndex = index < 11 ? index * 4 : 44 + (index - 11) * 3
    const manager = managerUsers[index % managerUsers.length]
    const assignedServiceUsers = serviceUsers.slice(serviceStartIndex, serviceStartIndex + memberCount)
    return {
      id: index + 1,
      name,
      manager: manager.name,
      description: `${name} operational support group.`,
      memberIds: [manager.id, ...assignedServiceUsers.map((user) => user.id)],
      members: memberCount + 1,
      escalatesTo: '',
      created: '01 Jul 2026',
      updated: '22 Jul 2026',
      active: true,
    }
  }),
  {
    id: operationalGroupNames.length + 1,
    name: 'Admin Team',
    manager: managerUsers[0].name,
    description: 'System administration and platform governance group.',
    memberIds: [...administratorUsers.map((user) => user.id), managerUsers[0].id],
    members: administratorUsers.length + 1,
    escalatesTo: '',
    created: '01 Jul 2026',
    updated: '22 Jul 2026',
    active: true,
  },
  {
    id: operationalGroupNames.length + 2,
    name: 'Advisory Group',
    manager: managerUsers[0].name,
    description: 'Cross-functional advisory group for service and program decisions.',
    memberIds: [managerUsers[0].id, managerUsers[1].id],
    members: 2,
    escalatesTo: '',
    created: '01 Jul 2026',
    updated: '22 Jul 2026',
    active: true,
  },
]

/* ──────────────────────────────────────────
   Login Page
   ────────────────────────────────────────── */
function LoginPage({ onLogin, users, assignmentGroups, directoryReady }) {
  const initialsFor = (name) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const demoUsers = useMemo(() => [
    ...users
      .filter((user) => user.status === 'Active' && user.role === 'Administrator')
      .slice(0, 1)
      .map((user) => ({ key: 'admin', label: 'Administrator', name: user.name, email: user.email, role: user.role, initials: initialsFor(user.name), credential: user.employeeId })),
    ...assignmentGroups
      .filter((group) => group.active)
      .map((group) => {
        const member = users.find((user) => group.memberIds?.includes(user.id) && user.status === 'Active')
        return member && { key: `group-${group.id}`, label: group.name, name: member.name, email: member.email, role: member.role, initials: initialsFor(member.name), credential: member.employeeId }
      })
      .filter(Boolean),
  ], [assignmentGroups, users])
  const [selectedUserKey, setSelectedUserKey] = useState('')
  const selectedUser = demoUsers.find((user) => user.key === selectedUserKey) || demoUsers[0]

  useEffect(() => {
    if (!demoUsers.some((user) => user.key === selectedUserKey)) setSelectedUserKey(demoUsers[0]?.key || '')
  }, [demoUsers, selectedUserKey])

  const [loginError, setLoginError] = useState('')
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    setLoginError('')
    try {
      const session = await authenticationApi.demoLogin(selectedUser)
      onLogin({ ...selectedUser, session })
    } catch (error) {
      setLoginError(error.message)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-image-panel">
        <div className="login-brand-content">
          <div className="login-brand-lockup"><span className="login-brand-mark"><img src="/assets/als50-logo-cropped.png" alt="ALS50 CSM Portal logo" /></span><span>ALS50 CSM Portal</span></div>
          <div className="login-image-copy">
            <h1>Every mission, supported.</h1>
            <p>Customer Support Management</p>
          </div>
          <div className="login-image-footer"><span>Post-delivery operations</span><span>v0.1.0</span></div>
        </div>
      </div>
      <div className="login-form-panel">
        <img className="tata-wordmark" src="/assets/tasl_logo.png" alt="Tata Advanced Systems" />
        <div className="login-card">
          <p className="login-eyebrow">Demo access</p>
          <h2>Choose a test identity</h2>
          <p className="login-desc">{directoryReady ? 'Select a representative from an assignment group to test incident visibility and workflow routing.' : 'Loading active assignment group members...'}</p>
          <form onSubmit={handleSubmit}>
            <div className="demo-user-tiles">{demoUsers.map((demoUser) => <button type="button" key={demoUser.key} className={`demo-user-tile ${selectedUser?.key === demoUser.key ? 'selected' : ''}`} onClick={() => setSelectedUserKey(demoUser.key)}><span className="demo-user-avatar">{demoUser.initials}</span><span className="demo-user-details"><strong>{demoUser.label}</strong><small>{demoUser.name}</small><small>{demoUser.email}</small></span><span className="demo-user-credential">{demoUser.credential}</span></button>)}</div>
            <div className="login-actions"><button type="submit" className="login-btn primary" disabled={!directoryReady || !selectedUser}><LogIn size={17} /> Continue as {selectedUser?.name || 'selected user'}</button></div>
          </form>
          {loginError && <p className="login-desc" role="alert">{loginError}</p>}
          <div className="login-footer"><Lock size={13} /> Demo identities map to the seeded user records and Entra IDs.</div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────
   Dashboard (main app shell)
   ────────────────────────────────────────── */
const incidentReportFields = ['Number', 'Short description', 'Customer', 'Priority', 'State', 'Assignment group', 'Opened', 'Age days', 'Age bucket']
const defaultReports = [
  {
    id: 'report-loitering-munition-warranty-status',
    name: 'Loitering Munition warranty status',
    source: 'Product category: Loitering Munition',
    filters: [],
    visualization: 'bar',
    fields: ['Serial number', 'Contract number', 'Customer', 'Warranty expiry', 'Warranty status'],
    selectedFields: ['Serial number', 'Contract number', 'Customer', 'Warranty expiry', 'Warranty status'],
    groupBy: ['Warranty status'],
    sortBy: 'Warranty expiry',
    sortDirection: 'ascending',
    style: { showLegend: true, showValues: true, palette: 'operational' },
    createdBy: 'amitabh.sharma@aerofix.in',
    createdByName: 'Amitabh Sharma',
    sharedWith: ['Manager', 'Service engineer'],
    updatedAt: '2026-07-23T00:00:00.000Z',
  },
  {
    id: 'report-loitering-munition-service-due',
    name: 'Loitering Munition service due',
    source: 'Product category: Loitering Munition',
    filters: [],
    visualization: 'bar',
    fields: ['Serial number', 'Contract number', 'Customer', 'Last serviced', 'Service due', 'Service due period'],
    selectedFields: ['Serial number', 'Contract number', 'Customer', 'Service due', 'Service due period'],
    groupBy: ['Service due period'],
    sortBy: 'Service due',
    sortDirection: 'ascending',
    style: { showLegend: true, showValues: true, palette: 'signal' },
    createdBy: 'amitabh.sharma@aerofix.in',
    createdByName: 'Amitabh Sharma',
    sharedWith: ['Manager', 'Service engineer'],
    updatedAt: '2026-07-23T00:00:00.000Z',
  },
  {
    id: 'report-incidents-customer-priority',
    name: 'Incidents by customer and priority',
    source: 'Incidents',
    filters: [],
    visualization: 'bar',
    fields: incidentReportFields,
    groupBy: ['Customer', 'Priority'],
    createdBy: 'amitabh.sharma@aerofix.in',
    createdByName: 'Amitabh Sharma',
    sharedWith: ['Manager', 'Service engineer'],
    updatedAt: '2026-07-22T00:00:00.000Z',
  },
  {
    id: 'report-open-incidents-aging',
    name: 'Open incidents older than 1 week and 1 month',
    source: 'Incidents',
    filters: [
      { id: 'aging-state', field: 'State', operator: 'is not one of', value: 'Resolved|Closed' },
      { id: 'aging-days', field: 'Age days', operator: 'greater than', value: '7' },
    ],
    visualization: 'bar',
    fields: incidentReportFields,
    groupBy: ['Age bucket'],
    createdBy: 'amitabh.sharma@aerofix.in',
    createdByName: 'Amitabh Sharma',
    sharedWith: ['Manager', 'Service engineer'],
    updatedAt: '2026-07-22T00:00:00.000Z',
  },
]

function Dashboard({ user, onLogout }) {
  const dashboardStorageKey = `als50-dashboard-${user.email}`
  const [activePage, setActivePage] = useState('Overview')
  const [reportingVisit, setReportingVisit] = useState(0)
  const [drillReportId, setDrillReportId] = useState(null)
  const [nlpReportDefinition, setNlpReportDefinition] = useState(null)
  const [incidentDrill, setIncidentDrill] = useState(null)
  const [productAssetDrill, setProductAssetDrill] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [categoryNavigationOpen, setCategoryNavigationOpen] = useState(true)
  const [incidentNavigationOpen, setIncidentNavigationOpen] = useState(true)
  const [approvalCenterOpen, setApprovalCenterOpen] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState('All customers')
  const [incidentEditMode, setIncidentEditMode] = useState(false)
  const [customers, setCustomers] = useState(initialCustomers)
  const [incidents, setIncidents] = useState([])
  const [contracts, setContracts] = useState(initialContracts)
  const [products, setProducts] = useState(seedProducts)
  const [productAssets, setProductAssets] = useState([])
  const [knowledgeDocuments, setKnowledgeDocuments] = useState(seedDocuments)
  const [mailCorrespondence, setMailCorrespondence] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [assignmentGroups, setAssignmentGroups] = useState(initialAssignmentGroups)
  const [users, setUsers] = useState(initialUsers)
  const [repairExecutions, setRepairExecutions] = useState(initialRepairExecutions)
  const [processes, setProcesses] = useState(() => getConfiguredProcesses())
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationToasts, setNotificationToasts] = useState([])
  const seenNotificationIds = useRef(new Set())
  const notificationsInitialized = useRef(false)
  const [persistenceReady, setPersistenceReady] = useState(false)
  const persistedCollections = useRef({})
  const currentCollections = useRef({})
  const [reports, setReports] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('als50-report-library') || '[]')
    return [...stored, ...defaultReports.filter((report) => !stored.some((item) => item.id === report.id))]
  })
  const [dashboardLayout, setDashboardLayout] = useState(() => {
    const stored = JSON.parse(localStorage.getItem(dashboardStorageKey) || '[]')
    if (stored.length) return stored
    // Initialize with default dashboard tiles on first load
    return [
      { i: 'report-incidents-customer-priority', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'report-loitering-munition-warranty-status', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'report-loitering-munition-service-due', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'report-open-incidents-aging', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
    ]
  })

  useEffect(() => { localStorage.setItem('als50-report-library', JSON.stringify(reports)) }, [reports])
  useEffect(() => { localStorage.setItem(dashboardStorageKey, JSON.stringify(dashboardLayout)) }, [dashboardLayout, dashboardStorageKey])
  useEffect(() => { localStorage.setItem(processConfigurationStorageKey, JSON.stringify(processes)) }, [processes])
  useEffect(() => {
    const synchronizeProcesses = (event) => {
      if (event.key !== processConfigurationStorageKey || event.storageArea !== localStorage) return
      try {
        setProcesses(JSON.parse(event.newValue || '[]'))
      } catch {
        setProcesses([])
      }
    }
    window.addEventListener('storage', synchronizeProcesses)
    return () => window.removeEventListener('storage', synchronizeProcesses)
  }, [])

  useEffect(() => {
    let active = true
    const collections = [
      { resource: 'customers', records: customers, setRecords: setCustomers, key: (record) => record.id || record.name },
      { resource: 'contracts', records: contracts, setRecords: setContracts, key: (record) => record.id || record.number },
      { resource: 'products', records: products, setRecords: setProducts, key: (record) => record.productRecordId || record.material_serial_number || record.product_serial_number },
      { resource: 'product_assets', records: productAssets, setRecords: setProductAssets, key: (record) => record.id },
      { resource: 'incidents', records: incidents, setRecords: setIncidents, key: (record) => record.id },
      { resource: 'knowledge_documents', records: knowledgeDocuments, setRecords: setKnowledgeDocuments, key: (record) => record.id || record.number || record.title },
      { resource: 'mail_correspondence', records: mailCorrespondence, setRecords: setMailCorrespondence, key: (record) => record.id },
      { resource: 'calendar_events', records: calendarEvents, setRecords: setCalendarEvents, key: (record) => record.id },
      { resource: 'users', records: users, setRecords: setUsers, key: (record) => record.id || record.email },
      { resource: 'assignment_groups', records: assignmentGroups, setRecords: setAssignmentGroups, key: (record) => record.id || record.name },
      { resource: 'repair_executions', records: repairExecutions, setRecords: setRepairExecutions, key: (record) => record.id },
      { resource: 'process_configurations', records: processes, setRecords: setProcesses, key: (record) => record.id },
      { resource: 'notifications', records: notifications, setRecords: setNotifications, key: (record) => record.id },
    ]
    const migrate = async () => {
      try {
        await Promise.all(collections.map(async ({ resource, records, setRecords, key }) => {
          const stored = await recordApi.list(resource)
          if (stored.length) {
            const persistedRecords = stored.map((record) => resource === 'products'
              ? { ...record.payload, productRecordId: record.payload.productRecordId || record.record_id }
              : record.payload)
            if (active) setRecords(resource === 'assignment_groups'
              ? persistedRecords.map((group) => group.name === 'Customer Support Manager' ? { ...group, name: 'Customer Support Management Group' } : group.name === 'Advisory Team' ? { ...group, name: 'Advisory Group' } : group)
              : resource === 'customers' ? reseedCustomerContacts(persistedRecords)
                : resource === 'incidents' ? normalizeIncidentAssignmentGroups(normalizeIncidentOpenedDates(persistedRecords))
                  : resource === 'process_configurations' ? normalizeProcessAssignmentGroups(persistedRecords)
                    : persistedRecords)
            persistedCollections.current[resource] = new Map(stored.map((record) => [record.record_id, JSON.stringify(record.payload)]))
            return
          }
          if (records.length) {
            const initialRecords = records.map((record) => ({ record_id: String(key(record)), payload: record }))
            await recordApi.bulkUpsert(resource, initialRecords)
            persistedCollections.current[resource] = new Map(initialRecords.map((record) => [record.record_id, JSON.stringify(record.payload)]))
          }
        }))
      } catch (error) {
        console.warn('PostgreSQL persistence is unavailable; using the current local session.', error)
      } finally {
        if (active) setPersistenceReady(true)
      }
    }
    migrate()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!persistenceReady) return
    setContracts((current) => {
      const normalized = current.map(normalizeWarrantyStatus)
      return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized
    })
  }, [persistenceReady])

  useEffect(() => {
    if (!persistenceReady) return
    setProductAssets((current) => {
      const reconciled = reconcileProductAssets(products, contracts, current)
      return JSON.stringify(reconciled) === JSON.stringify(current) ? current : reconciled
    })
  }, [contracts, persistenceReady, products])

  useEffect(() => {
    if (!persistenceReady || !contracts.length) return
    const group = assignmentGroups.find((entry) => entry.name === 'Customer Support Management Group' && entry.active)
    if (!group) return
    const recipients = users.filter((entry) => group.memberIds?.some((memberId) => String(memberId) === String(entry.id)) && entry.email).map((entry) => ({ name: entry.name, email: entry.email }))
    const expiredContracts = contracts.filter((contract) => contract.expiryDate && contract.expiryDate < new Date().toISOString().slice(0, 10))
    let active = true
    Promise.all(expiredContracts.map((contract) => notificationApi.createWarrantyExpiryNotification({
      contractNumber: contract.number,
      customer: contract.customer,
      expiryDate: contract.expiryDate,
      recipients,
    }))).then((results) => {
      if (!active) return
      setNotifications((current) => sortNotificationsNewestFirst(results.reduce((next, result) => next.some((notification) => notification.id === result.notification.id) ? next : [...next, result.notification], current)))
    }).catch((error) => console.warn('Unable to create warranty-expiry notifications.', error))
    return () => { active = false }
  }, [assignmentGroups, contracts, persistenceReady, users])

  useEffect(() => {
    if (!persistenceReady) return
    const pruneStaleReadNotifications = () => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      setNotifications((current) => {
        const retained = current.filter((notification) => !isStaleReadNotification(notification, cutoff))
        return retained.length === current.length ? current : retained
      })
    }
    pruneStaleReadNotifications()
    const timer = window.setInterval(pruneStaleReadNotifications, 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [notifications, persistenceReady])

  useEffect(() => {
    if (!persistenceReady || !incidents.length || !products.length || localStorage.getItem(componentSerialJournalMigrationKey)) return
    setProducts((current) => {
      let changed = false
      const migratedProducts = current.map((product) => {
        const key = [product.subsystems, product.material_description, product.part_number || ''].join('::')
        const incident = incidents.find((entry) => entry.serialNumber === product.product_serial_number && (
          entry.componentSerialNumbers?.[key] || (entry.auditLog || []).some((journalEntry) => (journalEntry.changes || []).some((change) => change.field === `Component serial number: ${product.material_description}` && change.previous === product.material_serial_number))
        ))
        if (!incident) return product
        const auditChange = [...(incident.auditLog || [])].reverse().flatMap((journalEntry) => journalEntry.changes || []).find((change) => change.field === `Component serial number: ${product.material_description}` && change.previous === product.material_serial_number)
        const nextSerialNumber = incident.componentSerialNumbers?.[key] || auditChange?.next
        if (!nextSerialNumber || nextSerialNumber === product.material_serial_number) return product
        changed = true
        return { ...product, material_serial_number: nextSerialNumber, productJournal: [...(product.productJournal || []), { id: `migration-${incident.id}-${product.part_number}`, updatedAt: new Date().toISOString(), updatedBy: 'System migration', incidentNumber: incident.id, field: 'Material Serial No', previous: product.material_serial_number || 'Not Applicable', next: nextSerialNumber }] }
      })
      localStorage.setItem(componentSerialJournalMigrationKey, '1')
      return changed ? migratedProducts : current
    })
  }, [incidents, persistenceReady, products])

  useEffect(() => {
    if (!persistenceReady) return
    const collections = [
      ['customers', customers, (record) => record.id || record.name],
      ['contracts', contracts, (record) => record.id || record.number],
      ['products', products, (record) => record.productRecordId || record.material_serial_number || record.product_serial_number],
      ['product_assets', productAssets, (record) => record.id],
      ['incidents', incidents, (record) => record.id],
      ['knowledge_documents', knowledgeDocuments, (record) => record.id || record.number || record.title],
      ['mail_correspondence', mailCorrespondence, (record) => record.id],
      ['calendar_events', calendarEvents, (record) => record.id],
      ['users', users, (record) => record.id || record.email],
      ['assignment_groups', assignmentGroups, (record) => record.id || record.name],
      ['repair_executions', repairExecutions, (record) => record.id],
      ['process_configurations', processes, (record) => record.id],
      ['notifications', notifications, (record) => record.id],
    ]
    collections.forEach(([resource, records, key]) => {
      if (resource === 'product_assets' && !records.length && products.length) return
      const nextRecords = records.map((record) => ({ record_id: String(key(record)), payload: record }))
      const previousRecords = persistedCollections.current[resource] || new Map()
      const nextRecordMap = new Map(nextRecords.map((record) => [record.record_id, JSON.stringify(record.payload)]))
      const changedRecords = nextRecords.filter((record) => previousRecords.get(record.record_id) !== JSON.stringify(record.payload))
      const deletedRecordIds = [...previousRecords.keys()].filter((recordId) => !nextRecordMap.has(recordId))
      if (!changedRecords.length && !deletedRecordIds.length) return
      Promise.all([
        changedRecords.length ? recordApi.bulkUpsert(resource, changedRecords) : Promise.resolve(),
        ...deletedRecordIds.map((recordId) => recordApi.remove(resource, recordId)),
      ]).then(() => {
        persistedCollections.current[resource] = nextRecordMap
      }).catch((error) => console.warn(`Unable to save ${resource}.`, error))
    })
  }, [assignmentGroups, calendarEvents, contracts, customers, incidents, knowledgeDocuments, mailCorrespondence, notifications, persistenceReady, processes, productAssets, products, repairExecutions, users])

  useEffect(() => {
    const collections = [
      ['customers', customers, (record) => record.id || record.name],
      ['contracts', contracts, (record) => record.id || record.number],
      ['products', products, (record) => record.productRecordId || record.material_serial_number || record.product_serial_number],
      ['product_assets', productAssets, (record) => record.id],
      ['incidents', incidents, (record) => record.id],
      ['knowledge_documents', knowledgeDocuments, (record) => record.id || record.number || record.title],
      ['mail_correspondence', mailCorrespondence, (record) => record.id],
      ['calendar_events', calendarEvents, (record) => record.id],
      ['users', users, (record) => record.id || record.email],
      ['assignment_groups', assignmentGroups, (record) => record.id || record.name],
      ['repair_executions', repairExecutions, (record) => record.id],
      ['process_configurations', processes, (record) => record.id],
      ['notifications', notifications, (record) => record.id],
    ]
    currentCollections.current = Object.fromEntries(collections.map(([resource, records, key]) => [resource, new Map(records.map((record) => [String(key(record)), JSON.stringify(record)]))]))
  }, [assignmentGroups, calendarEvents, contracts, customers, incidents, knowledgeDocuments, mailCorrespondence, notifications, processes, productAssets, products, repairExecutions, users])

  useEffect(() => {
    if (!persistenceReady) return
    const collections = [
      ['customers', setCustomers, (record) => record.id || record.name],
      ['contracts', setContracts, (record) => record.id || record.number],
      ['products', setProducts, (record) => record.productRecordId || record.material_serial_number || record.product_serial_number],
      ['product_assets', setProductAssets, (record) => record.id],
      ['incidents', setIncidents, (record) => record.id],
      ['knowledge_documents', setKnowledgeDocuments, (record) => record.id || record.number || record.title],
      ['mail_correspondence', setMailCorrespondence, (record) => record.id],
      ['calendar_events', setCalendarEvents, (record) => record.id],
      ['users', setUsers, (record) => record.id || record.email],
      ['assignment_groups', setAssignmentGroups, (record) => record.id || record.name],
      ['repair_executions', setRepairExecutions, (record) => record.id],
      ['process_configurations', setProcesses, (record) => record.id],
      ['notifications', setNotifications, (record) => record.id],
    ]
    const synchronize = async () => {
      await Promise.all(collections.map(async ([resource, setRecords, key]) => {
        try {
          const stored = await recordApi.list(resource)
          const remoteMap = new Map(stored.map((record) => [record.record_id, JSON.stringify(record.payload)]))
          const persistedMap = persistedCollections.current[resource] || new Map()
          const currentMap = currentCollections.current[resource] || new Map()
          if (recordMapsEqual(remoteMap, persistedMap) || !recordMapsEqual(currentMap, persistedMap)) return
          const records = stored.map((record) => resource === 'products'
            ? { ...record.payload, productRecordId: record.payload.productRecordId || record.record_id }
            : record.payload)
          setRecords(resource === 'assignment_groups'
            ? records.map((group) => group.name === 'Customer Support Manager' ? { ...group, name: 'Customer Support Management Group' } : group.name === 'Advisory Team' ? { ...group, name: 'Advisory Group' } : group)
            : resource === 'customers' ? reseedCustomerContacts(records)
              : resource === 'incidents' ? normalizeIncidentAssignmentGroups(normalizeIncidentOpenedDates(records))
                : resource === 'process_configurations' ? normalizeProcessAssignmentGroups(records)
                  : records)
          persistedCollections.current[resource] = remoteMap
        } catch (error) {
          console.warn(`Unable to refresh ${resource}.`, error)
        }
      }))
    }
    synchronize()
    const timer = window.setInterval(synchronize, 2000)
    return () => window.clearInterval(timer)
  }, [persistenceReady])

  useEffect(() => {
    setUsers((current) => current.length ? current : initialUsers)
    setAssignmentGroups((current) => {
      const migratedGroups = current.map((group) => group.name === 'Customer Support Manager' ? { ...group, name: 'Customer Support Management Group' } : group)
      const missingSeedGroups = initialAssignmentGroups.filter((seedGroup) => !migratedGroups.some((group) => group.name === seedGroup.name))
      return missingSeedGroups.length ? [...migratedGroups, ...missingSeedGroups] : migratedGroups
    })
  }, [])

  const addCustomerContact = (customerName, contact) => {
    setCustomers((current) => current.map((customer) => {
      if (customer.name !== customerName) return customer
      const nextId = Math.max(...customer.contacts.map((entry) => entry.id || 0), 0) + 1
      return { ...customer, contacts: [...customer.contacts, { id: nextId, designation: '', email: '', site: '', address: '', ...contact }] }
    }))
  }

  const saveReport = (definition, sharedWith = []) => {
    const existing = reports.find((report) => report.createdBy === user.email && report.name === definition.name && report.source === definition.source)
    const id = existing?.id || `report-${Date.now()}`
    setReports((current) => {
      const report = { ...definition, id, createdBy: user.email, createdByName: user.name, sharedWith: [...new Set([...(existing?.sharedWith || []), ...sharedWith])], updatedAt: new Date().toISOString() }
      return existing ? current.map((item) => item.id === id ? report : item) : [...current, report]
    })
    return id
  }

  const addReportToDashboard = (reportId) => setDashboardLayout((current) => current.some((item) => item.i === reportId) ? current : [...current, { i: reportId, x: 0, y: Infinity, w: 6, h: 4, minW: 3, minH: 3 }])
  const removeReportFromDashboard = (reportId) => setDashboardLayout((current) => current.filter((item) => item.i !== reportId))

  const applicationData = { customers, incidents, contracts, products, productAssets, knowledgeDocuments, users, assignmentGroups, notifications }
  const productCategories = getProductCategories(products)
  const currentUserRecord = users.find((member) => member.email === user.email) || user
  const createNotifications = (nextNotifications) => setNotifications((current) => sortNotificationsNewestFirst([...current, ...nextNotifications.filter((notification) => !current.some((entry) => entry.id === notification.id))]))
  const createAssignmentNotifications = (incident, assignmentGroup) => createNotifications(assignmentGroupNotifications(incident, assignmentGroup, assignmentGroups, users))
  const resolveGroupApproval = async (incidentId, decision, reason) => {
    const incident = incidents.find((entry) => entry.id === incidentId)
    const approval = incident?.groupApproval
    if (!approval || approval.status !== 'Pending') return
    const decidedBy = currentUserRecord.name || user.name || user.email
    if (!approval.members?.some((member) => member.name === decidedBy && member.status === 'Pending')) return
    const decidedAt = new Date().toISOString()
    const isReplacementApproval = approval.approvalType === 'replacement-parts'
    const nextStage = decision === 'Approved' && !isReplacementApproval
      ? getNextProcessStage(incident.repairExecution, incident.status, processes)
      : null
    const nextAssignmentGroup = nextStage?.assignmentGroup || incident.assignmentGroup || incident.group || ''
    const updatedIncident = {
      ...incident,
      ...(nextStage ? {
        status: nextStage.status,
        stage: nextStage.status,
        assignmentGroup: nextAssignmentGroup,
        group: nextAssignmentGroup,
        assignedTo: '',
      } : {}),
      groupApproval: {
        ...approval,
        status: decision,
        decision,
        decisionBy: decidedBy,
        decisionAt: decidedAt,
        decisionReason: reason,
        approvedBy: decision === 'Approved' ? decidedBy : '',
        approvedAt: decision === 'Approved' ? decidedAt : '',
        members: approval.members.map((member) => member.name === decidedBy
          ? { ...member, status: decision, decisionReason: reason, completedAt: decidedAt }
          : member.status === 'Pending' ? { ...member, status: 'Cancelled', completedAt: decidedAt } : member),
      },
      auditLog: [...(incident.auditLog || []), {
        id: `approval-${Date.now()}-${Math.random()}`,
        assignedGroup: approval.assignmentGroup || incident.assignmentGroup || incident.group || '',
        updatedBy: decidedBy,
        updatedAt: decidedAt,
        changes: [
          { field: 'Approval request', previous: 'Pending', next: approval.id },
          { field: 'Approval decision', previous: 'Pending', next: decision },
          { field: 'Approval reason', previous: '', next: reason },
          { field: 'Approval group', previous: '', next: approval.assignmentGroup || incident.assignmentGroup || incident.group || '--' },
          ...(nextStage ? [
            { field: 'Status', previous: incident.status, next: nextStage.status },
            { field: 'Assigned group', previous: incident.assignmentGroup || incident.group || '--', next: nextAssignmentGroup || '--' },
            { field: 'Assigned to', previous: incident.assignedTo || '--', next: '--' },
          ] : []),
        ],
      }],
    }
    await recordApi.bulkUpsert('incidents', [{ record_id: updatedIncident.id, payload: updatedIncident }])
    setIncidents((current) => current.map((entry) => entry.id === updatedIncident.id ? updatedIncident : entry))
    if (nextStage && nextAssignmentGroup !== (incident.assignmentGroup || incident.group || '')) createAssignmentNotifications(updatedIncident, nextAssignmentGroup)
  }
  const openIncidentFromApproval = (incidentId) => {
    setIncidentDrill({ incidentIds: [incidentId], selectedIncidentId: incidentId, activeTab: 'Notes', navigationId: Date.now() })
    setActivePage('Incidents')
  }
  const notificationsForCurrentUser = sortNotificationsNewestFirst(notifications
    .filter((notification) => !notification.recipientUserId || String(notification.recipientUserId) === String(currentUserRecord.id)))
  const unreadNotifications = notificationsForCurrentUser.filter((notification) => notification.recipientUserId ? !notification.readByUserIds?.includes(currentUserRecord.id) : !notification.read)
  const currentUserGroupNames = assignmentGroups
    .filter((group) => group.manager === user.name || group.memberIds?.includes(currentUserRecord.id))
    .map((group) => group.name)
  const visibleIncidentCount = incidents.filter((incident) => currentUserGroupNames.includes(incident.assignmentGroup || incident.group)).length
  useEffect(() => {
    if (!persistenceReady) return
    const nextNotifications = notifications.filter((notification) => notification.recipientUserId && String(notification.recipientUserId) === String(currentUserRecord.id) && !seenNotificationIds.current.has(notification.id))
    nextNotifications.forEach((notification) => seenNotificationIds.current.add(notification.id))
    if (!notificationsInitialized.current) {
      notificationsInitialized.current = true
      return
    }
    if (!nextNotifications.length) return
    setNotificationToasts((current) => sortNotificationsNewestFirst([...current, ...nextNotifications]))
    const timer = window.setTimeout(() => setNotificationToasts((current) => current.filter((notification) => !nextNotifications.some((next) => next.id === notification.id))), 6000)
    return () => window.clearTimeout(timer)
  }, [currentUserRecord.id, notifications, persistenceReady])

  const toggleNotifications = () => setNotificationsOpen((open) => !open)
  const openNotification = (notification) => {
    setNotifications((current) => current.map((entry) => entry.id !== notification.id ? entry : entry.recipientUserId
      ? { ...entry, readByUserIds: [...new Set([...(entry.readByUserIds || []), currentUserRecord.id])] }
      : { ...entry, read: true }))
    setNotificationsOpen(false)
    if (notification.incidentId) {
      setIncidentDrill({ incidentIds: [notification.incidentId], selectedIncidentId: notification.incidentId, activeTab: 'Notes', navigationId: Date.now() })
      setActivePage('Incidents')
    }
  }
  const renderPage = () => {
    if (activePage.startsWith('Product category:')) {
      const category = activePage.slice('Product category:'.length)
      return <ProductCategoryPage key={`${category}-${productAssetDrill?.navigationId || ''}`} category={category} assets={productAssets} products={products} contracts={contracts} currentUser={user} selectedCustomer={selectedCustomer} initialSerialNumbers={productAssetDrill?.category === category ? productAssetDrill.serialNumbers : []} onUpdateAsset={(asset) => setProductAssets((current) => current.map((entry) => entry.id === asset.id ? asset : entry))} onDeleteAsset={(id) => setProductAssets((current) => current.filter((entry) => entry.id !== id))} />
    }
    switch (activePage) {
      case 'Overview': return <OverviewPage user={user} reports={reports} layout={dashboardLayout} data={applicationData} selectedCustomer={selectedCustomer} onAddReport={addReportToDashboard} onLayoutChange={setDashboardLayout} onRemoveReport={removeReportFromDashboard} onNavigate={setActivePage} onOpenReport={(id) => { setNlpReportDefinition(null); setDrillReportId(id); setReportingVisit((v) => v + 1); setActivePage('Reporting') }} onOpenNlpReport={(definition) => { setDrillReportId(null); setNlpReportDefinition(definition); setReportingVisit((v) => v + 1); setActivePage('Reporting') }} onOpenIncidents={(drill) => { setIncidentDrill(drill); setActivePage('Incidents') }} onOpenRecords={({ source, recordIds }) => {
        if (source === 'Incidents') { setIncidentDrill({ incidentIds: recordIds }); setActivePage('Incidents'); return }
        if (source.startsWith('Product category: ')) { const category = source.slice('Product category: '.length); setProductAssetDrill({ category, serialNumbers: recordIds }); setActivePage(`Product category:${category}`) }
      }} />
      case 'Incidents': return <IncidentsPage key={incidentDrill?.navigationId || 'default'} currentUser={user} assignmentGroups={assignmentGroups} users={users} customers={customers} contracts={contracts} repairExecutions={repairExecutions} processes={processes} products={products} productAssets={productAssets} incidents={incidents} setIncidents={setIncidents} setProducts={setProducts} onAddCustomerContact={addCustomerContact} onCreateNotifications={createNotifications} onCreateAssignmentNotifications={createAssignmentNotifications} onEditModeChange={setIncidentEditMode} initialDrill={incidentDrill} />
      case 'Customers': return <CustomersPage customers={customers} setCustomers={setCustomers} />
      case 'Contracts': return <ContractsPage contracts={contracts} setContracts={setContracts} />
      case 'Product master': return <ProductMasterPage products={products} setProducts={setProducts} />
      case 'Knowledge management': return <KnowledgeManagementPage documents={knowledgeDocuments} setDocuments={setKnowledgeDocuments} />
      case 'Mail correspondence': return <MailCorrespondencePage correspondence={mailCorrespondence} setCorrespondence={setMailCorrespondence} users={users} currentUser={user} />
      case 'My Calendar': return <MyCalendarPage
        incidents={incidents.filter((incident) => currentUserGroupNames.includes(incident.assignmentGroup || incident.group))}
        events={calendarEvents}
        setEvents={setCalendarEvents}
        currentUser={currentUserRecord}
      />
      case 'Reporting': return <ReportingPage key={reportingVisit} user={user} data={applicationData} reports={reports} initialReportId={drillReportId} initialReportDefinition={nlpReportDefinition} onSaveReport={(definition) => saveReport(definition)} onShareReport={(definition, audience) => saveReport(definition, [audience])} />
      case 'User management': return <UserManagementPage assignmentGroups={assignmentGroups} users={users} setUsers={setUsers} />
      case 'Assignment groups': return <AssignmentGroupsPage groups={assignmentGroups} setGroups={setAssignmentGroups} users={users} />
      case 'Repair execution': return <RepairExecutionsPage repairExecutions={repairExecutions} setRepairExecutions={setRepairExecutions} />
      case 'Approval center: My Current Approvals': return <ApprovalCenterPage view="mine" currentUser={user} users={users} incidents={incidents} contracts={contracts} knowledgeDocuments={knowledgeDocuments} onResolveGroupApproval={resolveGroupApproval} onOpenIncident={openIncidentFromApproval} />
      case 'Approval center: My Delegated Approvals': return <ApprovalCenterPage view="delegated" currentUser={user} users={users} incidents={incidents} contracts={contracts} knowledgeDocuments={knowledgeDocuments} onResolveGroupApproval={resolveGroupApproval} onOpenIncident={openIncidentFromApproval} />
      case 'Process configuration': return <ProcessConfigurationPage assignmentGroups={assignmentGroups} repairExecutions={repairExecutions} processes={processes} setProcesses={setProcesses} />
      case 'Email settings': return <EmailSettingsPage assignmentGroups={assignmentGroups} users={users} data={applicationData} />
      case 'System settings': return <SystemSettingsPage />
      case 'Authentication settings': return <AuthenticationSettingsPage />
      default: return <OverviewPage user={user} reports={reports} layout={dashboardLayout} data={applicationData} selectedCustomer={selectedCustomer} onAddReport={addReportToDashboard} onLayoutChange={setDashboardLayout} onRemoveReport={removeReportFromDashboard} onNavigate={setActivePage} />
    }
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      {mobileNavigationOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} />}
      <aside className={`sidebar ${mobileNavigationOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div><strong>ALS50</strong><span>CSM Portal</span></div>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {workspaceNav.filter(({ csmOnly }) => !csmOnly || currentUserGroupNames.includes('Customer Support Management Group')).map(({ key, label, icon: Icon, count }) => {
            const displayCount = key === 'Incidents' ? visibleIncidentCount : count
            if (key === 'Incidents') return <div className="nav-group" key={key}>
              <button className={`nav-item ${activePage === 'Incidents' ? 'active' : ''}`} aria-expanded={incidentNavigationOpen} onClick={() => setIncidentNavigationOpen((open) => !open)}><Icon size={18} /><span>{label}</span>{displayCount && <b>{displayCount}</b>}<ChevronDown size={14} className={incidentNavigationOpen ? 'expanded' : ''} /></button>
              {incidentNavigationOpen && <div className="nav-submenu">{[{ label: 'Assigned to my group', scope: 'Assigned to my group' }, { label: 'Assigned to me', scope: 'Assigned to me' }].map((item) => <button key={item.scope} className={activePage === 'Incidents' && incidentDrill?.scope === item.scope ? 'active' : ''} onClick={() => { setIncidentDrill({ scope: item.scope, navigationId: Date.now() }); setActivePage('Incidents'); setMobileNavigationOpen(false) }}><span>{item.label}</span></button>)}</div>}
            </div>
            if (key === 'Approval center') return <div className="nav-group" key={key}>
              <button className={`nav-item ${activePage.startsWith('Approval center:') ? 'active' : ''}`} aria-expanded={approvalCenterOpen} onClick={() => setApprovalCenterOpen((open) => !open)}><Icon size={18} /><span>{label}</span><ChevronDown size={14} className={approvalCenterOpen ? 'expanded' : ''} /></button>
              {approvalCenterOpen && <div className="nav-submenu">{['My Current Approvals', 'My Delegated Approvals'].map((item) => <button key={item} className={activePage === `Approval center: ${item}` ? 'active' : ''} onClick={() => { setActivePage(`Approval center: ${item}`); setMobileNavigationOpen(false) }}><span>{item}</span></button>)}</div>}
            </div>
            if (key === 'Product categories') return <div className="nav-group" key={key}>
              <button className={`nav-item ${activePage.startsWith('Product category:') ? 'active' : ''}`} aria-expanded={categoryNavigationOpen} onClick={() => setCategoryNavigationOpen((open) => !open)}><Icon size={18} /><span>{label}</span><ChevronDown size={14} className={categoryNavigationOpen ? 'expanded' : ''} /></button>
              {categoryNavigationOpen && <div className="nav-submenu">{productCategories.map((category) => <button key={category} className={activePage === `Product category:${category}` ? 'active' : ''} onClick={() => { setProductAssetDrill({ category, serialNumbers: [], navigationId: Date.now() }); setActivePage(`Product category:${category}`); setMobileNavigationOpen(false) }}><span>{category}</span><b>{productAssets.filter((asset) => asset.category === category).length}</b></button>)}</div>}
            </div>
            return (
              <button key={key} className={`nav-item ${activePage === key ? 'active' : ''}`} onClick={() => { if (key === 'Reporting') setReportingVisit((current) => current + 1); setActivePage(key); setMobileNavigationOpen(false) }}>
                <Icon size={18} /><span>{label}</span>{displayCount && <b>{displayCount}</b>}
              </button>
            )
          })}

          <p className="nav-label config-label">Administration</p>
          {configNav.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${activePage === key ? 'active' : ''}`} onClick={() => { setActivePage(key); setMobileNavigationOpen(false) }}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="environment"><span></span> Production workspace</div>
          <button className="help-link"><CircleHelp size={17} /> Help centre</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={mobileNavigationOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Service management</span><ChevronRight size={15} /><strong>{activePage.startsWith('Product category:') ? activePage.slice('Product category:'.length) : activePage.startsWith('Approval center:') ? activePage.slice('Approval center: '.length) : activePage}</strong></div>
          <div className="topbar-actions">
            {!incidentEditMode && <label className="customer-context">
              <span>Customer</span>
              <select value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} aria-label="Dashboard customer context">
                {configuredCustomers.map((customer) => <option key={customer}>{customer}</option>)}
              </select>
            </label>}
            <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}><Search size={19} /></button>
            <div className="notification-menu"><button className="icon-button notification" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={toggleNotifications}><Bell size={19} />{unreadNotifications.length > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><header><strong>Notifications</strong><span>{unreadNotifications.length}</span></header>{notificationsForCurrentUser.length ? <ul>{notificationsForCurrentUser.map((notification) => <li key={notification.id} className={notification.recipientUserId && !notification.readByUserIds?.includes(currentUserRecord.id) ? 'unread' : ''}><button type="button" onClick={() => openNotification(notification)}><strong>{notification.title}</strong><span>{notification.incidentId ? notification.incidentId : `${notification.contractNumber} · ${notification.customer}`}</span><small>{notification.workNotes || `Expired ${notification.expiryDate} · ${notification.recipientGroup}`}</small></button></li>)}</ul> : <p>No notifications.</p>}</div>}</div>
            <button className="profile" onClick={onLogout} title="Sign out">
              <span>{user.initials}</span>
              <div><strong>{user.name}</strong><small>{user.role}</small></div>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>
        <section className="content">
          {searchOpen && <div className="search-panel"><Search size={18} /><input autoFocus placeholder="Search incidents, customers, contracts..." /><kbd>Esc</kbd></div>}
          {notificationToasts.length > 0 && <aside className="notification-toast-stack" aria-live="polite">{notificationToasts.map((notification) => <button type="button" key={notification.id} onClick={() => openNotification(notification)}><Bell size={16} /><span><strong>{notification.title}</strong><small>{notification.workNotes}</small></span></button>)}</aside>}
          {renderPage()}
        </section>
      </main>
    </div>
  )
}

const formFieldSelector = [
  '.field',
  '.incident-field',
  '.customer-field',
  '.user-config-grid label',
  '.group-config-fields label',
  '.asset-form-grid label',
  '.product-record-editor label',
  '.knowledge-form-sheet label',
  '.settings-form-grid label',
  '.report-dialog label',
  'form label',
].join(', ')

const databaseColumnFromLabel = (label) => label
  .replace(/\*/g, '')
  .replace(/\([^)]*\)/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')

function DatabaseColumnInspector() {
  const [inspector, setInspector] = useState(null)

  useEffect(() => {
    const close = () => setInspector(null)
    const handleContextMenu = (event) => {
      const field = event.target.closest(formFieldSelector)
      if (!field) return
      const caption = field.matches('label')
        ? field.querySelector(':scope > span')?.textContent || field.childNodes[0]?.textContent || ''
        : field.querySelector(':scope > label, :scope > span')?.textContent || ''
      const control = field.querySelector('input, select, textarea')
      const column = field.dataset.dbColumn || control?.dataset.dbColumn || control?.name || databaseColumnFromLabel(caption)
      if (!column) return
      event.preventDefault()
      setInspector({ column, x: event.clientX, y: event.clientY })
    }
    const handleKeyDown = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', close)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!inspector) return null
  return <div className="database-column-popover" role="status" style={{ left: Math.min(inspector.x, window.innerWidth - 236), top: Math.min(inspector.y, window.innerHeight - 72) }}><span>Database column</span><code>{inspector.column}</code></div>
}

/* ──────────────────────────────────────────
   Root App
   ────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null)
  const [loginUsers, setLoginUsers] = useState([])
  const [loginAssignmentGroups, setLoginAssignmentGroups] = useState([])
  const [loginDirectoryReady, setLoginDirectoryReady] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([recordApi.list('users'), recordApi.list('assignment_groups')])
      .then(([storedUsers, storedGroups]) => {
        if (!active) return
        setLoginUsers(storedUsers.map((record) => record.payload))
        setLoginAssignmentGroups(storedGroups.map((record) => record.payload))
        setLoginDirectoryReady(true)
      })
      .catch((error) => console.warn('Unable to load demo login identities.', error))
    return () => { active = false }
  }, [])
  if (!user) return <><LoginPage onLogin={setUser} users={loginUsers} assignmentGroups={loginAssignmentGroups} directoryReady={loginDirectoryReady} /><DatabaseColumnInspector /></>
  return <><Dashboard user={user} onLogout={() => setUser(null)} /><DatabaseColumnInspector /></>
}
