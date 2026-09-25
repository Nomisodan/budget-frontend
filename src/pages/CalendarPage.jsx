import { useState, useEffect } from 'react'
import CalendarGrid from '../components/Calendar/CalendarGrid'
import AgendaView from '../components/Calendar/AgendaView'
import { fetchCalendar } from '../api/calendar'
import { fetchAccounts } from '../api/accounts'
import { patchTransaction, fetchCategories } from '../api/transactions'

const BANK_LABEL = { bmo: 'BMO', scotiabank: 'Scotia', desjardins: 'Desjardins', capital_one: 'Cap One', loc: 'LOC', cash: 'Cash' }

export default function CalendarPage() {
  const today = new Date()

  const saved = (() => { try { return JSON.parse(localStorage.getItem('calendar-state') || '{}') } catch { return {} } })()

  const [year, setYear] = useState(saved.year ?? today.getFullYear())
  const [month, setMonth] = useState(saved.month ?? today.getMonth() + 1)
  const [activeTab, setActiveTab] = useState(saved.activeTab ?? null)
  const [showProjections, setShowProjections] = useState(false)

  const [accounts, setAccounts] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('grid')
  const [refreshKey, setRefreshKey] = useState(0)
  const [categories, setCategories] = useState([])

  // Derive groups from account.group_names — an account may belong to more than one group
  const groupMap = {}
  for (const a of accounts) {
    for (const gn of a.group_names ?? []) {
      if (!groupMap[gn]) groupMap[gn] = []
      groupMap[gn].push(a)
    }
  }
  const groups = Object.entries(groupMap).map(([name, accts]) => ({ name, ids: accts.map(a => a.id) }))

  const isGroupTab = typeof activeTab === 'string'
  const activeAccountId = isGroupTab ? null : activeTab
  const activeGroup = isGroupTab ? groups.find(g => g.name === activeTab) : null

  useEffect(() => {
    fetchAccounts()
      .then(accts => {
        setAccounts(accts)
        // Only set a default tab if nothing was restored from localStorage
        setActiveTab(prev => prev ?? (accts.length > 0 ? accts[0].id : null))
      })
      .catch(() => setError('Could not load accounts'))
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  // Persist selected account/group and month whenever they change
  useEffect(() => {
    if (activeTab !== null) {
      localStorage.setItem('calendar-state', JSON.stringify({ year, month, activeTab }))
    }
  }, [year, month, activeTab])

  useEffect(() => {
    if (activeTab === null) return
    setLoading(true)
    setError(null)
    const fetchIds = activeGroup?.ids ?? null
    fetchCalendar(year, month, activeAccountId, fetchIds, showProjections)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [year, month, activeTab, refreshKey, showProjections])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  async function handleTypeChange(txnId, newType, linkedAccountId = null) {
    const updated = await patchTransaction(txnId, { type: newType, linked_account_id: linkedAccountId })
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          transactions: day.transactions.map(t =>
            t.id === txnId
              ? { ...t, type: updated.type, linked_account_id: updated.linked_account_id, mirror_id: updated.mirror_id ?? null }
              : t
          ),
        })),
      }
    })
    setRefreshKey(k => k + 1)
  }

  async function handleCategoryChange(txnId, newCategory) {
    await patchTransaction(txnId, { category: newCategory })
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          transactions: day.transactions.map(t =>
            t.id === txnId ? { ...t, category: newCategory } : t
          ),
        })),
      }
    })
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' })

  // Transfers between own accounts are just money movement — exclude both sides from income/expense totals.
  // Only transfers to/from external parties (linked_account_id is null) count.
  const ownAccountIds = new Set(accounts.map(a => a.id))
  const isEffectiveIncome  = t => t.type === 'income' ||
    (t.type === 'transfer' && t.amount > 0 && !ownAccountIds.has(t.linked_account_id))
  const isEffectiveExpense = t => t.type === 'expense' ||
    (t.type === 'transfer' && t.amount < 0 && !ownAccountIds.has(t.linked_account_id))

  const totalIncome = data?.days.reduce((s, d) =>
    s + d.transactions.filter(t => !t.is_projection).filter(isEffectiveIncome).reduce((a, t) => a + t.amount, 0), 0) ?? 0
  const totalExpenses = data?.days.reduce((s, d) =>
    s + d.transactions.filter(t => !t.is_projection).filter(isEffectiveExpense).reduce((a, t) => a + Math.abs(t.amount), 0), 0) ?? 0
  const endBalance = data?.days[data.days.length - 1]?.balance ?? 0

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-4 max-w-2xl mx-auto md:max-w-4xl md:px-8">

      {/* Account / group tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-3 px-3 no-scrollbar">
        {groups.map(g => (
          <button
            key={g.name}
            onClick={() => setActiveTab(g.name)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === g.name
                ? 'bg-[var(--color-today)] text-black'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {g.name}
          </button>
        ))}
        {accounts.map(a => (
          <button
            key={a.id}
            onClick={() => setActiveTab(a.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === a.id
                ? 'bg-[var(--color-today)] text-black'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="opacity-70">{BANK_LABEL[a.bank] ?? a.bank}</span> {a.name}
          </button>
        ))}
      </div>

      {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-[var(--color-text)]">Cash Flow</h1>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-0.5">
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${view === 'grid' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </button>
              <button
                onClick={() => setView('agenda')}
                title="Agenda view"
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${view === 'agenda' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
            </div>
            {/* Forecast toggle */}
            <button
              onClick={() => setShowProjections(p => !p)}
              title="Toggle forecast overlay"
              className={`text-xs border rounded px-2 py-1 transition-colors ${
                showProjections
                  ? 'border-[var(--color-today)] text-[var(--color-today)] bg-[var(--color-today)]/10'
                  : 'text-[var(--color-muted)] border-[var(--color-muted)]/30 hover:border-[var(--color-muted)]'
              }`}
            >
              Forecast
            </button>
            <button
              onClick={goToday}
              className="text-xs text-[var(--color-today)] border border-[var(--color-today)]/40 rounded px-2 py-1 hover:bg-[var(--color-today)]/10 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors"
          >
            ‹
          </button>
          <span className="text-base font-semibold text-[var(--color-text)]">{monthName}</span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors"
          >
            ›
          </button>
        </div>

        {/* Summary bar */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Income</p>
              <p className="text-sm font-mono font-bold text-[var(--color-income)]">
                +${totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Expenses</p>
              <p className="text-sm font-mono font-bold text-[var(--color-expense)]">
                -${totalExpenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--color-muted)] mb-0.5">End Balance</p>
              <p className={`text-sm font-mono font-bold ${endBalance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                ${endBalance.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        )}

        {/* Calendar */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">
            Loading…
          </div>
        )}
        {error && (
          <div className="text-center py-10 text-[var(--color-expense)]">
            {error} — is the Flask backend running on port 5000?
          </div>
        )}
        {!loading && !error && view === 'agenda' && (
          <AgendaView
            data={data}
            accountId={activeAccountId}
            accounts={accounts}
            onTypeChange={handleTypeChange}
            onTransactionAdded={() => setRefreshKey(k => k + 1)}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            multiAccount={isGroupTab}
          />
        )}
        {!loading && !error && view === 'grid' && (
          <CalendarGrid
            data={data}
            accountId={activeAccountId}
            accounts={accounts}
            onTypeChange={handleTypeChange}
            onTransactionAdded={() => setRefreshKey(k => k + 1)}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            multiAccount={isGroupTab}
          />
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 justify-center flex-wrap">
          {[['Income', 'var(--color-income)'], ['Expense', 'var(--color-expense)'], ['Transfer', 'var(--color-transfer)']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `${color}` }} />
              <span className="text-[11px] text-[var(--color-muted)]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-[var(--color-muted)]" />
            <span className="text-[11px] text-[var(--color-muted)]">Scheduled</span>
          </div>
          {showProjections && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm border border-[var(--color-today)] opacity-60" />
              <span className="text-[11px] text-[var(--color-muted)]">Forecast</span>
            </div>
          )}
        </div>

    </div>
  )
}
