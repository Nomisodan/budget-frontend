const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchCalendar(year, month, accountId, accountIds = null, showProjections = false) {
  const params = new URLSearchParams({ year, month })
  if (accountIds && accountIds.length) {
    params.set('account_ids', accountIds.join(','))
  } else if (accountId) {
    params.set('account_id', accountId)
  }
  if (showProjections) params.set('projections', '1')
  const res = await fetch(`${BASE}/api/calendar?${params}`)
  if (!res.ok) throw new Error('Failed to fetch calendar')
  return res.json()
}
