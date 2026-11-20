import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchUpcomingScheduled } from '../api/scheduled'
import { fetchCategories } from '../api/transactions'
import { GROUPS, fetchCategoryGroups, setCategoryGroup } from '../api/categoryGroups'
import useMonthSummary from '../hooks/useMonthSummary'
import MonthFilterBar from '../components/MonthFilterBar'

function fmt(n) {
  return Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

function fmtDec(n) {
  return Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

// ─── Group setup (assign each sub-category to a group) ───────────────────────

function GroupSetup({ categories, mapping, onChange, onClose }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  async function assign(category, group) {
    const next = mapping[category] === group ? null : group  // tap the selected group again to unassign
    setSaving(category)
    setError(null)
    try {
      await setCategoryGroup(category, next)
      onChange(category, next)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  const unassigned = categories.filter(c => !mapping[c])
  const assigned   = categories.filter(c => mapping[c])

  const row = c => (
    <div key={c} className="px-4 py-2.5 border-t border-[var(--color-border)]/40">
      <p className={`text-sm mb-1.5 ${saving === c ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]'}`}>{c}</p>
      <div className="flex gap-1.5 flex-wrap">
        {GROUPS.map(g => {
          const on = mapping[c] === g.key
          return (
            <button key={g.key} disabled={saving === c} onClick={() => assign(c, g.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                on ? 'text-black border-transparent' : 'text-[var(--color-muted)] border-[var(--color-border)] bg-[var(--color-bg)]'
              }`}
              style={on ? { backgroundColor: g.color } : undefined}
            >{g.label}</button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Set up groups</p>
        <button onClick={onClose} className="text-xs font-medium text-[var(--color-today)]">Done</button>
      </div>
      <p className="px-4 pb-3 text-[11px] text-[var(--color-muted)]">
        Pick which group each sub-category belongs to. Tap the selected group again to unassign.
      </p>
      {error && <p className="px-4 pb-2 text-xs text-[var(--color-expense)]">{error}</p>}
      {unassigned.length > 0 && (
        <>
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[var(--color-today)] uppercase tracking-widest">
            Unassigned ({unassigned.length})
          </p>
          {unassigned.map(row)}
        </>
      )}
      {assigned.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Assigned</p>
          {assigned.map(row)}
        </>
      )}
    </div>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const s = useMonthSummary()
  const { data, loading, error } = s

  const [mapping, setMapping] = useState({})
  const [allCategories, setAllCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)

  useEffect(() => {
    fetchCategoryGroups().then(setMapping).catch(() => {})
    fetchCategories().then(setAllCategories).catch(() => {})
  }, [])

  // Per sub-category expense + income totals for the month
  const perCat = {}
  for (const c of data?.categories ?? []) {
    perCat[c.category] = { ...(perCat[c.category] ?? { exp: 0, inc: 0 }), exp: c.total }
  }
  for (const c of data?.income_categories ?? []) {
    perCat[c.category] = { ...(perCat[c.category] ?? { exp: 0, inc: 0 }), inc: c.total }
  }

  // Roll sub-categories up into the four groups. For Income the amount is money in
  // (net of any expenses tagged there); for the others it's money out (net of refunds).
  const groupData = Object.fromEntries(GROUPS.map(g => [g.key, { total: 0, subs: [] }]))
  const unassigned = []
  for (const [cat, { exp, inc }] of Object.entries(perCat)) {
    const g = mapping[cat]
    if (!g || !groupData[g]) { unassigned.push({ category: cat, amount: inc - exp }); continue }
    const amount = g === 'income' ? inc - exp : exp - inc
    groupData[g].total += amount
    groupData[g].subs.push({ category: cat, amount })
  }
  for (const g of Object.values(groupData)) g.subs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  unassigned.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const outflow  = groupData.bills.total + groupData.variables.total + groupData.spending.total
  const leftOver = groupData.income.total - outflow

  // Every known sub-category, plus any that only appear in this month's data or the mapping
  const setupCategories = [...new Set([...allCategories, ...Object.keys(perCat), ...Object.keys(mapping)])]
    .sort((a, b) => a.localeCompare(b))

  const selectedGroup = GROUPS.find(g => g.key === selected)

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

        <MonthFilterBar s={s} />

        {setupOpen && (
          <GroupSetup
            categories={setupCategories}
            mapping={mapping}
            onChange={(cat, g) => setMapping(m => {
              const next = { ...m }
              if (g) next[cat] = g; else delete next[cat]
              return next
            })}
            onClose={() => setSetupOpen(false)}
          />
        )}

        {loading && <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">Loading…</div>}
        {error   && <div className="text-center py-10 text-[var(--color-expense)] text-sm">{error}</div>}

        {!loading && !error && data && (
          <>
            {/* ── Four groups ── */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {GROUPS.map(g => {
                const gd = groupData[g.key]
                const active = selected === g.key
                return (
                  <button key={g.key}
                    onClick={() => setSelected(active ? null : g.key)}
                    className={`text-left bg-[var(--color-surface)] rounded-xl p-3 border transition-colors ${
                      active ? 'border-[var(--color-today)]' : 'border-transparent hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <p className="text-[11px] text-[var(--color-muted)] font-medium">{g.label}</p>
                    </div>
                    <p className="text-base font-mono font-bold" style={{ color: g.color }}>
                      {g.key === 'income' ? '+' : '−'}${fmt(gd.total)}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
                      {gd.subs.length} sub-categor{gd.subs.length === 1 ? 'y' : 'ies'}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* ── Left over ── */}
            <div className="bg-[var(--color-surface)] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-muted)]">Left over</p>
              <p className={`text-sm font-mono font-bold ${leftOver >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                {leftOver >= 0 ? '+' : '−'}${fmt(leftOver)}
              </p>
            </div>

            {/* ── Selected group detail ── */}
            {selectedGroup && (
              <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden mb-4">
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest px-4 pt-4 pb-2">
                  {selectedGroup.label}
                </p>
                {groupData[selected].subs.length === 0 ? (
                  <p className="px-4 pb-4 text-xs text-[var(--color-muted)]">
                    Nothing this month. Assign sub-categories with "Set up groups".
                  </p>
                ) : groupData[selected].subs.map(sub => {
                  const total = groupData[selected].total
                  return (
                    <div key={sub.category} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                      <span className="text-sm text-[var(--color-text)] flex-1 truncate">{sub.category}</span>
                      <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-9 text-right">
                        {total !== 0 ? (sub.amount / total * 100).toFixed(0) : 0}%
                      </span>
                      <span className="text-sm font-mono flex-shrink-0 w-24 text-right" style={{ color: selectedGroup.color }}>
                        ${fmtDec(sub.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Not yet grouped (this month) ── */}
            {unassigned.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden mb-4">
                <p className="text-[10px] font-semibold text-[var(--color-today)] uppercase tracking-widest px-4 pt-4 pb-2">
                  Not in a group yet ({unassigned.length})
                </p>
                {unassigned.map(u => (
                  <div key={u.category} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                    <span className="text-sm text-[var(--color-text)] flex-1 truncate">{u.category}</span>
                    <span className={`text-sm font-mono flex-shrink-0 w-24 text-right ${u.amount >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                      {u.amount >= 0 ? '+' : '−'}${fmtDec(u.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!setupOpen && (
              <button onClick={() => { setSetupOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="w-full py-2.5 rounded-xl border border-dashed border-[var(--color-border)] text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                Set up groups
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
