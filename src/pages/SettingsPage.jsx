import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { resetBudget } from '../api/settings'
import { fetchWorkspaces, renameWorkspace, deleteWorkspace } from '../api/workspaces'
import { getWorkspaceId, setWorkspaceId } from '../workspace'

const CONFIRM_PHRASE = 'RESET'

function WorkspaceRow({ workspace, isCurrent, onRenamed, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(workspace.name)
  const [confirmText, setConfirmText] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function saveRename() {
    const next = nameDraft.trim()
    if (!next || next === workspace.name) { setEditing(false); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await renameWorkspace(workspace.id, next)
      onRenamed(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    try {
      await deleteWorkspace(workspace.id)
      onDeleted(workspace.id)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="bg-[var(--color-surface-2)] rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            value={nameDraft}
            autoFocus
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 bg-[var(--color-surface)] border border-[var(--color-today)] rounded-lg px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none"
          />
        ) : (
          <span className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            {workspace.name}
            {isCurrent && <span className="text-[9px] text-[var(--color-today)] border border-[var(--color-today)]/50 rounded-full px-1.5 py-0.5">current</span>}
          </span>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={saveRename} disabled={saving} className="text-xs text-[var(--color-today)] font-semibold disabled:opacity-50">Save</button>
              <button onClick={() => { setEditing(false); setNameDraft(workspace.name) }} className="text-xs text-[var(--color-muted)]">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">Rename</button>
              <button onClick={() => setShowDelete(v => !v)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-expense)]">Delete</button>
            </>
          )}
        </div>
      </div>

      {showDelete && (
        <div className="border-t border-[var(--color-border)] pt-2">
          <p className="text-[11px] text-[var(--color-expense)] mb-1.5">
            Permanently deletes every account, transaction, recurring item, and budget in "{workspace.name}". Type the name to confirm.
          </p>
          <div className="flex gap-2">
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={workspace.name}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-expense)]"
            />
            <button
              onClick={handleDelete}
              disabled={confirmText !== workspace.name || saving}
              className="px-3 py-1 rounded-lg bg-[var(--color-expense)] text-white text-xs font-semibold disabled:opacity-40"
            >
              {saving ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-[var(--color-expense)]">{error}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const currentId = getWorkspaceId()

  useEffect(() => { fetchWorkspaces().then(setWorkspaces).catch(() => {}) }, [])

  function handleRenamed(updated) {
    setWorkspaces(prev => prev.map(w => w.id === updated.id ? updated : w))
  }

  function handleDeleted(id) {
    const remaining = workspaces.filter(w => w.id !== id)
    setWorkspaces(remaining)
    if (id === currentId && remaining.length > 0) {
      setWorkspaceId(remaining[0].id)
      window.location.reload()
    }
  }

  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await resetBudget()
      setDone(true)
      setTimeout(() => navigate('/accounts'), 1200)
    } catch (err) {
      setError(err.message)
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto pb-24">
      <h1 className="text-lg font-bold text-[var(--color-text)] mb-1">Settings</h1>
      <p className="text-xs text-[var(--color-muted)] mb-6">Manage app-wide data and preferences.</p>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Workspaces</p>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Separate budgets — e.g. Personal, a partner's budget, or a business. Switch between them from the bar at the top.
        </p>
        <div className="flex flex-col gap-2">
          {workspaces.map(w => (
            <WorkspaceRow key={w.id} workspace={w} isCurrent={w.id === currentId} onRenamed={handleRenamed} onDeleted={handleDeleted} />
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-expense)]/40 p-4 mb-4">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Reset current workspace</p>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Permanently deletes every account, transaction, recurring item, and learned category default
          in the current workspace only. This cannot be undone — you'll start from a completely empty budget.
        </p>

        {done ? (
          <p className="text-sm text-[var(--color-income)]">Budget reset. Redirecting…</p>
        ) : (
          <>
            <label className="text-xs text-[var(--color-muted)] mb-1.5 block">
              Type <span className="font-mono font-semibold text-[var(--color-text)]">{CONFIRM_PHRASE}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-expense)] mb-3"
            />
            {error && <p className="text-xs text-[var(--color-expense)] mb-3">{error}</p>}
            <button
              onClick={handleReset}
              disabled={confirmText !== CONFIRM_PHRASE || resetting}
              className="w-full py-2.5 rounded-xl bg-[var(--color-expense)] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resetting ? 'Resetting…' : 'Reset everything'}
            </button>
          </>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 opacity-60">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">More settings</p>
        <p className="text-xs text-[var(--color-muted)]">
          Currency conversion and other preferences are coming soon.
        </p>
      </div>
    </div>
  )
}
