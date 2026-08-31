const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchBudgets() {
  const res = await fetch(`${BASE}/api/budgets`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch budgets')
  return json
}

export async function fetchBudgetsSummary(year, month) {
  const params = new URLSearchParams({ year, month })
  const res = await fetch(`${BASE}/api/budgets/summary?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch budget summary')
  return json
}

export async function createBudget(data) {
  const res = await fetch(`${BASE}/api/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function updateBudget(id, patch) {
  const res = await fetch(`${BASE}/api/budgets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Update failed')
  return json
}

export async function deleteBudget(id) {
  const res = await fetch(`${BASE}/api/budgets/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json
}
