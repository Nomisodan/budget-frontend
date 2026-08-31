import { useState } from 'react'
import RecurringPage from './RecurringPage'
import CategoriesPage from './CategoriesPage'
import BudgetPage from './BudgetPage'

export default function OverviewPage() {
  const [tab, setTab] = useState('budget')

  return (
    <div>
      <div className="px-4 pt-6 max-w-2xl mx-auto md:max-w-4xl md:px-8">
        <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-0.5 w-fit">
          <button
            onClick={() => setTab('budget')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'budget' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >Budget</button>
          <button
            onClick={() => setTab('bills')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'bills' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >Bills</button>
          <button
            onClick={() => setTab('categories')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'categories' ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >Categories</button>
        </div>
      </div>
      {tab === 'budget' && <BudgetPage />}
      {tab === 'bills' && <RecurringPage />}
      {tab === 'categories' && <CategoriesPage />}
    </div>
  )
}
