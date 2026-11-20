import { useState } from 'react'
import SpendingOverviewPage from './SpendingOverviewPage'
import RecurringPage from './RecurringPage'
import CategoriesPage from './CategoriesPage'
import BudgetPage from './BudgetPage'

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'budget',     label: 'Budget' },
  { key: 'bills',      label: 'Bills' },
  { key: 'categories', label: 'Sub-categories' },
]

export default function OverviewPage() {
  const [tab, setTab] = useState('overview')

  return (
    <div>
      <div className="px-4 pt-6 max-w-2xl mx-auto md:max-w-4xl md:px-8">
        <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-0.5 w-fit max-w-full overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${tab === t.key ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
            >{t.label}</button>
          ))}
        </div>
      </div>
      {tab === 'overview'   && <SpendingOverviewPage />}
      {tab === 'budget'     && <BudgetPage />}
      {tab === 'bills'      && <RecurringPage />}
      {tab === 'categories' && <CategoriesPage />}
    </div>
  )
}
