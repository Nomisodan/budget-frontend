import { useState, useEffect } from 'react'
import { fetchWorkspaces, createWorkspace } from '../api/workspaces'
import { getWorkspaceId, setWorkspaceId } from '../workspace'

export default function WorkspaceBar() {
  const [workspaces, setWorkspaces] = useState([])
  const [currentId, setCurrentId] = useState(getWorkspaceId())
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchWorkspaces().then(list => {
      setWorkspaces(list)
      // First-ever load, or the active workspace no longer exists — fall back to the first one.
      if (list.length > 0 && !list.some(w => w.id === currentId)) {
        setWorkspaceId(list[0].id)
        setCurrentId(list[0].id)
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTo(id) {
    if (id === currentId) return
    setWorkspaceId(id)
    window.location.reload()
  }

  async function createNew(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      const ws = await createWorkspace(name)
      setWorkspaceId(ws.id)
      window.location.reload()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (workspaces.length === 0) return null

  return (
    <div className="relative sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-2 flex items-center justify-between gap-3">
      <select
        value={currentId ?? ''}
        onChange={e => switchTo(Number(e.target.value))}
        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-sm font-medium text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)] max-w-[60%] truncate"
      >
        {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      {!showNew ? (
        <button onClick={() => setShowNew(true)} className="text-xs text-[var(--color-today)] font-semibold flex-shrink-0">
          + New workspace
        </button>
      ) : (
        <form onSubmit={createNew} className="flex items-center gap-1.5 flex-shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Business"
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs w-28 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
          <button type="submit" disabled={saving} className="text-xs text-[var(--color-today)] font-semibold disabled:opacity-50">
            {saving ? '…' : 'Add'}
          </button>
          <button type="button" onClick={() => { setShowNew(false); setNewName(''); setError(null) }} className="text-xs text-[var(--color-muted)]">
            ✕
          </button>
        </form>
      )}
      {error && <p className="absolute top-full left-0 right-0 text-[10px] text-[var(--color-expense)] px-4 py-1 bg-[var(--color-surface)]">{error}</p>}
    </div>
  )
}
