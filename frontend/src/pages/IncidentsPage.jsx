import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownUp, ArrowLeft, Camera, ChevronDown, ClipboardPlus, Download, Edit2, Eye, FileUp, Filter, History, ListChecks, Paperclip, Plus, Search, Star, Trash2, UserRound, Wrench, X } from 'lucide-react'
import { customerAcceptanceStage, getNextProcessStage, getProcessStage, getProcessStages } from '../data/processConfiguration'
import { emailApi, recordApi } from '../data/api'
import { productCategoryMatches } from '../data/productCategoryRegistry'

const pageSize = 8
const normalizePriorityFilter = (priority) => priority === 'Critical (AOG)' ? 'Critical' : priority || 'All'
const columns = [
  { key: 'id', label: 'Number', width: 300, minWidth: 220 },
  { key: 'opened', label: 'Opened', width: 210, minWidth: 160 },
  { key: 'title', label: 'Short description', width: 380, minWidth: 220 },
  { key: 'assignmentGroup', label: 'Assigned group', width: 260, minWidth: 180 },
  { key: 'priority', label: 'Priority', width: 150, minWidth: 110 },
  { key: 'status', label: 'Status', width: 220, minWidth: 160 },
]
const groupableColumns = columns.map(({ key, label }) => ({ key, label }))
const incidentStatus = (incident) => incident.status || incident.stage || '--'
const groupLabel = (incident, key) => String(key === 'status' ? incidentStatus(incident) : incident[key] || 'Unspecified')
const sortValue = (incident, key) => key === 'opened' ? Date.parse(incident.opened) || 0 : String(key === 'status' ? incidentStatus(incident) : incident[key] || '')
const openedDateLabel = (opened) => {
  const parsed = new Date(opened)
  return Number.isNaN(parsed.getTime()) ? opened || '--' : parsed.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const stageGuidance = {
  New: 'Review the reported issue and confirm the incident record contains the required customer, asset, and issue details.',
  Registered: 'Validate the incident information and prepare it for technical assessment.',
  'Advisory Group Review': 'The Advisory Group reviews the issue, selects the repair execution, and records the recommended resolution path.',
  'Awaiting Receipt': 'Store Management prepares to receive the item and confirms the expected material and supporting documents.',
  'Pending Dispatch': 'Arrange shipment to the repair facility and attach the dispatch reference and handover documents.',
  'Item Received': 'Confirm physical receipt, verify the item identity, and record any visible condition issues.',
  'Under IQC': 'Perform incoming quality checks and document the inspection result before repair work begins.',
  'Work in Progress In-House': 'Carry out the approved in-house repair activities and record work performed and parts used.',
  'Work in Progress - Vendor': 'Coordinate the external repair, track vendor updates, and retain the service documentation.',
  'Post repair Quality Review': 'Complete post-repair inspection and functional verification against the applicable acceptance criteria.',
  'Item Dispatched': 'Dispatch the repaired item to the customer and record the shipment and handover details.',
  'Received by Customer': 'Obtain confirmation that the customer received the item and that the delivery is complete.',
  'Resource Assignment': 'Assign the appropriate engineer, tools, and planned service window for the on-site activity.',
  Diagnosis: 'Diagnose the reported fault, identify the corrective action, and document the technical findings.',
  'Work in Progress': 'Perform the approved service activity and keep the work notes current with progress and outcomes.',
  'Assigned Vendor': 'Assign the approved vendor, provide the scope of work, and track the vendor acknowledgement.',
  'Post repair Review': 'Review repair evidence and verification results before confirming the service outcome.',
  Closed: 'Confirm all work, documentation, customer communication, and outstanding actions are complete before closure.',
}
const guidanceForStage = (status) => stageGuidance[status] || `Complete the required activities for ${status} and record the supporting information before progressing.`

const emptyForm = { repairExecution: 'Incident Registration', status: 'New', customer: '', customerOther: false, requestor: '', contract: '', contact: '', system: '', category: '', serialNumber: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', occurrencePhase: '', assignmentGroup: 'Customer Support Management Group', assignedTo: '', priority: '', warranty: '', lastServiced: '', shortDescription: '', description: '', attachments: [] }

const currentRuleRecipients = async (rule, incident, workNotes = '') => {
  const [userRecords, groupRecords] = await Promise.all([
    recordApi.list('users'),
    recordApi.list('assignment_groups'),
  ])
  const users = userRecords.map((record) => record.payload).filter((user) => user.status === 'Active' && user.email)
  const groups = groupRecords.map((record) => record.payload).filter((group) => group.active)
  const userIdsForGroups = (selectedGroups) => new Set(selectedGroups.flatMap((group) => group.memberIds || []).map(String))
  const userEmails = (selectedUsers) => selectedUsers.map((user) => user.email.trim().toLowerCase())
  const selectedGroups = groups.filter((group) => (rule.groupIds || []).includes(String(group.id)))
  const selectedUsers = users.filter((user) => (rule.userIds || []).includes(String(user.id)))
  const usersForGroups = (selected) => users.filter((user) => userIdsForGroups(selected).has(String(user.id)))
  const usersMatching = (value) => users.filter((user) => [user.id, user.name, user.email].some((candidate) => String(candidate).toLowerCase() === String(value || '').toLowerCase()))
  const normalizedMentionLabel = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  const externalEmails = Array.isArray(rule.externalEmails) ? rule.externalEmails : String(rule.externalEmails || '').split(/[;,\s]+/)
  let recipients = []
  switch (rule.recipientType) {
    case 'all_assignment_groups': recipients = userEmails(usersForGroups(groups)); break
    case 'multiple_assignment_groups': recipients = userEmails(usersForGroups(selectedGroups)); break
    case 'assignment_group': recipients = userEmails(usersForGroups(groups.filter((group) => group.name === incident.assignmentGroup))); break
    case 'approval_assignment_group': recipients = userEmails(usersForGroups(groups.filter((group) => group.name === incident.groupApproval?.assignmentGroup))); break
    case 'specific_user': recipients = userEmails(selectedUsers); break
    case 'custom_recipients': recipients = [...userEmails(selectedUsers), ...externalEmails]; break
    case 'requester':
    case 'requested_for': recipients = userEmails(usersMatching(incident.requestor || incident.requestedFor)); break
    case 'assigned_to': recipients = userEmails(usersMatching(incident.assignedTo)); break
    case 'manager': recipients = userEmails(selectedGroups.flatMap((group) => usersMatching(group.manager))); break
    case 'watch_list': recipients = userEmails((incident.watchList || []).flatMap(usersMatching)); break
    case 'mentioned_users': {
      const mentionedLabels = [...new Set([...String(workNotes).matchAll(/@\[([^\]]+)\]/g)].map((match) => match[1].trim()))]
      const mentionedUserIds = new Set()
      mentionedLabels.forEach((label) => {
        usersMatching(label).forEach((user) => mentionedUserIds.add(String(user.id)))
        groups.filter((group) => normalizedMentionLabel(group.name) === normalizedMentionLabel(label)).flatMap((group) => group.memberIds || []).forEach((memberId) => mentionedUserIds.add(String(memberId)))
      })
      recipients = userEmails(users.filter((user) => mentionedUserIds.has(String(user.id))))
      break
    }
    default: recipients = []
  }
  return [...new Set(recipients.map((email) => String(email).trim().toLowerCase()).filter(Boolean))]
}

const logIncidentEmails = async (incident, trigger = 'On incident creation', workNotes = '', updatedBy = '') => {
  const rules = await recordApi.list('outbound_email_rules')
  const templates = await recordApi.list('email_templates').catch(() => [])
  const activeRules = rules
    .map((record) => record.payload)
    .filter((rule) => rule.active && rule.trigger === trigger)
    .filter((rule) => !rule.approvalType || rule.approvalType === incident.groupApproval?.approvalType)
  await Promise.all(activeRules.map(async (rule) => {
    const template = templates.find((record) => record.record_id === rule.templateId)?.payload
    const fields = {
      incident_id: incident.id,
      id: incident.id,
      title: incident.title,
      description: incident.description || incident.title,
      customer: incident.customer,
      opened: openedDateLabel(incident.opened),
      created_at: openedDateLabel(incident.opened),
      priority: incident.priority,
      severity: incident.severity || incident.priority,
      category: incident.category,
      serial_number: incident.serialNumber,
      requester_name: incident.requestor,
      assignment_group: incident.assignmentGroup,
      assignee: incident.assignedTo,
      assigned_to: incident.assignedTo,
      status: incident.status || incident.stage,
      work_notes: workNotes,
      updated_by: updatedBy,
      post_repair_review_stage: incident.postRepairReviewStage || '',
      return_status: incident.postRepairReturnStatus || '',
      return_assignment_group: incident.postRepairReturnAssignmentGroup || '',
      return_assignee: incident.postRepairReturnAssignee || '',
      dissatisfaction_reason: incident.postRepairDissatisfactionReason || 'The inspection outcome did not meet the applicable resolution and acceptance guidelines.',
      resolution_details: incident.resolutionDetails || '',
      approval_type: incident.groupApproval?.approvalType === 'replacement-parts' ? 'Part replacement approval' : 'Pre-dispatch approval',
      approval_assignment_group: incident.groupApproval?.assignmentGroup || '',
      approval_requested_by: incident.groupApproval?.requestedBy || '',
      approval_requested_at: incident.groupApproval?.requestedAt || '',
      replacement_source: incident.groupApproval?.replacementSource || '',
      replacement_parts: (incident.groupApproval?.parts || []).map((part) => `${part.materialDescription || part.componentKey || 'Component'}${part.partNumber ? ` (${part.partNumber})` : ''}`).join(', '),
      approval_request_reason: incident.groupApproval?.taslRequestReason || incident.resolutionDetails || '',
    }
    const renderTemplate = (value, html = false) => String(value).replace(/{{\s*([^}]+?)\s*}}/g, (_, token) => {
      const field = token.replace(/^incident\./, '')
      const fieldValue = String(fields[field] ?? '')
      if (!html) return fieldValue
      return fieldValue
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replace(/\r?\n/g, '<br>')
    })
    const isAssignmentChange = trigger === 'On assignment change'
    const isWorkNoteUpdate = trigger === 'On work note update'
    const isPostRepairDissatisfaction = trigger === 'On post-repair dissatisfaction'
    const isApprovalRequired = trigger === 'On approval required'
    const subject = renderTemplate(template?.subject || (isApprovalRequired ? 'Approval required: Incident {{incident_id}}' : isPostRepairDissatisfaction ? 'Action required: Incident {{incident_id}} returned for corrective action' : isWorkNoteUpdate ? 'Work note update: Incident {{incident_id}}' : isAssignmentChange ? 'Incident {{incident_id}} has been assigned to {{assignment_group}}' : 'Incident {{incident_id}} has been created'))
    const templateBody = template?.body || (isAssignmentChange
      ? 'Incident {{incident_id}} has been assigned to {{assignment_group}}.\n\nShort Description: {{title}}\nStatus: {{status}}\nPriority: {{priority}}'
      : isPostRepairDissatisfaction
        ? 'Incident {{incident_id}} was returned to {{return_assignment_group}} for corrective action after post-repair inspection.\n\nReturn stage: {{return_status}}\nInspection stage: {{post_repair_review_stage}}\nRequired action: Review the resolution against the acceptance guidelines and resolve the issue again.'
      : isApprovalRequired
        ? 'Approval is required for incident {{incident_id}}.\n\nApproval type: {{approval_type}}\nRequested group: {{approval_assignment_group}}\nRequested by: {{approval_requested_by}}'
      : isWorkNoteUpdate
        ? 'A work note was added to incident {{incident_id}} by {{updated_by}}.\n\n{{work_notes}}'
      : 'A new incident has been reported.\n\nIncident Number: {{incident_id}}\nShort Description: {{title}}\nPriority: {{priority}}\nStatus: Registered')
    const isHtmlTemplate = /<[^>]+>/.test(templateBody)
    const renderedContent = renderTemplate(templateBody, isHtmlTemplate)
    const incidentUrl = `${window.location.origin}${window.location.pathname}?incidentId=${encodeURIComponent(incident.id)}`
    const incidentLink = `<a href="${incidentUrl}" style="color:#1a5fa8;text-decoration:underline;">${incident.id}</a>`
    const content = isHtmlTemplate ? renderedContent.replaceAll(incident.id, incidentLink) : `${renderedContent}\n\nOpen incident: ${incidentUrl}`
    const recipients = (await currentRuleRecipients(rule, incident, workNotes)).map((email) => ({ email, name: email }))
    if (recipients.length) await emailApi.sendIncidentRegistrationNotification({
      incidentId: incident.id,
      ruleId: rule.id,
      ruleName: rule.name,
      subject,
      content,
      recipients,
      event: isApprovalRequired ? `${fields.approval_type} required` : isWorkNoteUpdate ? 'Incident work note mention notification' : isAssignmentChange ? 'Incident assignment group notification' : 'Incident registration notification',
      deliveryKey: isApprovalRequired ? `approval-${incident.groupApproval?.id || incident.status}` : isWorkNoteUpdate ? `work-note-${Date.now()}` : isAssignmentChange ? `assignment-${incident.status || incident.stage}-${incident.assignmentGroup}` : 'registration',
    })
  }))
}

const customerInitials = (customer) => String(customer || '')
  .match(/[A-Za-z0-9]+/g)
  ?.map((word) => word[0])
  .join('')
  .toUpperCase() || 'CUSTOMER'
const contractSystemCode = (contract) => String(contract?.system || '')
  .match(/[A-Za-z0-9]+/g)
  ?.join('')
  .toUpperCase() || 'SYSTEM'
const incidentNumberBase = (contract, customer, year) => {
  return `TASL-${customerInitials(customer)}-${contractSystemCode(contract)}-${year}`
}
const nextIncidentId = (incidents, contract, customer) => {
  const base = incidentNumberBase(contract, customer, new Date().getFullYear())
  const prefix = `${base}-`
  const sequence = incidents.reduce((highest, incident) => {
    if (!incident.id?.startsWith(prefix)) return highest
    const value = Number(incident.id.slice(prefix.length))
    return Number.isInteger(value) ? Math.max(highest, value) : highest
  }, 0)
  return `${prefix}${String(sequence + 1).padStart(4, '0')}`
}

const findCustomerProfile = (customers, contracts, customerName) => {
  const customer = customers.find((entry) => entry.name === customerName)
  return customer ? { ...customer, contracts: contracts.filter((contract) => contract.customer === customerName) } : undefined
}
const contactValue = (contact) => contact ? `${contact.phone} | ${contact.email}` : ''
const militaryRankPrefix = /^(Group Captain|Rear Admiral|Lt\. Commander|Commander|Colonel|Major|Captain)\s+/i
const requestorOptionLabel = (customer, contact) => {
  const primaryRank = customer?.primaryContact?.name === contact.name ? customer.primaryContact.rank : ''
  const embeddedRank = contact.name.match(militaryRankPrefix)?.[1] || ''
  const rank = contact.rank || primaryRank || embeddedRank || 'Not specified'
  const name = embeddedRank ? contact.name.replace(militaryRankPrefix, '') : contact.name
  return `${rank} | ${name} | ${contact.designation || 'Not specified'}`
}
const activeGroupNames = (groups) => groups.filter((group) => group.active).map((group) => group.name)
const groupMemberNames = (groups, users, groupName) => {
  const group = groups.find((entry) => entry.name === groupName)
  return users.filter((user) => group?.memberIds?.includes(user.id) && user.status === 'Active').map((user) => user.name)
}
const approvalGroupNotifications = (incident, approval, groups, users) => {
  const group = groups.find((entry) => entry.active && entry.name === approval.assignmentGroup)
  const groupMemberIds = new Set((group?.memberIds || []).map(String))
  const approvalLabel = approval.approvalType === 'replacement-parts' ? 'Material Replacement Approval' : 'Pre-Dispatch Approval'
  const createdAt = new Date().toISOString()
  return users
    .filter((user) => user.status === 'Active' && groupMemberIds.has(String(user.id)))
    .map((user) => ({
      id: `approval-${approval.id}-${user.id}`,
      type: 'approval-required',
      title: `${approvalLabel} - ${incident.id} - Pending for your approval`,
      incidentId: incident.id,
      workNotes: `${approval.assignmentGroup} approval requested.`,
      recipientUserId: user.id,
      recipientName: user.name,
      readByUserIds: [],
      createdAt,
    }))
}
const workNoteMentionRecipients = (workNotes, users, groups) => {
  const labels = [...new Set([...String(workNotes).matchAll(/@\[([^\]]+)\]/g)].map((match) => match[1].trim()))]
  const recipients = new Map()
  labels.forEach((label) => {
    const user = users.find((entry) => entry.status === 'Active' && entry.name === label)
    if (user) recipients.set(user.id, user)
    const group = groups.find((entry) => entry.active && entry.name === label)
    group?.memberIds?.forEach((memberId) => {
      const member = users.find((entry) => String(entry.id) === String(memberId) && entry.status === 'Active')
      if (member) recipients.set(member.id, member)
    })
  })
  return [...recipients.values()]
}
const componentOptions = (records, serialNumber, subsystem) => [...new Set((records.find((record) => record.serialNumber === serialNumber)?.components || [])
  .filter((component) => component.subsystem === subsystem)
  .map((component) => component.materialDescription)
  .filter(Boolean))]
const materialSerialNumberFor = (records, serialNumber, subsystem, materialDescription) => records.find((record) => record.serialNumber === serialNumber)?.components
  .find((component) => component.subsystem === subsystem && component.materialDescription === materialDescription)?.materialSerialNumber || 'Not Applicable'
const componentKey = (component) => [component.subsystem, component.materialDescription, component.part_number || ''].join('::')
const productCategoriesForCustomerContract = (assets, customer, contract) => [...new Set(assets
  .filter((asset) => asset.customer === customer && asset.contractNumber === contract && asset.category)
  .map((asset) => asset.category))]
  .sort((first, second) => first.localeCompare(second))
const serialRecordsForCustomerContractCategory = (records, assets, customer, category, contract) => {
  if (!customer || !category || !contract) return []
  const eligibleSerialNumbers = new Set(assets
    .filter((asset) => asset.customer === customer && asset.contractNumber === contract && productCategoryMatches(asset.category, category))
    .map((asset) => asset.serialNumber))
  return records
    .filter((record) => eligibleSerialNumbers.has(record.serialNumber) && productCategoryMatches(record.category, category))
    .sort((first, second) => first.serialNumber.localeCompare(second.serialNumber, undefined, { numeric: true }))
}
const incidentComponentColumns = [
  ['product_serial_number', 'Product serial number'], ['part_number', 'Part number'], ['sap_part_number', 'SAP part number'], ['materialDescription', 'Material description'], ['batch_or_po_number', 'Batch no / PO no'], ['materialSerialNumber', 'Material serial no'], ['weight_in_grams', 'Weight in grams'], ['required_quantity', 'Required quantity'], ['unit_of_measurement', 'Unit of measurement'], ['subsystem', 'Subsystem'],
]
const validatePhoneNumber = (value) => {
  const digitsOnly = value.replace(/\D/g, '')
  return digitsOnly.slice(0, 10)
}

export default function IncidentsPage({ currentUser, assignmentGroups, users, customers, contracts, repairExecutions, processes, products, productAssets, incidents, setIncidents, setProducts, onAddCustomerContact, onCreateNotifications, onCreateAssignmentNotifications, onEditModeChange, initialDrill }) {
  const [showForm, setShowForm] = useState(Boolean(initialDrill?.createIncident))
  const [selectedIncident, setSelectedIncident] = useState(null)
  const drilledIncidentIds = useMemo(() => new Set(initialDrill?.incidentIds || []), [initialDrill])
  const [scope, setScope] = useState(initialDrill?.scope || 'Assigned to my group')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialDrill?.stateFilter || 'All')
  const [priorityFilter, setPriorityFilter] = useState(() => normalizePriorityFilter(initialDrill?.priorityFilter))
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('opened')
  const [sortDescending, setSortDescending] = useState(true)
  const [groupBy, setGroupBy] = useState('')
  const [page, setPage] = useState(1)
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map(({ key, width }) => [key, width])))
  const currentUserRecord = useMemo(() => users.find((member) => member.email === currentUser.email) || currentUser, [currentUser, users])
  const myGroupNames = useMemo(() => assignmentGroups
    .filter((group) => group.manager === currentUser.name || group.memberIds?.some((memberId) => String(memberId) === String(currentUserRecord.id)))
    .map((group) => group.name), [assignmentGroups, currentUser.name, currentUserRecord.id])
  const hasFullIncidentAccess = String(currentUserRecord.role || currentUser.role || '').toLowerCase() === 'administrator'
    || myGroupNames.includes('Customer Support Management Group')
  const canEditIncident = (incident) => {
    if (hasFullIncidentAccess) return true
    const assignee = String(incident.assignedTo || incident.assignee || '').toLowerCase()
    const assignedToCurrentUser = [currentUser.name, currentUser.email, currentUserRecord.id]
      .filter(Boolean)
      .some((value) => assignee === String(value).toLowerCase())
    return assignedToCurrentUser || myGroupNames.includes(incident.assignmentGroup || incident.group)
  }
  const serialNumberRecords = useMemo(() => Array.from(products.reduce((records, product) => {
    const serialNumber = product.product_serial_number
    if (!serialNumber) return records
    const current = records.get(serialNumber) || { serialNumber, system: serialNumber.startsWith('LM-') ? 'SRLM' : '', category: product.product_category || '', subsystems: [], components: [] }
    if (product.product_category) current.category = product.product_category
    if (product.subsystems && !current.subsystems.includes(product.subsystems)) current.subsystems.push(product.subsystems)
    if (product.subsystems && product.material_description) current.components.push({ ...product, subsystem: product.subsystems, materialDescription: product.material_description, materialSerialNumber: product.material_serial_number || 'Not Applicable' })
    records.set(serialNumber, current)
    return records
  }, new Map()).values()), [products])

  useEffect(() => {
    onEditModeChange(Boolean(showForm || selectedIncident))
    return () => onEditModeChange(false)
  }, [onEditModeChange, selectedIncident, showForm])

  useEffect(() => {
    if (initialDrill?.createIncident) {
      setShowForm(true)
      setPage(1)
    }
  }, [initialDrill?.createIncident])

  useEffect(() => {
    if (initialDrill?.scope) {
      setScope(initialDrill.scope)
      setPage(1)
    }
  }, [initialDrill?.scope])

  useEffect(() => {
    if (initialDrill?.priorityFilter) {
      setPriorityFilter(normalizePriorityFilter(initialDrill.priorityFilter))
      setPage(1)
    }
  }, [initialDrill?.priorityFilter])

  useEffect(() => {
    if (initialDrill?.selectedIncidentId) setSelectedIncident(incidents.find((incident) => incident.id === initialDrill.selectedIncidentId) || null)
  }, [incidents, initialDrill?.selectedIncidentId])

  const availableStatuses = useMemo(() => [...new Set(incidents.map(incidentStatus))].filter((status) => status !== '--').sort(), [incidents])
  const filtered = useMemo(() => incidents.filter((incident) => {
    const assignee = String(incident.assignedTo || incident.assignee || '').toLowerCase()
    const isAssignedToMe = [currentUser.name, currentUser.email, currentUserRecord.id].filter(Boolean).some((value) => assignee === String(value).toLowerCase())
    const isAssignedToMyGroup = myGroupNames.includes(incident.assignmentGroup || incident.group)
    const status = incidentStatus(incident)
    const inScope = scope === 'All' || (scope === 'Assigned to me' && isAssignedToMe) || (scope === 'Assigned to my group' && isAssignedToMyGroup) || (scope === 'Open' && status !== 'Closed')
    const matchesSearch = !search || [incident.id, incident.title, status].some((value) => value.toLowerCase().includes(search.toLowerCase()))
    const matchesPriority = priorityFilter === 'All' || incident.priority === priorityFilter
    const matchesDrill = !drilledIncidentIds.size || drilledIncidentIds.has(incident.id)
    return inScope && matchesSearch && matchesDrill && (statusFilter === 'All' || status === statusFilter) && matchesPriority && (!favoritesOnly || incident.favorite)
  }).sort((first, second) => {
    if (groupBy) {
      const groupComparison = groupLabel(first, groupBy).localeCompare(groupLabel(second, groupBy), undefined, { numeric: true })
      if (groupComparison) return sortDescending && groupBy === sortBy ? -groupComparison : groupComparison
    }
    const firstValue = sortValue(first, sortBy)
    const secondValue = sortValue(second, sortBy)
    const comparison = typeof firstValue === 'number' && typeof secondValue === 'number'
      ? firstValue - secondValue
      : String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true })
    return sortDescending ? -comparison : comparison
  }), [currentUser.email, currentUser.name, currentUserRecord.id, drilledIncidentIds, favoritesOnly, groupBy, incidents, myGroupNames, priorityFilter, scope, search, sortBy, sortDescending, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const groupCounts = useMemo(() => filtered.reduce((counts, incident) => {
    const label = groupLabel(incident, groupBy)
    counts[label] = (counts[label] || 0) + 1
    return counts
  }, {}), [filtered, groupBy])
  const setListScope = (nextScope) => { setScope(nextScope); setPage(1) }
  const startColumnResize = (event, column) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = columnWidths[column.key]
    const resizeColumn = (moveEvent) => setColumnWidths((current) => ({ ...current, [column.key]: Math.max(column.minWidth, startWidth + moveEvent.clientX - startX) }))
    const stopResize = () => { document.removeEventListener('mousemove', resizeColumn); document.removeEventListener('mouseup', stopResize) }
    document.addEventListener('mousemove', resizeColumn)
    document.addEventListener('mouseup', stopResize)
  }
  const createIncident = async (form) => {
    if (form.customerOther) onAddCustomerContact(form.customer, { name: form.requestor, phone: form.contact })
    const contract = contracts.find((entry) => entry.number === form.contract)
        const id = nextIncidentId(incidents, contract, form.customer || '')
    const registeredStage = getProcessStage('Incident Registration', 'Registered', processes)
    if (!registeredStage?.assignmentGroup) throw new Error('Configure an assignment group for the Registered Incident Registration stage before submitting an incident.')
    const assignmentGroup = 'Customer Support Management Group'
    const incident = { id, opened: new Date().toISOString(), title: form.shortDescription, description: form.description, priority: form.priority, state: 'In progress', stage: registeredStage.status, status: registeredStage.status, repairExecution: 'Incident Registration', group: assignmentGroup, assignmentGroup, assignedTo: form.assignedTo, favorite: false, attachments: form.attachments || [], customer: form.customer, contract: form.contract, requestor: form.requestor, contact: form.contact, warranty: form.warranty, serialNumber: form.serialNumber, system: form.system, category: form.category, subsystem: form.subsystem, component: form.component, materialSerialNumber: form.materialSerialNumber, occurrencePhase: form.occurrencePhase }
    await recordApi.bulkUpsert('incidents', [{ record_id: id, payload: incident }])
    setIncidents((current) => [incident, ...current])
    onCreateAssignmentNotifications(incident, incident.assignmentGroup)
    setPage(1)
    setShowForm(false)
    window.setTimeout(() => { void logIncidentEmails(incident).catch(() => {}) }, 0)
  }

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const data = [['Number', 'Opened', 'Short Description', 'Assigned group', 'Priority', 'Status'].map(csv), ...filtered.map((i) => [i.id, i.opened, i.title, i.assignmentGroup || i.group, i.priority, incidentStatus(i)].map(csv))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'incidents.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (showForm) return <NewIncidentForm assignmentGroups={assignmentGroups} customers={customers} contracts={contracts} processes={processes} productAssets={productAssets} serialNumberRecords={serialNumberRecords} users={users} onCancel={() => setShowForm(false)} onSubmit={createIncident} />
  if (selectedIncident) return <IncidentDetailForm assignmentGroups={assignmentGroups} customers={customers} contracts={contracts} repairExecutions={repairExecutions} processes={processes} currentUser={currentUser} products={products} productAssets={productAssets} serialNumberRecords={serialNumberRecords} users={users} incident={selectedIncident} allIncidents={incidents} initialActiveTab={initialDrill?.activeTab} canEdit={canEditIncident(selectedIncident)} onCancel={() => setSelectedIncident(null)} onSave={async (updates) => {
    const { childIncident, componentProductUpdates = [], mentionNotifications = [], ...incidentUpdates } = updates
    const updatedIncident = { ...selectedIncident, ...incidentUpdates }
    const previousAssignmentGroup = selectedIncident.assignmentGroup || selectedIncident.group || ''
    const assignmentGroupChanged = Boolean(updatedIncident.assignmentGroup && updatedIncident.assignmentGroup !== previousAssignmentGroup)
    const assignmentChanged = assignmentGroupChanged || updatedIncident.assignedTo !== (selectedIncident.assignedTo || '')
    await recordApi.bulkUpsert('incidents', [
      { record_id: updatedIncident.id, payload: updatedIncident },
      ...(childIncident ? [{ record_id: childIncident.id, payload: childIncident }] : []),
    ])
    if (mentionNotifications.length) onCreateNotifications(mentionNotifications)
    if (assignmentGroupChanged) onCreateAssignmentNotifications(updatedIncident, updatedIncident.assignmentGroup)
    if (assignmentChanged) void logIncidentEmails(updatedIncident, 'On assignment change').catch(() => {})
    if (childIncident?.assignmentGroup) onCreateAssignmentNotifications(childIncident, childIncident.assignmentGroup)
    if (componentProductUpdates.length) setProducts((current) => current.map((product) => {
      const update = componentProductUpdates.find((item) => item.productSerialNumber === product.product_serial_number && item.partNumber === product.part_number && item.subsystem === product.subsystems)
      if (!update) return product
      return { ...product, material_serial_number: update.next, productJournal: [...(product.productJournal || []), { id: `${Date.now()}-${Math.random()}`, updatedAt: new Date().toISOString(), updatedBy: currentUser.name || currentUser.email, incidentNumber: updatedIncident.id, field: 'Material Serial No', previous: product.material_serial_number || 'Not Applicable', next: update.next || 'Not Applicable' }] }
    }))
    setIncidents((current) => [
      ...current.map((item) => item.id === updatedIncident.id ? updatedIncident : item),
      ...(childIncident && !current.some((item) => item.id === childIncident.id) ? [childIncident] : []),
    ])
    setSelectedIncident(updatedIncident)
  }} />

  return (
    <section className="incident-list-page">
      <div className="incident-list-head"><div className="incident-list-title"><h1>Incidents</h1></div><button className="incident-create-button" onClick={() => setShowForm(true)}><Plus size={15} /> New incident</button></div>
      <div className="incident-command-bar">
        <div className="incident-search"><Search size={15} /><input aria-label="Search incidents" placeholder="Search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
        <nav className="incident-scope-actions" aria-label="Incident list scope">{['All', 'Assigned to me', 'Assigned to my group', 'Open'].map((item) => <button key={item} className={scope === item ? 'active' : ''} onClick={() => setListScope(item)}>{item}</button>)}</nav>
        <div className="incident-command-actions"><button className="compact-button secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Extract data</button><label className="incident-filter-select"><Filter size={14} /><select value={statusFilter} aria-label="Filter incidents by status" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="All">Status: All</option>{availableStatuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={13} /></label><label className="incident-filter-select" style={{ marginLeft: 4 }}><Filter size={14} /><select value={priorityFilter} aria-label="Filter incidents by priority" onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }}><option value="All">Priority: All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={13} /></label><label className="incident-list-select"><select value={sortBy} aria-label="Sort incidents by" onChange={(event) => { setSortBy(event.target.value); setPage(1) }}><option value="id">Sort: Incident number</option><option value="opened">Sort: Opened date</option></select><ChevronDown size={13} /></label><button title={sortDescending ? 'Sort descending' : 'Sort ascending'} aria-label={sortDescending ? 'Sort descending' : 'Sort ascending'} onClick={() => { setSortDescending((value) => !value); setPage(1) }}><ArrowDownUp size={14} /></button><label className="incident-list-select"><select value={groupBy} aria-label="Group incidents by" onChange={(event) => { setGroupBy(event.target.value); setPage(1) }}><option value="">Group: None</option>{groupableColumns.map((column) => <option key={column.key} value={column.key}>Group: {column.label}</option>)}</select><ChevronDown size={13} /></label><button className={favoritesOnly ? 'selected' : ''} onClick={() => { setFavoritesOnly((value) => !value); setPage(1) }}><Star size={14} /> Favorites</button></div>
        <span className="incident-list-count">{filtered.length ? `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : '0 results'}</span>
      </div>
      <div className="incident-table-frame"><div className="incident-table-scroll"><table className="incident-table"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}<col style={{ width: 108 }} /></colgroup><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}<button className="column-resize-handle" aria-label={`Resize ${column.label} column`} onMouseDown={(event) => startColumnResize(event, column)} /></th>)}<th className="actions-column">Actions</th></tr></thead><tbody>{pageRows.map((incident, index) => <Fragment key={incident.id}>{groupBy && (!index || groupLabel(pageRows[index - 1], groupBy) !== groupLabel(incident, groupBy)) && <tr className="incident-group-row"><td colSpan="7"><span>{groupableColumns.find((column) => column.key === groupBy)?.label}</span><strong>{groupLabel(incident, groupBy)}</strong><b>{groupCounts[groupLabel(incident, groupBy)]} incident{groupCounts[groupLabel(incident, groupBy)] === 1 ? '' : 's'}</b></td></tr>}<tr>{columns.map((column) => <td key={column.key}>{column.key === 'id' ? <button className="incident-number" onClick={() => setSelectedIncident(incident)}>{incident[column.key]}</button> : column.key === 'opened' ? openedDateLabel(incident.opened) : column.key === 'assignmentGroup' ? incident.assignmentGroup || incident.group || '--' : column.key === 'status' ? incidentStatus(incident) : incident[column.key]}</td>)}<td className="row-actions-cell"><div className="row-actions"><button className="action-btn" title="View incident" onClick={() => setSelectedIncident(incident)}><Eye size={15} /></button><button className="action-btn" title="Edit incident" onClick={() => setSelectedIncident(incident)}><Edit2 size={15} /></button></div></td></tr></Fragment>)}{!pageRows.length && <tr><td colSpan="7" className="empty-row">No incidents match the current list filters.</td></tr>}</tbody></table></div></div>
      <footer className="incident-pagination"><span>Showing {filtered.length} result{filtered.length === 1 ? '' : 's'}</span><div><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Prev</button><span>{page}</span><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer>
    </section>
  )
}

function NewIncidentForm({ assignmentGroups, customers, contracts, processes, productAssets, serialNumberRecords, users, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...emptyForm, assignmentGroup: 'Customer Support Management Group' }))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const workflowStages = getProcessStages(form.repairExecution, processes)
  const assignmentGroupOptions = activeGroupNames(assignmentGroups)
  const assignedToOptions = groupMemberNames(assignmentGroups, users, form.assignmentGroup)
    const productCategoryOptions = productCategoriesForCustomerContract(productAssets, form.customer, form.contract)
    const eligibleSerialNumberRecords = serialRecordsForCustomerContractCategory(serialNumberRecords, productAssets, form.customer, form.category, form.contract)
  const components = componentOptions(serialNumberRecords, form.serialNumber, form.subsystem)
  const selectAssignmentGroup = (assignmentGroup) => setForm((current) => ({ ...current, assignmentGroup, assignedTo: '' }))
  const selectedCustomer = findCustomerProfile(customers, contracts, form.customer)
  const selectCustomer = (customerName) => {
    const profile = findCustomerProfile(customers, contracts, customerName)
    const primaryContact = profile?.contacts[0]
    setForm((current) => ({ ...current, customer: customerName, requestor: primaryContact?.name || '', contact: contactValue(primaryContact), contract: '', system: '', warranty: '', serialNumber: '', category: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  }
  const toggleCustomerOther = (customerOther) => {
    const primaryContact = selectedCustomer?.contacts[0]
    setForm((current) => ({ ...current, customerOther, requestor: customerOther ? '' : primaryContact?.name || '', contact: customerOther ? '' : contactValue(primaryContact) }))
  }
  const selectRequestor = (requestorName) => {
    const contact = selectedCustomer?.contacts.find((entry) => entry.name === requestorName)
    setForm((current) => ({ ...current, requestor: requestorName, contact: contactValue(contact) }))
  }
  const selectProductCategory = (category) => setForm((current) => ({ ...current, category, serialNumber: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  const selectContract = (contractNumber) => {
    const contract = selectedCustomer?.contracts.find((entry) => entry.number === contractNumber)
    setForm((current) => ({ ...current, contract: contractNumber, system: contract?.system || '', warranty: contract?.warranty || '', category: '', serialNumber: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  }
  const selectSerialNumber = (serialNumber) => {
    const record = serialNumberRecords.find((entry) => entry.serialNumber === serialNumber)
    setForm((current) => {
      const asset = productAssets.find((entry) => entry.serialNumber === serialNumber && entry.customer === current.customer && entry.contractNumber === current.contract)
        || productAssets.find((entry) => entry.serialNumber === serialNumber)
      return { ...current, serialNumber, system: current.contract ? current.system : record?.system || '', category: current.category || record?.category || '', subsystem: record?.subsystems[0] || '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: asset?.lastServiced || '' }
    })
  }
  const selectSubsystem = (subsystem) => setForm((current) => ({ ...current, subsystem, component: '', materialSerialNumber: 'Not Applicable' }))
  const selectComponent = (component) => setForm((current) => ({ ...current, component, materialSerialNumber: materialSerialNumberFor(serialNumberRecords, current.serialNumber, current.subsystem, component) }))
  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(['customer', 'requestor', 'category', 'contract', 'serialNumber', 'component', 'materialSerialNumber', 'occurrencePhase', 'priority', 'assignmentGroup', 'assignedTo', 'shortDescription', 'description'].filter((key) => !form[key].trim()).map((key) => [key, 'Required']))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setSubmitError('Complete the required fields highlighted below before submitting the incident.')
      return
    }
    setSubmitError('')
    try {
      await onSubmit(form)
    } catch (error) {
      setSubmitError(`Incident was not saved: ${error.message}`)
    }
  }

  return <form className="incident-create-page" onSubmit={submit} noValidate>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Incidents</button><h1>Incident Registration</h1><p>Log a new incident for quick resolution.</p></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit incident</button></div></header>
    {workflowStages.length > 0 && <WorkflowProgress stages={workflowStages} currentStatus={form.status} compact />}
    <section className="incident-form-sheet">
      <FormSection icon={ClipboardPlus} title="Incident details"><Field label="Incident number"><div className="incident-auto-field">Auto-generated</div></Field><Field label="Created on"><div className="incident-auto-field">Auto-generated</div></Field><Field label="Current activity"><div className="incident-auto-field">Incident Registration</div></Field><Field label="Status"><div className="incident-auto-field">New</div></Field></FormSection>
      <FormSection icon={UserRound} title="Customer & requestor" headerAction={<label className="incident-other-contact"><input type="checkbox" checked={form.customerOther} disabled={!form.customer} onChange={(event) => toggleCustomerOther(event.target.checked)} /> Customer other</label>}><Field label="Customer name" required error={errors.customer}><SelectField value={form.customer} onChange={selectCustomer} options={customers.map((customer) => customer.name)} placeholder="Select customer" /></Field><Field label="Requestor name" required error={errors.requestor}>{form.customerOther ? <input value={form.requestor} onChange={(event) => update('requestor', event.target.value)} placeholder="Enter requestor name" /> : <RequestorSelect customer={selectedCustomer} value={form.requestor} onChange={selectRequestor} />}</Field><Field label="Customer contract" required error={errors.contract}><SelectField value={form.contract} onChange={selectContract} options={selectedCustomer?.contracts.map((contract) => contract.number) || []} placeholder={form.customer ? 'Select customer contract' : 'Select customer first'} disabled={!form.customer} /></Field><Field label="Requestor contact">{form.customerOther ? <input type="tel" inputMode="numeric" maxLength={10} value={form.contact} onChange={(event) => update('contact', validatePhoneNumber(event.target.value))} placeholder="Enter 10-digit phone number" /> : <input value={form.contact} readOnly placeholder="Auto-filled from requestor" />}</Field></FormSection>
      <FormSection icon={Wrench} title="Product information"><Field label="Product category" required error={errors.category}><SelectField value={form.category} onChange={selectProductCategory} options={productCategoryOptions} placeholder={form.contract ? 'Select product category' : 'Select customer contract first'} disabled={!form.contract} /></Field><SerialNumberReference records={eligibleSerialNumberRecords} value={form.serialNumber} onChange={selectSerialNumber} required error={errors.serialNumber} disabled={!form.customer || !form.category || !form.contract} placeholder={form.category ? 'Search serial number assigned to this contract and product category' : 'Select product category first'} hint={form.category ? `${eligibleSerialNumberRecords.length} serial number${eligibleSerialNumberRecords.length === 1 ? '' : 's'} assigned to this customer contract and product category` : 'Select product category to view eligible serial numbers'} /><LookupField label="System type" value={form.system} /><SubsystemReference serialNumber={form.serialNumber} value={form.subsystem} records={serialNumberRecords} onChange={selectSubsystem} /><Field label="Component" required error={errors.component}><SelectField value={form.component} onChange={selectComponent} options={components} placeholder={form.subsystem ? 'Select material description' : 'Select sub-system first'} /></Field><Field label="Material serial number" required error={errors.materialSerialNumber}><input value={form.materialSerialNumber} onChange={(event) => update('materialSerialNumber', event.target.value)} placeholder="Not Applicable" /></Field></FormSection>
      <FormSection icon={AlertTriangle} title="Issue classification"><Field label="Occurrence phase" required error={errors.occurrencePhase}><SelectField value={form.occurrencePhase} onChange={(value) => setForm((current) => ({ ...current, occurrencePhase: value, priority: value === 'In Flight' ? 'High' : current.priority }))} options={['In Flight', 'Ground Operations']} placeholder="Select occurrence phase" required /></Field><Field label="Priority" required error={errors.priority}><SelectField value={form.priority} onChange={(value) => update('priority', value)} options={['Critical', 'High', 'Medium', 'Low']} placeholder="Select priority" priority /></Field><Field label="Assignment group"><input value="Customer Support Management Group" readOnly /></Field><Field label="Assigned to" required error={errors.assignedTo}><SelectField value={form.assignedTo} onChange={(value) => update('assignedTo', value)} options={assignedToOptions} placeholder="Select CSM group member" /></Field></FormSection>
      <FormSection icon={History} title="Service history"><Field label="Warranty status"><input value={form.warranty} onChange={(event) => update('warranty', event.target.value)} placeholder="e.g., Active, Expired" /></Field><Field label="Last serviced on"><input type="date" value={form.lastServiced} onChange={(event) => update('lastServiced', event.target.value)} /></Field></FormSection>
      <section className="incident-description-section"><h2>Issue description</h2><Field label="Short description" required error={errors.shortDescription} hint="What is the main problem?"><input value={form.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} placeholder="Brief summary of the issue" /></Field><Field label="Detailed description" required error={errors.description} hint="Include as much detail as possible to aid resolution"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Provide detailed information about the issue, steps to reproduce, error messages, etc." rows="5" /></Field><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} cameraCapture /></section>
    </section>
    <footer className="incident-form-footer">{submitError && <span className="incident-submit-error">{submitError}</span>}<button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button><button type="submit" className="incident-submit-button">Submit incident</button></footer>
  </form>
}

function IncidentComponentsTable({ components, componentSerialNumbers, onChange, serialNumber, subsystem, readOnly = false }) {
  if (!serialNumber || !subsystem) return <div className="incident-work-panel incident-empty-panel">Select a product serial number and sub-system in the incident form to view its components.</div>
  if (!components.length) return <div className="incident-work-panel incident-empty-panel">No Product Master components are available for {serialNumber} in {subsystem}.</div>

  return <div className="incident-work-panel incident-components-panel"><div className="incident-components-summary"><div><strong>{serialNumber}</strong><span>{subsystem}</span></div><small>{components.length} component{components.length === 1 ? '' : 's'} · Material serial numbers are updated through approved replacement requests</small></div><div className="incident-components-table"><table><thead><tr>{incidentComponentColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{components.map((component) => <tr key={componentKey(component)}>{incidentComponentColumns.map(([key]) => <td key={key}>{key === 'materialSerialNumber' ? <input aria-label={`Material serial number for ${component.materialDescription}`} disabled={readOnly} value={componentSerialNumbers[componentKey(component)] ?? component.materialSerialNumber} onChange={(event) => onChange(component, event.target.value)} /> : component[key] || '--'}</td>)}</tr>)}</tbody></table></div></div>
}

function ReplacementPartsPanel({ enabled, onToggle, replacementSource, taslRequestReason, onSourceChange, onTaslRequestReasonChange, parts, components, approval, onAdd, onRemove, onChange, onSubmit, canSubmit }) {
  const locked = approval?.status === 'Pending' || approval?.status === 'Approved'
  const approved = approval?.status === 'Approved'
  return <section className="replacement-parts-panel">
    <label className="repair-completed-check"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} /> <span>Part needs replacement</span></label>
    {enabled && <>
      <section className="replacement-source-panel" aria-label="Replacement source">
        <header><div><strong>Replacement source</strong><span>Select one fulfilment path for this replacement request.</span></div></header>
        <div className="replacement-source-options">
          <label className={replacementSource === 'mrls' ? 'selected' : ''}><input type="checkbox" checked={replacementSource === 'mrls'} disabled={locked} onChange={() => onSourceChange('mrls')} /><span><strong>Available in MRLS</strong><small>Request Advisory approval for MRLS stock.</small></span></label>
          <label className={replacementSource === 'tasl' ? 'selected' : ''}><input type="checkbox" checked={replacementSource === 'tasl'} disabled={locked} onChange={() => onSourceChange('tasl')} /><span><strong>Request from TASL</strong><small>Record the supply request reason for Advisory review.</small></span></label>
        </div>
        {replacementSource === 'tasl' && <label className="replacement-tasl-reason"><span><strong>Request reason</strong><small>This note is added to the incident and sent to the Advisory Group.</small></span><textarea value={taslRequestReason} disabled={locked} onChange={(event) => onTaslRequestReasonChange(event.target.value)} placeholder="Explain why this part must be requested from TASL..." rows="3" /></label>}
      </section>
      <div className={`replacement-request-card ${approval?.status?.toLowerCase() || 'draft'}`}>
        <header><div><strong>Replacement components</strong><span>{approval?.status === 'Pending' ? 'Awaiting Advisory Group decision' : approved ? 'Approved - enter replacement serial numbers' : 'Build the request before sending for approval'}</span></div><b>{approval?.status || 'Draft'}</b></header>
        <div className="replacement-part-list">{parts.length ? parts.map((part, index) => <article key={part.id}><header><strong>Component {index + 1}</strong><button type="button" className="icon-button danger" disabled={locked} title="Remove replacement component" onClick={() => onRemove(part.id)}><Trash2 size={14} /></button></header><div className="replacement-part-fields"><label><span>Component name</span><select value={part.componentKey} disabled={locked} onChange={(event) => onChange(part.id, { componentKey: event.target.value })}><option value="">Select component</option>{components.map((component) => <option key={componentKey(component)} value={componentKey(component)}>{component.materialDescription}</option>)}</select></label><label><span>Part number</span><output>{part.partNumber || '--'}</output></label><label><span>Current serial number</span><output>{part.currentSerialNumber || '--'}</output></label><label><span>New serial number</span><input value={part.newSerialNumber} disabled={!approved} onChange={(event) => onChange(part.id, { newSerialNumber: event.target.value })} placeholder={approved ? 'Enter new serial number' : 'Available after approval'} /></label></div></article>) : <div className="replacement-part-empty">No replacement components added. Use <strong>Add component</strong> to begin.</div>}</div>
        {!locked && <footer className="replacement-parts-actions"><button type="button" className="compact-button secondary" disabled={!components.length} onClick={onAdd}>Add component</button><button type="button" className="incident-next-stage-button" disabled={!canSubmit} onClick={onSubmit}>Send for Advisory approval</button></footer>}
      </div>
    </>}
  </section>
}

function FormSection({ icon: Icon, title, headerAction, children }) { return <section className="incident-form-section"><h2><span><Icon size={16} /> {title}</span>{headerAction}</h2><div className="incident-form-grid">{children}</div></section> }
function Field({ label, required, hint, error, children }) { return <label className={`incident-field ${error ? 'has-error' : ''}`}><span>{required && <em>*</em>}{label}</span>{children}{error ? <small className="incident-field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label> }
const auditDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') return '--'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? Object.entries(item).map(([key, itemValue]) => `${key}: ${auditDisplayValue(itemValue)}`).join(', ') : auditDisplayValue(item)).join('; ')
  return Object.entries(value).map(([key, itemValue]) => `${key}: ${auditDisplayValue(itemValue)}`).join(', ')
}
const attachmentAuditValue = (value) => {
  const attachments = Array.isArray(value) ? value : []
  if (!attachments.length) return '--'
  return attachments.map((attachment) => `${attachment.name || 'Unnamed file'} (${attachment.type || 'Unknown file type'})`).join('; ')
}
function AuditChangeValue({ change }) {
  const { field, previous, next } = change
  if (/group approval/i.test(field) && next && typeof next === 'object') {
    const parts = Array.isArray(next.parts) ? next.parts : []
    return <div className="journal-structured-value"><dl><div><dt>Approval type</dt><dd>{next.approvalType === 'replacement-parts' ? 'Material replacement' : next.approvalType || '--'}</dd></div><div><dt>Status</dt><dd>{next.status || '--'}</dd></div><div><dt>Assignment group</dt><dd>{next.assignmentGroup || '--'}</dd></div><div><dt>Requested by</dt><dd>{next.requestedBy || '--'}</dd></div>{next.decisionReason && <div><dt>Decision comments</dt><dd>{next.decisionReason}</dd></div>}{parts.length > 0 && <div><dt>Replacement parts</dt><dd>{parts.map((part) => part.materialDescription || part.partNumber || 'Part').join(', ')}</dd></div>}</dl></div>
  }
  if (/customer.?quality feedback/i.test(field) && Array.isArray(next)) return <div className="journal-structured-value"><dl>{next.map((item, index) => <div key={item.id || index}><dt>Feedback {index + 1}</dt><dd>{item.customerFeedback || '--'} | Quality check: {item.qualityCheckStatus || '--'}{item.remarks ? ` | Remarks: ${item.remarks}` : ''}</dd></div>)}</dl></div>
  if (/attachments?/i.test(field)) return <><s>{attachmentAuditValue(previous)}</s><i>to</i><b>{attachmentAuditValue(next)}</b></>
  return <><s>{auditDisplayValue(previous)}</s><i>to</i><b>{auditDisplayValue(next)}</b></>
}
const acceptanceHistoryDetails = (changes) => (changes || [])
  .filter((change) => /post repair|acceptance feedback|quality check|customer.?quality feedback|repair completed|resolution notes/i.test(change.field || ''))
  .map((change) => ({ label: change.field, value: auditDisplayValue(change.next) }))
function PostRepairQcPanel({ canEdit, decision, returnTarget, feedbackItems = [], acceptanceHistory = [], feedbackCaptured = false, onFeedbackChange = () => {}, onFeedbackAdd = () => {}, onFeedbackRemove = () => {}, onDecision, onReturn, embedded = false }) {
  const isNotSatisfied = decision === 'Not Satisfied'
  const hasStructuredFeedback = feedbackItems.some((item) => item.customerFeedback || item.remarks)
  const isHistoricalReview = !decision && !hasStructuredFeedback && acceptanceHistory.length > 0
  return <section className={`post-repair-qc-card ${embedded ? 'customer-acceptance-panel' : ''} ${isNotSatisfied ? 'requires-return' : decision === 'Satisfied' ? 'is-satisfied' : ''}`}>
    <header><div><span>Quality control</span><h3>Post Repair Acceptance</h3><p>Confirm the rectification outcome before completing this workflow stage.</p></div><b>{decision || 'Pending review'}</b></header>
    <section className="customer-quality-feedback-panel"><header><div><span>Customer feedback</span><h3>Acceptance feedback</h3><p>Record each customer point and its quality follow-up before confirming the outcome.</p></div><button type="button" className="compact-button secondary" disabled={!canEdit} onClick={onFeedbackAdd}><Plus size={14} /> Add feedback</button></header><div className="customer-quality-feedback-table"><div className="customer-quality-feedback-head"><span>Customer Feedback</span><span>Quality Check Status</span><span>Remarks</span><span /></div>{feedbackItems.map((item, index) => <div className="customer-quality-feedback-row" key={item.id}><input aria-label={`Customer feedback ${index + 1}`} disabled={!canEdit} value={item.customerFeedback} onChange={(event) => onFeedbackChange(item.id, 'customerFeedback', event.target.value)} placeholder="Customer feedback" /><select aria-label={`Quality check status ${index + 1}`} disabled={!canEdit} value={item.qualityCheckStatus} onChange={(event) => onFeedbackChange(item.id, 'qualityCheckStatus', event.target.value)}><option value="Open">Open</option><option value="Closed">Closed</option></select><input aria-label={`Feedback remarks ${index + 1}`} disabled={!canEdit} value={item.remarks} onChange={(event) => onFeedbackChange(item.id, 'remarks', event.target.value)} placeholder="Remarks" /><button type="button" className="icon-button danger" disabled={!canEdit || feedbackItems.length === 1} title="Remove feedback item" onClick={() => onFeedbackRemove(item.id)}><Trash2 size={14} /></button></div>)}</div></section>
    {isHistoricalReview && <section className="post-repair-history"><header><div><h3>Recorded acceptance history</h3><p>Acceptance details retained from the incident journal.</p></div><b>Outcome not recorded</b></header><div className="post-repair-history-list">{acceptanceHistory.map((entry) => { const details = acceptanceHistoryDetails(entry.changes); return <article key={entry.id}><header><time>{openedDateLabel(entry.updatedAt)}</time><span>{entry.updatedBy || 'System'}</span></header>{details.length ? <dl>{details.map((detail, index) => <div key={`${detail.label}-${index}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : <p>No detailed acceptance values were retained for this entry.</p>}</article> })}</div></section>}
    {!feedbackCaptured && canEdit && <p className="post-repair-feedback-required">Record customer feedback before confirming a satisfied acceptance outcome.</p>}
    {!isHistoricalReview && <div className="post-repair-qc-options"><label className={decision === 'Satisfied' ? 'selected' : ''}><input type="checkbox" checked={decision === 'Satisfied'} disabled={!canEdit || !feedbackCaptured} onChange={() => onDecision('Satisfied')} /><span><strong>Issue Rectified - Satisfied</strong><small>All feedback is addressed and the incident can move to the next stage.</small></span></label><label className={isNotSatisfied ? 'selected' : ''}><input type="checkbox" checked={isNotSatisfied} disabled={!canEdit} onChange={() => onDecision('Not Satisfied')} /><span><strong>Not Satisfied</strong><small>Return the incident to the prior repair owner for corrective action.</small></span></label></div>}
    {isNotSatisfied && <footer><div><strong>Return destination</strong><span>{returnTarget ? `${returnTarget.status} | ${returnTarget.assignmentGroup}${returnTarget.assignedTo ? ` | ${returnTarget.assignedTo}` : ''}` : 'Previous assignment unavailable'}</span></div><button type="button" className="incident-next-stage-button" disabled={!returnTarget} onClick={onReturn}>Send back to previous stage</button></footer>}
  </section>
}
function WorkNotesField({ value, onChange, users, groups, inputRef, disabled = false }) {
  const [query, setQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const suggestions = [...users.filter((user) => user.status === 'Active').map((user) => ({ id: `user-${user.id}`, name: user.name, type: 'User' })), ...groups.filter((group) => group.active).map((group) => ({ id: `group-${group.id}`, name: group.name, type: 'Assignment group' }))]
    .filter((suggestion) => suggestion.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
  const handleChange = (event) => {
    const nextValue = event.target.value
    const cursor = event.target.selectionStart
    const match = nextValue.slice(0, cursor).match(/@([^\s@\[]*)$/)
    setMentionStart(match ? cursor - match[0].length : -1)
    setQuery(match ? match[1] : '')
    onChange(nextValue)
  }
  const selectMention = (suggestion) => {
    const nextValue = `${value.slice(0, mentionStart)}@[${suggestion.name}] ${value.slice(inputRef.current?.selectionStart || value.length)}`
    onChange(nextValue)
    setMentionStart(-1)
    window.requestAnimationFrame(() => {
      const cursor = mentionStart + suggestion.name.length + 4
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(cursor, cursor)
    })
  }
  return <Field label="Work notes" hint="Use @ to mention an active user or assignment group."><div className="work-notes-mention"><textarea className="work-notes-input" ref={inputRef} value={value} disabled={disabled} onChange={handleChange} placeholder="Add work notes here..." rows="4" />{!disabled && mentionStart >= 0 && <ul role="listbox" aria-label="Mention suggestions">{suggestions.length ? suggestions.map((suggestion) => <li key={suggestion.id} role="option" onMouseDown={(event) => { event.preventDefault(); selectMention(suggestion) }}><strong>{suggestion.name}</strong><span>{suggestion.type}</span></li>) : <li className="empty">No matching users or assignment groups.</li>}</ul>}</div></Field>
}
function SelectField({ value, onChange, options, placeholder, required = false, priority = false, disabled = false }) { return <select className={priority ? `incident-priority-select ${String(value).toLowerCase()}` : ''} value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">-- {placeholder} --</option>{options.map((option) => <option key={option}>{option}</option>)}</select> }
function RequestorSelect({ customer, value, onChange }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">-- Select customer first --</option>{customer?.contacts.map((contact) => <option key={contact.id} value={contact.name}>{requestorOptionLabel(customer, contact)}</option>)}</select> }
function LookupField({ label, value }) { return <Field label={label}><input value={value} readOnly placeholder="Auto-filled from serial number" /></Field> }
function SerialNumberReference({ records, value, onChange, required, error, disabled = false, hint = 'Search and select an asset serial number', placeholder = 'Search serial number, e.g. LM-001' }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const matches = records.filter((record) => record.serialNumber.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  useEffect(() => setQuery(value), [value])
  const select = (serialNumber) => { setQuery(serialNumber); onChange(serialNumber); setOpen(false) }
  return <Field label="Serial number" required={required} error={error} hint={hint}><div className="serial-reference"><Search size={15} /><input value={query} disabled={disabled} onFocus={() => setOpen(true)} onChange={(event) => { const serialNumber = event.target.value.toUpperCase(); setQuery(serialNumber); setOpen(true); onChange(serialNumber) }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder={placeholder} role="combobox" aria-expanded={open} aria-controls="serial-number-results" aria-autocomplete="list" />{open && matches.length > 0 && <ul id="serial-number-results" role="listbox">{matches.map((record) => <li key={record.serialNumber} role="option" aria-selected={record.serialNumber === value} onMouseDown={() => select(record.serialNumber)}><strong>{record.serialNumber}</strong><span>{record.system} · {record.category}</span></li>)}</ul>}</div></Field>
}
function SubsystemReference({ serialNumber, value, records, onChange }) { const record = records.find((entry) => entry.serialNumber === serialNumber); return <Field label="Sub-system"><SelectField value={value} onChange={onChange} options={record?.subsystems || []} placeholder={serialNumber ? 'Select sub-system from Product Master' : 'Select serial number first'} /></Field> }
function WorkflowProgress({ stages, currentStatus, compact = false }) { return <ol className={`incident-lifecycle ${compact ? 'incident-create-lifecycle compact' : ''}`} style={compact ? { gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))` } : undefined}>{stages.map((stage) => <li key={stage.id} className={stage.status === currentStatus ? 'current' : ''}><span>{stage.order}</span><strong>{stage.status}</strong></li>)}</ol> }

export function AttachmentSection({ attachments = [], onChange, cameraCapture = false }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraFallback = useRef(null)
  const addFiles = async (files) => {
    const nextAttachments = await Promise.all(Array.from(files).map(async (file) => {
      const content = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
      })
      return { id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, type: file.type, size: file.size, content }
    }))
    onChange([...attachments, ...nextAttachments])
  }
  const addCapturedImage = (file) => addFiles([file])
  const openCamera = () => {
    if (navigator.mediaDevices?.getUserMedia) setCameraOpen(true)
    else cameraFallback.current?.click()
  }
  return <section className="incident-attachments"><div><h3><Paperclip size={15} /> Attachments</h3><p>Add reference files, photographs, or evidence for this incident.</p></div><div className="attachment-actions"><label className="compact-button secondary"><FileUp size={14} /> Add files<input type="file" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} /></label>{cameraCapture && <><button type="button" className="compact-button primary" onClick={openCamera}><Camera size={14} /> Capture image</button><input ref={cameraFallback} className="camera-fallback-input" type="file" accept="image/*" capture="environment" onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} /></>}</div>{attachments.length > 0 && <div className="attachment-list">{attachments.map((attachment) => { const content = attachment.content || attachment.preview; const canAccess = content && !content.startsWith('blob:'); return <article key={attachment.id}>{attachment.type?.startsWith('image/') && canAccess ? <img src={content} alt={attachment.name} /> : <Paperclip size={16} />}<span><strong>{attachment.name}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span>{canAccess ? <a className="attachment-access" href={content} download={attachment.name} target="_blank" rel="noreferrer" title={`Download ${attachment.name}`} aria-label={`Download ${attachment.name}`}><Download size={14} /></a> : <span className="attachment-access unavailable" title="This legacy attachment is no longer available"><Download size={14} /></span>}<button type="button" onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))} title="Remove attachment"><Trash2 size={14} /></button></article>})}</div>}{cameraOpen && <CameraCaptureDialog onCapture={addCapturedImage} onClose={() => setCameraOpen(false)} onFallback={() => { setCameraOpen(false); cameraFallback.current?.click() }} />}</section>
}

function CameraCaptureDialog({ onCapture, onClose, onFallback }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stream
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((nextStream) => { stream = nextStream; video.current.srcObject = nextStream })
      .catch(() => setError('Camera access was unavailable. Use the image picker instead.'))
    return () => stream?.getTracks().forEach((track) => track.stop())
  }, [])
  const capture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = video.current.videoWidth
    canvas.height = video.current.videoHeight
    canvas.getContext('2d').drawImage(video.current, 0, 0)
    canvas.toBlob((blob) => { if (blob) { onCapture(new File([blob], `incident-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })); onClose() } }, 'image/jpeg', .9)
  }
  return <div className="camera-capture-backdrop"><section className="camera-capture-dialog" role="dialog" aria-modal="true" aria-label="Capture incident image"><header><div><h2>Capture image</h2><p>Use the device camera to attach a photograph to this incident.</p></div><button type="button" onClick={onClose} aria-label="Close camera"><X size={17} /></button></header>{error ? <div className="camera-error"><p>{error}</p><button type="button" className="compact-button secondary" onClick={onFallback}>Choose image</button></div> : <video ref={video} autoPlay playsInline muted />}<footer><button type="button" className="incident-cancel-button" onClick={onClose}>Cancel</button>{!error && <button type="button" className="incident-submit-button" onClick={capture}><Camera size={15} /> Capture</button>}</footer></section></div>
}

function IncidentDetailForm({ assignmentGroups, customers, contracts, repairExecutions, processes, currentUser, products, productAssets, serialNumberRecords, users, incident, allIncidents, initialActiveTab, canEdit, onCancel, onSave }) {
  const initialCustomer = incident.id.includes('-IAF-') ? 'Indian Air Force' : 'Indian Army'
  const initialProfile = findCustomerProfile(customers, contracts, incident.customer || initialCustomer)
  const initialContract = initialProfile?.contracts.find((contract) => contract.number === incident.contract) || initialProfile?.contracts[0]
  const defaultRepairExecution = incident.repairExecution || 'Incident Registration'
  const initialStages = getProcessStages(defaultRepairExecution, processes)
  const defaultStatus = incident.status || (incident.stage && incident.stage !== 'Triage' ? incident.stage : initialStages[0]?.status || 'Registered')
  const assignmentGroupOptions = activeGroupNames(assignmentGroups)
  const [activeTab, setActiveTab] = useState(initialActiveTab || 'Notes')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [stageConfirmationOpen, setStageConfirmationOpen] = useState(false)
  const [manualNextAssignmentGroup, setManualNextAssignmentGroup] = useState('')
  const [processStepsOpen, setProcessStepsOpen] = useState(false)
  const [approvalDecisionOpen, setApprovalDecisionOpen] = useState(false)
  const [approvalDecisionReason, setApprovalDecisionReason] = useState('')
  const [replacementReasonOpen, setReplacementReasonOpen] = useState(false)
  const [replacementReason, setReplacementReason] = useState('')
  const [replacementReasonError, setReplacementReasonError] = useState('')
  const [form, setForm] = useState({
    repairExecution: defaultRepairExecution, status: defaultStatus, customer: incident.customer || initialCustomer, contract: incident.contract || initialContract?.number || '', requestor: incident.requestor || initialProfile?.contacts[0]?.name || '', contact: incident.contact || contactValue(initialProfile?.contacts[0]), occurrencePhase: incident.occurrencePhase || '', priority: incident.priority || 'Medium', assignmentGroup: incident.assignmentGroup || incident.group || '', assignedTo: incident.assignedTo || '', system: initialContract?.system || incident.system || 'SRLM', category: incident.category || 'Loitering Munition (LM)', subsystem: incident.subsystem || 'Airframe', serialNumber: incident.serialNumber || '', component: incident.component || '', materialSerialNumber: incident.materialSerialNumber || 'Not Applicable', componentSerialNumbers: incident.componentSerialNumbers || {}, warranty: initialContract?.warranty || incident.warranty || '', lastServiced: incident.lastServiced || '', shortDescription: incident.title || '', description: incident.description || incident.title || '', workNotes: '', repairCompleted: Boolean(incident.repairCompleted), resolutionDetails: incident.resolutionDetails || '', groupApproval: incident.groupApproval || null, postRepairQcDecision: incident.postRepairQcDecision || '', postRepairQcReturnTarget: incident.postRepairQcReturnTarget || null, customerFeedback: incident.customerFeedback || '', qualityCheckStatus: incident.qualityCheckStatus || '', customerFeedbackRemarks: incident.customerFeedbackRemarks || '', attachments: incident.attachments || [],
  })
  const [replacementDraft, setReplacementDraft] = useState({
    partReplacementRequired: Boolean(incident.partReplacementRequired),
    replacementParts: Array.isArray(incident.replacementParts) ? incident.replacementParts : [],
    replacementSource: incident.replacementSource || '',
    taslRequestReason: incident.taslRequestReason || '',
  })
  const repairExecutionOptions = repairExecutions.filter((execution) => execution.active || execution.name === form.repairExecution).map((execution) => execution.name)
  const initialForm = useRef(form)
  const workNotesInput = useRef(null)
  const update = (key, value) => { if (!canEdit && (key !== 'workNotes' || !canAddWorkNotes)) return; setSaved(false); setForm((current) => ({ ...current, [key]: value })) }
  const selectAssignmentGroup = (assignmentGroup) => { setSaved(false); setForm((current) => ({ ...current, assignmentGroup, assignedTo: '' })) }
  const selectedCustomer = findCustomerProfile(customers, contracts, form.customer)
  const selectCustomer = (customerName) => {
    const profile = findCustomerProfile(customers, contracts, customerName)
    const primaryContact = profile?.contacts[0]
    setSaved(false)
    setForm((current) => ({ ...current, customer: customerName, requestor: primaryContact?.name || '', contact: contactValue(primaryContact), contract: '', system: '', warranty: '', serialNumber: '', category: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  }
  const selectRequestor = (requestorName) => {
    const contact = selectedCustomer?.contacts.find((entry) => entry.name === requestorName)
    setSaved(false)
    setForm((current) => ({ ...current, requestor: requestorName, contact: contactValue(contact) }))
  }
  const selectProductCategory = (category) => {
    setSaved(false)
    setForm((current) => ({ ...current, category, serialNumber: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  }
  const selectContract = (contractNumber) => {
    const contract = selectedCustomer?.contracts.find((entry) => entry.number === contractNumber)
    setSaved(false)
    setForm((current) => ({ ...current, contract: contractNumber, system: contract?.system || '', warranty: contract?.warranty || '', category: '', serialNumber: '', subsystem: '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: '' }))
  }
  const selectRepairExecution = (repairExecution) => {
    const stages = getProcessStages(repairExecution, processes)
    const initialStage = stages[0]
    const requiresSiteTaslRouting = form.status === 'Advisory Group Review' && repairExecution === 'Repair at Site - TASL'
    setSaved(false)
    setForm((current) => {
      const assignmentGroup = requiresSiteTaslRouting ? '' : initialStage?.assignmentGroup || current.assignmentGroup
      return {
        ...current,
        repairExecution,
        status: initialStage?.status || '',
        assignmentGroup,
        assignedTo: '',
      }
    })
  }
  const selectSerialNumber = (serialNumber) => {
    const record = serialNumberRecords.find((entry) => entry.serialNumber === serialNumber)
    setForm((current) => {
      const asset = productAssets.find((entry) => entry.serialNumber === serialNumber && entry.customer === current.customer && entry.contractNumber === current.contract)
        || productAssets.find((entry) => entry.serialNumber === serialNumber)
      return { ...current, serialNumber, system: current.contract ? current.system : record?.system || '', category: current.category || record?.category || '', subsystem: record?.subsystems[0] || '', component: '', materialSerialNumber: 'Not Applicable', lastServiced: asset?.lastServiced || '' }
    })
  }
  const isRegistered = form.status === 'Registered'
  const isAdvisoryReview = form.status === 'Advisory Group Review'
  const isRepairExecution = form.repairExecution !== 'Incident Registration'
  const repairExecutionDetailsReadOnly = !canEdit || isAdvisoryReview || form.repairExecution !== 'Incident Registration'
  const field = (label, key, placeholder, options, disabled = repairExecutionDetailsReadOnly) => <Field label={label}>{options ? <SelectField value={form[key]} onChange={(value) => update(key, value)} options={options} placeholder={placeholder} priority={key === 'priority'} disabled={disabled} /> : <input value={form[key]} disabled={disabled} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} />}</Field>
  const stages = getProcessStages(form.repairExecution, processes)
  const currentStage = getProcessStage(form.repairExecution, form.status, processes)
  const configuredNextStage = getNextProcessStage(form.repairExecution, form.status, processes)
  const isSiteTaslResourceAlignment = form.repairExecution === 'Repair at Site - TASL' && form.status === 'Resource Alignment'
  const nextStage = (configuredNextStage?.status === customerAcceptanceStage || configuredNextStage?.status === 'Closed' || isSiteTaslResourceAlignment)
    ? { ...configuredNextStage, assignmentGroup: form.assignmentGroup, retainsExistingAssignment: true }
    : configuredNextStage
  const isRepairWorkInProgress = isRepairExecution && /\b(repair|work) in progress\b/i.test(form.status)
  const hasResolutionDetails = isRepairWorkInProgress || form.repairCompleted || Boolean(form.resolutionDetails.trim())
  const isSiteTaslWorkInProgress = isRepairWorkInProgress && form.repairExecution === 'Repair at Site - TASL'
  const isRepairAtSite = /^Repair at Site -/.test(form.repairExecution)
  const isPostRepairQualityStage = /^post repair (quality (check|review)|qc|review|acceptance(?: by customer)?)$/i.test(form.status.trim())
  const isPostRepairQuality = isRepairAtSite && isPostRepairQualityStage
  const isPostRepairAcceptance = form.status === customerAcceptanceStage
    const feedbackItems = Array.isArray(form.customerFeedbackItems) && form.customerFeedbackItems.length
      ? form.customerFeedbackItems
      : [{ id: 'legacy-feedback', customerFeedback: form.customerFeedback || '', qualityCheckStatus: form.qualityCheckStatus || 'Open', remarks: form.customerFeedbackRemarks || '' }]
    const hasCapturedCustomerFeedback = feedbackItems.some((item) => Boolean(item.customerFeedback?.trim()))
    const updateFeedbackItem = (id, field, value) => update('customerFeedbackItems', feedbackItems.map((item) => item.id === id ? { ...item, [field]: value } : item))
    const addFeedbackItem = () => update('customerFeedbackItems', [...feedbackItems, { id: `customer-feedback-${Date.now()}-${Math.random()}`, customerFeedback: '', qualityCheckStatus: 'Open', remarks: '' }])
    const removeFeedbackItem = (id) => update('customerFeedbackItems', feedbackItems.filter((item) => item.id !== id))
  const isPreDispatchApproval = /^pre[- ]?dispatch approval$/i.test(form.status.trim())
  const groupApprovalPending = isPreDispatchApproval && form.groupApproval?.status !== 'Approved'
  const assignedToOptions = groupMemberNames(assignmentGroups, users, form.assignmentGroup)
  const currentUserRecord = users.find((member) => member.email === currentUser.email)
  const currentUserName = currentUserRecord?.name || currentUser.name
  const currentUserGroupNames = assignmentGroups
    .filter((group) => group.manager === currentUser.name || group.memberIds?.includes(currentUserRecord?.id))
    .map((group) => group.name)
  const canAddWorkNotes = canEdit || currentUserGroupNames.includes('Customer Support Management Group') || currentUserGroupNames.includes('Advisory Group')
  const isCustomerSupportManagementMember = currentUserGroupNames.includes('Customer Support Management Group')
  const postRepairAcceptanceHistory = (incident.auditLog || []).filter((entry) => (entry.changes || []).some((change) => /post repair|acceptance feedback|quality check/i.test(change.field || '')))
  const historicPostRepairDecision = postRepairAcceptanceHistory.flatMap((entry) => entry.changes || [])
    .map((change) => String(change.next || ''))
    .find((value) => ['Satisfied', 'Not Satisfied'].includes(value)) || ''
  const effectivePostRepairDecision = form.postRepairQcDecision || historicPostRepairDecision
  const hasPostRepairAcceptanceAudit = (incident.auditLog || []).some((entry) => (entry.changes || []).some((change) => /post repair|acceptance feedback|quality check/i.test(change.field || '')))
  const hasPostRepairAcceptanceRecords = Boolean(form.postRepairQcDecision || form.customerFeedbackItems?.length || form.customerFeedback || form.customerFeedbackRemarks || hasPostRepairAcceptanceAudit)
  const showPostRepairAcceptanceRecords = isRepairAtSite && (isPostRepairAcceptance || (isCustomerSupportManagementMember && hasPostRepairAcceptanceRecords))
  const updateWorkNotes = (workNotes) => {
    if (!canAddWorkNotes) return
    setSaved(false)
    setForm((current) => ({ ...current, workNotes }))
  }
  const canAssignToMe = Boolean(currentUserName && assignedToOptions.includes(currentUserName))
  const currentAssignmentGroup = assignmentGroups.find((group) => group.name === form.assignmentGroup)
  const isCurrentGroupMember = currentAssignmentGroup?.manager === currentUser.name
    || currentAssignmentGroup?.memberIds?.some((memberId) => String(memberId) === String(currentUserRecord?.id))
  const hasCompletedRepair = form.repairCompleted && Boolean(form.resolutionDetails.trim())
  const requiresSiteTaslRouting = initialForm.current.status === 'Advisory Group Review' && form.repairExecution === 'Repair at Site - TASL'
  const assignedToLockedForAdvisory = isSiteTaslResourceAlignment && form.assignmentGroup === 'Advisory Group'
  const hasValidSiteTaslRouting = !requiresSiteTaslRouting || Boolean(form.assignmentGroup)
  const canApproveGroupRequest = canEdit && groupApprovalPending && form.groupApproval?.members?.some((member) => member.name === currentUserName && member.status === 'Pending')
  const replacementSerialsReady = replacementDraft.replacementParts.length > 0
    && replacementDraft.replacementParts.every((part) => Boolean(part.newSerialNumber.trim()))
  const productCategoryOptions = productCategoriesForCustomerContract(productAssets, form.customer, form.contract)
  const eligibleSerialNumberRecords = serialRecordsForCustomerContractCategory(serialNumberRecords, productAssets, form.customer, form.category, form.contract)
  const components = componentOptions(serialNumberRecords, form.serialNumber, form.subsystem)
  const incidentComponents = useMemo(() => serialNumberRecords.find((record) => record.serialNumber === form.serialNumber)?.components
    .filter((component) => component.subsystem === form.subsystem) || [], [form.serialNumber, form.subsystem, serialNumberRecords])
  const componentsByKey = useMemo(() => new Map(incidentComponents.map((component) => [componentKey(component), component])), [incidentComponents])
  const updateComponentSerialNumber = (component, materialSerialNumber) => update('componentSerialNumbers', { ...form.componentSerialNumbers, [componentKey(component)]: materialSerialNumber })
  const currentSerialForComponent = (component) => form.componentSerialNumbers[componentKey(component)] ?? component.materialSerialNumber ?? 'Not Applicable'
  const togglePartReplacementRequired = (checked) => {
    setSaved(false)
    setReplacementDraft((current) => ({
      ...current,
      partReplacementRequired: checked,
      replacementParts: checked ? current.replacementParts : [],
      replacementSource: checked ? current.replacementSource : '',
      taslRequestReason: checked ? current.taslRequestReason : '',
    }))
  }
  const selectReplacementSource = (replacementSource) => {
    setSaved(false)
    setReplacementDraft((current) => ({
      ...current,
      replacementSource: current.replacementSource === replacementSource ? '' : replacementSource,
      taslRequestReason: replacementSource === 'tasl' ? current.taslRequestReason : '',
    }))
  }
  const updateTaslRequestReason = (taslRequestReason) => {
    setSaved(false)
    setReplacementDraft((current) => ({ ...current, taslRequestReason }))
  }
  const addReplacementPart = () => {
    const firstComponent = incidentComponents[0]
    if (!firstComponent) return
    setReplacementDraft((current) => ({
      ...current,
      replacementParts: [...current.replacementParts, {
        id: `replacement-${Date.now()}-${Math.random()}`,
        componentKey: componentKey(firstComponent),
        materialDescription: firstComponent.materialDescription,
        partNumber: firstComponent.part_number,
        currentSerialNumber: currentSerialForComponent(firstComponent),
        newSerialNumber: '',
      }],
    }))
  }
  const removeReplacementPart = (id) => setReplacementDraft((current) => ({ ...current, replacementParts: current.replacementParts.filter((part) => part.id !== id) }))
  const updateReplacementPart = (id, updates) => setReplacementDraft((current) => ({
    ...current,
    replacementParts: current.replacementParts.map((part) => {
      if (part.id !== id) return part
      const next = { ...part, ...updates }
      if (updates.componentKey) {
        const component = componentsByKey.get(updates.componentKey)
        if (component) {
          next.materialDescription = component.materialDescription
          next.partNumber = component.part_number
          next.currentSerialNumber = currentSerialForComponent(component)
          next.newSerialNumber = ''
        }
      }
      return next
    }),
  }))
  const replacementApproval = form.groupApproval?.approvalType === 'replacement-parts' ? form.groupApproval : null
  const replacementApprovalPending = replacementApproval?.status === 'Pending'
  const replacementApprovalApproved = replacementApproval?.status === 'Approved'
  const canSubmitReplacementApproval = canEdit && isSiteTaslWorkInProgress
    && replacementDraft.partReplacementRequired
    && !replacementApprovalPending
    && Boolean(replacementDraft.replacementSource)
    && (replacementDraft.replacementSource !== 'tasl' || Boolean(replacementDraft.taslRequestReason.trim()))
    && replacementDraft.replacementParts.length > 0
  const submitReplacementApproval = async (reason) => {
    if (!canSubmitReplacementApproval || !reason.trim()) return
    const advisoryGroup = assignmentGroups.find((group) => group.name === 'Advisory Group')
    const approvalMembers = advisoryGroup ? [...new Set([
      ...groupMemberNames(assignmentGroups, users, advisoryGroup.name),
      ...users.filter((user) => user.status === 'Active' && user.name === advisoryGroup.manager).map((user) => user.name),
    ])] : []
    const groupApproval = {
      id: `replacement-approval-${incident.id}-${Date.now()}`,
      approvalType: 'replacement-parts',
      status: 'Pending',
      assignmentGroup: advisoryGroup?.name || 'Advisory Group',
      requestedAt: new Date().toISOString(),
      requestedBy: currentUser.name || currentUser.email,
      members: approvalMembers.map((name) => ({ name, status: 'Pending' })),
      parts: replacementDraft.replacementParts.map((part) => ({ ...part })),
      replacementSource: replacementDraft.replacementSource,
      taslRequestReason: replacementDraft.taslRequestReason.trim(),
      partReplacementReason: reason.trim(),
    }
    const taslRequestNote = replacementDraft.replacementSource === 'tasl'
      ? `Request from TASL: ${replacementDraft.taslRequestReason.trim()}`
      : ''
    const advisoryNotifications = approvalGroupNotifications(incident, groupApproval, assignmentGroups, users)
    const approvalForm = { ...form, groupApproval, workNotes: reason.trim() }
    const savedApproval = await saveChanges(
      approvalForm,
      [{
        id: `replacement-approval-reason-${Date.now()}-${Math.random()}`,
        assignedGroup: advisoryGroup?.name || 'Advisory Group',
        updatedBy: currentUser.name || currentUser.email,
        updatedAt: new Date().toISOString(),
        changes: [{ field: 'Work notes', previous: '', next: reason.trim() }],
      }],
      advisoryNotifications,
    )
    if (savedApproval) {
      setReplacementReasonOpen(false)
      setReplacementReason('')
      setReplacementReasonError('')
      void logIncidentEmails({ ...incident, ...approvalForm }, 'On approval required', '', currentUser.name || currentUser.email).catch(() => {})
    }
  }
  const selectSubsystem = (subsystem) => { setSaved(false); setForm((current) => ({ ...current, subsystem, component: '', materialSerialNumber: 'Not Applicable' })) }
  const selectComponent = (component) => setForm((current) => ({ ...current, component, materialSerialNumber: materialSerialNumberFor(serialNumberRecords, current.serialNumber, current.subsystem, component) }))
  const saveChanges = async (nextForm = form, journalEntries = [], additionalNotifications = []) => {
        if (!canEdit && !canAddWorkNotes) {
          setSaveError('This incident is view-only because it is not assigned to you or one of your assignment groups.')
          return false
        }
    if (!canEdit) {
      const workNotes = nextForm.workNotes.trim()
      if (!workNotes) {
        setSaveError('Enter work notes before saving.')
        return false
      }
      const mentionNotifications = workNoteMentionRecipients(workNotes, users, assignmentGroups)
        .filter((recipient) => recipient.id !== currentUserRecord?.id)
        .map((recipient) => ({ id: `incident-mention-${incident.id}-${Date.now()}-${recipient.id}`, type: 'work-note-mention', title: `${currentUser.name || currentUser.email} mentioned you`, incidentId: incident.id, workNotes, recipientUserId: recipient.id, recipientName: recipient.name, readByUserIds: [], createdAt: new Date().toISOString() }))
      const auditLog = [...(incident.auditLog || []), {
        id: `${Date.now()}-${Math.random()}`,
        assignedGroup: incident.assignmentGroup || incident.group || '',
        updatedBy: currentUser.name || currentUser.email,
        updatedAt: new Date().toISOString(),
        changes: [{ field: 'Work notes', previous: '', next: workNotes }],
      }]
      try {
        await onSave({ workNotes, mentionNotifications, auditLog })
        void logIncidentEmails(incident, 'On work note update', workNotes, currentUser.name || currentUser.email).catch(() => {})
        initialForm.current = { ...initialForm.current, workNotes: '' }
        setForm((current) => ({ ...current, workNotes: '' }))
        setSaved(true)
        onCancel()
        return true
      } catch (error) {
        setSaveError(`Changes were not saved: ${error.message}`)
        return false
      }
    }
    const advisoryRepairPathSelected = initialForm.current.status === 'Advisory Group Review'
      && nextForm.repairExecution !== initialForm.current.repairExecution
    if (advisoryRepairPathSelected && !nextForm.workNotes.trim()) {
      setSaveError('Enter work notes before saving the selected repair execution path.')
      setActiveTab('Notes')
      window.requestAnimationFrame(() => workNotesInput.current?.focus())
      return false
    }
    if (initialForm.current.status === 'Advisory Group Review' && nextForm.repairExecution === 'Repair at Site - TASL' && !nextForm.assignmentGroup) {
      setSaveError('Select an Assignment Group before saving Repair at Site - TASL.')
      return false
    }
    if (nextForm.status === 'Advisory Group Review' && nextForm.assignedTo && !groupMemberNames(assignmentGroups, users, nextForm.assignmentGroup).includes(nextForm.assignedTo)) {
      setSaveError('Assigned To must be an active member of the current Advisory Group.')
      return false
    }
    const approvedReplacementParts = replacementDraft.partReplacementRequired && replacementApprovalApproved
      ? replacementDraft.replacementParts.map((part) => ({ ...part, newSerialNumber: part.newSerialNumber.trim() }))
      : []
    if (approvedReplacementParts.some((part) => !part.newSerialNumber)) {
      setSaveError('Provide a new serial number for every approved replacement part before saving.')
      return false
    }
    const normalizedReplacementSerial = (value) => String(value).trim().toUpperCase()
    const duplicateRequestSerial = approvedReplacementParts.find((part, index) => approvedReplacementParts.some((other, otherIndex) => otherIndex !== index && normalizedReplacementSerial(other.newSerialNumber) === normalizedReplacementSerial(part.newSerialNumber)))
    if (duplicateRequestSerial) {
      setSaveError(`Material serial number ${duplicateRequestSerial.newSerialNumber} is selected more than once in this replacement request.`)
      return false
    }
    const existingSerialCollision = approvedReplacementParts.map((part) => {
      const component = componentsByKey.get(part.componentKey)
      const matchingProduct = products.find((product) => normalizedReplacementSerial(product.material_serial_number) === normalizedReplacementSerial(part.newSerialNumber)
        && !(product.product_serial_number === nextForm.serialNumber && product.part_number === component?.part_number && product.subsystems === component?.subsystem))
      return matchingProduct ? { part, matchingProduct } : null
    }).find(Boolean)
    if (existingSerialCollision) {
      const { part, matchingProduct } = existingSerialCollision
      setSaveError(`Material serial number ${part.newSerialNumber} is already assigned to ${matchingProduct.product_serial_number} / ${matchingProduct.material_description || matchingProduct.part_number}. Enter a unique serial number.`)
      return false
    }
    const values = {
      title: nextForm.shortDescription, description: nextForm.description, customer: nextForm.customer, contract: nextForm.contract, requestor: nextForm.requestor, contact: nextForm.contact, occurrencePhase: nextForm.occurrencePhase, priority: nextForm.priority, group: nextForm.assignmentGroup, assignmentGroup: nextForm.assignmentGroup, assignedTo: nextForm.assignedTo, attachments: nextForm.attachments, repairExecution: nextForm.repairExecution, status: nextForm.status, stage: nextForm.status, serialNumber: nextForm.serialNumber, system: nextForm.system, category: nextForm.category, subsystem: nextForm.subsystem, component: nextForm.component, materialSerialNumber: nextForm.materialSerialNumber, componentSerialNumbers: nextForm.componentSerialNumbers, warranty: nextForm.warranty, lastServiced: nextForm.lastServiced, workNotes: nextForm.workNotes, repairCompleted: nextForm.repairCompleted, resolutionDetails: nextForm.resolutionDetails, groupApproval: nextForm.groupApproval, postRepairQcDecision: nextForm.postRepairQcDecision, postRepairQcReturnTarget: nextForm.postRepairQcReturnTarget, postRepairReviewStage: nextForm.postRepairReviewStage, postRepairReturnStatus: nextForm.postRepairReturnStatus, postRepairReturnAssignmentGroup: nextForm.postRepairReturnAssignmentGroup, postRepairReturnAssignee: nextForm.postRepairReturnAssignee, postRepairDissatisfactionReason: nextForm.postRepairDissatisfactionReason, customerFeedback: nextForm.customerFeedback, qualityCheckStatus: nextForm.qualityCheckStatus, customerFeedbackRemarks: nextForm.customerFeedbackRemarks, partReplacementRequired: replacementDraft.partReplacementRequired, replacementParts: replacementDraft.replacementParts, replacementSource: replacementDraft.replacementSource, taslRequestReason: replacementDraft.taslRequestReason.trim(),
    }
    values.customerFeedbackItems = nextForm.customerFeedbackItems || feedbackItems
    const labels = { title: 'Short description', description: 'Description', customer: 'Customer', contract: 'Customer contract', requestor: 'Requestor', contact: 'Requestor contact', occurrencePhase: 'Occurrence phase', priority: 'Priority', assignmentGroup: 'Assigned group', assignedTo: 'Assigned to', repairExecution: 'Repair execution', status: 'Status', serialNumber: 'Product serial number', system: 'System type', category: 'Product category', subsystem: 'Sub-system', component: 'Component', materialSerialNumber: 'Material serial number', warranty: 'Warranty status', lastServiced: 'Last serviced on', workNotes: 'Work notes', repairCompleted: 'Repair completed', resolutionDetails: 'Resolution notes', groupApproval: 'Group approval', postRepairQcDecision: 'Post Repair QC decision', postRepairQcReturnTarget: 'Post Repair QC return target', postRepairReviewStage: 'Post Repair review stage', postRepairReturnStatus: 'Post Repair return status', postRepairReturnAssignmentGroup: 'Post Repair return assignment group', postRepairReturnAssignee: 'Post Repair return assignee', postRepairDissatisfactionReason: 'Post Repair dissatisfaction reason', customerFeedback: 'Customer Feedback', qualityCheckStatus: 'Quality Check Status', customerFeedbackRemarks: 'Customer Feedback Remarks', attachments: 'Attachments', replacementSource: 'Replacement source', taslRequestReason: 'Request from TASL reason', childIncidentIds: 'Child incidents' }
    labels.customerFeedbackItems = 'Customer / Quality Feedback'
    const previousValues = { ...initialForm.current, title: initialForm.current.shortDescription, group: initialForm.current.assignmentGroup, assignmentGroup: initialForm.current.assignmentGroup }
    const changes = Object.entries(values)
      .filter(([key]) => !['group', 'stage', 'componentSerialNumbers'].includes(key))
      .filter(([key, value]) => JSON.stringify(previousValues[key] ?? '') !== JSON.stringify(value ?? ''))
      .map(([key, value]) => ({ field: labels[key], previous: previousValues[key] ?? '', next: value ?? '' }))
    const changedComponentSerialNumbers = Object.entries(nextForm.componentSerialNumbers || {})
      .filter(([key, value]) => value !== (initialForm.current.componentSerialNumbers || {})[key])
    const componentSerialChanges = changedComponentSerialNumbers
      .map(([key, value]) => {
        const component = componentsByKey.get(key)
        const previous = (initialForm.current.componentSerialNumbers || {})[key] ?? component?.materialSerialNumber ?? 'Not Applicable'
        return { field: `Component serial number: ${component?.materialDescription || key}`, previous, next: value || 'Not Applicable' }
      })
    changes.push(...componentSerialChanges)
    const componentProductUpdates = changedComponentSerialNumbers.map(([key, value]) => {
      const component = componentsByKey.get(key)
      return component ? { productSerialNumber: nextForm.serialNumber, partNumber: component.part_number, subsystem: component.subsystem, next: value || 'Not Applicable' } : null
    }).filter(Boolean)
    const replacementProductUpdates = replacementDraft.partReplacementRequired && replacementApprovalApproved
      ? replacementDraft.replacementParts.map((part) => {
        const component = componentsByKey.get(part.componentKey)
        const next = part.newSerialNumber.trim()
        if (!component || !next || next === currentSerialForComponent(component)) return null
        changes.push({ field: `Replacement serial number: ${component.materialDescription}`, previous: currentSerialForComponent(component), next })
        return { productSerialNumber: nextForm.serialNumber, partNumber: component.part_number, subsystem: component.subsystem, componentKey: part.componentKey, next, replacement: true }
      }).filter(Boolean)
      : []
    componentProductUpdates.push(...replacementProductUpdates)
    replacementProductUpdates.forEach((update) => {
      values.componentSerialNumbers = { ...values.componentSerialNumbers, [update.componentKey]: update.next }
    })
    const isMovingToPostRepairAcceptance = nextForm.status === customerAcceptanceStage && form.status !== customerAcceptanceStage
    const existingChildIncidentIds = incident.childIncidentIds || []
    const hasFactoryChild = existingChildIncidentIds.length > 0 || allIncidents.some((entry) => entry.parentIncidentId === incident.id)
    let childIncident
    if (isMovingToPostRepairAcceptance && replacementDraft.replacementSource === 'mrls' && replacementApprovalApproved && replacementSerialsReady && !hasFactoryChild) {
      const childContract = contracts.find((contract) => contract.number === nextForm.contract)
      const childId = nextIncidentId([...allIncidents, incident], childContract, nextForm.customer)
      const childAssignmentGroup = 'Customer Support Management Group'
      const createdAt = new Date().toISOString()
      childIncident = {
        id: childId,
        opened: createdAt,
        title: `Follow-up for ${nextForm.serialNumber || incident.id}`,
        description: `Registered follow-up created from ${incident.id} after MRLS replacement approval.`,
        priority: nextForm.priority,
        state: 'In progress',
        stage: 'Registered',
        status: 'Registered',
        repairExecution: 'Incident Registration',
        group: childAssignmentGroup,
        assignmentGroup: childAssignmentGroup,
        assignedTo: '',
        customer: nextForm.customer,
        contract: nextForm.contract,
        requestor: nextForm.requestor,
        contact: nextForm.contact,
        occurrencePhase: nextForm.occurrencePhase,
        serialNumber: nextForm.serialNumber,
        system: nextForm.system,
        category: nextForm.category,
        subsystem: nextForm.subsystem,
        component: nextForm.component,
        materialSerialNumber: nextForm.materialSerialNumber,
        componentSerialNumbers: nextForm.componentSerialNumbers,
        warranty: nextForm.warranty,
        lastServiced: nextForm.lastServiced,
        attachments: nextForm.attachments,
        parentIncidentId: incident.id,
        replacementSource: 'mrls',
        replacementParts: replacementDraft.replacementParts,
        auditLog: [{
          id: `factory-child-${Date.now()}-${Math.random()}`,
          assignedGroup: childAssignmentGroup,
          updatedBy: currentUser.name || currentUser.email,
          updatedAt: createdAt,
          changes: [{ field: 'Parent incident', previous: '', next: incident.id }, { field: 'Creation source', previous: '', next: 'Approved MRLS replacement follow-up' }],
        }],
      }
      values.childIncidentIds = [...existingChildIncidentIds, childId]
    }
    const auditLog = [...(incident.auditLog || [])]
    if (changes.length) auditLog.push({ id: `${Date.now()}-${Math.random()}`, assignedGroup: nextForm.assignmentGroup, updatedBy: currentUser.name || currentUser.email, updatedAt: new Date().toISOString(), changes })
    if (childIncident) auditLog.push({
      id: `factory-child-link-${Date.now()}-${Math.random()}`,
      assignedGroup: nextForm.assignmentGroup,
      updatedBy: currentUser.name || currentUser.email,
      updatedAt: new Date().toISOString(),
      changes: [{ field: 'Factory child incident', previous: '', next: childIncident.id }],
    })
    auditLog.push(...journalEntries)
    setSaveError('')
    try {
      const mentionNotifications = workNoteMentionRecipients(nextForm.workNotes, users, assignmentGroups)
        .filter((recipient) => recipient.id !== currentUserRecord?.id)
        .map((recipient) => ({ id: `incident-mention-${incident.id}-${Date.now()}-${recipient.id}`, type: 'work-note-mention', title: `${currentUser.name || currentUser.email} mentioned you`, incidentId: incident.id, workNotes: nextForm.workNotes, recipientUserId: recipient.id, recipientName: recipient.name, readByUserIds: [], createdAt: new Date().toISOString() }))
      const notifications = [...mentionNotifications, ...additionalNotifications.filter((notification) => !mentionNotifications.some((mention) => mention.recipientUserId === notification.recipientUserId))]
      await onSave({ ...values, childIncident, componentProductUpdates, mentionNotifications: notifications, auditLog })
      if (nextForm.workNotes.trim()) void logIncidentEmails({ ...incident, ...values }, 'On work note update', nextForm.workNotes, currentUser.name || currentUser.email).catch(() => {})
      initialForm.current = { ...nextForm, workNotes: '' }
      setForm((current) => ({ ...current, workNotes: '' }))
      setSaved(true)
      onCancel()
      return true
    } catch (error) {
      setSaveError(`Changes were not saved: ${error.message}`)
      return false
    }
  }
  const openStageTransition = () => {
    if (isRepairExecution && !form.repairCompleted && !form.workNotes.trim()) {
      setSaveError(`Work Notes are required before moving an incident from ${form.status} to ${nextStage?.status || 'the next stage'}.`)
      setActiveTab('Notes')
      window.requestAnimationFrame(() => workNotesInput.current?.focus())
      return
    }
    setSaveError('')
    setManualNextAssignmentGroup(nextStage?.retainsExistingAssignment ? form.assignmentGroup : nextStage?.assignmentGroup || '')
    setStageConfirmationOpen(true)
  }
  const moveToNextStage = async () => {
    const retainsExistingAssignment = Boolean(nextStage?.retainsExistingAssignment)
    const nextAssignmentGroup = nextStage?.assignmentGroup || (retainsExistingAssignment ? form.assignmentGroup : manualNextAssignmentGroup)
    if (!nextStage || !nextAssignmentGroup) return
    const approvalGroup = assignmentGroups.find((group) => group.name === nextAssignmentGroup)
    const approvalMembers = approvalGroup ? [...new Set([
      ...groupMemberNames(assignmentGroups, users, approvalGroup.name),
      ...users.filter((user) => user.status === 'Active' && user.name === approvalGroup.manager).map((user) => user.name),
    ])] : []
    const groupApproval = isPostRepairQualityStage ? {
      id: `group-approval-${incident.id}-${Date.now()}`,
      approvalType: 'pre-dispatch',
      status: 'Pending',
      assignmentGroup: nextAssignmentGroup,
      requestedAt: new Date().toISOString(),
      requestedBy: currentUser.name || currentUser.email,
      members: approvalMembers.map((name) => ({ name, status: 'Pending' })),
    } : form.groupApproval
    const assignedGroup = isPostRepairQualityStage ? groupApproval.assignmentGroup : nextAssignmentGroup
    const postRepairQcReturnTarget = /^post repair (quality (check|review)|qc|review|acceptance(?: by customer)?)$/i.test(nextStage.status.trim())
      ? { status: form.status, assignmentGroup: form.assignmentGroup, assignedTo: form.assignedTo }
      : form.postRepairQcReturnTarget
    const nextForm = { ...form, status: nextStage.status, assignmentGroup: assignedGroup, assignedTo: retainsExistingAssignment ? form.assignedTo : '', groupApproval, postRepairQcDecision: isPostRepairAcceptance ? form.postRepairQcDecision : '', postRepairQcReturnTarget, qualityCheckStatus: retainsExistingAssignment ? (form.qualityCheckStatus || 'Open') : form.qualityCheckStatus }
    const approvalNotifications = groupApproval?.approvalType === 'pre-dispatch'
      ? approvalGroupNotifications({ ...incident, ...nextForm }, groupApproval, assignmentGroups, users)
      : []
    if (await saveChanges(nextForm, [], approvalNotifications)) {
      if (groupApproval?.approvalType === 'pre-dispatch') void logIncidentEmails({ ...incident, ...nextForm }, 'On approval required', '', currentUser.name || currentUser.email).catch(() => {})
      setForm({ ...nextForm, workNotes: '' })
      setManualNextAssignmentGroup('')
      setStageConfirmationOpen(false)
    }
  }
  const approveGroupRequest = async (reason) => {
    if (!canApproveGroupRequest) return
    const approvedAt = new Date().toISOString()
    const nextForm = {
      ...form,
      ...(nextStage ? {
        status: nextStage.status,
        assignmentGroup: nextStage.assignmentGroup || form.assignmentGroup,
        assignedTo: '',
      } : {}),
      groupApproval: {
        ...form.groupApproval,
        status: 'Approved',
        approvedBy: currentUserName,
        approvedAt,
        decision: 'Approved',
        decisionBy: currentUserName,
        decisionAt: approvedAt,
        decisionReason: reason,
        members: form.groupApproval.members.map((member) => member.name === currentUserName
          ? { ...member, status: 'Approved', decisionReason: reason, completedAt: approvedAt }
          : member.status === 'Pending' ? { ...member, status: 'Cancelled', completedAt: approvedAt } : member),
      },
    }
    await saveChanges(nextForm, [{
      id: `approval-${Date.now()}-${Math.random()}`,
      assignedGroup: form.groupApproval.assignmentGroup || form.assignmentGroup,
      updatedBy: currentUserName,
      updatedAt: approvedAt,
      changes: [
        { field: 'Approval request', previous: 'Pending', next: form.groupApproval.id },
        { field: 'Approval decision', previous: 'Pending', next: 'Approved' },
        { field: 'Approval reason', previous: '', next: reason },
        { field: 'Approval group', previous: '', next: form.groupApproval.assignmentGroup || form.assignmentGroup || '--' },
        ...(nextStage ? [
          { field: 'Status', previous: form.status, next: nextStage.status },
          { field: 'Assigned group', previous: form.assignmentGroup || '--', next: nextStage.assignmentGroup || form.assignmentGroup || '--' },
          { field: 'Assigned to', previous: form.assignedTo || '--', next: '--' },
        ] : []),
      ],
    }])
    setApprovalDecisionOpen(false)
    setApprovalDecisionReason('')
  }
  const currentStageAssignmentIsConfigured = Boolean(currentStage?.assignmentGroup)
  const canMoveToNextStage = canEdit && (isRegistered || isRepairExecution)
    && Boolean(form.assignmentGroup)
    && isCurrentGroupMember
    && Boolean(nextStage)
  const movesToPostRepairAcceptance = nextStage?.status === customerAcceptanceStage
  const replacementApprovalReady = !replacementDraft.partReplacementRequired || replacementDraft.replacementSource !== 'mrls'
    || (replacementApprovalApproved && replacementSerialsReady)
  const canAdvanceToNextStage = canMoveToNextStage && (!isRepairWorkInProgress || hasCompletedRepair) && (!isPostRepairAcceptance || (form.postRepairQcDecision === 'Satisfied' && hasCapturedCustomerFeedback)) && !groupApprovalPending
    && (!movesToPostRepairAcceptance || replacementApprovalReady)
  const nextStageActionLabel = nextStage ? `Move to ${nextStage.status}` : ''
  const journalReturnTarget = [...(incident.auditLog || [])].reverse().map((entry) => {
    const changes = entry.changes || []
    const statusChange = changes.find((change) => change.field === 'Status' && change.next === form.status)
    if (!statusChange) return null
    return {
      status: statusChange.previous,
      assignmentGroup: changes.find((change) => change.field === 'Assigned group')?.previous || '',
      assignedTo: changes.find((change) => change.field === 'Assigned to')?.previous || '',
    }
  }).find((target) => target?.status && target.assignmentGroup)
  const postRepairQcReturnTarget = form.postRepairQcReturnTarget || journalReturnTarget
  const returnToPostRepairQcTarget = async () => {
    const target = postRepairQcReturnTarget
    if (!canEdit || form.postRepairQcDecision !== 'Not Satisfied' || !target?.status || !target?.assignmentGroup) return
    const returnedForm = {
      ...form,
      status: target.status,
      assignmentGroup: target.assignmentGroup,
      assignedTo: target.assignedTo || '',
      groupApproval: null,
      postRepairQcReturnTarget: target,
      postRepairReviewStage: form.status,
      postRepairReturnStatus: target.status,
      postRepairReturnAssignmentGroup: target.assignmentGroup,
      postRepairReturnAssignee: target.assignedTo || '',
      postRepairDissatisfactionReason: 'The inspection outcome did not meet the applicable resolution and acceptance guidelines. Review the resolution and complete corrective action before resubmitting for post-repair inspection.',
    }
    const returned = await saveChanges(returnedForm, [{
      id: `post-repair-qc-return-${Date.now()}-${Math.random()}`,
      assignedGroup: target.assignmentGroup,
      updatedBy: currentUser.name || currentUser.email,
      updatedAt: new Date().toISOString(),
      changes: [
        { field: 'Post Repair QC decision', previous: '', next: 'Not Satisfied' },
        { field: 'Status', previous: form.status, next: target.status },
        { field: 'Assigned group', previous: form.assignmentGroup || '--', next: target.assignmentGroup },
        { field: 'Assigned to', previous: form.assignedTo || '--', next: target.assignedTo || '--' },
      ],
    }])
    if (returned) void logIncidentEmails({ ...incident, ...returnedForm }, 'On post-repair dissatisfaction', '', currentUser.name || currentUser.email).catch(() => {})
  }
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm.current)
  const advisoryRepairPathSelected = initialForm.current.status === 'Advisory Group Review'
    && form.repairExecution !== initialForm.current.repairExecution
  const canSave = canEdit
    ? (isRepairWorkInProgress || hasUnsavedChanges) && hasValidSiteTaslRouting && (!advisoryRepairPathSelected || Boolean(form.workNotes.trim()))
    : canAddWorkNotes && Boolean(form.workNotes.trim())

  return <form className={`incident-detail-page ${canEdit ? '' : 'view-only'} ${canAddWorkNotes ? 'can-add-work-notes' : ''}`} onSubmit={async (event) => { event.preventDefault(); if (canSave) await saveChanges() }}>
    <header className="incident-form-header"><div><button type="button" className="incident-back-button" onClick={onCancel}><ArrowLeft size={15} /> Incidents</button><p className="incident-detail-kicker">Incident{!canEdit && ' · View only'}</p><h1>{incident.id}</h1></div><div className="incident-form-actions"><button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button>{canMoveToNextStage && <button type="button" className="incident-next-stage-button" disabled={!canAdvanceToNextStage} title={isRepairWorkInProgress && !hasCompletedRepair ? 'Complete Repair Completed and Resolution Notes before progressing.' : undefined} onClick={openStageTransition}>{nextStageActionLabel}</button>}<button type="submit" className="incident-submit-button" disabled={!canSave}>Save</button></div></header>
    <section className="incident-detail-sheet">
      <WorkflowProgress stages={stages} currentStatus={form.status} />
      <div className="incident-detail-content">
        <section className="incident-detail-section"><header className="incident-section-header"><h2>Incident details</h2><button type="button" className="process-steps-link" onClick={() => setProcessStepsOpen(true)}><ListChecks size={14} /> Process steps</button></header><div className="incident-form-grid"><Field label="Incident number"><div className="incident-auto-field">{incident.id}</div></Field><Field label="Created on"><div className="incident-auto-field">{openedDateLabel(incident.opened)}</div></Field><Field label="Repair execution"><SelectField value={form.repairExecution} onChange={selectRepairExecution} options={repairExecutionOptions} placeholder="Select repair execution" disabled={(isRegistered || repairExecutionDetailsReadOnly) && !isAdvisoryReview} /></Field><Field label="Status"><SelectField value={form.status} onChange={(value) => update('status', value)} options={stages.map((stage) => stage.status)} placeholder="Select status" disabled={isRegistered || repairExecutionDetailsReadOnly} /></Field></div></section>
        <fieldset disabled={repairExecutionDetailsReadOnly}><section className="incident-detail-section"><h2>Customer</h2><div className="incident-form-grid"><Field label="Customer name"><SelectField value={form.customer} onChange={selectCustomer} options={customers.map((customer) => customer.name)} placeholder="Select customer" /></Field><Field label="Customer contract"><SelectField value={form.contract} onChange={selectContract} options={selectedCustomer?.contracts.map((contract) => contract.number) || []} placeholder={form.customer ? 'Select customer contract' : 'Select customer first'} disabled={!form.customer || repairExecutionDetailsReadOnly} /></Field><Field label="Requestor name"><RequestorSelect customer={selectedCustomer} value={form.requestor} onChange={selectRequestor} /></Field><Field label="Requestor contact"><input value={form.contact} readOnly placeholder="Auto-filled from requestor" /></Field></div></section></fieldset>
        <section className="incident-detail-section"><h2>Incident classification</h2><div className="incident-form-grid"><Field label="Occurrence phase"><SelectField value={form.occurrencePhase} onChange={(value) => setForm((current) => ({ ...current, occurrencePhase: value, priority: value === 'In Flight' ? 'High' : current.priority }))} options={['In Flight', 'Ground Operations']} placeholder="Select occurrence phase" disabled={repairExecutionDetailsReadOnly} /></Field>{field('Priority', 'priority', 'Select priority', ['Critical', 'High', 'Medium', 'Low'])}<Field label="Assignment group" required={!currentStageAssignmentIsConfigured || requiresSiteTaslRouting || isSiteTaslResourceAlignment}><SelectField value={form.assignmentGroup} onChange={selectAssignmentGroup} options={assignmentGroupOptions} placeholder="Select assignment group" /></Field><Field label="Assigned to" required={false}><SelectField value={form.assignedTo} onChange={(value) => update('assignedTo', value)} options={assignedToOptions} placeholder={form.assignmentGroup ? 'Select group member' : 'Select assignment group first'} disabled={assignedToLockedForAdvisory} /><button type="button" className="compact-button secondary" disabled={assignedToLockedForAdvisory || !canAssignToMe || form.assignedTo === currentUserName} onClick={() => update('assignedTo', currentUserName)}>Assign to me</button></Field></div></section>
          <fieldset disabled={repairExecutionDetailsReadOnly}><section className="incident-detail-section"><h2>Product details</h2><div className="incident-form-grid"><Field label="Product category"><SelectField value={form.category} onChange={selectProductCategory} options={productCategoryOptions} placeholder={form.contract ? 'Select product category' : 'Select customer contract first'} disabled={!form.contract || repairExecutionDetailsReadOnly} /></Field><SerialNumberReference records={eligibleSerialNumberRecords} value={form.serialNumber} onChange={selectSerialNumber} disabled={repairExecutionDetailsReadOnly || !form.customer || !form.category || !form.contract} placeholder={form.category ? 'Search serial number assigned to this contract and product category' : 'Select product category first'} hint={form.category ? `${eligibleSerialNumberRecords.length} serial number${eligibleSerialNumberRecords.length === 1 ? '' : 's'} assigned to this customer contract and product category` : 'Select product category to view eligible serial numbers'} /><LookupField label="System type" value={form.system} /><SubsystemReference serialNumber={form.serialNumber} value={form.subsystem} records={serialNumberRecords} onChange={selectSubsystem} /><Field label="Component"><SelectField value={form.component} onChange={selectComponent} options={components} placeholder={form.subsystem ? 'Select material description' : 'Select sub-system first'} /></Field><Field label="Material serial number"><input value={form.materialSerialNumber} onChange={(event) => update('materialSerialNumber', event.target.value)} placeholder="Not Applicable" /></Field></div></section></fieldset>
        <section className="incident-detail-section"><h2>Service history</h2><div className="incident-form-grid">{field('Warranty status', 'warranty', 'Active/Expired/Expiring Soon')}{field('Last serviced on', 'lastServiced', 'YYYY-MM-DD')}</div></section>
        <section className="incident-detail-section"><h2>Issue description</h2><fieldset disabled={repairExecutionDetailsReadOnly}><div className="incident-form-grid">{field('Short description', 'shortDescription', 'Short description')}<Field label="Description"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Description" rows="4" /></Field></div></fieldset><AttachmentSection attachments={form.attachments} onChange={(attachments) => update('attachments', attachments)} cameraCapture={canEdit} /></section>
        <section className="incident-work-area"><div className="incident-work-tabs">{['Notes', 'Components', 'Resolution'].map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{activeTab === 'Notes' && <div className="incident-work-panel"><WorkNotesField value={form.workNotes} onChange={(value) => update('workNotes', value)} users={users} groups={assignmentGroups} inputRef={workNotesInput} />{isPreDispatchApproval && form.groupApproval && <section className="group-approval-panel"><h3>{form.groupApproval.assignmentGroup} approval</h3><p>{form.groupApproval.status === 'Approved' ? `Approved by ${form.groupApproval.approvedBy}.` : `Pending approval from ${form.groupApproval.assignmentGroup} (${form.groupApproval.members.filter((member) => member.status === 'Pending').length} member${form.groupApproval.members.filter((member) => member.status === 'Pending').length === 1 ? '' : 's'}).`}</p>{canApproveGroupRequest && <button type="button" className="incident-next-stage-button" onClick={() => setApprovalDecisionOpen(true)}>Approve group request</button>}</section>}<details><summary>Record journal</summary>{(incident.auditLog || []).length ? <ol className="incident-journal">{[...incident.auditLog].reverse().map((entry) => <li key={entry.id}><article><header><div><strong>{entry.updatedBy || 'System'}</strong><span>Updated record</span></div><time>{openedDateLabel(entry.updatedAt)}</time></header><dl><div><dt>Assigned group</dt><dd>{entry.assignedGroup || '--'}</dd></div>{entry.changes.map((change, index) => <div key={`${change.field}-${index}`}><dt>{change.field}</dt><dd><AuditChangeValue change={change} /></dd></div>)}</dl></article></li>)}</ol> : <p>No journal entries have been recorded.</p>}</details></div>}{activeTab === 'Components' && <IncidentComponentsTable components={incidentComponents} componentSerialNumbers={form.componentSerialNumbers} onChange={updateComponentSerialNumber} serialNumber={form.serialNumber} subsystem={form.subsystem} readOnly />}{activeTab === 'Resolution' && <div className="incident-work-panel resolution-work-panel">{hasResolutionDetails && <section className={`resolution-completion-card ${form.repairCompleted ? 'is-complete' : ''}`}><header><div><span className="resolution-card-icon"><Wrench size={15} /></span><div><h3>Repair completion</h3><p>Confirm that corrective work and functional verification are complete.</p></div></div><span className="resolution-state">{form.repairCompleted ? 'Complete' : 'Required'}</span></header><label className="repair-completed-check"><input type="checkbox" disabled={!isRepairWorkInProgress} checked={form.repairCompleted} onChange={(event) => update('repairCompleted', event.target.checked)} /><span><strong>Repair completed</strong><small>All repair actions and checks have been completed.</small></span></label></section>}{isPostRepairQuality && <PostRepairQcPanel canEdit={canEdit} decision={form.postRepairQcDecision} returnTarget={postRepairQcReturnTarget} onDecision={(decision) => update('postRepairQcDecision', decision)} onReturn={() => void returnToPostRepairQcTarget()} />}{isSiteTaslWorkInProgress && <ReplacementPartsPanel enabled={replacementDraft.partReplacementRequired} onToggle={togglePartReplacementRequired} replacementSource={replacementDraft.replacementSource} taslRequestReason={replacementDraft.taslRequestReason} onSourceChange={selectReplacementSource} onTaslRequestReasonChange={updateTaslRequestReason} parts={replacementDraft.replacementParts} components={incidentComponents} approval={replacementApproval} onAdd={addReplacementPart} onRemove={removeReplacementPart} onChange={updateReplacementPart} onSubmit={() => { setReplacementReasonError(''); setReplacementReasonOpen(true) }} canSubmit={canSubmitReplacementApproval} /> }<section className="resolution-notes-panel"><header><div><h3>Resolution &amp; verification</h3><p>Record the work performed, test results, and service outcome.</p></div>{isRepairWorkInProgress && <span className={`resolution-state ${hasCompletedRepair ? 'is-complete' : ''}`}>{hasCompletedRepair ? 'Ready to progress' : 'Action needed'}</span>}</header><Field label="Resolution notes" required={isRepairWorkInProgress && form.repairCompleted}><textarea disabled={repairExecutionDetailsReadOnly && !isRepairWorkInProgress} value={form.resolutionDetails} onChange={(event) => update('resolutionDetails', event.target.value)} placeholder="Document the resolution and verification details..." rows="4" /></Field>{isRepairWorkInProgress && <p className={`resolution-readiness ${hasCompletedRepair ? 'is-complete' : ''}`}>{hasCompletedRepair ? 'Completion requirements met. Record work notes, then move this incident to the next stage.' : 'Select Repair completed and provide resolution notes before moving to the next stage.'}</p>}</section></div>}</section>
      </div>
      {showPostRepairAcceptanceRecords && <section className="incident-work-area customer-quality-feedback-area"><div className="incident-work-tabs"><button type="button" className="active">Customer / Quality Feedback</button></div><div className="incident-work-panel"><PostRepairQcPanel embedded canEdit={canEdit} decision={effectivePostRepairDecision} returnTarget={postRepairQcReturnTarget} feedbackItems={feedbackItems} feedbackCaptured={hasCapturedCustomerFeedback} feedbackCaptured={hasCapturedCustomerFeedback} acceptanceHistory={postRepairAcceptanceHistory} onFeedbackChange={updateFeedbackItem} onFeedbackAdd={addFeedbackItem} onFeedbackRemove={removeFeedbackItem} onDecision={(decision) => update('postRepairQcDecision', decision)} onReturn={() => void returnToPostRepairQcTarget()} /></div></section>}
    </section>
    <footer className="incident-form-footer">{saved && <span className="incident-saved-message">Changes saved</span>}{saveError && <span className="incident-submit-error">{saveError}</span>}<button type="button" className="incident-cancel-button" onClick={onCancel}>Cancel</button>{canMoveToNextStage && <button type="button" className="incident-next-stage-button" disabled={!canAdvanceToNextStage} title={isRepairWorkInProgress && !hasCompletedRepair ? 'Complete Repair Completed and Resolution Notes before progressing.' : undefined} onClick={openStageTransition}>{nextStageActionLabel}</button>}<button type="submit" className="incident-submit-button" disabled={!canSave}>Save</button></footer>
    {replacementReasonOpen && <div className="stage-confirmation-backdrop"><section className="stage-confirmation-dialog" role="dialog" aria-modal="true" aria-label="Reason for part replacement"><h2>Reason for Part Replacement</h2><label className="approval-decision-reason"><span>Reason for Part Replacement <em>*</em></span><textarea autoFocus value={replacementReason} onChange={(event) => { setReplacementReason(event.target.value); setReplacementReasonError("") }} placeholder="Explain why this part needs replacement..." rows="4" /></label>{replacementReasonError && <p className="incident-submit-error">{replacementReasonError}</p>}<footer><button type="button" className="incident-cancel-button" onClick={() => { setReplacementReasonOpen(false); setReplacementReason(""); setReplacementReasonError("") }}>Cancel</button><button type="button" className="incident-next-stage-button" onClick={() => { if (!replacementReason.trim()) { setReplacementReasonError("Please provide a reason for part replacement."); return } void submitReplacementApproval(replacementReason) }}>Send for Approval</button></footer></section></div>}
    {approvalDecisionOpen && <div className="stage-confirmation-backdrop"><section className="stage-confirmation-dialog" role="dialog" aria-modal="true" aria-label="Approve group request"><h2>Approval comments</h2><p>Enter comments for this decision. They will be recorded in the incident journal.</p><label className="approval-decision-reason"><span>Approval comments</span><textarea autoFocus value={approvalDecisionReason} onChange={(event) => setApprovalDecisionReason(event.target.value)} placeholder="Why is this request being approved?" rows="4" /></label><footer><button type="button" className="incident-cancel-button" onClick={() => { setApprovalDecisionOpen(false); setApprovalDecisionReason('') }}>Cancel</button><button type="button" className="incident-next-stage-button" disabled={!approvalDecisionReason.trim()} onClick={() => approveGroupRequest(approvalDecisionReason.trim())}>Approve</button></footer></section></div>}
    {processStepsOpen && <div className="process-steps-backdrop"><section className="process-steps-dialog" role="dialog" aria-modal="true" aria-label="Process steps"><header><div><p>{form.repairExecution}</p><h2>Process steps</h2><span>Follow the guidance for each stage of this incident.</span></div><button type="button" onClick={() => setProcessStepsOpen(false)} aria-label="Close process steps"><X size={17} /></button></header><ol>{stages.map((stage) => <li key={stage.id} className={stage.status === form.status ? 'current' : ''}><span>{stage.order}</span><div><strong>{stage.status}</strong><p>{guidanceForStage(stage.status)}</p></div>{stage.status === form.status && <b>Current</b>}</li>)}</ol><footer><button type="button" className="incident-cancel-button" onClick={() => setProcessStepsOpen(false)}>Close</button></footer></section></div>}
    {stageConfirmationOpen && nextStage && <div className="stage-confirmation-backdrop"><section className="stage-confirmation-dialog" role="dialog" aria-modal="true" aria-label="Confirm move to next stage"><h2>{nextStageActionLabel}?</h2>{nextStage.status === 'Post Repair Acceptance' ? <p>This will set the status to Post Repair Acceptance and retain the existing assignment team and assignee.</p> : nextStage.assignmentGroup ? <p>This will set the status to {nextStage.status} and assign the incident to {nextStage.assignmentGroup}.</p> : <><p>Select the Assignment Group required to continue to {nextStage.status}. The current assignee will be cleared.</p><Field label="Assignment group" required><SelectField value={manualNextAssignmentGroup} onChange={setManualNextAssignmentGroup} options={assignmentGroupOptions} placeholder="Select assignment group" /></Field></>}<footer><button type="button" className="incident-cancel-button" onClick={() => { setManualNextAssignmentGroup(''); setStageConfirmationOpen(false) }}>Cancel</button><button type="button" className="incident-next-stage-button" disabled={nextStage.status !== 'Post Repair Acceptance' && !nextStage.assignmentGroup && !manualNextAssignmentGroup} onClick={moveToNextStage}>Confirm</button></footer></section></div>}
  </form>
}
