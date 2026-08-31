const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchAccounts() {
  const res = await fetch(`${BASE}/api/accounts`)
  if (!res.ok) throw new Error('Failed to fetch accounts')
  return res.json()
}

export async function createAccount(data) {
  const res = await fetch(`${BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function updateAccount(id, patch) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Update failed')
  return data
}

export async function deleteAccount(id) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Delete failed')
  return data
}

export async function addAccountToGroup(id, groupName) {
  const res = await fetch(`${BASE}/api/accounts/${id}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_name: groupName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to add to group')
  return data
}

export async function removeAccountFromGroup(id, groupName) {
  const res = await fetch(`${BASE}/api/accounts/${id}/groups/${encodeURIComponent(groupName)}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to remove from group')
  return data
}

export async function renameGroup(oldName, newName) {
  const res = await fetch(`${BASE}/api/groups/${encodeURIComponent(oldName)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Rename failed')
  return data
}

export async function deleteGroup(name) {
  const res = await fetch(`${BASE}/api/groups/${encodeURIComponent(name)}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Delete failed')
  return data
}
