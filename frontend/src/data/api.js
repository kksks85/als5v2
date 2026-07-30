const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1'

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
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

export const entraApi = {
  getConfiguration: () => request('/authentication/entra/configuration'),
  saveConfiguration: (configuration) => request('/authentication/entra/configuration', {
    method: 'PUT',
    body: JSON.stringify(configuration),
  }),
}

export const emailApi = {
  sendMentionNotification: (notification) => request('/notifications/mention-email', {
    method: 'POST',
    body: JSON.stringify(notification),
  }),
}

export const notificationApi = {
  createWarrantyExpiryNotification: (notification) => request('/notifications/warranty-expiry', {
    method: 'POST',
    body: JSON.stringify(notification),
  }),
}
