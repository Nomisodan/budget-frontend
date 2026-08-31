import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { fetchCategorySummary } from '../api/categories'
import { fetchAccounts } from '../api/accounts'
import { fetchUpcomingScheduled } from '../api/scheduled'

const COLORS = [
  '#f97316','#3b82f6','#a855f7','#22c55e','#eab308',
  '#06b6d4','#ec4899','#14b8a6','#f43f5e','#8b5cf6',
  '#84cc16','#fb923c','#60a5fa','#c084fc','#34d399',
]

function fmt(n) {
  return Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

function fmtDec(n) {
  return Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function slicePath(cx, cy, outer, inner, start, end) {
  const [ox1, oy1] = polar(cx, cy, outer, start)
  const [ox2, oy2] = polar(cx, cy, outer, end)
  const [ix1, iy1] = polar(cx, cy, inner, end)
  const [ix2, iy2] = polar(cx, cy, inner, start)
  const large = end - start > 180 ? 1 : 0
  return `M${ox1},${oy1} A${outer},${outer},0,${large},1,${ox2},${oy2} L${ix1},${iy1} A${inner},${inner},0,${large},0,${ix2},${iy2}Z`
}

function DonutChart({ slices, total }) {
  const size = 220
  const cx = size / 2, cy = size / 2
  const outer = 90, inner = 58
  const gap = slices.length > 1 ? 1.5 : 0

  let angle = 0
  const paths = slices.map((s, i) => {
    const sweep = s.pct * 360
    const start = angle + gap / 2
    const end   = angle + sweep - gap / 2
    angle += sweep
    return { d: slicePath(cx, cy, outer, inner, start, end), color: COLORS[i % COLORS.length] }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
      {/* Center label */}
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-[var(--color-muted)]" fontSize="11" fontFamily="inherit">
        Expenses
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-[var(--color-text)]" fontSize="16" fontWeight="700" fontFamily="monospace">
        ${fmt(total)}
      </text>
    </svg>
  )
}

// ─── What's next widget ─────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function WhatsNextCard() {
  const [items, setItems] = useState(null)

  useEffect(() => { fetchUpcomingScheduled(3).then(setItems).catch(() => setItems([])) }, [])

  if (items === null || items.length === 0) return null

  return (
    <Link to="/recurring" className="block bg-[var(--color-surface)] rounded-2xl p-4 mb-4 hover:bg-[var(--color-surface-2)] transition-colors">
      <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2.5">What's next to be paid</p>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const days = daysUntil(item.date)
          const color = item.type === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          return (
            <div key={`${item.id}-${item.date}-${i}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text)] truncate">{item.name}</p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                </p>
              </div>
              <span className={`text-sm font-mono font-semibold flex-shrink-0 ${color}`}>
                {item.type === 'income' ? '+' : '−'}${Math.abs(item.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )
        })}
      </div>
    </Link>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const today   = new Date()
  const saved   = (() => { try { return JSON.parse(localStorage.getItem('calendar-state') || '{}') } catch { return {} } })()

  const [year,  setYear]  = useState(saved.year  ?? today.getFullYear())
  const [month, setMonth] = useState(saved.month ?? today.getMonth() + 1)
  const [data,  setData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [accounts, setAccounts]   = useState([])
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

  // Persist to localStorage so Calendar + Categories stay in sync
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
  const cats     = data?.categories ?? []
  const incCats  = data?.income_categories ?? []
  const expTotal = data?.expense_total ?? 0
  const incTotal = data?.income_total  ?? 0
  const net      = incTotal - expTotal

  const slices = cats
    .filter(c => c.total > 0)
    .map(c => ({ label: c.category, total: c.total, pct: expTotal > 0 ? c.total / expTotal : 0 }))

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      <div className="max-w-lg mx-auto px-4 py-5">

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-[var(--color-text)]">Dashboard</h1>
          <Link to="/settings" aria-label="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        </div>

        <WhatsNextCard />

        {/* ── Account / group filter ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 no-scrollbar">
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
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Month nav ── */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">
            ‹
          </button>
          <span className="text-base font-semibold text-[var(--color-text)]">{monthLabel}</span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">
            ›
          </button>
        </div>

        {loading && <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">Loading…</div>}
        {error   && <div className="text-center py-10 text-[var(--color-expense)] text-sm">{error}</div>}

        {!loading && !error && data && (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Income</p>
                <p className="text-sm font-mono font-bold text-[var(--color-income)]">+${fmt(incTotal)}</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Expenses</p>
                <p className="text-sm font-mono font-bold text-[var(--color-expense)]">-${fmt(expTotal)}</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Net</p>
                <p className={`text-sm font-mono font-bold ${net >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                  {net >= 0 ? '+' : '-'}${fmt(net)}
                </p>
              </div>
            </div>

            {/* ── Donut chart ── */}
            {slices.length > 0 ? (
              <>
                <div className="bg-[var(--color-surface)] rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-3">
                    Spending breakdown
                  </p>
                  <DonutChart slices={slices} total={expTotal} />
                </div>

                {/* ── Category legend ── */}
                <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden mb-4">
                  <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest px-4 pt-4 pb-2">
                    Expenses
                  </p>
                  {slices.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-[var(--color-text)] flex-1 truncate">{s.label}</span>
                      <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-9 text-right">
                        {(s.pct * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm font-mono text-[var(--color-expense)] flex-shrink-0 w-20 text-right">
                        ${fmtDec(s.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-[var(--color-muted)] text-sm py-12">No expenses this month</p>
            )}

            {/* ── Income breakdown ── */}
            {incCats.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest px-4 pt-4 pb-2">
                  Income
                </p>
                {incCats.map((c, i) => (
                  <div key={c.category} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--color-income)]"
                      style={{ opacity: 1 - i * 0.15 }} />
                    <span className="text-sm text-[var(--color-text)] flex-1 truncate">{c.category}</span>
                    <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-9 text-right">
                      {incTotal > 0 ? (c.total / incTotal * 100).toFixed(0) : 0}%
                    </span>
                    <span className="text-sm font-mono text-[var(--color-income)] flex-shrink-0 w-20 text-right">
                      +${fmtDec(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
