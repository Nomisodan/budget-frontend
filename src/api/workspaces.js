const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchWorkspaces() {
  const res = await fetch(`${BASE}/api/workspaces`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch workspaces')
  return json
}

export async function createWorkspace(name) {
  const res = await fetch(`${BASE}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function renameWorkspace(id, name) {
  const res = await fetch(`${BASE}/api/workspaces/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Rename failed')
  return json
}

export async function deleteWorkspace(id) {
  const res = await fetch(`${BASE}/api/workspaces/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json
}
