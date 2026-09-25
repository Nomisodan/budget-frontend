import DayCell from './DayCell'
import DayDrawer from './DayDrawer'
import useDayDrawer from './useDayDrawer'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({ data, accountId, accounts, onTypeChange, onTransactionAdded, categories = [], onCategoryChange, multiAccount = false }) {
  const {
    selectedDay, openDay, closeDay, openSeq, initialEditId,
    handleTypeChange, handleCategoryChange, handleTransactionAdded, handleTransactionEdited, handleTransactionDeleted,
  } = useDayDrawer(onTypeChange, onCategoryChange, onTransactionAdded)

  if (!data) return null

  const { year, month, days } = data

  // Pad leading empty days (Sun = 0)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const emptyCells = Array(firstDayOfWeek).fill(null)

  // Running balance sparkline range for color scale
  const balances = days.map(d => d.balance)
  const minBalance = Math.min(...balances)
  const maxBalance = Math.max(...balances)

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-CA', { month: 'long' })

  return (
    <>
      <div className="w-full">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs text-[var(--color-muted)] py-1 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {emptyCells.map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => (
            <DayCell
              key={day.date}
              day={day}
              onClick={d => openDay(d)}
            />
          ))}
        </div>
      </div>

      <DayDrawer
        day={selectedDay} accountId={accountId} accounts={accounts} onClose={closeDay}
        onTypeChange={handleTypeChange} onTransactionAdded={handleTransactionAdded}
        onTransactionEdited={handleTransactionEdited} onTransactionDeleted={handleTransactionDeleted}
        categories={categories} onCategoryChange={handleCategoryChange} multiAccount={multiAccount}
        initialEditId={initialEditId} openSeq={openSeq}
      />
    </>
  )
}
