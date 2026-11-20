const BASE = import.meta.env.VITE_API_URL ?? ''

export const GROUPS = [
  { key: 'income',    label: 'Income',    color: 'var(--color-income)' },
  { key: 'bills',     label: 'Bills',     color: '#3b82f6' },
  { key: 'variables', label: 'Variables', color: '#a855f7' },
  { key: 'spending',  label: 'Spending',  color: 'var(--color-expense)' },
]

export async function fetchCategoryGroups() {
  const res = await fetch(`${BASE}/api/category-groups`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch category groups')
  return json
}

export async function setCategoryGroup(category, group) {
  const res = await fetch(`${BASE}/api/category-groups`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, group }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to save group')
  return json
}
