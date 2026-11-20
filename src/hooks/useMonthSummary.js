import { useState, useEffect, useCallback } from 'react'
import { fetchCategorySummary } from '../api/categories'
import { fetchAccounts } from '../api/accounts'

// Shared month + account-filter state for Home and Overview. Persisted to the same
// localStorage key the Calendar uses so all three pages stay in sync.
export default function useMonthSummary() {
  const today = new Date()
  const saved = (() => { try { return JSON.parse(localStorage.getItem('calendar-state') || '{}') } catch { return {} } })()

  const [year,  setYear]  = useState(saved.year  ?? today.getFullYear())
  const [month, setMonth] = useState(saved.month ?? today.getMonth() + 1)
  const [data,  setData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [accounts, setAccounts] = useState([])
  const [activeFilter, setActiveFilter] = useState(saved.activeTab ?? 'all')

  // Derive groups — an account may belong to more than one group
  const groupMap = {}
  for (const a of accounts) {
    for (const gn of a.group_names ?? []) {
      if (!groupMap[gn]) groupMap[gn] = []
      groupMap[gn].push(a)
    }
  }
  const groups = Object.entries(groupMap).map(([name, accts]) => ({ name, ids: accts.map(a => a.id) }))

  const filterAccountIds = (() => {
    if (!activeFilter || activeFilter === 'all') return null
    if (typeof activeFilter === 'string') return groups.find(g => g.name === activeFilter)?.ids ?? null
    return [activeFilter]
  })()

  useEffect(() => {
    localStorage.setItem('calendar-state', JSON.stringify({ year, month, activeTab: activeFilter }))
  }, [year, month, activeFilter])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchCategorySummary(year, month, filterAccountIds)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, activeFilter, accounts])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchAccounts().then(setAccounts).catch(() => {}) }, [])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' })

  return { year, month, monthLabel, prevMonth, nextMonth, data, loading, error, reload: load,
           accounts, groups, activeFilter, setActiveFilter }
}
