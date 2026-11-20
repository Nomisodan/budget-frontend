import useMonthSummary from '../hooks/useMonthSummary'
import MonthFilterBar from '../components/MonthFilterBar'

const COLORS = [
  '#f97316','#3b82f6','#a855f7','#22c55e','#eab308',
  '#06b6d4','#ec4899','#14b8a6','#f43f5e','#8b5cf6',
  '#84cc16','#fb923c','#60a5fa','#c084fc','#34d399',
]

function fmt(n) {
  return Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

function fmtDec(n) {
  return Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function slicePath(cx, cy, outer, inner, start, end) {
  const [ox1, oy1] = polar(cx, cy, outer, start)
  const [ox2, oy2] = polar(cx, cy, outer, end)
  const [ix1, iy1] = polar(cx, cy, inner, end)
  const [ix2, iy2] = polar(cx, cy, inner, start)
  const large = end - start > 180 ? 1 : 0
  return `M${ox1},${oy1} A${outer},${outer},0,${large},1,${ox2},${oy2} L${ix1},${iy1} A${inner},${inner},0,${large},0,${ix2},${iy2}Z`
}

function DonutChart({ slices, total }) {
  const size = 220
  const cx = size / 2, cy = size / 2
  const outer = 90, inner = 58
  const gap = slices.length > 1 ? 1.5 : 0

  let angle = 0
  const paths = slices.map((s, i) => {
    const sweep = s.pct * 360
    const start = angle + gap / 2
    const end   = angle + sweep - gap / 2
    angle += sweep
    return { d: slicePath(cx, cy, outer, inner, start, end), color: COLORS[i % COLORS.length] }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
      {/* Center label */}
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-[var(--color-muted)]" fontSize="11" fontFamily="inherit">
        Expenses
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-[var(--color-text)]" fontSize="16" fontWeight="700" fontFamily="monospace">
        ${fmt(total)}
      </text>
    </svg>
  )
}

// ─── Spending overview (Overview → Overview tab) ──────────────────────────────

export default function SpendingOverviewPage() {
  const s = useMonthSummary()
  const { data, loading, error } = s

  const cats     = data?.categories ?? []
  const incCats  = data?.income_categories ?? []
  const expTotal = data?.expense_total ?? 0
  const incTotal = data?.income_total  ?? 0
  const net      = incTotal - expTotal

  const slices = cats
    .filter(c => c.total > 0)
    .map(c => ({ label: c.category, total: c.total, pct: expTotal > 0 ? c.total / expTotal : 0 }))

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      <div className="max-w-lg mx-auto px-4 py-5">
        <MonthFilterBar s={s} />

        {loading && <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">Loading…</div>}
        {error   && <div className="text-center py-10 text-[var(--color-expense)] text-sm">{error}</div>}

        {!loading && !error && data && (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Income</p>
                <p className="text-sm font-mono font-bold text-[var(--color-income)]">+${fmt(incTotal)}</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Expenses</p>
                <p className="text-sm font-mono font-bold text-[var(--color-expense)]">-${fmt(expTotal)}</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-muted)] mb-0.5">Net</p>
                <p className={`text-sm font-mono font-bold ${net >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                  {net >= 0 ? '+' : '-'}${fmt(net)}
                </p>
              </div>
            </div>

            {/* ── Donut chart ── */}
            {slices.length > 0 ? (
              <>
                <div className="bg-[var(--color-surface)] rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-3">
                    Spending breakdown
                  </p>
                  <DonutChart slices={slices} total={expTotal} />
                </div>

                {/* ── Category legend ── */}
                <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden mb-4">
                  <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest px-4 pt-4 pb-2">
                    Expenses
                  </p>
                  {slices.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-[var(--color-text)] flex-1 truncate">{s.label}</span>
                      <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-9 text-right">
                        {(s.pct * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm font-mono text-[var(--color-expense)] flex-shrink-0 w-20 text-right">
                        ${fmtDec(s.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-[var(--color-muted)] text-sm py-12">No expenses this month</p>
            )}

            {/* ── Income breakdown ── */}
            {incCats.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest px-4 pt-4 pb-2">
                  Income
                </p>
                {incCats.map((c, i) => (
                  <div key={c.category} className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)]/40">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--color-income)]"
                      style={{ opacity: 1 - i * 0.15 }} />
                    <span className="text-sm text-[var(--color-text)] flex-1 truncate">{c.category}</span>
                    <span className="text-[11px] text-[var(--color-muted)] flex-shrink-0 w-9 text-right">
                      {incTotal > 0 ? (c.total / incTotal * 100).toFixed(0) : 0}%
                    </span>
                    <span className="text-sm font-mono text-[var(--color-income)] flex-shrink-0 w-20 text-right">
                      +${fmtDec(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
