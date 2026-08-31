const BASE = import.meta.env.VITE_API_URL ?? ''

export async function resetBudget() {
  const res = await fetch(`${BASE}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Reset failed')
  return json
}
