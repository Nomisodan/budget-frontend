import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCategorySummary } from '../api/categories'
import { fetchCategories, fetchTransaction, patchTransaction, fetchAllTransactions } from '../api/transactions'
import { fetchAccounts } from '../api/accounts'
import CategoryInput from '../components/Calendar/CategoryInput'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(n) {
  return n.toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

function cellStyle(val, maxVal, colorVar = '--color-expense') {
  if (!val || maxVal === 0) return 'text-[var(--color-muted)]/25'
  const r = val / maxVal
  const income = colorVar === '--color-income'
  if (r >= 0.75) return income ? 'text-[var(--color-income)] font-semibold'  : 'text-[var(--color-expense)] font-semibold'
  if (r >= 0.45) return income ? 'text-[var(--color-income)]/80'              : 'text-[var(--color-expense)]/80'
  if (r >= 0.2)  return income ? 'text-[var(--color-income)]/55'              : 'text-[var(--color-expense)]/55'
  return           income ? 'text-[var(--color-income)]/35'              : 'text-[var(--color-expense)]/35'
}

export default function CategoriesPage() {
  const today = new Date()
  const savedCal = (() => { try { return JSON.parse(localStorage.getItem('calendar-state') || '{}') } catch { return {} } })()
  const [year, setYear]     = useState(savedCal.year  ?? today.getFullYear())
  const [month, setMonth]   = useState(savedCal.month ?? today.getMonth() + 1)
  const [view, setView]     = useState('month')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts]     = useState([])
  const [activeFilter, setActiveFilter] = useState(savedCal.activeTab ?? 'all')
  const [allTxns, setAllTxns] = useState(null)
  const [allLoading, setAllLoading] = useState(false)
  const [allError, setAllError] = useState(null)

  // Derive groups from accounts — an account may belong to more than one group
  const groupMap = {}
  for (const a of accounts) {
    for (const gn of a.group_names ?? []) {
      if (!groupMap[gn]) groupMap[gn] = []
      groupMap[gn].push(a)
    }
  }
  const groups = Object.entries(groupMap).map(([name, accts]) => ({ name, ids: accts.map(a => a.id) }))

  // Resolve active filter to account ID list (null = all)
  const filterAccountIds = (() => {
    if (!activeFilter || activeFilter === 'all') return null
    if (typeof activeFilter === 'string') return groups.find(g => g.name === activeFilter)?.ids ?? null
    return [activeFilter]
  })()

  const loadSummary = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchCategorySummary(year, view === 'month' ? month : null, filterAccountIds)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, view, activeFilter, accounts])

  useEffect(() => { if (view !== 'all') loadSummary() }, [loadSummary, view])
  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}) }, [])
  useEffect(() => { fetchAccounts().then(setAccounts).catch(() => {}) }, [])

  const loadAllTxns = useCallback(() => {
    setAllLoading(true)
    setAllError(null)
    fetchAllTransactions()
      .then(setAllTxns)
      .catch(err => setAllError(err.message))
      .finally(() => setAllLoading(false))
  }, [])

  useEffect(() => { if (view === 'all' && allTxns === null) loadAllTxns() }, [view, allTxns, loadAllTxns])

  function prev() {
    if (view === 'year') { setYear(y => y - 1); return }
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function next() {
    if (view === 'year') { setYear(y => y + 1); return }
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const periodLabel = view === 'year'
    ? String(year)
    : new Date(year, month - 1, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-4 max-w-2xl mx-auto md:max-w-4xl md:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-[var(--color-text)]">Categories</h1>
        <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-0.5">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'month' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >Month</button>
          <button
            onClick={() => setView('year')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'year' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >Year</button>
          <button
            onClick={() => setView('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === 'all' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >All</button>
        </div>
      </div>

      {view !== 'all' && (
        <>
          {/* Account / group filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-3 px-3 no-scrollbar">
            {[
              { key: 'all', label: 'All' },
              ...groups.map(g => ({ key: g.name, label: g.name })),
              ...accounts.map(a => ({ key: a.id, label: a.name })),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === key
                    ? 'bg-[var(--color-today)] text-black'
                    : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">‹</button>
            <span className="text-base font-semibold text-[var(--color-text)]">{periodLabel}</span>
            <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">›</button>
          </div>
        </>
      )}

      {view !== 'all' && loading && <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">Loading…</div>}
      {view !== 'all' && error   && <div className="text-center py-10 text-[var(--color-expense)]">{error}</div>}
      {!loading && !error && data?.view === 'month' && view === 'month' && <MonthView data={data} categories={categories} onRefresh={loadSummary} />}
      {!loading && !error && data?.view === 'year'  && view === 'year'  && <YearView  data={data} year={year} />}
      {view === 'all' && (
        <AllTransactionsView
          txns={allTxns}
          loading={allLoading}
          error={allError}
          categories={categories}
          onUpdated={(id, patch) => setAllTxns(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))}
        />
      )}
    </div>
  )
}

function TransactionDetailDrawer({ txnId, onClose, categories, onCategoryUpdated }) {
  const [txn, setTxn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [catDraft, setCatDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!txnId) return
    setLoading(true)
    fetchTransaction(txnId)
      .then(t => { setTxn(t); setCatDraft(t.category || '') })
      .catch(() => setTxn(null))
      .finally(() => setLoading(false))
  }, [txnId])

  async function saveCategory() {
    if (!catDraft.trim()) return
    setSaving(true)
    try {
      await patchTransaction(txnId, { category: catDraft.trim() })
      onCategoryUpdated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function goToCalendar() {
    if (!txn) return
    const d = new Date(txn.date + 'T00:00:00')
    try { localStorage.setItem('calendar-state', JSON.stringify({ year: d.getFullYear(), month: d.getMonth() + 1 })) } catch {}
    navigate('/calendar')
    onClose()
  }

  const amtColor = txn?.type === 'income'
    ? 'text-[var(--color-income)]'
    : txn?.type === 'transfer'
    ? 'text-[var(--color-transfer)]'
    : 'text-[var(--color-expense)]'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="flex justify-end px-4 pt-1 pb-1 flex-shrink-0">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--color-muted)]">Loading…</div>
        ) : txn ? (
          <div className="px-5 pb-8 overflow-y-auto flex-1">
            <p className={`text-3xl font-mono font-bold mb-1 ${amtColor}`}>
              {txn.amount > 0 ? '+' : txn.amount < 0 ? '-' : ''}${Math.abs(txn.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-base font-semibold text-[var(--color-text)] mb-1 leading-snug">{txn.description}</p>
            <p className="text-sm text-[var(--color-muted)] mb-5">
              {new Date(txn.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <div className="bg-[var(--color-surface-2)] rounded-xl divide-y divide-[var(--color-border)]/50 mb-5">
              {txn.account_name && (
                <div className="flex justify-between items-center px-3 py-2.5">
                  <span className="text-xs text-[var(--color-muted)]">Account</span>
                  <span className="text-xs font-medium text-[var(--color-text)]">{txn.account_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-3 py-2.5">
                <span className="text-xs text-[var(--color-muted)]">Type</span>
                <span className={`text-xs font-medium capitalize ${amtColor}`}>{txn.type || '—'}</span>
              </div>
              {txn.source && (
                <div className="flex justify-between items-center px-3 py-2.5">
                  <span className="text-xs text-[var(--color-muted)]">Source</span>
                  <span className="text-xs font-medium text-[var(--color-text)] capitalize">{txn.source}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">Category</p>
            <div className="flex gap-2 mb-5">
              <CategoryInput
                value={catDraft}
                onChange={setCatDraft}
                onSave={saveCategory}
                categories={categories}
                placeholder="e.g. Groceries"
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
              />
              <button onClick={saveCategory} disabled={saving}
                className="px-4 py-2 rounded-lg bg-[var(--color-today)] text-black text-sm font-semibold disabled:opacity-50 flex-shrink-0">
                {saving ? '…' : 'Save'}
              </button>
            </div>

            <button onClick={goToCalendar}
              className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              View on Calendar
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-expense)]">Transaction not found</div>
        )}
      </div>
    </div>
  )
}

function CategorySection({ cats, color, emptyMsg, categories, onRefresh }) {
  const [expanded, setExpanded] = useState(null)
  const [drawerTxnId, setDrawerTxnId] = useState(null)
  const maxTotal = cats.length > 0 ? Math.max(...cats.map(c => c.total)) : 1

  if (cats.length === 0) return <p className="text-center text-[var(--color-muted)] text-sm py-6">{emptyMsg}</p>

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {cats.map(cat => {
          const isOpen = expanded === cat.category
          const barPct = maxTotal > 0 ? (cat.total / maxTotal * 100) : 0
          return (
            <div key={cat.category} className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
              <div className="p-3 cursor-pointer select-none" onClick={() => setExpanded(isOpen ? null : cat.category)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-[var(--color-text)] truncate">{cat.category}</span>
                    <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">{cat.count} txn{cat.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`text-sm font-mono font-semibold ${color}`}>${fmt(cat.total)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-[var(--color-muted)] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: `var(${color.replace('text-[var(', '').replace(')]', '')})` }} />
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-[var(--color-border)]">
                  {cat.transactions.map((t, i) => {
                    const label = new Date(t.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                    return (
                      <div key={t.id}
                        className={`flex items-center justify-between px-3 py-2 gap-3 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors ${i < cat.transactions.length - 1 ? 'border-b border-[var(--color-border)]/40' : ''}`}
                        onClick={() => setDrawerTxnId(t.id)}>
                        <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-12">{label}</span>
                        <span className="text-xs text-[var(--color-text)] truncate flex-1">{t.description}</span>
                        <span className={`text-xs font-mono flex-shrink-0 ${color}`}>
                          {t.amount > 0 ? '+' : t.amount < 0 ? '-' : ''}${Math.abs(t.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-muted)] flex-shrink-0">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {drawerTxnId && (
        <TransactionDetailDrawer
          txnId={drawerTxnId}
          onClose={() => setDrawerTxnId(null)}
          categories={categories}
          onCategoryUpdated={() => { setDrawerTxnId(null); onRefresh() }}
        />
      )}
    </>
  )
}

function MonthView({ data, categories, onRefresh }) {
  const net = data.income_total - data.expense_total
  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Income</p>
          <p className="text-sm font-mono font-bold text-[var(--color-income)]">+${fmt(data.income_total)}</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Expenses</p>
          <p className="text-sm font-mono font-bold text-[var(--color-expense)]">-${fmt(data.expense_total)}</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Net</p>
          <p className={`text-sm font-mono font-bold ${net >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
            {net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}
          </p>
        </div>
      </div>

      {/* Income section */}
      {(data.income_categories ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">Income</p>
          <CategorySection
            cats={data.income_categories}
            color="text-[var(--color-income)]"
            emptyMsg="No income this month"
            categories={categories}
            onRefresh={onRefresh}
          />
          <div className="flex items-center justify-between px-3 py-2.5 mt-1 border-t border-[var(--color-border)]">
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {(data.income_categories ?? []).reduce((s, c) => s + c.count, 0)} transactions
            </span>
            <span className="text-sm font-mono font-bold text-[var(--color-income)]">+${fmt(data.income_total)}</span>
          </div>
        </div>
      )}

      {/* Expenses section */}
      <div>
        <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">Expenses</p>
        <CategorySection
          cats={data.categories}
          color="text-[var(--color-expense)]"
          emptyMsg="No expenses this month"
          categories={categories}
          onRefresh={onRefresh}
        />
        {data.categories.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2.5 mt-1 border-t border-[var(--color-border)]">
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {data.categories.reduce((s, c) => s + c.count, 0)} transactions
            </span>
            <span className="text-sm font-mono font-bold text-[var(--color-expense)]">-${fmt(data.expense_total)}</span>
          </div>
        )}
      </div>

      {/* Transfers section */}
      {(data.transfer_categories ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">Transfers</p>
          <CategorySection
            cats={data.transfer_categories}
            color="text-[var(--color-transfer)]"
            emptyMsg="No transfers this month"
            categories={categories}
            onRefresh={onRefresh}
          />
          <div className="flex items-center justify-between px-3 py-2.5 mt-1 border-t border-[var(--color-border)]">
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {(data.transfer_categories ?? []).reduce((s, c) => s + c.count, 0)} transactions
            </span>
            <span className="text-sm font-mono font-bold text-[var(--color-transfer)]">${fmt(data.transfer_total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function YearTable({ categories, monthlyTotals, total, colorVar, year }) {
  const today = new Date()
  const currentYear     = today.getFullYear()
  const currentMonthIdx = today.getMonth()
  const allVals = categories.flatMap(c => c.months)
  const maxVal  = allVals.length > 0 ? Math.max(...allVals) : 1

  if (categories.length === 0) return null

  return (
    <div className="overflow-x-auto -mx-3">
      <table className="text-xs border-collapse" style={{ minWidth: '720px', width: '100%' }}>
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left py-2.5 pl-3 pr-2 text-[var(--color-muted)] font-medium sticky left-0 bg-[var(--color-bg)] w-28">Category</th>
            {MONTHS_SHORT.map((m, i) => (
              <th key={m} className={`text-right py-2.5 px-1.5 font-medium ${
                year === currentYear && i === currentMonthIdx ? 'text-[var(--color-today)]'
                : year === currentYear && i > currentMonthIdx ? 'text-[var(--color-muted)]/30'
                : 'text-[var(--color-muted)]'
              }`}>{m}</th>
            ))}
            <th className="text-right py-2.5 pl-1.5 pr-3 font-semibold text-[var(--color-text)]">Total</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <tr key={cat.category} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface)]/50 transition-colors">
              <td className="py-2 pl-3 pr-2 font-medium text-[var(--color-text)] sticky left-0 bg-[var(--color-bg)]">{cat.category}</td>
              {cat.months.map((val, i) => (
                <td key={i} className={`text-right px-1.5 py-2 font-mono ${cellStyle(val, maxVal, colorVar)}`}>
                  {val ? `$${fmt(val)}` : '—'}
                </td>
              ))}
              <td className={`text-right pl-1.5 pr-3 py-2 font-mono font-semibold`} style={{ color: `var(${colorVar})` }}>
                ${fmt(cat.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)]">
            <td className="py-2.5 pl-3 pr-2 font-semibold text-[var(--color-text)] sticky left-0 bg-[var(--color-bg)]">Total</td>
            {monthlyTotals.map((val, i) => (
              <td key={i} className={`text-right px-1.5 py-2.5 font-mono font-semibold`}
                style={{ color: val ? `var(${colorVar})` : undefined }}
              >
                {val ? `$${fmt(val)}` : <span className="text-[var(--color-muted)]/25">—</span>}
              </td>
            ))}
            <td className="text-right pl-1.5 pr-3 py-2.5 font-mono font-bold" style={{ color: `var(${colorVar})` }}>
              ${fmt(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function YearView({ data, year }) {
  const net = data.income_total - data.expense_total

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Income</p>
          <p className="text-sm font-mono font-bold text-[var(--color-income)]">+${fmt(data.income_total)}</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Expenses</p>
          <p className="text-sm font-mono font-bold text-[var(--color-expense)]">-${fmt(data.expense_total)}</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Net</p>
          <p className={`text-sm font-mono font-bold ${net >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
            {net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}
          </p>
        </div>
      </div>

      {/* Income table */}
      {(data.income_categories ?? []).length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Income</p>
          <YearTable
            categories={data.income_categories}
            monthlyTotals={data.income_monthly_totals}
            total={data.income_total}
            colorVar="--color-income"
            year={year}
          />
        </>
      )}

      {/* Expense table */}
      {data.categories.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Expenses</p>
          <YearTable
            categories={data.categories}
            monthlyTotals={data.monthly_totals}
            total={data.expense_total}
            colorVar="--color-expense"
            year={year}
          />
        </>
      )}

      {data.categories.length === 0 && (data.income_categories ?? []).length === 0 && (
        <p className="text-center text-[var(--color-muted)] text-sm py-12">No transactions in {year}</p>
      )}
    </div>
  )
}

function SortButton({ label, active, dir, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-[var(--color-today)]/15 text-[var(--color-today)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {label}
      {active && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={dir === 'asc' ? 'rotate-180' : ''}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      )}
    </button>
  )
}

function AllTxnRow({ t, categories, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(t.category || '')
  const [saving, setSaving] = useState(false)

  const amtColor = t.type === 'income' ? 'text-[var(--color-income)]' : t.type === 'transfer' ? 'text-[var(--color-transfer)]' : 'text-[var(--color-expense)]'
  const dateLabel = new Date(t.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })

  async function save(cat) {
    const next = cat.trim()
    if (!next || next === t.category) { setEditing(false); return }
    setSaving(true)
    try {
      await patchTransaction(t.id, { category: next, update_default: true })
      onUpdated(t.id, { category: next })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)]/40 last:border-b-0">
      <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-24">{dateLabel}</span>
      <span className="text-sm text-[var(--color-text)] truncate flex-1 min-w-0">{t.description}</span>
      <div className="flex-shrink-0 w-32">
        {editing ? (
          <CategoryInput
            value={draft}
            onChange={setDraft}
            onSave={save}
            categories={categories}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        ) : (
          <button
            onClick={() => { setDraft(t.category || ''); setEditing(true) }}
            disabled={saving}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface-2)] rounded px-2 py-1 w-full text-left truncate transition-colors disabled:opacity-50"
          >
            {saving ? '…' : (t.category || 'Uncategorized')}
          </button>
        )}
      </div>
      <span className={`text-xs font-mono flex-shrink-0 w-20 text-right ${amtColor}`}>
        {t.amount > 0 ? '+' : t.amount < 0 ? '-' : ''}${Math.abs(t.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}

function AllTransactionsView({ txns, loading, error, categories, onUpdated }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    if (!txns) return []
    const q = search.trim().toLowerCase()
    const base = !q ? txns : txns.filter(t =>
      t.description.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
    )
    const sorted = [...base].sort((a, b) => {
      let cmp
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'description') cmp = a.description.localeCompare(b.description)
      else cmp = (a.category || '').localeCompare(b.category || '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns, search, sortKey, sortDir])

  if (loading) return <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">Loading…</div>
  if (error) return <div className="text-center py-10 text-[var(--color-expense)]">{error}</div>
  if (!txns) return null

  return (
    <div className="flex flex-col gap-3">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or category…"
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <SortButton label="Date" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
          <SortButton label="Name" active={sortKey === 'description'} dir={sortDir} onClick={() => toggleSort('description')} />
          <SortButton label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => toggleSort('category')} />
        </div>
        <span className="text-[10px] text-[var(--color-muted)]">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <p className="text-[10px] text-[var(--color-muted)] -mt-1">
        Changing a category here also updates the default used for this merchant on future imports.
      </p>

      <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
        {filtered.map(t => (
          <AllTxnRow key={t.id} t={t} categories={categories} onUpdated={onUpdated} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-[var(--color-muted)] text-sm py-10">No matching transactions</p>
        )}
      </div>
    </div>
  )
}
