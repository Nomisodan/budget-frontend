import { useState, useEffect, useCallback } from 'react'
import { fetchBudgetsSummary, createBudget, updateBudget, deleteBudget } from '../api/budgets'
import { fetchCategories } from '../api/transactions'

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2 })
}

function barColor(pct) {
  if (pct >= 100) return 'var(--color-expense)'
  if (pct >= 80) return 'var(--color-today)'
  return 'var(--color-income)'
}

function BudgetForm({ initial, editing, categories, onSave, onCancel }) {
  const [category, setCategory] = useState(initial?.category ?? '')
  const [limit, setLimit] = useState(initial?.monthly_limit != null ? String(initial.monthly_limit) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!category) { setError('Choose a category'); return }
    const parsed = parseFloat(limit)
    if (!limit || isNaN(parsed) || parsed <= 0) { setError('Enter a valid monthly limit'); return }

    setSaving(true)
    setError(null)
    try {
      await onSave({ category, monthly_limit: parsed })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3 mb-6">
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Category</label>
        {editing ? (
          <p className="text-sm font-medium text-[var(--color-text)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
            {category}
          </p>
        ) : (
          <select
            value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          >
            <option value="">— Choose —</option>
            {categories.length === 0 && <option value="" disabled>No unbudgeted categories left</option>}
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Monthly limit ($)</label>
        <input
          type="number" min="0" step="0.01"
          value={limit} onChange={e => setLimit(e.target.value)}
          placeholder="0.00"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
      </div>

      {error && <p className="text-xs text-[var(--color-expense)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--color-today)] text-black font-semibold text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-muted)] text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function BudgetRow({ item, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const pct = Math.min(100, item.percent)
  const over = item.over

  return (
    <div className={`rounded-xl border px-4 py-3 ${over ? 'bg-[var(--color-expense)]/10 border-[var(--color-expense)]' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[var(--color-text)] truncate">{item.category}</span>
          {over && (
            <span className="text-[10px] text-[var(--color-expense)] border border-[var(--color-expense)]/50 rounded px-1.5 py-0.5 flex-shrink-0">
              over budget
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {confirming ? (
            <div className="flex gap-1">
              <button onClick={() => onDelete(item.id)}
                className="px-2 py-1 rounded-lg bg-[var(--color-expense)]/20 text-[var(--color-expense)] text-xs font-medium"
              >Yes</button>
              <button onClick={() => setConfirming(false)}
                className="px-2 py-1 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs"
              >No</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-expense)] hover:bg-[var(--color-expense)]/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="relative h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden mb-1.5">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor(item.percent) }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-muted)]">{fmt(item.actual)} of {fmt(item.monthly_limit)}</span>
        <span className={over ? 'text-[var(--color-expense)] font-semibold' : 'text-[var(--color-muted)]'}>
          {over ? `${fmt(Math.abs(item.remaining))} over` : `${fmt(item.remaining)} left`}
        </span>
      </div>
    </div>
  )
}

export default function BudgetPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchBudgetsSummary(year, month)
      .then(setSummary)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}) }, [])

  function prev() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function next() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const periodLabel = new Date(year, month - 1, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' })

  async function handleSave(payload) {
    if (editing) {
      await updateBudget(editing.id, { monthly_limit: payload.monthly_limit })
    } else {
      await createBudget(payload)
    }
    setShowForm(false)
    setEditing(null)
    load()
  }

  async function handleDelete(id) {
    await deleteBudget(id)
    load()
  }

  function startEdit(item) {
    setEditing(item)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
  }

  const budgetedCategories = new Set((summary?.items ?? []).map(i => i.category))
  const availableCategories = categories.filter(c => !budgetedCategories.has(c))
  const totalOver = summary && summary.total_actual > summary.total_budget

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-2xl mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Budget</h1>
          <p className="text-xs text-[var(--color-muted)]">Link categories to a monthly limit and see if you're busting it</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 bg-[var(--color-today)] text-black text-sm font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">‹</button>
        <span className="text-base font-semibold text-[var(--color-text)]">{periodLabel}</span>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors">›</button>
      </div>

      {showForm && (
        <BudgetForm
          initial={editing}
          editing={!!editing}
          categories={availableCategories}
          onSave={handleSave}
          onCancel={cancelForm}
        />
      )}

      {loading && <p className="text-center py-20 text-[var(--color-muted)]">Loading…</p>}
      {error && <p className="text-center py-10 text-[var(--color-expense)]">{error}</p>}

      {!loading && !error && summary && (
        <>
          {summary.items.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-6">
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">Total budget</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-muted)] mb-1">Budgeted</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-text)]">{fmt(summary.total_budget)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-muted)] mb-1">Spent</p>
                  <p className={`text-lg font-bold font-mono ${totalOver ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`}>
                    {fmt(summary.total_actual)}
                  </p>
                </div>
              </div>
              <div className="relative h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    width: `${summary.total_budget > 0 ? Math.min(100, (summary.total_actual / summary.total_budget) * 100) : 0}%`,
                    backgroundColor: totalOver ? 'var(--color-expense)' : 'var(--color-income)',
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {summary.items.map(item => (
              <BudgetRow key={item.id} item={item} onEdit={startEdit} onDelete={handleDelete} />
            ))}
          </div>

          {summary.items.length === 0 && !showForm && (
            <div className="text-center py-16">
              <p className="text-[var(--color-muted)] text-sm mb-1">No budgets set yet</p>
              <p className="text-[var(--color-muted)] text-xs">Link a category to a monthly limit to start tracking</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
