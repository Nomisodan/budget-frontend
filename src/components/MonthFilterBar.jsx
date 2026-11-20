// Account/group filter chips + month navigation, shared by Home and Overview.
export default function MonthFilterBar({ s }) {
  const { accounts, groups, activeFilter, setActiveFilter, monthLabel, prevMonth, nextMonth } = s
  return (
    <>
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
    </>
  )
}
