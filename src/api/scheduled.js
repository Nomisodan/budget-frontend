const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchScheduled(accountId) {
  const params = accountId ? `?account_id=${accountId}` : ''
  const res = await fetch(`${BASE}/api/scheduled${params}`)
  if (!res.ok) throw new Error('Failed to fetch scheduled transactions')
  return res.json()
}

export async function createScheduled(data) {
  const res = await fetch(`${BASE}/api/scheduled`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function updateScheduled(id, patch) {
  const res = await fetch(`${BASE}/api/scheduled/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Update failed')
  return json
}

export async function deleteScheduled(id) {
  const res = await fetch(`${BASE}/api/scheduled/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json
}

export async function fetchUpcomingScheduled(limit = 5) {
  const res = await fetch(`${BASE}/api/scheduled/upcoming?limit=${limit}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch upcoming items')
  return json
}

export async function fetchBillsForecast(dateFrom, dateTo) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/scheduled/forecast?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch forecast')
  return json
}
