const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchTransaction(id) {
  const res = await fetch(`${BASE}/api/transactions/${id}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Not found')
  return json
}

export async function createTransaction(data) {
  const res = await fetch(`${BASE}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function deleteTransaction(id) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json
}

export async function patchTransaction(id, patch) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Update failed')
  return json
}

export async function fetchAllTransactions() {
  const res = await fetch(`${BASE}/api/transactions`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch transactions')
  return json
}

export async function fetchCategories() {
  const res = await fetch(`${BASE}/api/categories`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch categories')
  return json
}

export async function fetchCategorySuggestion(description, amount = 0) {
  const params = new URLSearchParams({ description, amount })
  const res = await fetch(`${BASE}/api/categorize?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Categorize failed')
  return json  // { category, type }
}

export async function splitTransaction(id, splits) {
  const res = await fetch(`${BASE}/api/transactions/${id}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ splits }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Split failed')
  return json  // { split_id, splits: [...] }
}

export async function previewDeleteRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Preview failed')
  return json  // { count }
}

export async function deleteTransactionRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json  // { deleted }
}

export async function unsplitTransaction(id) {
  const res = await fetch(`${BASE}/api/transactions/${id}/split`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Unsplit failed')
  return json  // merged transaction
}
