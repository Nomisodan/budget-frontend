import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import WorkspaceBar from './components/WorkspaceBar'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import AccountsPage from './pages/AccountsPage'
import RecurringPage from './pages/RecurringPage'
import CategoriesPage from './pages/CategoriesPage'
import OverviewPage from './pages/OverviewPage'
import SettingsPage from './pages/SettingsPage'

function BottomNav() {
  const base = 'flex flex-col items-center gap-1 flex-1 py-2 text-[var(--color-muted)] transition-colors'
  const active = 'text-[var(--color-today)]'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex safe-area-pb">
      <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="text-[10px] font-medium">Home</span>
      </NavLink>

      <NavLink to="/calendar" className={({ isActive }) => `${base} ${isActive ? active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className="text-[10px] font-medium">Calendar</span>
      </NavLink>

      <NavLink to="/overview" className={({ isActive }) => `${base} ${isActive ? active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span className="text-[10px] font-medium">Overview</span>
      </NavLink>

      <NavLink to="/accounts" className={({ isActive }) => `${base} ${isActive ? active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <span className="text-[10px] font-medium">Accounts</span>
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceBar />
      <div className="pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  )
}
