export default function DayCell({ day, onClick }) {
  const date = new Date(day.date + 'T00:00:00')
  const dayNum = date.getDate()

  const incomeTotal = day.transactions
    .filter(t => t.type === 'income' || (t.type === 'transfer' && t.amount > 0))
    .reduce((sum, t) => sum + t.amount, 0)
  const expenseTotal = day.transactions
    .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.amount < 0))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const hasTransactions = day.transactions.length > 0
  const balanceColor = day.balance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'

  let borderClass = 'border-[var(--color-border)]'
  if (day.is_today) borderClass = 'border-[var(--color-today)] border-2'

  let bgClass = 'bg-[var(--color-surface)]'
  if (day.is_past) bgClass = 'bg-[var(--color-bg)]'
  if (day.is_today) bgClass = 'bg-[var(--color-surface-2)]'

  return (
    <div
      className={`${bgClass} ${borderClass} border rounded-lg p-2 min-h-[100px] md:min-h-[140px] md:p-3 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors flex flex-col gap-1`}
      onClick={() => onClick(day)}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
            day.is_today
              ? 'bg-[var(--color-today)] text-black'
              : 'text-[var(--color-text)]'
          }`}
        >
          {dayNum}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
        {incomeTotal > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-income)] flex-shrink-0" />
            <span className="text-[10px] text-[var(--color-income)] truncate">
              +${incomeTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
        {expenseTotal > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-expense)] flex-shrink-0" />
            <span className="text-[10px] text-[var(--color-expense)] truncate">
              -${expenseTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
        {hasTransactions && (
          <span className="text-[10px] text-[var(--color-muted)]">
            {day.transactions.length} transaction{day.transactions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {hasTransactions && (
        <span className={`text-xs font-mono font-bold mt-auto self-start ${balanceColor}`}>
          ${day.balance.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      )}
    </div>
  )
}
