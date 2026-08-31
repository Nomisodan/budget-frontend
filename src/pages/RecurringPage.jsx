import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchScheduled, createScheduled, updateScheduled, deleteScheduled, fetchBillsForecast } from '../api/scheduled'
import { fetchAccounts } from '../api/accounts'

const FREQ_LABEL = { monthly: 'Monthly', biweekly: 'Bi-weekly', weekly: 'Weekly', once: 'One-time' }
const FREQ_MULTIPLIER = { monthly: 1, biweekly: 26 / 12, weekly: 52 / 12, once: 0 }

const TYPE_COLOR = {
  income:   { text: 'text-[var(--color-income)]',   bg: 'bg-[var(--color-income)]/10',   border: 'border-[var(--color-income)]' },
  expense:  { text: 'text-[var(--color-expense)]',  bg: 'bg-[var(--color-expense)]/10',  border: 'border-[var(--color-expense)]' },
  transfer: { text: 'text-[var(--color-transfer)]', bg: 'bg-[var(--color-transfer)]/10', border: 'border-[var(--color-transfer)]' },
}

function monthlyEquivalent(item) {
  return Math.abs(item.amount) * (FREQ_MULTIPLIER[item.frequency] ?? 0)
}

const EMPTY_FORM = {
  name: '', amount: '', type: 'expense', category: '',
  frequency: 'monthly', day_of_month: '', next_date: '', start_date: '', account_id: '',
  is_projection: false,
}

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2 })
}

// ── Form component ─────────────────────────────────────────────────────────────
function ScheduledForm({ initial, accounts, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError('Enter a valid amount'); return }
    if (form.frequency !== 'monthly' && !form.next_date) { setError('Enter the next occurrence date'); return }
    if (form.frequency === 'monthly' && (!form.day_of_month || form.day_of_month < 1 || form.day_of_month > 31)) {
      setError('Enter the day of month (1–31)'); return
    }

    setSaving(true)
    setError(null)
    try {
      const absAmount = parseFloat(form.amount)
      const signed = form.type === 'income' ? Math.abs(absAmount) : -Math.abs(absAmount)
      const payload = {
        name: form.name.trim(),
        amount: signed,
        type: form.type,
        category: form.category.trim() || null,
        frequency: form.frequency,
        day_of_month: form.frequency === 'monthly' ? parseInt(form.day_of_month) : null,
        next_date: form.frequency !== 'monthly' ? form.next_date : null,
        start_date: form.start_date ? `${form.start_date}-01` : null,
        account_id: form.account_id ? parseInt(form.account_id) : null,
        is_active: true,
        is_projection: form.is_projection,
      }
      await onSave(payload)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const typeOptions = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
  ]
  const freqOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'once', label: 'One-time' },
  ]

  return (
    <form onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
      {/* Type selector */}
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Type</label>
        <div className="flex gap-2">
          {typeOptions.map(o => (
            <button type="button" key={o.value}
              onClick={() => set('type', o.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.type === o.value
                  ? `${TYPE_COLOR[o.value].bg} ${TYPE_COLOR[o.value].border} ${TYPE_COLOR[o.value].text}`
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Name</label>
        <input
          value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Rent, Payday, Phone Bill"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
      </div>

      {/* Amount + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
            Amount ($) <span className="normal-case text-[var(--color-muted)]">— always positive</span>
          </label>
          <input
            type="number" min="0" step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0.00"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Category</label>
          <input
            value={form.category} onChange={e => set('category', e.target.value)}
            placeholder="e.g. Bills, Income"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Frequency</label>
        <div className="grid grid-cols-4 gap-1.5">
          {freqOptions.map(o => (
            <button type="button" key={o.value}
              onClick={() => set('frequency', o.value)}
              className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                form.frequency === o.value
                  ? 'bg-[var(--color-today)]/15 border-[var(--color-today)] text-[var(--color-today)]'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {/* Day / Date depending on frequency */}
      {form.frequency === 'monthly' ? (
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Day of month</label>
          <input
            type="number" min="1" max="31"
            value={form.day_of_month} onChange={e => set('day_of_month', e.target.value)}
            placeholder="e.g. 1, 15, 28"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        </div>
      ) : (
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
            Next occurrence
          </label>
          <input
            type="date"
            value={form.next_date} onChange={e => set('next_date', e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        </div>
      )}

      {/* Start from */}
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
          Start from <span className="normal-case text-[var(--color-muted)]">— first month this applies</span>
        </label>
        <input
          type="month"
          value={form.start_date} onChange={e => set('start_date', e.target.value)}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
        <p className="text-[10px] text-[var(--color-muted)] mt-1">Leave blank to show in all months (past and future)</p>
      </div>

      {/* Account */}
      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Account</label>
        <select
          value={form.account_id} onChange={e => set('account_id', e.target.value)}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        >
          <option value="">— Any / unassigned —</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Forecast-only toggle */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
          form.is_projection
            ? 'border-[var(--color-today)] bg-[var(--color-today)]/5'
            : 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
        }`}
        onClick={() => set('is_projection', !form.is_projection)}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
          form.is_projection ? 'bg-[var(--color-today)] border-[var(--color-today)]' : 'border-[var(--color-border)]'
        }`}>
          {form.is_projection && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Forecast only</p>
          <p className="text-[11px] text-[var(--color-muted)]">Shows as a ghost entry on the calendar — never matched to real transactions</p>
        </div>
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

// ── Row component ──────────────────────────────────────────────────────────────
function ScheduledRow({ item, accounts, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const colors = TYPE_COLOR[item.type] ?? TYPE_COLOR.expense
  const monthly = monthlyEquivalent(item)
  const accountName = accounts.find(a => a.id === item.account_id)?.name

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${colors.bg} ${colors.border}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--color-text)]">{item.name}</span>
          {item.category && (
            <span className="text-[10px] text-[var(--color-muted)] bg-[var(--color-surface-2)] rounded px-1.5 py-0.5">{item.category}</span>
          )}
          {item.is_projection && (
            <span className="text-[10px] text-[var(--color-today)] border border-[var(--color-today)]/50 rounded px-1.5 py-0.5">forecast</span>
          )}
          {!item.is_active && (
            <span className="text-[10px] text-[var(--color-muted)] border border-[var(--color-border)] rounded px-1.5 py-0.5">paused</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-[var(--color-muted)]">{FREQ_LABEL[item.frequency]}</span>
          {item.frequency === 'monthly' && item.day_of_month && (
            <span className="text-xs text-[var(--color-muted)]">· day {item.day_of_month}</span>
          )}
          {item.next_date && (
            <span className="text-xs text-[var(--color-muted)]">· next {item.next_date}</span>
          )}
          {item.start_date && (
            <span className="text-xs text-[var(--color-muted)]">
              · from {new Date(item.start_date + 'T00:00:00').toLocaleString('en-CA', { month: 'short', year: 'numeric' })}
            </span>
          )}
          {accountName && (
            <span className="text-xs text-[var(--color-muted)]">· {accountName}</span>
          )}
          {item.frequency !== 'once' && (
            <span className={`text-xs font-mono ${colors.text}`}>≈ {fmt(monthly)}/mo</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
        <span className={`text-base font-bold font-mono ${colors.text}`}>
          {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
        </span>
        <div className="flex gap-1">
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
    </div>
  )
}

// ── Bills forecast (between two paycheques) ────────────────────────────────────
function defaultForecastRange() {
  const today = new Date()
  const in14 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)
  return { from: today.toISOString().slice(0, 10), to: in14.toISOString().slice(0, 10) }
}

function BillsForecastView({ accounts }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('bills-forecast-range') || '{}') } catch { return {} } })()
  const defaults = defaultForecastRange()
  const [dateFrom, setDateFrom] = useState(saved.from ?? defaults.from)
  const [dateTo, setDateTo] = useState(saved.to ?? defaults.to)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    localStorage.setItem('bills-forecast-range', JSON.stringify({ from: dateFrom, to: dateTo }))
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return
    setLoading(true)
    setError(null)
    fetchBillsForecast(dateFrom, dateTo)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  const accountName = id => accounts.find(a => a.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
        <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">Between paycheques</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">From (last payday)</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">To (next payday)</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]" />
          </div>
        </div>
        {dateFrom > dateTo && <p className="text-xs text-[var(--color-expense)] mt-2">'From' must be before 'To'</p>}
      </div>

      {loading && <p className="text-center py-10 text-[var(--color-muted)]">Loading…</p>}
      {error && <p className="text-center py-10 text-[var(--color-expense)]">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-muted)] mb-1">Income due</p>
              <p className="text-lg font-bold font-mono text-[var(--color-income)]">+{fmt(data.total_income)}</p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-muted)] mb-1">Bills due</p>
              <p className="text-lg font-bold font-mono text-[var(--color-expense)]">−{fmt(data.total_expense)}</p>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
            {data.items.length === 0 ? (
              <p className="text-center text-[var(--color-muted)] text-sm py-10">Nothing due in this window</p>
            ) : data.items.map((item, i) => {
              const colors = TYPE_COLOR[item.type] ?? TYPE_COLOR.expense
              const label = new Date(item.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={`${item.id}-${item.date}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)]/40 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text)] truncate">{item.name}</p>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {label}{accountName(item.account_id) ? ` · ${accountName(item.account_id)}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-mono font-semibold flex-shrink-0 ${colors.text}`}>
                    {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RecurringPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [prefillDate, setPrefillDate] = useState(null)
  const [pageView, setPageView] = useState('list')

  useEffect(() => {
    const date = searchParams.get('date')
    if (date) {
      setPrefillDate({
        date,
        name:       searchParams.get('name')       ?? '',
        amount:     searchParams.get('amount')     ?? '',
        type:       searchParams.get('type')       ?? 'expense',
        category:   searchParams.get('category')   ?? '',
        account_id: searchParams.get('account_id') ?? '',
      })
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchScheduled(), fetchAccounts()])
      .then(([scheds, accts]) => { setItems(scheds); setAccounts(accts) })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(payload) {
    if (editing) {
      const updated = await updateScheduled(editing.id, payload)
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    } else {
      const created = await createScheduled(payload)
      setItems(prev => [...prev, created])
    }
    setShowForm(false)
    setEditing(null)
    setPrefillDate(null)
  }

  async function handleDelete(id) {
    await deleteScheduled(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function startEdit(item) {
    setEditing(item)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
    setPrefillDate(null)
  }

  function dateKey(item) {
    if (item.day_of_month) return item.day_of_month
    if (item.next_date) return parseInt(item.next_date.split('-')[2])
    return 999
  }

  const income   = items.filter(i => i.type === 'income'   && i.is_active).sort((a, b) => dateKey(a) - dateKey(b))
  const expense  = items.filter(i => i.type === 'expense'  && i.is_active).sort((a, b) => dateKey(a) - dateKey(b))
  const transfer = items.filter(i => i.type === 'transfer' && i.is_active).sort((a, b) => dateKey(a) - dateKey(b))
  const inactive = items.filter(i => !i.is_active)

  const monthlyIncome   = income.reduce((s, i) => s + monthlyEquivalent(i), 0)
  const monthlyExpenses = expense.reduce((s, i) => s + monthlyEquivalent(i), 0)
  const monthlyNet      = monthlyIncome - monthlyExpenses

  const formInitial = editing ? {
    name: editing.name,
    amount: Math.abs(editing.amount).toString(),
    type: editing.type,
    category: editing.category ?? '',
    frequency: editing.frequency,
    day_of_month: editing.day_of_month?.toString() ?? '',
    next_date: editing.next_date ?? '',
    start_date: editing.start_date ? editing.start_date.slice(0, 7) : '',
    account_id: editing.account_id?.toString() ?? '',
    is_projection: editing.is_projection ?? false,
  } : prefillDate ? {
    ...EMPTY_FORM,
    name:         prefillDate.name,
    amount:       prefillDate.amount,
    type:         prefillDate.type,
    category:     prefillDate.category,
    next_date:    prefillDate.date,
    day_of_month: String(parseInt(prefillDate.date.split('-')[2])),
    account_id:   prefillDate.account_id,
  } : EMPTY_FORM

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-2xl mx-auto md:max-w-4xl md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Recurring</h1>
          <p className="text-xs text-[var(--color-muted)]">Bills, income, and regular transfers</p>
        </div>
        {pageView === 'list' && !showForm && (
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

      {/* Tabs */}
      <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-0.5 mb-6 w-fit">
        <button
          onClick={() => setPageView('list')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${pageView === 'list' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
        >Recurring</button>
        <button
          onClick={() => setPageView('forecast')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${pageView === 'forecast' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
        >Bills Forecast</button>
      </div>

      {pageView === 'forecast' && <BillsForecastView accounts={accounts} />}

      {pageView === 'list' && (
      <>
      {/* Form */}
      {showForm && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">
            {editing ? 'Edit recurring item' : 'New recurring item'}
          </h2>
          <ScheduledForm
            initial={formInitial}
            accounts={accounts}
            onSave={handleSave}
            onCancel={cancelForm}
          />
        </div>
      )}

      {loading ? (
        <p className="text-center py-20 text-[var(--color-muted)]">Loading…</p>
      ) : (
        <>
          {/* ── Monthly projection ── */}
          {items.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-6">
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">Monthly projection</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-muted)] mb-1">Income</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-income)]">+{fmt(monthlyIncome)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-muted)] mb-1">Expenses</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-expense)]">−{fmt(monthlyExpenses)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-muted)] mb-1">Net</p>
                  <p className={`text-lg font-bold font-mono ${monthlyNet >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                    {monthlyNet >= 0 ? '+' : '−'}{fmt(monthlyNet)}
                  </p>
                </div>
              </div>
              <div className="relative h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                {monthlyIncome > 0 && (
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (monthlyExpenses / monthlyIncome) * 100)}%`,
                      backgroundColor: monthlyNet >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                    }}
                  />
                )}
              </div>
              <p className="text-[10px] text-[var(--color-muted)] mt-1 text-right">
                {monthlyIncome > 0
                  ? `${Math.round((monthlyExpenses / monthlyIncome) * 100)}% of income spoken for`
                  : 'No recurring income set'}
              </p>
            </div>
          )}

          {/* ── Lists ── */}
          {[
            { label: 'Income', data: income },
            { label: 'Expenses', data: expense },
            { label: 'Transfers', data: transfer },
            { label: 'Paused', data: inactive },
          ].map(section => section.data.length === 0 ? null : (
            <div key={section.label} className="mb-5">
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">{section.label}</p>
              <div className="flex flex-col gap-2">
                {section.data.map(item => (
                  <ScheduledRow
                    key={item.id}
                    item={item}
                    accounts={accounts}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}

          {items.length === 0 && !showForm && (
            <div className="text-center py-16">
              <p className="text-[var(--color-muted)] text-sm mb-1">No recurring items yet</p>
              <p className="text-[var(--color-muted)] text-xs">Add your bills and payday to see your monthly projection</p>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  )
}
