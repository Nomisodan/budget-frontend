import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchAccounts, createAccount, updateAccount, deleteAccount,
  addAccountToGroup, removeAccountFromGroup, renameGroup, deleteGroup as apiDeleteGroup,
} from '../api/accounts'
import { uploadCsv } from '../api/upload'
import { previewDeleteRange, deleteTransactionRange } from '../api/transactions'

const EXPORT_INSTRUCTIONS = {
  bmo: 'Online Banking → Accounts → Download → CSV',
  scotiabank: 'Online Banking → Accounts → Download Transactions → CSV',
  desjardins: 'AccèsD → My accounts → Select account → Export → CSV',
  capital_one: 'Online Account → Statements → Download → CSV',
  loc: 'Online Banking → Accounts → Line of Credit → Download Transactions → CSV',
}

const BANK_OPTIONS = [
  { value: 'bmo',         label: 'BMO' },
  { value: 'scotiabank',  label: 'Scotiabank' },
  { value: 'desjardins',  label: 'Desjardins' },
  { value: 'capital_one', label: 'Capital One' },
  { value: 'loc',         label: 'Line of Credit' },
  { value: 'loan',        label: 'Loan' },
  { value: 'other',       label: 'Other' },
  { value: 'cash',        label: 'Cash' },
]
const BANK_LABEL = Object.fromEntries(BANK_OPTIONS.map(o => [o.value, o.label]))
const BANK_COLOR = {
  bmo:         'text-[var(--color-transfer)] bg-[var(--color-transfer)]/10',
  scotiabank:  'text-[var(--color-income)]   bg-[var(--color-income)]/10',
  desjardins:  'text-[var(--color-income)]   bg-[var(--color-income)]/10',
  capital_one: 'text-[var(--color-expense)]  bg-[var(--color-expense)]/10',
  loc:         'text-[var(--color-expense)]  bg-[var(--color-expense)]/10',
  loan:        'text-[var(--color-expense)]  bg-[var(--color-expense)]/10',
  other:       'text-[var(--color-muted)]    bg-[var(--color-surface-2)]',
  cash:        'text-[var(--color-today)]    bg-[var(--color-today)]/10',
}

// Accounts with no bank CSV to import against — balance is tracked manually instead.
const NO_IMPORT_BANKS = new Set(['cash', 'loan'])

const EMPTY_FORM = { name: '', bank: 'bmo', balance: '', balance_date: new Date().toISOString().slice(0, 10), group_name: '' }

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({ group, allAccounts, onAccountsUpdated, onReload }) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(group.name)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingId, setAddingId] = useState('')

  // An account can belong to several groups — only exclude ones already in *this* group.
  const availableToAdd = allAccounts.filter(a => !(a.group_names ?? []).includes(group.name))

  async function saveRename() {
    const next = nameDraft.trim()
    if (!next || next === group.name) { setEditingName(false); return }
    setSaving(true)
    await renameGroup(group.name, next)
    await onReload()
    setEditingName(false)
    setSaving(false)
  }

  async function removeAccount(id) {
    const updated = await removeAccountFromGroup(id, group.name)
    onAccountsUpdated([updated])
  }

  async function addAccount() {
    if (!addingId) return
    const updated = await addAccountToGroup(Number(addingId), group.name)
    onAccountsUpdated([updated])
    setAddingId('')
  }

  async function deleteGroup() {
    setSaving(true)
    await apiDeleteGroup(group.name)
    await onReload()
    setSaving(false)
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-2)]">
        {editingName ? (
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingName(false) }}
            autoFocus
            className="flex-1 bg-[var(--color-surface)] border border-[var(--color-today)] rounded-lg px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none mr-2"
          />
        ) : (
          <span className="text-sm font-semibold text-[var(--color-text)]">{group.name}</span>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {editingName ? (
            <>
              <button onClick={saveRename} disabled={saving}
                className="text-xs text-[var(--color-today)] font-semibold disabled:opacity-50">
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => { setEditingName(false); setNameDraft(group.name) }}
                className="text-xs text-[var(--color-muted)]">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => { setEditingName(true); setNameDraft(group.name) }}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded px-2 py-0.5 transition-colors">
              Rename
            </button>
          )}
        </div>
      </div>

      {/* Accounts in this group */}
      <div className="divide-y divide-[var(--color-border)]">
        {group.accounts.map(a => (
          <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${BANK_COLOR[a.bank] ?? BANK_COLOR.other}`}>
                {BANK_LABEL[a.bank] ?? a.bank}
              </span>
              <span className="text-sm text-[var(--color-text)] truncate">{a.name}</span>
            </div>
            <button onClick={() => removeAccount(a.id)}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors flex-shrink-0 ml-2">
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add account / delete group */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)]">
        {availableToAdd.length > 0 ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={addingId}
              onChange={e => setAddingId(e.target.value)}
              className="flex-1 min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
            >
              <option value="">Add account…</option>
              {availableToAdd.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {addingId && (
              <button onClick={addAccount}
                className="text-xs text-[var(--color-today)] font-semibold flex-shrink-0">
                Add
              </button>
            )}
          </div>
        ) : (
          <span />
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-[var(--color-expense)]">Remove all accounts from group?</span>
            <button onClick={deleteGroup} disabled={saving}
              className="text-xs text-[var(--color-expense)] font-semibold disabled:opacity-50">
              {saving ? '…' : 'Yes'}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs text-[var(--color-muted)]">
              No
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors flex-shrink-0">
            Delete group
          </button>
        )}
      </div>
    </div>
  )
}

// ─── NewGroupForm ─────────────────────────────────────────────────────────────

function NewGroupForm({ allAccounts, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggle(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    const groupName = name.trim()
    if (!groupName) { setError('Group name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await Promise.all(
        [...selectedIds].map(id => addAccountToGroup(id, groupName))
      )
      onCreated(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-today)]/50 p-4 mb-3 flex flex-col gap-3">
      <p className="text-sm font-semibold text-[var(--color-text)]">New group</p>

      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Group name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Cash/Debit, Credit Cards"
          autoFocus
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
      </div>

      {allAccounts.length > 0 && (
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
            Add accounts to this group
          </label>
          <div className="flex flex-col gap-1.5">
            {allAccounts.map(a => (
              <label key={a.id} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="accent-[var(--color-today)] w-4 h-4"
                />
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${BANK_COLOR[a.bank] ?? BANK_COLOR.other}`}>
                  {BANK_LABEL[a.bank] ?? a.bank}
                </span>
                <span className="text-sm text-[var(--color-text)]">{a.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[var(--color-expense)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-lg bg-[var(--color-today)] text-black text-sm font-semibold disabled:opacity-50">
          {saving ? 'Creating…' : 'Create group'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── ImportPanel (CSV import + delete range, scoped to one account) ───────────

function ImportPanel({ account }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const inputRef = useRef(null)

  const [showDelete, setShowDelete] = useState(false)
  const [delFrom, setDelFrom] = useState('')
  const [delTo, setDelTo] = useState('')
  const [preview, setPreview] = useState(null)
  const [delStatus, setDelStatus] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  const canImport = !NO_IMPORT_BANKS.has(account.bank)

  function handleFile(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) { setStatus({ error: 'Please select a .csv file' }); return }
    setFile(f)
    setStatus(null)
  }
  function onDrop(e) {
    e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0])
  }
  async function handleSubmit() {
    if (!file) return
    setStatus('loading')
    try { setStatus(await uploadCsv(account.id, file)) }
    catch (err) { setStatus({ error: err.message }) }
  }
  function resetFile() {
    setFile(null); setStatus(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handlePreview() {
    if (!delFrom || !delTo) return
    setDelStatus('previewing')
    setConfirmed(false)
    setPreview(null)
    try {
      const { count } = await previewDeleteRange(account.id, delFrom, delTo)
      setPreview(count)
      setDelStatus(null)
    } catch (err) {
      setDelStatus({ error: err.message })
    }
  }
  async function handleDelete() {
    if (!delFrom || !delTo) return
    setDelStatus('loading')
    try {
      const result = await deleteTransactionRange(account.id, delFrom, delTo)
      setDelStatus(result)
      setPreview(null)
      setConfirmed(false)
    } catch (err) {
      setDelStatus({ error: err.message })
    }
  }

  const canSubmit = file && status !== 'loading'
  const canPreview = delFrom && delTo && delFrom <= delTo && delStatus !== 'previewing'

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-col gap-3">
      {canImport ? (
        <>
          <div
            className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${
              dragging ? 'border-[var(--color-today)] bg-[var(--color-today)]/5'
              : file ? 'border-[var(--color-income)] bg-[var(--color-income)]/5'
              : 'border-[var(--color-border)] hover:border-[var(--color-muted)]'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef} type="file"
              accept=".csv,text/csv,text/plain,text/comma-separated-values,application/csv,application/vnd.ms-excel,application/octet-stream"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-income)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>
                </svg>
                <span className="text-xs font-medium text-[var(--color-income)] text-center break-all">{file.name}</span>
                <button onClick={e => { e.stopPropagation(); resetFile() }} className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-expense)] underline">Remove</button>
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-xs text-[var(--color-muted)] text-center">Tap to choose a CSV file<br/><span className="text-[10px]">or drag and drop</span></p>
              </>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              canSubmit ? 'bg-[var(--color-today)] text-black hover:opacity-90' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] cursor-not-allowed'
            }`}
          >{status === 'loading' ? 'Importing…' : 'Import Transactions'}</button>

          {status && status !== 'loading' && (
            <div className={`rounded-xl p-3 ${status.error ? 'bg-[var(--color-expense)]/10 border border-[var(--color-expense)]/30' : 'bg-[var(--color-income)]/10 border border-[var(--color-income)]/30'}`}>
              {status.error ? (
                <p className="text-xs text-[var(--color-expense)]">{status.error}</p>
              ) : status.total === 0 ? (
                <>
                  <p className="text-xs font-semibold text-[var(--color-expense)] mb-1">No rows recognized</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    Parser used: <span className="font-mono text-[var(--color-text)]">{status.bank ?? '?'}</span>. Detected headers: {(status.detected_headers ?? []).join(', ') || 'none'}
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Total', status.total, 'text-[var(--color-text)]'], ['Imported', status.inserted, 'text-[var(--color-income)]'], ['Matched', status.matched ?? 0, 'text-[var(--color-today)]'], ['Skipped', status.skipped, 'text-[var(--color-muted)]']].map(([label, val, cls]) => (
                    <div key={label}>
                      <p className={`text-sm font-bold font-mono ${cls}`}>{val}</p>
                      <p className="text-[9px] text-[var(--color-muted)]">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-[var(--color-muted)]">
            {EXPORT_INSTRUCTIONS[account.bank] ?? 'Download a CSV export from your online banking portal.'}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">{BANK_LABEL[account.bank] ?? account.bank} accounts don't have a CSV to import — add transactions manually from the calendar.</p>
      )}

      {/* Delete range disclosure */}
      <div className="pt-2 border-t border-[var(--color-border)]/50">
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
            Delete transactions in a date range…
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] text-[var(--color-muted)]">From</label>
                <input
                  type="date"
                  value={delFrom}
                  onChange={e => { setDelFrom(e.target.value); setPreview(null); setDelStatus(null); setConfirmed(false) }}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-expense)] [color-scheme:dark]"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] text-[var(--color-muted)]">To</label>
                <input
                  type="date"
                  value={delTo}
                  onChange={e => { setDelTo(e.target.value); setPreview(null); setDelStatus(null); setConfirmed(false) }}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-expense)] [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!canPreview}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  canPreview ? 'bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-muted)]' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] cursor-not-allowed'
                }`}
              >{delStatus === 'previewing' ? 'Checking…' : 'Preview'}</button>
              <button onClick={() => setShowDelete(false)} className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
                ✕
              </button>
            </div>

            {delStatus?.error && <p className="text-xs text-[var(--color-expense)]">{delStatus.error}</p>}

            {preview !== null && !delStatus?.deleted && (
              <div className="rounded-lg bg-[var(--color-expense)]/10 border border-[var(--color-expense)]/30 p-3">
                <p className="text-xs font-semibold text-[var(--color-expense)] mb-1">
                  {preview === 0 ? 'No transactions found in this range' : `${preview} transaction${preview !== 1 ? 's' : ''} will be permanently deleted`}
                </p>
                {preview > 0 && (
                  !confirmed ? (
                    <button onClick={() => setConfirmed(true)}
                      className="mt-1 w-full py-2 rounded-lg border border-[var(--color-expense)] text-[var(--color-expense)] text-xs font-semibold hover:bg-[var(--color-expense)]/10 transition-colors">
                      I understand — delete {preview} transaction{preview !== 1 ? 's' : ''}
                    </button>
                  ) : (
                    <button onClick={handleDelete} disabled={delStatus === 'loading'}
                      className="mt-1 w-full py-2 rounded-lg bg-[var(--color-expense)] text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-colors">
                      {delStatus === 'loading' ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                  )
                )}
              </div>
            )}

            {delStatus?.deleted !== undefined && (
              <div className="rounded-lg bg-[var(--color-income)]/10 border border-[var(--color-income)]/30 p-3">
                <p className="text-xs font-semibold text-[var(--color-income)]">
                  Done — {delStatus.deleted} transaction{delStatus.deleted !== 1 ? 's' : ''} deleted
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AccountCard ──────────────────────────────────────────────────────────────

function AccountCard({ account, groupNames, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [bankDraft, setBankDraft] = useState(account.bank)
  const [groupsDraft, setGroupsDraft] = useState(new Set())
  const [newGroupInput, setNewGroupInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const [dateDraft, setDateDraft] = useState(account.balance_date ?? new Date().toISOString().slice(0, 10))

  function startEdit() {
    setDraft(account.balance.toString())
    setNameDraft(account.name)
    setBankDraft(account.bank)
    setGroupsDraft(new Set(account.group_names ?? []))
    setNewGroupInput('')
    setDateDraft(account.balance_date ?? new Date().toISOString().slice(0, 10))
    setEditing(true)
    setShowImport(false)
    setError(null)
  }

  function cancel() {
    setEditing(false)
    setConfirming(false)
    setError(null)
  }

  function toggleGroup(name) {
    setGroupsDraft(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  function addNewGroup() {
    const name = newGroupInput.trim()
    if (!name) return
    setGroupsDraft(prev => new Set(prev).add(name))
    setNewGroupInput('')
  }

  async function save() {
    const val = parseFloat(draft)
    if (isNaN(val)) { setError('Enter a valid number'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAccount(account.id, {
        balance: val,
        name: nameDraft.trim() || account.name,
        bank: bankDraft,
        balance_date: dateDraft || null,
        group_names: [...groupsDraft],
      })
      onSaved(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteAccount(account.id)
      onDeleted(account.id)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  const balanceColor = account.balance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BANK_COLOR[account.bank] ?? BANK_COLOR.other}`}>
            {BANK_LABEL[account.bank] ?? account.bank}
          </span>
          {!editing && <span className="text-sm font-semibold text-[var(--color-text)]">{account.name}</span>}
          {!editing && (account.group_names ?? []).map(g => (
            <span key={g} className="text-[10px] text-[var(--color-muted)] border border-[var(--color-border)] rounded-full px-1.5 py-0.5">
              {g}
            </span>
          ))}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">Account name</label>
            <input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">
              Bank <span className="text-[var(--color-muted)]">— determines which CSV format is expected on import</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BANK_OPTIONS.map(o => (
                <button type="button" key={o.value}
                  onClick={() => setBankDraft(o.value)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    bankDraft === o.value
                      ? 'bg-[var(--color-today)]/15 border-[var(--color-today)] text-[var(--color-today)]'
                      : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">Groups <span className="normal-case text-[var(--color-muted)]">— an account can belong to more than one</span></label>
            {groupsDraft.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {[...groupsDraft].map(g => (
                  <span key={g} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--color-today)]/15 border border-[var(--color-today)] text-[var(--color-today)]">
                    {g}
                    <button type="button" onClick={() => toggleGroup(g)} className="hover:opacity-70">✕</button>
                  </span>
                ))}
              </div>
            )}
            {groupNames.filter(g => !groupsDraft.has(g)).length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) toggleGroup(e.target.value) }}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)] mb-1.5"
              >
                <option value="">+ Add to existing group…</option>
                {groupNames.filter(g => !groupsDraft.has(g)).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <input
                value={newGroupInput}
                onChange={e => setNewGroupInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewGroup() } }}
                placeholder="Or type a new group name…"
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
              />
              {newGroupInput.trim() && (
                <button type="button" onClick={addNewGroup}
                  className="px-3 py-2 rounded-lg bg-[var(--color-surface-2)] text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Add
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1 block">Opening balance ($)</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDraft(d => d.startsWith('-') ? d.slice(1) : `-${d}`)}
                  title="Toggle negative"
                  className="px-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-text)] hover:border-[var(--color-today)]"
                >
                  ±
                </button>
                <input
                  type="text" inputMode="decimal"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoFocus
                  className="w-full min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
                  placeholder="-598.81"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1 block">As of date</label>
              <input
                type="date"
                value={dateDraft}
                onChange={e => setDateDraft(e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
              />
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-muted)]">Enter your balance before any transactions on that date. Negative for credit cards / overdraft.</p>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-today)] text-black text-sm font-semibold disabled:opacity-50">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={cancel}
              className="px-3 py-2 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] text-sm">
              ✕
            </button>
          </div>
          {error && <p className="text-xs text-[var(--color-expense)]">{error}</p>}
          {confirming ? (
            <div className="flex gap-2 mt-1">
              <p className="text-xs text-[var(--color-expense)] flex-1">Delete this account and all its transactions?</p>
              <button onClick={handleDelete} disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-expense)]/20 text-[var(--color-expense)] text-xs font-semibold">
                Yes, delete
              </button>
              <button onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="text-xs text-[var(--color-expense)] text-left mt-1 hover:underline">
              Delete account…
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xl font-bold font-mono ${balanceColor}`}>
              {account.balance < 0 ? '-' : ''}${Math.abs(account.balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
              opening balance{account.balance_date ? ` · ${new Date(account.balance_date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowImport(v => !v)}
              className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors border ${
                showImport
                  ? 'text-[var(--color-today)] border-[var(--color-today)] bg-[var(--color-today)]/10'
                  : 'text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
              }`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import
            </button>
            <button onClick={startEdit}
              className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>
        </div>
      )}

      {showImport && !editing && <ImportPanel account={account} />}
    </div>
  )
}

// ─── AddAccountForm ───────────────────────────────────────────────────────────

function AddAccountForm({ groupNames, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const created = await createAccount({
        name: form.name.trim(),
        bank: form.bank,
        balance: parseFloat(form.balance) || 0,
        balance_date: form.balance_date || null,
        group_names: form.group_name.trim() ? [form.group_name.trim()] : [],
      })
      onCreated(created)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-today)]/50 flex flex-col gap-3">
      <p className="text-sm font-semibold text-[var(--color-text)]">New account</p>

      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Bank</label>
        <div className="grid grid-cols-2 gap-1.5">
          {BANK_OPTIONS.map(o => (
            <button type="button" key={o.value}
              onClick={() => set('bank', o.value)}
              className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                form.bank === o.value
                  ? 'bg-[var(--color-today)]/15 border-[var(--color-today)] text-[var(--color-today)]'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >{o.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Account name</label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. BMO Chequing, Scotia Savings"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
      </div>

      <div>
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Group (optional)</label>
        <input
          list="new-account-groups"
          value={form.group_name}
          onChange={e => set('group_name', e.target.value)}
          placeholder="None"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
        <datalist id="new-account-groups">
          {groupNames.map(g => <option key={g} value={g} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">Opening balance ($)</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => set('balance', form.balance.startsWith('-') ? form.balance.slice(1) : `-${form.balance}`)}
              title="Toggle negative"
              className="px-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-text)] hover:border-[var(--color-today)]"
            >
              ±
            </button>
            <input
              type="text" inputMode="decimal"
              value={form.balance}
              onChange={e => set('balance', e.target.value)}
              placeholder="0.00"
              className="w-full min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">As of date</label>
          <input
            type="date"
            value={form.balance_date}
            onChange={e => set('balance_date', e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
        </div>
      </div>
      <p className="text-[10px] text-[var(--color-muted)] -mt-1">Balance before any transactions on that date. Negative for credit cards / overdraft.</p>

      {error && <p className="text-xs text-[var(--color-expense)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--color-today)] text-black font-semibold text-sm disabled:opacity-50">
          {saving ? 'Adding…' : 'Add account'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-muted)] text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── AccountsPage ─────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)

  const reload = useCallback(() => {
    return fetchAccounts().then(setAccounts)
  }, [])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  // Derive groups from accounts — an account may appear under more than one group
  const groupMap = {}
  for (const a of accounts) {
    for (const gn of a.group_names ?? []) {
      if (!groupMap[gn]) groupMap[gn] = []
      groupMap[gn].push(a)
    }
  }
  const groups = Object.entries(groupMap).map(([name, accts]) => ({ name, accounts: accts }))
  const groupNames = groups.map(g => g.name)

  function onAccountsUpdated(updatedList) {
    setAccounts(prev => prev.map(a => {
      const u = updatedList.find(u => u.id === a.id)
      return u ?? a
    }))
  }

  function onSaved(updated) {
    setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  function onDeleted(id) {
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function onCreated(account) {
    setAccounts(prev => [...prev, account])
    setShowForm(false)
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto pb-24">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-[var(--color-text)]">Accounts</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-[var(--color-today)] text-black text-sm font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--color-muted)] mb-6">
        Set each account's opening balance so the calendar running total is accurate.
      </p>

      {loading ? (
        <p className="text-center py-20 text-[var(--color-muted)]">Loading…</p>
      ) : (
        <>
          {showForm && (
            <div className="mb-4">
              <AddAccountForm groupNames={groupNames} onCreated={onCreated} onCancel={() => setShowForm(false)} />
            </div>
          )}

          {/* ── Groups section ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Groups</p>
              {!showNewGroup && (
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="flex items-center gap-1 text-xs text-[var(--color-today)] border border-[var(--color-today)]/40 rounded-lg px-2 py-1 hover:bg-[var(--color-today)]/10 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New group
                </button>
              )}
            </div>

            {showNewGroup && (
              <NewGroupForm
                allAccounts={accounts}
                onCreated={updated => { onAccountsUpdated(updated); setShowNewGroup(false) }}
                onCancel={() => setShowNewGroup(false)}
              />
            )}

            {groups.map(g => (
              <GroupCard key={g.name} group={g} allAccounts={accounts} onAccountsUpdated={onAccountsUpdated} onReload={reload} />
            ))}

            {groups.length === 0 && !showNewGroup && (
              <p className="text-xs text-[var(--color-muted)] text-center py-4 border border-dashed border-[var(--color-border)] rounded-xl">
                No groups yet — groups let you combine accounts in the calendar view.
              </p>
            )}
          </div>

          {/* ── Accounts section ── */}
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-3">Accounts</p>
          <div className="flex flex-col gap-3 mb-6">
            {accounts.map(a => (
              <AccountCard key={a.id} account={a} groupNames={groupNames} onSaved={onSaved} onDeleted={onDeleted} />
            ))}
            {accounts.length === 0 && !showForm && (
              <p className="text-center py-10 text-[var(--color-muted)] text-sm">No accounts yet — tap Add to create one.</p>
            )}
          </div>

          {accounts.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-muted)] mb-1">Net balance across all accounts</p>
              <p className={`text-2xl font-bold font-mono ${totalBalance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                {totalBalance < 0 ? '-' : ''}${Math.abs(totalBalance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
