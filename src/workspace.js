const STORAGE_KEY = 'budget-workspace-id'

export function getWorkspaceId() {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? Number(raw) : null
}

export function setWorkspaceId(id) {
  localStorage.setItem(STORAGE_KEY, String(id))
}

// Every request this app makes goes through src/api/*.js to our own Flask API. Rather than
// threading the active workspace through each of those fetch calls individually, tag every
// outgoing API request here so the backend can scope accounts/transactions/budgets to it.
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const id = getWorkspaceId()
  if (!url.includes('/api/') || !id) return nativeFetch(input, init)

  const headers = new Headers(init.headers)
  headers.set('X-Workspace-Id', String(id))
  return nativeFetch(input, { ...init, headers })
}
