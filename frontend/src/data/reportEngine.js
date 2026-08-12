export const reportCatalog = [
  { key: 'Incidents', label: 'Incidents', description: 'Service issues, state, priority, assignment, aging, and resolution data', roles: ['Administrator', 'Manager', 'Service engineer'], fields: ['Number', 'Short description', 'Customer', 'Priority', 'State', 'Assignment group', 'Opened', 'Age days', 'Age bucket', 'Resolved'] },
  { key: 'Customers', label: 'Customers', description: 'Customer accounts, contacts, operating sites, and service profile', roles: ['Administrator', 'Manager'], fields: ['Customer name', 'Service', 'Primary contact', 'Site', 'Status', 'Created'] },
  { key: 'Contracts', label: 'Contracts', description: 'Coverage, entitlement, warranty, and contract dates', roles: ['Administrator', 'Manager'], fields: ['Contract number', 'Customer', 'Coverage type', 'Status', 'Start date', 'End date'] },
  { key: 'Products', label: 'Product master', description: 'Configured systems, assemblies, serial numbers, and materials', roles: ['Administrator', 'Manager', 'Service engineer'], fields: ['Product serial', 'System', 'Assembly', 'Sub-system', 'Status'] },
  { key: 'Knowledge', label: 'Knowledge records', description: 'Controlled documents, versions, approvals, and review status', roles: ['Administrator', 'Manager', 'Service engineer'], fields: ['Document code', 'Title', 'Category', 'Version', 'Status', 'Owner', 'Updated'] },
  { key: 'Users', label: 'Users', description: 'User access, roles, assignment groups, and authentication status', roles: ['Administrator'], fields: ['Name', 'Role', 'Assignment group', 'Status', 'Last login', 'Created'] },
  { key: 'Assignment groups', label: 'Assignment groups', description: 'Operational support teams, managers, and membership', roles: ['Administrator', 'Manager'], fields: ['Group name', 'Manager', 'Members', 'Status', 'Updated'] },
  { key: 'Subcontracts', label: 'Subcontracts', description: 'AMC and CMC coverage, linked contracts, customers, and validity', roles: ['Administrator', 'Manager'], fields: ['Subcontract number', 'Customer', 'Main contract', 'Type', 'Status', 'Valid from', 'Valid to'] },
  { key: 'Mail correspondence', label: 'Mail correspondence', description: 'Incoming and outgoing letters, ownership, priority, and due dates', roles: ['Administrator', 'Manager', 'Service engineer'], fields: ['Reference number', 'Dated', 'Subject', 'Priority', 'Assigned to', 'Label', 'Status', 'Due date'] },
  { key: 'Calendar events', label: 'Calendar events', description: 'Operational events, notes, owners, and scheduled dates', roles: ['Administrator', 'Manager', 'Service engineer'], fields: ['Date', 'Note', 'Created by', 'Attachments'] },
  { key: 'Repair executions', label: 'Repair executions', description: 'Configured repair execution paths and workflow ownership', roles: ['Administrator', 'Manager'], fields: ['Name', 'Description', 'Status'] },
  { key: 'Process configurations', label: 'Process configurations', description: 'Repair workflow process definitions and configured stages', roles: ['Administrator'], fields: ['Process', 'Stage count', 'Status'] },
  { key: 'Notifications', label: 'Notifications', description: 'Operational notifications, recipients, status, and creation time', roles: ['Administrator', 'Manager'], fields: ['Notification ID', 'Message', 'Recipient', 'Read status', 'Created'] },
]

const productCategoryReportFields = ['Serial number', 'Contract number', 'Customer', 'Delivered on', 'Warranty / coverage', 'Warranty expiry', 'Warranty status', 'Last serviced', 'Service due', 'Service due period']

export const getProductCategoryReportCatalog = (productAssets = []) => [...new Set(productAssets
  .map((asset) => String(asset.category || '').trim())
  .filter(Boolean))]
  .sort((left, right) => left.localeCompare(right))
  .map((category) => ({
    key: `Product category: ${category}`,
    label: category,
    description: `Lifecycle, contract, warranty, and service records for ${category} units`,
    roles: ['Administrator', 'Manager', 'Service engineer'],
    fields: productCategoryReportFields,
  }))

export const reportOperators = ['is', 'is not', 'is one of', 'is not one of', 'contains', 'does not contain', 'starts with', 'ends with', 'is empty', 'is not empty', 'greater than', 'less than', 'on', 'before', 'after']
export const reportTypes = [
  { key: 'table', label: 'List', description: 'Detailed rows and columns' },
  { key: 'bar', label: 'Bar', description: 'Compare categories' },
  { key: 'line', label: 'Trend', description: 'Show change over time' },
  { key: 'pie', label: 'Donut', description: 'Show proportions' },
]

const parseDate = (value) => {
  if (!value || value === '--') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const ageDays = (opened) => {
  const openedDate = parseDate(opened)
  return openedDate ? Math.max(0, Math.floor((Date.now() - openedDate.getTime()) / 86400000)) : 0
}
const ageBucket = (days) => days > 30 ? 'More than 1 month' : days > 7 ? 'More than 1 week' : 'Up to 1 week'
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1)
const startOfQuarter = (date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1)
const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
const parseAssetDate = (value) => value ? new Date(`${value}T00:00:00`) : null
const assetDateStatus = (value, kind) => {
  const date = parseAssetDate(value)
  if (!date || Number.isNaN(date.getTime())) return 'Not scheduled'
  const today = new Date()
  const currentMonth = startOfMonth(today)
  const nextMonth = addMonths(today, 1)
  const followingMonth = addMonths(today, 2)
  if (kind === 'warranty') {
    if (date < today) return 'Expired'
    if (date < nextMonth) return 'Expiring current month'
    if (date < followingMonth) return 'Expiring next month'
    if (date < addMonths(today, 5)) return 'Expiring in coming 3 months'
    return 'Active beyond 3 months'
  }
  if (date < today) return 'Overdue'
  if (date < nextMonth) return 'Due this month'
  if (date < followingMonth) return 'Due next month'
  if (date < addMonths(startOfQuarter(today), 3)) return 'Due this quarter'
  if (date < addMonths(startOfQuarter(today), 6)) return 'Due next quarter'
  return 'Due later'
}
const serviceDueDate = (lastServiced) => {
  const date = parseAssetDate(lastServiced)
  return date ? addDays(date, 90).toISOString().slice(0, 10) : ''
}

export const createReportRows = ({ customers, incidents, contracts, products, productAssets = [], knowledgeDocuments, users, assignmentGroups, subcontracts = [], mailCorrespondence = [], calendarEvents = [], repairExecutions = [], processes = [], notifications = [] }) => ({
  Incidents: incidents.map((incident) => { const days = ageDays(incident.opened); return { Number: incident.id, 'Short description': incident.title, Customer: incident.customer || '--', Priority: incident.priority, State: incident.state, 'Assignment group': incident.group, Opened: incident.opened, 'Age days': days, 'Age bucket': ageBucket(days), Resolved: ['Resolved', 'Closed'].includes(incident.state) ? incident.opened : '--' } }),
  Customers: customers.map((customer) => ({ 'Customer name': customer.name, Service: customer.primaryContact?.designation || '--', 'Primary contact': customer.primaryContact?.name || '--', Site: customer.primaryContact?.site || '--', Status: 'Active', Created: customer.created || '--' })),
  Contracts: contracts.map((contract) => ({ 'Contract number': contract.number, Customer: contract.customer, 'Coverage type': contract.coverage?.join(', ') || 'No coverage', Status: contract.status, 'Start date': dateLabel(contract.signed), 'End date': dateLabel(contract.expiryDate) })),
  Products: products.map((product) => ({ 'Product serial': product.product_serial_number, System: product.product_category, Assembly: product.route_card_description, 'Sub-system': product.subsystems || '--', Status: 'Active' })),
  ...Object.fromEntries(getProductCategoryReportCatalog(productAssets).map(({ key, label }) => [key, productAssets
    .filter((asset) => asset.category === label)
    .map((asset) => ({
      'Serial number': asset.serialNumber || '--',
      'Contract number': asset.contractNumber || '--',
      Customer: asset.customer || '--',
      'Delivered on': dateLabel(asset.deliveredOn),
      'Warranty / coverage': asset.warranty || '--',
      'Warranty expiry': dateLabel(asset.warrantyExpiry),
      'Warranty status': assetDateStatus(asset.warrantyExpiry, 'warranty'),
      'Last serviced': dateLabel(asset.lastServiced),
      'Service due': dateLabel(serviceDueDate(asset.lastServiced)),
      'Service due period': assetDateStatus(serviceDueDate(asset.lastServiced), 'service'),
    }))])),
  Knowledge: knowledgeDocuments.map((document) => ({ 'Document code': document.code, Title: document.title, Category: document.type, Version: document.version, Status: document.status, Owner: document.owner, Updated: document.updated })),
  Users: users.map((member) => ({ Name: member.name, Role: member.role, 'Assignment group': member.groups, Status: member.status, 'Last login': member.lastLogin, Created: member.created })),
  'Assignment groups': assignmentGroups.map((group) => ({ 'Group name': group.name, Manager: group.manager, Members: String(group.members), Status: group.active ? 'Active' : 'Inactive', Updated: group.updated })),
  Subcontracts: subcontracts.map((subcontract) => ({ 'Subcontract number': subcontract.number || subcontract.id, Customer: subcontract.customer || '--', 'Main contract': subcontract.mainContractNumber || '--', Type: subcontract.type || '--', Status: subcontract.status || '--', 'Valid from': dateLabel(subcontract.validFrom), 'Valid to': dateLabel(subcontract.validTo) })),
  'Mail correspondence': mailCorrespondence.map((mail) => ({ 'Reference number': mail.mailReferenceNumber || '--', Dated: dateLabel(mail.dated), Subject: mail.subject || '--', Priority: mail.priority || '--', 'Assigned to': mail.assignedTo || 'Unassigned', Label: mail.label || '--', Status: mail.status || '--', 'Due date': dateLabel(mail.dueDate) })),
  'Calendar events': calendarEvents.map((event) => ({ Date: dateLabel(event.date || event.createdDate), Note: event.note || '--', 'Created by': event.createdBy || '--', Attachments: String(event.attachments?.length || 0) })),
  'Repair executions': repairExecutions.map((execution) => ({ Name: execution.name || execution.id || '--', Description: execution.description || '--', Status: execution.active === false ? 'Inactive' : 'Active' })),
  'Process configurations': processes.map((process) => ({ Process: process.name || process.repairExecution || process.id || '--', 'Stage count': String(process.stages?.length || 0), Status: process.active === false ? 'Inactive' : 'Active' })),
  Notifications: notifications.map((notification) => ({ 'Notification ID': notification.id || '--', Message: notification.message || notification.title || '--', Recipient: notification.recipientName || notification.recipientUserId || '--', 'Read status': notification.read ? 'Read' : 'Unread', Created: dateLabel(notification.createdAt || notification.created) })),
})

export const matchesReportFilter = (row, filter) => {
  const rawValue = row[filter.field]
  const value = String(rawValue ?? '').toLowerCase()
  const needles = String(filter.value || '').toLowerCase().split('|').map((item) => item.trim()).filter(Boolean)
  const needle = needles[0] || ''
  if (!needle && !['is empty', 'is not empty'].includes(filter.operator)) return true
  if (filter.operator === 'is') return value === needle
  if (filter.operator === 'is not') return value !== needle
  if (filter.operator === 'is one of') return needles.includes(value)
  if (filter.operator === 'is not one of') return !needles.includes(value)
  if (filter.operator === 'contains') return value.includes(needle)
  if (filter.operator === 'does not contain') return !value.includes(needle)
  if (filter.operator === 'starts with') return value.startsWith(needle)
  if (filter.operator === 'ends with') return value.endsWith(needle)
  if (filter.operator === 'is empty') return !value || value === '--'
  if (filter.operator === 'is not empty') return Boolean(value) && value !== '--'
  if (filter.operator === 'greater than') return Number(rawValue) > Number(filter.value)
  if (filter.operator === 'less than') return Number(rawValue) < Number(filter.value)
  const actualDate = parseDate(rawValue)
  const expectedDate = parseDate(filter.value)
  if (!actualDate || !expectedDate) return false
  if (filter.operator === 'on') return actualDate.toDateString() === expectedDate.toDateString()
  if (filter.operator === 'before') return actualDate < expectedDate
  if (filter.operator === 'after') return actualDate > expectedDate
  return true
}

export const runReportDefinition = (definition, rowsBySource) => {
  const rows = (rowsBySource[definition.source] || []).filter((row) => (definition.filters || []).every((filter) => matchesReportFilter(row, filter)))
  if (definition.sortBy) {
    const direction = definition.sortDirection === 'ascending' ? 1 : -1
    rows.sort((left, right) => String(left[definition.sortBy] ?? '').localeCompare(String(right[definition.sortBy] ?? ''), undefined, { numeric: true }) * direction)
  }
  const groupBy = definition.groupBy?.filter(Boolean) || []
  const groups = groupBy.length ? Object.entries(rows.reduce((result, row) => {
    const label = groupBy.map((field) => String(row[field] || 'Unspecified')).join(' / ')
    if (!result[label]) result[label] = { value: 0, values: Object.fromEntries(groupBy.map((field) => [field, String(row[field] || 'Unspecified')])) }
    result[label].value += 1
    return result
  }, {})).map(([label, group]) => ({ label, ...group })).sort((left, right) => right.value - left.value) : []
  return { rows, groups }
}

const sourceFromPrompt = (phrase, allowedCatalog) => {
  const requestedTable = [...allowedCatalog].sort((left, right) => right.key.length - left.key.length).find((table) => {
    const aliases = [table.key, table.label, table.key.replaceAll(' ', ''), table.label.replaceAll(' ', '')]
    return aliases.some((alias) => new RegExp(`\\b${alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(phrase))
  })
  if (requestedTable) return requestedTable.key
  if (/(mail|letter|correspondence)/.test(phrase)) return 'Mail correspondence'
  if (/(calendar|event|meeting|reminder)/.test(phrase)) return 'Calendar events'
  if (/(subcontract|sub-contract|amc|cmc)/.test(phrase)) return 'Subcontracts'
  if (/(repair execution|repair process)/.test(phrase)) return 'Repair executions'
  if (/(process configuration|workflow stage|workflow)/.test(phrase)) return 'Process configurations'
  if (/(notification|alert)/.test(phrase)) return 'Notifications'
  if (/(assignment group|support group|team roster|team membership)/.test(phrase)) return 'Assignment groups'
  if (/(user|login|employee|role)/.test(phrase)) return 'Users'
  if (/(knowledge|manual|bulletin|document|article)/.test(phrase)) return 'Knowledge'
  if (/(contract|coverage|warranty|amc|cmc)/.test(phrase)) return 'Contracts'
  if (/(product|material|inventory|serial|assembly|subsystem)/.test(phrase)) return 'Products'
  if (/(customer|contact|site)/.test(phrase) && !/incident/.test(phrase)) return 'Customers'
  return 'Incidents'
}

const fieldFromPhrase = (phrase, fields) => fields.find((field) => phrase.includes(field.toLowerCase()))
const groupFieldsFromPhrase = (phrase, fields) => {
  const requested = fields.filter((field) => new RegExp(`\\bby\\s+${field.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(phrase))
  if (requested.length) return requested.slice(0, 2)
  const afterBy = phrase.match(/\bby\s+(.+?)(?:\s+as\s+|\s+(?:bar|chart|list|table|trend|donut|pie)|$)/)?.[1] || ''
  return fields.filter((field) => afterBy.includes(field.toLowerCase())).slice(0, 2)
}

export const buildReportPromptGuide = (prompt, allowedCatalog) => {
  const phrase = prompt.trim().toLowerCase()
  const sourceKey = sourceFromPrompt(phrase, allowedCatalog)
  const table = allowedCatalog.find((item) => item.key === sourceKey) || allowedCatalog[0]
  if (!table) return 'Select a data table, then describe the records, grouping, and output format.'
  const suggestedField = table.fields.find((field) => !/number|id|description|note|message/i.test(field)) || table.fields[0]
  const promptPrefix = phrase ? `Using ${table.label}. ` : ''
  return `${promptPrefix}Try: "List ${table.label.toLowerCase()} by ${suggestedField.toLowerCase()}". Add a condition such as "where status is Draft" and an output such as "as a bar chart". Available fields: ${table.fields.join(', ')}.`
}

export const createBlankReport = (allowedCatalog) => {
  const table = allowedCatalog[0]
  return { name: 'Untitled report', source: table?.key || '', filters: [], visualization: 'table', fields: table?.fields || [], selectedFields: table?.fields.slice(0, 5) || [], groupBy: [], sortBy: '', sortDirection: 'descending', style: { showLegend: true, showValues: true, palette: 'operational' } }
}

export const parseReportPrompt = (prompt, allowedCatalog) => {
  const phrase = prompt.trim().toLowerCase()
  const requestedSource = sourceFromPrompt(phrase, allowedCatalog)
  const table = allowedCatalog.find((item) => item.key === requestedSource) || allowedCatalog[0]
  const filters = []
  const addFilter = (field, operator, value) => filters.push({ id: `nlp-${field}-${filters.length}`, field, operator, value })
  let groupBy = []
  let visualization = /list|table|detail/.test(phrase) ? 'table' : /trend|over time|monthly|weekly/.test(phrase) ? 'line' : /share|percentage|proportion|donut|pie/.test(phrase) ? 'pie' : 'bar'

  if (table.key === 'Incidents') {
    if (/open|unresolved|active/.test(phrase)) addFilter('State', 'is not one of', 'Resolved|Closed')
    if (/closed/.test(phrase)) addFilter('State', 'is', 'Closed')
    else if (/resolved/.test(phrase)) addFilter('State', 'is', 'Resolved')
    else if (/in progress/.test(phrase)) addFilter('State', 'is', 'In progress')
    else if (/new incident/.test(phrase)) addFilter('State', 'is', 'New')
    if (/critical|aog/.test(phrase)) addFilter('Priority', 'is', 'Critical')
    else if (/high priority/.test(phrase)) addFilter('Priority', 'is', 'High')
    else if (/medium priority/.test(phrase)) addFilter('Priority', 'is', 'Medium')
    else if (/low priority/.test(phrase)) addFilter('Priority', 'is', 'Low')
    if (/more than (a |one )?month|older than (a |one )?month|30 days/.test(phrase)) addFilter('Age days', 'greater than', '30')
    else if (/more than (a |one )?week|older than (a |one )?week|7 days/.test(phrase)) addFilter('Age days', 'greater than', '7')
    if (/by customer (and|then|,)?\s*priority|by priority (and|then|,)?\s*customer/.test(phrase)) groupBy = ['Customer', 'Priority']
    else if (/by customer/.test(phrase)) groupBy = ['Customer']
    else if (/by priority/.test(phrase)) groupBy = ['Priority']
    else if (/by (state|status)/.test(phrase)) groupBy = ['State']
    else if (/by (assignment group|group|team)/.test(phrase)) groupBy = ['Assignment group']
    else if (/by (age|aging|age bucket)/.test(phrase)) groupBy = ['Age bucket']
    else if (/customer.*priority|priority.*customer/.test(phrase)) groupBy = ['Customer', 'Priority']
    else if (/age|week|month/.test(phrase)) groupBy = ['Age bucket']
    else if (/customer/.test(phrase)) groupBy = ['Customer']
    else if (/priority/.test(phrase)) groupBy = ['Priority']
    else if (/state|status/.test(phrase)) groupBy = ['State']
    else if (/assignment|group|team/.test(phrase)) groupBy = ['Assignment group']
  }
  if (table.key !== 'Incidents') {
    const statusField = table.fields.find((field) => field.toLowerCase() === 'status')
    const requestedStatus = ['draft', 'published', 'active', 'inactive', 'pending', 'completed', 'unread', 'read'].find((status) => new RegExp(`\\b${status}\\b`).test(phrase))
    if (statusField && requestedStatus) addFilter(statusField, 'is', requestedStatus[0].toUpperCase() + requestedStatus.slice(1))
    const groupedFields = groupFieldsFromPhrase(phrase, table.fields)
    if (groupedFields.length) groupBy = groupedFields
    else {
      const directField = fieldFromPhrase(phrase, table.fields)
      if (directField && /by|group/.test(phrase)) groupBy = [directField]
    }
  }
  if (!groupBy.length && visualization !== 'table') groupBy = [table.fields[1]]
  const subject = table.key === 'Incidents' ? 'Incidents' : table.label
  const qualifier = filters.find((filter) => filter.field === 'Age days')?.value === '30' ? ' older than one month' : filters.find((filter) => filter.field === 'Age days') ? ' older than one week' : ''
  const grouping = groupBy.length ? ` by ${groupBy.join(' and ').toLowerCase()}` : ''
  return {
    definition: { name: `${/open/.test(phrase) ? 'Open ' : ''}${subject}${qualifier}${grouping}`, source: table.key, filters, visualization, fields: table.fields, selectedFields: table.fields.slice(0, 5), groupBy, sortBy: '', sortDirection: 'descending', style: { showLegend: true, showValues: true, palette: 'operational' } },
    explanation: `I selected ${table.label}, ${filters.length ? `applied ${filters.length} condition${filters.length === 1 ? '' : 's'}` : 'kept all records'}, and grouped the result ${groupBy.length ? `by ${groupBy.join(' and ')}` : 'as a detailed list'}.`,
  }
}
