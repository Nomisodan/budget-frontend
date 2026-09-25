import DayDrawer from './DayDrawer'
import useDayDrawer from './useDayDrawer'

const SplitIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5"/><path d="M8 3H3v5"/>
    <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>
  </svg>
)

const TYPE_COLOR = {
  income:   'text-[var(--color-income)]',
  expense:  'text-[var(--color-expense)]',
  transfer: 'text-[var(--color-transfer)]',
}
const TYPE_BG = {
  income:   'bg-[var(--color-income)]/10',
  expense:  'bg-[var(--color-expense)]/10',
  transfer: 'bg-[var(--color-transfer)]/10',
}

function fmtSigned(amount) {
  const abs = Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })
  return (amount >= 0 ? '+' : '−') + '$' + abs
}

function fmtBalance(amount) {
  const abs = Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })
  return (amount < 0 ? '−' : '') + '$' + abs
}

function balanceColor(amount) {
  return amount >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
}

export default function AgendaView({ data, accountId, accounts = [], onTypeChange, onTransactionAdded, categories = [], onCategoryChange, multiAccount = false }) {
  const {
    selectedDay, openDay, closeDay, openSeq, initialEditId,
    handleTypeChange, handleCategoryChange, handleTransactionAdded, handleTransactionEdited, handleTransactionDeleted,
  } = useDayDrawer(onTypeChange, onCategoryChange, onTransactionAdded)

  if (!data) return null
  const { days } = data

  return (
    <div className="flex flex-col gap-1.5">
      {days.map(day => {
        const hasTxns = day.transactions.length > 0
        const date = new Date(day.date + 'T00:00:00')
        const dayNum = date.getDate()
        const weekday = date.toLocaleString('en-CA', { weekday: 'short' })
        const balanceBefore = Math.round((day.balance - day.delta) * 100) / 100
        const balanceAfter  = day.balance

        // Empty days — thin separator row
        if (!hasTxns && !day.is_today) {
          return (
            <div key={day.date} className="flex items-center gap-3 px-2 py-1 opacity-25">
              <div className="w-10 text-right flex-shrink-0">
                <span className="text-[10px] text-[var(--color-muted)]">{weekday}</span>
                <p className="text-sm font-semibold text-[var(--color-muted)] leading-none">{dayNum}</p>
              </div>
              <div className="flex-1 border-t border-[var(--color-border)]" />
              <span className="text-xs font-mono text-[var(--color-muted)]">{fmtBalance(balanceAfter)}</span>
            </div>
          )
        }

        return (
          <div
            key={day.date}
            className={`rounded-xl border overflow-hidden ${
              day.is_today
                ? 'border-[var(--color-today)] bg-[var(--color-today)]/5'
                : day.is_past
                ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}
          >
            {/* ── Opening balance bar ── */}
            {hasTxns && (
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40">
                <div className="flex items-center gap-2">
                  {/* Date circle */}
                  <div className={`w-9 h-9 rounded-full flex flex-col items-center justify-center flex-shrink-0 ${
                    day.is_today ? 'bg-[var(--color-today)]' : 'bg-[var(--color-surface-2)]'
                  }`}>
                    <span className={`text-[9px] font-medium leading-none ${day.is_today ? 'text-black' : 'text-[var(--color-muted)]'}`}>{weekday}</span>
                    <span className={`text-base font-bold leading-tight ${day.is_today ? 'text-black' : 'text-[var(--color-text)]'}`}>{dayNum}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-muted)] leading-none mb-0.5">Opening</p>
                    <p className={`text-sm font-mono font-bold ${balanceColor(balanceBefore)}`}>{fmtBalance(balanceBefore)}</p>
                  </div>
                </div>

                {/* Desktop: show delta inline; mobile: keep it compact */}
                {day.delta !== 0 && (
                  <span className={`hidden md:inline text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                    day.delta > 0
                      ? 'bg-[var(--color-income)]/10 text-[var(--color-income)]'
                      : 'bg-[var(--color-expense)]/10 text-[var(--color-expense)]'
                  }`}>
                    {fmtSigned(day.delta)} net
                  </span>
                )}
              </div>
            )}

            {/* ── Transactions ── */}
            <div className="px-3 py-2 flex flex-col gap-1.5">
              {/* Mobile delta chip (only if has transactions) */}
              {hasTxns && day.delta !== 0 && (
                <div className="flex md:hidden justify-end">
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    day.delta > 0
                      ? 'bg-[var(--color-income)]/10 text-[var(--color-income)]'
                      : 'bg-[var(--color-expense)]/10 text-[var(--color-expense)]'
                  }`}>
                    {fmtSigned(day.delta)} net
                  </span>
                </div>
              )}

              {day.transactions.map((t, i) => {
                const isGhost = t.is_projection
                return (
                  <div key={i} className={isGhost ? 'opacity-55' : ''}>
                    <div
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${TYPE_BG[t.type] ?? 'bg-[var(--color-surface-2)]'} ${!t.is_scheduled && !isGhost ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (t.is_scheduled || isGhost) return
                        openDay(day, t.id)
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isGhost && (
                          <span className="text-[9px] border border-[var(--color-today)] text-[var(--color-today)] rounded px-1 py-0.5 leading-none flex-shrink-0">
                            proj
                          </span>
                        )}
                        {t.is_scheduled && !isGhost && (
                          <span className="text-[9px] border border-[var(--color-muted)]/50 text-[var(--color-muted)] rounded px-1 py-0.5 leading-none flex-shrink-0">
                            sched
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate md:whitespace-normal">
                            {multiAccount && t.account_name && (
                              <span className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-muted)] rounded px-1.5 py-0.5 leading-none mr-1.5 align-middle">
                                {t.account_name}
                              </span>
                            )}
                            {t.description}
                          </p>
                          {(t.category || t.matched_name || t.mirror_id || t.split_id) && (
                            <p className="text-[10px] text-[var(--color-muted)] flex items-center gap-1.5">
                              {t.category}
                              {t.matched_name && (
                                <span className="text-[var(--color-today)] flex items-center gap-0.5">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                                    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                                  </svg>
                                  {t.matched_name}
                                </span>
                              )}
                              {t.mirror_id && (
                                <span title="Linked transfer" className="text-[var(--color-today)]">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                  </svg>
                                </span>
                              )}
                              {t.split_id && (
                                <span title="Split transaction" className="text-[var(--color-today)] opacity-70">
                                  <SplitIcon />
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm font-mono font-semibold ml-4 flex-shrink-0 ${TYPE_COLOR[t.type] ?? ''}`}>
                        {fmtSigned(t.amount)}
                      </span>
                    </div>
                  </div>
                )
              })}

              {day.transactions.length === 0 && day.is_today && (
                <p className="text-xs text-[var(--color-muted)] text-center py-2">No transactions today</p>
              )}
            </div>

            {/* ── Closing balance bar ── */}
            {hasTxns && (
              <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40">
                <p className="text-[10px] text-[var(--color-muted)]">Closing</p>
                <p className={`text-sm font-mono font-bold ${balanceColor(balanceAfter)}`}>{fmtBalance(balanceAfter)}</p>
              </div>
            )}
          </div>
        )
      })}

      <DayDrawer
        day={selectedDay} accountId={accountId} accounts={accounts} onClose={closeDay}
        onTypeChange={handleTypeChange} onTransactionAdded={handleTransactionAdded}
        onTransactionEdited={handleTransactionEdited} onTransactionDeleted={handleTransactionDeleted}
        categories={categories} onCategoryChange={handleCategoryChange} multiAccount={multiAccount}
        initialEditId={initialEditId} openSeq={openSeq}
      />
    </div>
  )
}
