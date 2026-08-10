const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1'
let accessToken = ''

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${response.status})`)
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

export const authenticationApi = {
  demoLogin: async (user) => {
    const session = await request('/authentication/demo-login', {
      method: 'POST',
      body: JSON.stringify({ username: user.credential || user.email, display_name: user.name, email: user.email }),
    })
    accessToken = session.access_token
    return session
  },
  login: async (credentials) => {
    const session = await request('/authentication/login', { method: 'POST', body: JSON.stringify(credentials) })
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
