const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchCategorySummary(year, month = null, accountIds = null) {
  const params = new URLSearchParams({ year })
  if (month) params.set('month', month)
  if (accountIds && accountIds.length > 0) params.set('account_ids', accountIds.join(','))
  const res = await fetch(`${BASE}/api/categories/summary?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch summary')
  return json
}
