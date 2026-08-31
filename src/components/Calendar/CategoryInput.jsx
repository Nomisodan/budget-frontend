import { useState, useRef } from 'react'

export default function CategoryInput({ value, onChange, onSave, onCommit, categories = [], placeholder = 'Category', className = '' }) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const listRef = useRef(null)
  const savedRef = useRef(false)

  const lower = (value || '').toLowerCase()
  const filtered = categories
    .filter(c => !lower || c.toLowerCase().includes(lower))
    .slice(0, 10)

  function handleSelect(cat) {
    onChange(cat)
    setOpen(false)
    setHighlighted(-1)
    savedRef.current = true
    onSave?.(cat)
    onCommit?.()
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false)
      setHighlighted(-1)
      if (!savedRef.current) {
        onSave?.(value)
      }
      savedRef.current = false
    }, 150)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open || filtered.length === 0) return
      e.preventDefault()
      setHighlighted(i => {
        const next = e.key === 'ArrowDown'
          ? Math.min(i + 1, filtered.length - 1)
          : Math.max(i - 1, 0)
        scrollIntoView(next)
        return next
      })
    } else if (e.key === 'Enter') {
      if (open && highlighted >= 0 && highlighted < filtered.length) {
        e.preventDefault()
        handleSelect(filtered[highlighted])
      } else {
        setOpen(false)
        setHighlighted(-1)
        e.target.blur()
        onCommit?.()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  function scrollIntoView(idx) {
    if (!listRef.current) return
    const item = listRef.current.children[idx]
    item?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className="relative">
      <input
        value={value || ''}
        onChange={e => { onChange(e.target.value); setHighlighted(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-50 w-full mt-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-y-auto max-h-40">
          {filtered.map((cat, idx) => (
            <button
              key={cat}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(cat) }}
              onMouseEnter={() => setHighlighted(idx)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                idx === highlighted
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-today)] font-medium'
                  : (value || '').toLowerCase() === cat.toLowerCase()
                  ? 'text-[var(--color-today)] font-medium'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
