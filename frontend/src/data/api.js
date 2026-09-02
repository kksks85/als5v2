const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1'
let accessToken = ''

// Fix #8: Enforce HTTPS in production
function ensureSecureConnection() {
  const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (import.meta.env.PROD && !localHostnames.has(window.location.hostname) && window.location.protocol !== 'https:') {
    // Redirect to HTTPS version of the same URL
    window.location.href = 'https:' + window.location.href.substring(window.location.protocol.length)
  }
}

function csrfToken() {
  return document.cookie.split('; ').find((cookie) => cookie.startsWith('als50_csrf='))?.split('=').slice(1).join('') || ''
}

function errorMessageFromBody(body, status) {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  if (typeof detail?.message === 'string') return detail.message
  if (typeof detail?.code === 'string') return detail.code
  if (detail) return JSON.stringify(detail)
  return `Request failed (${status})`
}

async function request(path, options = {}) {
  // Fix #8: Ensure secure connection for production
  ensureSecureConnection()
  
  const token = csrfToken()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(token ? { 'X-CSRF-Token': token } : {}), ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(errorMessageFromBody(body, response.status))
  }
  return response.json()
}

export const recordApi = {
  list: async (resource) => (await request(`/records/${resource}`)).items,
  replace: (resource, records) => request(`/records/${resource}`, {
    method: 'PUT',
    body: JSON.stringify({ records }),
  }),
  bulkUpsert: (resource, records) => request(`/records/${resource}/bulk-upsert`, {
    method: 'POST',
    body: JSON.stringify({ records }),
  }),
  remove: (resource, recordId) => request(`/records/${resource}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  }),
}

export const componentLifecycleApi = {
  listComponents: async (lifecycleStatus) => {
    const query = lifecycleStatus ? `?lifecycle_status=${encodeURIComponent(lifecycleStatus)}` : ''
    return (await request(`/component-lifecycle/components${query}`)).items
  },
  listMrlsComponents: async ({ componentType, customer, contractNumber } = {}) => {
    const query = new URLSearchParams()
    if (componentType) query.set('component_type', componentType)
    if (customer) query.set('customer', customer)
    if (contractNumber) query.set('contract_number', contractNumber)
    return (await request(`/component-lifecycle/mrls${query.size ? `?${query}` : ''}`)).items
  },
  getUavConfiguration: async (uavSerialNumber) => (await request(`/component-lifecycle/uavs/${encodeURIComponent(uavSerialNumber)}/configuration`)).items,
  getComponent: (serialNumber) => request(`/component-lifecycle/components/${encodeURIComponent(serialNumber)}`),
  listRepairs: async () => (await request('/component-lifecycle/repairs')).items,
  receiveComponent: (receipt) => request('/component-lifecycle/receipts', { method: 'POST', body: JSON.stringify(receipt) }),
  decideQuality: (serialNumber, decision) => request(`/component-lifecycle/components/${encodeURIComponent(serialNumber)}/quality`, { method: 'POST', body: JSON.stringify(decision) }),
  updateRepair: (repairId, action, update) => request(`/component-lifecycle/repairs/${encodeURIComponent(repairId)}/${action}`, { method: 'POST', body: JSON.stringify(update) }),
  closeRepairIncident: (repairIncidentId, performedBy) => request(`/component-lifecycle/repairs/by-incident/${encodeURIComponent(repairIncidentId)}/close?performed_by=${encodeURIComponent(performedBy)}`, { method: 'POST' }),
  markBeyondEconomicalRepair: (repairIncidentId, decision) => request(`/component-lifecycle/repairs/by-incident/${encodeURIComponent(repairIncidentId)}/beyond-economical-repair`, { method: 'POST', body: JSON.stringify(decision) }),
  attachRepairToIncident: (sourceIncidentId, repairIncidentId) => request(`/component-lifecycle/repairs/attach?source_incident_id=${encodeURIComponent(sourceIncidentId)}&repair_incident_id=${encodeURIComponent(repairIncidentId)}`, { method: 'POST' }),
  replaceComponent: (replacement) => request('/component-lifecycle/replacements', {
    method: 'POST',
    body: JSON.stringify(replacement),
  }),
}

export const authenticationApi = {
  restoreSession: (session) => {
    accessToken = session?.access_token || ''
  },
  clearSession: () => {
    accessToken = ''
  },
  demoLogin: async (user, password) => {
    const session = await request('/authentication/demo-login', {
      method: 'POST',
      body: JSON.stringify({ username: user.credential || user.email, display_name: user.name, email: user.email, password }),
    })
    accessToken = session.access_token
    return session
  },
  login: async (credentials) => {
    const session = await request('/authentication/login', { method: 'POST', body: JSON.stringify(credentials) })
    accessToken = session.access_token
    return session
  },
  adEligibilityLogin: async (email) => {
    const session = await request('/authentication/ad-eligibility-login', { method: 'POST', body: JSON.stringify({ email }) })
    accessToken = session.access_token
    return session
  },
  logout: async () => {
    const result = await request('/authentication/logout', { method: 'POST' })
    accessToken = ''
    return result
  },
  getSettings: () => request('/authentication/settings'),
  updateSettings: (settings) => request('/authentication/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getLocalAdminPasswordStatus: () => request('/authentication/local-admin-password'),
  updateLocalAdminPassword: (passwords) => request('/authentication/local-admin-password', { method: 'PUT', body: JSON.stringify(passwords) }),
  listRoleMappings: () => request('/authentication/role-mappings'),
  saveRoleMapping: (directory_group, mapping) => request(`/authentication/role-mappings/${encodeURIComponent(directory_group)}`, { method: 'PUT', body: JSON.stringify(mapping) }),
  getHealth: () => request('/authentication/health'),
}

export const emailApi = {
  testOutboundConnection: () => request('/notifications/smtp-connection-test', {
    method: 'POST',
  }),
  sendTestEmail: (recipient) => request('/notifications/smtp-test-email', {
    method: 'POST',
    body: JSON.stringify({ recipient }),
  }),
  sendMentionNotification: (notification) => request('/notifications/mention-email', {
    method: 'POST',
    body: JSON.stringify(notification),
  }),
  sendIncidentRegistrationNotification: (notification) => request('/notifications/incident-registration-email', {
    method: 'POST',
    body: JSON.stringify(notification),
  }),
}

export const notificationApi = {
  createWarrantyExpiryNotification: (notification) => request('/notifications/warranty-expiry', {
    method: 'POST',
    body: JSON.stringify(notification),
  }),
  consumeSubcontractCoverage: (usage) => request('/notifications/subcontract-coverage-usage', {
    method: 'POST',
    body: JSON.stringify(usage),
  }),
}
