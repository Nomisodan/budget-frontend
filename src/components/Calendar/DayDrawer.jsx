import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTransaction, patchTransaction, deleteTransaction, fetchCategorySuggestion, splitTransaction, unsplitTransaction } from '../../api/transactions'
import CategoryInput from './CategoryInput'

const SplitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5"/><path d="M8 3H3v5"/>
    <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>
  </svg>
)

const RecurringIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)

const TYPE_BORDER = {
  income:   'border-[var(--color-income)]',
  expense:  'border-[var(--color-expense)]',
  transfer: 'border-[var(--color-transfer)]',
}

const TYPE_COLOR_MAP = {
  income:   'text-[var(--color-income)]',
  expense:  'text-[var(--color-expense)]',
  transfer: 'text-[var(--color-transfer)]',
}
const TYPE_BG_MAP = {
  income:   'bg-[var(--color-income)]/10',
  expense:  'bg-[var(--color-expense)]/10',
  transfer: 'bg-[var(--color-transfer)]/10',
}

export default function DayDrawer({ day, accountId, accounts = [], onClose, onTypeChange, onTransactionAdded, onTransactionEdited, onTransactionDeleted, categories = [], onCategoryChange, multiAccount = false }) {
  const navigate = useNavigate()
  const [editingId, setEditingId] = useState(null)
  const [editCatVal, setEditCatVal] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [linkingId, setLinkingId] = useState(null)
  const [splittingId, setSplittingId] = useState(null)
  const [splitLines, setSplitLines] = useState([])
  const [splitSaving, setSplitSaving] = useState(false)
  const [splitError, setSplitError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ description: '', amount: '', type: 'expense', category: '', linked_account_id: null, account_id: accountId, is_projection: false })
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [suggestedCategory, setSuggestedCategory] = useState(null)
  if (!day) return null

  const otherAccounts = accounts.filter(a => a.id !== accountId)

  function isManualTxn(t) {
    const bank = accounts.find(a => a.id === t.account_id)?.bank
    return bank === 'cash' || bank === 'loan'
  }

  async function submitFullEdit(t) {
    const rawAmt = parseFloat(editForm.amount)
    if (!editForm.description.trim() || isNaN(rawAmt) || rawAmt <= 0) return
    const signedAmt = editForm.type === 'income' ? rawAmt : -rawAmt
    setEditSaving(true)
    try {
      const updated = await patchTransaction(t.id, {
        description: editForm.description.trim(),
        amount: signedAmt,
        type: editForm.type,
        category: editForm.category.trim() || null,
        is_projection: editForm.is_projection ?? false,
      })
      setEditingId(null)
      setEditForm(null)
      onTransactionEdited?.(t.id, updated)
    } catch { /* ignore */ } finally {
      setEditSaving(false)
    }
  }

  function setAdd(field, value) {
    setAddForm(f => ({
      ...f,
      [field]: value,
      // clear link when switching away from transfer
      ...(field === 'type' && value !== 'transfer' ? { linked_account_id: null } : {}),
    }))
  }

  async function handleCategorySuggest() {
    const desc = addForm.description.trim()
    if (!desc) return
    const amt = parseFloat(addForm.amount) || 0
    try {
      const { category, type } = await fetchCategorySuggestion(desc, amt)
      setSuggestedCategory(category)
      setAddForm(f => ({
        ...f,
        category: f.category.trim() ? f.category : category,
        type: f.type === 'expense' && type !== 'expense' ? type : f.type,
      }))
    } catch {
      // silently ignore — user can still set type/category manually
    }
  }

  function startSplit(t) {
    setEditingId(null)
    setSplittingId(t.id)
    setSplitLines([
      { category: t.category || '', amount: '' },
      { category: '', amount: '' },
    ])
    setSplitError(null)
  }

  function setSplitLine(idx, field, value) {
    setSplitLines(lines => lines.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  async function submitSplit(t) {
    const total = Math.abs(t.amount)
    const allocated = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    const remaining = Math.round((total - allocated) * 100) / 100

    // Build final splits array (user lines + auto-remainder if needed)
    const userLines = splitLines.filter(l => parseFloat(l.amount) > 0)
    const allSplits = remaining > 0.005
      ? [...userLines, { category: t.category || '', amount: remaining.toFixed(2) }]
      : userLines

    if (allSplits.length < 2) {
      setSplitError('Enter at least 2 amounts to split')
      return
    }
    if (remaining < -0.005) {
      setSplitError(`Split amounts exceed total by $${Math.abs(remaining).toFixed(2)}`)
      return
    }

    setSplitSaving(true)
    setSplitError(null)
    try {
      await splitTransaction(t.id, allSplits.map(l => ({
        category: l.category || null,
        amount: parseFloat(l.amount),
      })))
      setSplittingId(null)
      setSplitLines([])
      onTransactionAdded?.()
    } catch (err) {
      setSplitError(err.message)
    } finally {
      setSplitSaving(false)
    }
  }

  async function handleUnsplit(t) {
    try {
      await unsplitTransaction(t.id)
      setEditingId(null)
      onTransactionAdded?.()
    } catch { /* ignore */ }
  }

  async function handleDelete(t) {
    try {
      await deleteTransaction(t.id)
      setEditingId(null)
      setConfirmDeleteId(null)
      onTransactionDeleted?.(t.id)
    } catch { /* ignore */ }
  }

  async function submitAdd(e) {
    e.preventDefault()
    if (!addForm.description.trim()) { setAddError('Description required'); return }
    if (!addForm.amount || isNaN(parseFloat(addForm.amount))) { setAddError('Enter a valid amount'); return }
    if (multiAccount && !addForm.account_id) { setAddError('Select an account'); return }
    setSaving(true)
    setAddError(null)
    try {
      const newTxn = await createTransaction({
        date: day.date,
        description: addForm.description.trim(),
        amount: parseFloat(addForm.amount),
        type: addForm.type,
        category: addForm.category.trim() || null,
        account_id: addForm.account_id || accountId || null,
        linked_account_id: addForm.linked_account_id || null,
        is_projection: addForm.is_projection,
      })
      setShowAddForm(false)
      setAddForm({ description: '', amount: '', type: 'expense', category: '', linked_account_id: null, account_id: accountId, is_projection: false })
      setSuggestedCategory(null)
      onTransactionAdded?.(newTxn)
      onClose()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const date = new Date(day.date + 'T00:00:00')
  const formatted = date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
  const balanceColor = day.balance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'

  const typeColor = {
    income:   'text-[var(--color-income)]',
    expense:  'text-[var(--color-expense)]',
    transfer: 'text-[var(--color-transfer)]',
  }
  const typeBg = {
    income:   'bg-[var(--color-income)]/10',
    expense:  'bg-[var(--color-expense)]/10',
    transfer: 'bg-[var(--color-transfer)]/10',
  }

  function goRecurring(t) {
    const params = new URLSearchParams({
      date:       day.date,
      name:       t.description,
      amount:     Math.abs(t.amount).toString(),
      type:       t.type,
      category:   t.category ?? '',
    })
    if (accountId) params.set('account_id', accountId)
    onClose()
    navigate(`/recurring?${params}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-5 pb-8 z-10 max-h-[75vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[var(--color-muted)] text-sm">{formatted}</p>
            <p className={`text-2xl font-bold font-mono ${balanceColor}`}>
              ${day.balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[var(--color-muted)] text-xs">running balance</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xl leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Transactions */}
        {day.transactions.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm text-center py-6">No transactions</p>
        ) : (
          <div className="flex flex-col gap-2">
            {day.transactions.map((t, i) => {
              const isEditing = editingId === t.id
              // Scheduled projections (id is a string like "s42") are read-only ghosts.
              // Manually-added forecast transactions (numeric id) are fully editable.
              const isGhost = t.is_projection && typeof t.id === 'string'
              const isForecastActual = t.is_projection && typeof t.id === 'number'
              return (
                <div key={i} className={`flex flex-col gap-1 ${t.is_projection ? 'opacity-55' : ''}`}>
                  <div
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${typeBg[t.type] || 'bg-[var(--color-surface-2)]'} ${!t.is_scheduled && !isGhost ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (t.is_scheduled || isGhost) return
                      if (splittingId === t.id) return  // keep split form open
                      if (isEditing) {
                        setEditingId(null)
                        setLinkingId(null)
                        setEditForm(null)
                      } else {
                        setEditingId(t.id)
                        setEditCatVal(t.category || '')
                        setSplittingId(null)
                        if (isManualTxn(t) || t.source === 'manual') {
                          setEditForm({
                            description: t.description,
                            amount: Math.abs(t.amount).toFixed(2),
                            type: t.type,
                            category: t.category || '',
                            is_projection: !!t.is_projection,
                          })
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate flex items-center gap-1.5">
                        {(isGhost || isForecastActual) && (
                          <span className="text-[10px] border border-[var(--color-today)] text-[var(--color-today)] rounded px-1 py-0.5 leading-none">
                            proj
                          </span>
                        )}
                        {t.is_scheduled && !isGhost && (
                          <span className="text-[10px] border border-[var(--color-muted)] text-[var(--color-muted)] rounded px-1 py-0.5 leading-none">
                            sched
                          </span>
                        )}
                        {multiAccount && t.account_name && (
                          <span className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-muted)] rounded px-1.5 py-0.5 leading-none flex-shrink-0">
                            {t.account_name}
                          </span>
                        )}
                        {t.description}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)] flex items-center gap-1.5">
                        {t.category}
                        {t.split_id && (
                          <span className="text-[var(--color-today)] opacity-70 flex items-center gap-0.5">
                            <SplitIcon />
                          </span>
                        )}
                        {t.matched_name && (
                          <span className="text-[var(--color-today)] flex items-center gap-0.5">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                            </svg>
                            {t.matched_name}
                          </span>
                        )}
                        {t.mirror_id && (
                          <span title="Linked transfer" className="text-[var(--color-today)]">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                          </span>
                        )}
                      </span>
                    </div>
                    <span className={`text-sm font-mono font-semibold flex-shrink-0 ${typeColor[t.type] || ''}`}>
                      {t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </span>
                    {!t.is_scheduled && !isGhost && !isForecastActual && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); goRecurring(t) }}
                          title="Add as recurring"
                          className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-today)] hover:bg-[var(--color-today)]/10 transition-colors"
                        >
                          <RecurringIcon />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditingId(null)
                            startSplit(t)
                          }}
                          title="Split transaction"
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                            splittingId === t.id
                              ? 'text-[var(--color-today)] bg-[var(--color-today)]/10'
                              : 'text-[var(--color-muted)] hover:text-[var(--color-today)] hover:bg-[var(--color-today)]/10'
                          }`}
                        >
                          <SplitIcon />
                        </button>
                      </>
                    )}
                  </div>
                  {splittingId === t.id && (() => {
                    const total = Math.abs(t.amount)
                    const allocated = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
                    const remaining = Math.round((total - allocated) * 100) / 100
                    const overAllocated = remaining < -0.005
                    const fullyAllocated = Math.abs(remaining) <= 0.005 && allocated > 0
                    const splitCount = splitLines.filter(l => parseFloat(l.amount) > 0).length + (remaining > 0.005 ? 1 : 0)
                    return (
                      <div className="flex flex-col gap-2 bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-border)]">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-[var(--color-text)]">Split transaction</p>
                          <span className="text-[11px] font-mono text-[var(--color-muted)]">
                            total ${total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {splitLines.map((line, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="flex-1">
                              <CategoryInput
                                value={line.category}
                                onChange={v => setSplitLine(idx, 'category', v)}
                                categories={categories}
                                placeholder="Category"
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                              />
                            </div>
                            <input
                              type="number" min="0.01" step="0.01"
                              value={line.amount}
                              onChange={e => setSplitLine(idx, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="w-[4.5rem] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                            />
                            <button
                              onClick={() => setSplitLines(lines => lines.filter((_, i) => i !== idx))}
                              disabled={splitLines.length <= 1}
                              className="text-[var(--color-muted)] hover:text-[var(--color-expense)] disabled:opacity-30 p-1 text-base leading-none"
                            >×</button>
                          </div>
                        ))}

                        {/* Auto-remainder row */}
                        {remaining > 0.005 && (
                          <div className="flex items-center gap-1.5 opacity-50">
                            <div className="flex-1 px-2 py-1.5 text-xs text-[var(--color-muted)] border border-dashed border-[var(--color-border)] rounded-lg truncate">
                              {t.category || 'uncategorized'} <span className="text-[10px]">(remainder)</span>
                            </div>
                            <div className="w-[4.5rem] px-2 py-1.5 text-xs font-mono text-[var(--color-muted)] border border-dashed border-[var(--color-border)] rounded-lg text-right">
                              ${remaining.toFixed(2)}
                            </div>
                            <div className="w-6" />
                          </div>
                        )}

                        {overAllocated && (
                          <p className="text-[10px] text-[var(--color-expense)]">
                            Exceeds total by ${Math.abs(remaining).toFixed(2)}
                          </p>
                        )}
                        {fullyAllocated && !overAllocated && (
                          <p className="text-[10px] text-[var(--color-income)]">Fully allocated ✓</p>
                        )}
                        {splitError && (
                          <p className="text-[10px] text-[var(--color-expense)]">{splitError}</p>
                        )}

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSplitLines(l => [...l, { category: '', amount: '' }])}
                            className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)] px-2 py-1.5 rounded-lg border border-[var(--color-border)] whitespace-nowrap"
                          >+ Add line</button>
                          <button
                            onClick={() => submitSplit(t)}
                            disabled={overAllocated || splitSaving || splitCount < 2}
                            className="flex-1 py-1.5 rounded-lg bg-[var(--color-today)] text-black text-[11px] font-semibold disabled:opacity-40"
                          >
                            {splitSaving ? 'Saving…' : `Save ${splitCount} parts`}
                          </button>
                          <button
                            onClick={() => { setSplittingId(null); setSplitLines([]); setSplitError(null) }}
                            className="px-2.5 py-1.5 rounded-lg text-[var(--color-muted)] border border-[var(--color-border)] text-[11px]"
                          >Cancel</button>
                        </div>
                      </div>
                    )
                  })()}

                  {isEditing && splittingId !== t.id && editForm && (isManualTxn(t) || t.source === 'manual') && (
                    <div className="flex flex-col gap-2 bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-border)]">
                      {/* Type */}
                      <div className="flex gap-1.5">
                        {['income', 'expense', 'transfer'].map(type => (
                          <button
                            key={type}
                            onClick={() => setEditForm(f => ({ ...f, type }))}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors capitalize ${
                              editForm.type === type
                                ? `${typeBg[type]} ${TYPE_BORDER[type]} ${typeColor[type]}`
                                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                            }`}
                          >{type}</button>
                        ))}
                      </div>
                      {/* Forecast toggle */}
                      <button
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, is_projection: !f.is_projection }))}
                        className={`self-start text-[11px] px-2.5 py-1 rounded border transition-colors ${
                          editForm.is_projection
                            ? 'border-[var(--color-today)] text-[var(--color-today)] bg-[var(--color-today)]/10'
                            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                        }`}
                      >
                        Forecast only
                      </button>

                      {/* Transfer link */}
                      {editForm.type === 'transfer' && (
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] text-[var(--color-muted)] px-0.5">Link to account</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => setEditForm(f => ({ ...f, linked_account_id: null }))}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                !editForm.linked_account_id
                                  ? 'bg-[var(--color-expense)]/10 border-[var(--color-expense)] text-[var(--color-expense)]'
                                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                              }`}
                            >External</button>
                            {otherAccounts.map(a => (
                              <button key={a.id}
                                onClick={() => setEditForm(f => ({ ...f, linked_account_id: a.id }))}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  editForm.linked_account_id === a.id
                                    ? 'bg-[var(--color-transfer)]/10 border-[var(--color-transfer)] text-[var(--color-transfer)]'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                                }`}
                              >{a.name}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Description */}
                      <input
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Description"
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                      />
                      {/* Amount + Category */}
                      <div className="flex gap-2">
                        <input
                          type="number" min="0.01" step="0.01"
                          value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="Amount"
                          className="w-24 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                        />
                        <CategoryInput
                          value={editForm.category}
                          onChange={v => setEditForm(f => ({ ...f, category: v }))}
                          categories={categories}
                          placeholder="Category (optional)"
                          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                        />
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => submitFullEdit(t)}
                          disabled={editSaving}
                          className="flex-1 py-1.5 rounded-lg bg-[var(--color-today)] text-black text-[11px] font-semibold disabled:opacity-50"
                        >{editSaving ? 'Saving…' : 'Save'}</button>
                        <button
                          onClick={() => { setEditingId(null); setEditForm(null) }}
                          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-[11px]"
                        >Cancel</button>
                      </div>
                      {t.split_id && (
                        <button
                          onClick={() => handleUnsplit(t)}
                          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-expense)] text-left transition-colors"
                        >Un-split — merge back into one transaction</button>
                      )}
                      {/* Delete */}
                      <div className="border-t border-[var(--color-border)] pt-2 mt-1">
                        {confirmDeleteId === t.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[var(--color-expense)] flex-1">Delete this transaction?</span>
                            <button onClick={() => handleDelete(t)} className="px-2.5 py-1 rounded-lg bg-[var(--color-expense)] text-white text-[11px] font-semibold">Delete</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-[11px]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(t.id)} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
                            Delete transaction
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isEditing && splittingId !== t.id && !isManualTxn(t) && t.source !== 'manual' && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        {['income', 'expense', 'transfer'].map(type => (
                          <button
                            key={type}
                            onClick={() => {
                              if (type === 'transfer') {
                                setLinkingId(t.id)
                              } else {
                                setEditingId(null)
                                setLinkingId(null)
                                onTypeChange?.(t.id, type, null)
                              }
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors capitalize ${
                              t.type === type
                                ? `${typeBg[type]} ${TYPE_BORDER[type]} ${typeColor[type]}`
                                : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      {(linkingId === t.id || t.type === 'transfer') && (
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] text-[var(--color-muted)] px-0.5">Link to account (leave unset = counts as expense)</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => { setEditingId(null); setLinkingId(null); onTypeChange?.(t.id, 'transfer', null) }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                !t.linked_account_id && t.type === 'transfer'
                                  ? 'bg-[var(--color-expense)]/10 border-[var(--color-expense)] text-[var(--color-expense)]'
                                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
                              }`}
                            >External</button>
                            {otherAccounts.map(a => (
                              <button
                                key={a.id}
                                onClick={() => { setEditingId(null); setLinkingId(null); onTypeChange?.(t.id, 'transfer', a.id) }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  t.linked_account_id === a.id
                                    ? 'bg-[var(--color-transfer)]/10 border-[var(--color-transfer)] text-[var(--color-transfer)]'
                                    : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
                                }`}
                              >{a.name}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <CategoryInput
                        value={editCatVal}
                        onChange={setEditCatVal}
                        onSave={async (val) => {
                          const trimmed = (val || '').trim()
                          if (trimmed === (t.category || '')) return
                          try {
                            await patchTransaction(t.id, { category: trimmed || null })
                            onCategoryChange?.(t.id, trimmed || null)
                          } catch { /* ignore */ }
                        }}
                        onCommit={() => { setEditingId(null); setLinkingId(null); onClose() }}
                        categories={categories}
                        placeholder="Category (optional)"
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                      />
                      {t.split_id && (
                        <button
                          onClick={() => handleUnsplit(t)}
                          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-expense)] text-left transition-colors"
                        >
                          Un-split — merge back into one transaction
                        </button>
                      )}
                      {/* Delete */}
                      <div className="border-t border-[var(--color-border)] pt-1.5 mt-0.5">
                        {confirmDeleteId === t.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[var(--color-expense)] flex-1">Delete this transaction?</span>
                            <button onClick={() => handleDelete(t)} className="px-2.5 py-1 rounded-lg bg-[var(--color-expense)] text-white text-[11px] font-semibold">Delete</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] text-[11px]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(t.id)} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
                            Delete transaction
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add transaction form / button */}
        <div className="mt-4">
          {showAddForm ? (
            <form onSubmit={submitAdd} className="flex flex-col gap-3 bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text)]">Add transaction</p>

              {/* Account selector (group view only) */}
              {multiAccount && accounts.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-[var(--color-muted)]">Account</p>
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map(a => (
                      <button type="button" key={a.id}
                        onClick={() => setAdd('account_id', a.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          addForm.account_id === a.id
                            ? 'bg-[var(--color-today)]/10 border-[var(--color-today)] text-[var(--color-today)]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                        }`}
                      >{a.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type selector */}
              <div className="flex gap-1.5">
                {['income', 'expense', 'transfer'].map(type => (
                  <button type="button" key={type}
                    onClick={() => setAdd('type', type)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors capitalize ${
                      addForm.type === type
                        ? `${TYPE_BG_MAP[type]} ${TYPE_BORDER[type]} ${TYPE_COLOR_MAP[type]}`
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >{type}</button>
                ))}
              </div>

              {/* Forecast toggle */}
              <button
                type="button"
                onClick={() => setAdd('is_projection', !addForm.is_projection)}
                className={`self-start text-[11px] px-2.5 py-1 rounded border transition-colors ${
                  addForm.is_projection
                    ? 'border-[var(--color-today)] text-[var(--color-today)] bg-[var(--color-today)]/10'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                }`}
              >
                Forecast only
              </button>

              {/* Transfer account link */}
              {addForm.type === 'transfer' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-[var(--color-muted)]">Link to account — leave External if sending to someone else</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button"
                      onClick={() => setAdd('linked_account_id', null)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                        !addForm.linked_account_id
                          ? 'bg-[var(--color-expense)]/10 border-[var(--color-expense)] text-[var(--color-expense)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                      }`}
                    >External</button>
                    {otherAccounts.map(a => (
                      <button type="button" key={a.id}
                        onClick={() => setAdd('linked_account_id', a.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          addForm.linked_account_id === a.id
                            ? 'bg-[var(--color-transfer)]/10 border-[var(--color-transfer)] text-[var(--color-transfer)]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                        }`}
                      >{a.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <input
                value={addForm.description}
                onChange={e => setAdd('description', e.target.value)}
                onBlur={handleCategorySuggest}
                placeholder="Description (e.g. Interest charge)"
                autoFocus
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
              />

              {/* Amount + Category */}
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <input
                    type="number" min="0" step="0.01"
                    value={addForm.amount}
                    onChange={e => setAdd('amount', e.target.value)}
                    onBlur={handleCategorySuggest}
                    placeholder="Amount"
                    className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                  />
                  <CategoryInput
                    value={addForm.category}
                    onChange={v => { setAdd('category', v); setSuggestedCategory(null) }}
                    categories={categories}
                    placeholder="Category (optional)"
                    className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                  />
                </div>
                {suggestedCategory && addForm.category === suggestedCategory && (
                  <p className="text-[10px] text-[var(--color-muted)] px-0.5 text-right">auto-suggested</p>
                )}
              </div>

              {addError && <p className="text-xs text-[var(--color-expense)]">{addError}</p>}

              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-[var(--color-today)] text-black text-sm font-semibold disabled:opacity-50"
                >{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => { setShowAddForm(false); setAddError(null); setSuggestedCategory(null); setAddForm({ description: '', amount: '', type: 'expense', category: '', linked_account_id: null, account_id: accountId, is_projection: false }) }}
                  className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] text-sm"
                >Cancel</button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] text-sm font-semibold hover:text-[var(--color-text)] hover:border-[var(--color-text)]/40 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add transaction
              </button>
              <button
                onClick={() => {
                  const p = new URLSearchParams({ date: day.date })
                  if (accountId) p.set('account_id', accountId)
                  onClose()
                  navigate(`/recurring?${p}`)
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--color-today)]/50 text-[var(--color-today)] text-sm font-semibold hover:bg-[var(--color-today)]/10 transition-colors"
              >
                <RecurringIcon />
                New recurring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
