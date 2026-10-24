import { useMemo } from 'react'
import { formatMoney, formatRate, type CurrencyCode } from '@/lib/format'
import type { Holding } from '@/api/types'

interface Slice {
  label: string
  value: number
  color: string
}

/** 국내(AccountSummary) 또는 해외(MarketSummary) 어느 쪽이든 받는다. 한 도넛은 한 통화만 다룬다. */
export interface AllocationSource {
  cash: number
  holdings: Holding[]
}

export function buildAllocation(summary: AllocationSource, maxSlices = 6): Slice[] {
  const sorted = [...summary.holdings].filter((h) => h.evaluationAmount > 0).sort((a, b) => b.evaluationAmount - a.evaluationAmount)
  const slices: Slice[] = sorted.slice(0, maxSlices).map((h, i) => ({
    label: h.name,
    value: h.evaluationAmount,
    color: `rgb(var(--chart-${i + 1}))`,
  }))
  const rest = sorted.slice(maxSlices).reduce((s, h) => s + h.evaluationAmount, 0)
  if (rest > 0) slices.push({ label: '기타 종목', value: rest, color: 'rgb(var(--chart-7))' })
  if (summary.cash > 0) slices.push({ label: '현금', value: summary.cash, color: 'rgb(var(--chart-8))' })
  return slices
}

export function AllocationDonut({ summary, currency = 'KRW' }: { summary: AllocationSource; currency?: CurrencyCode }) {
  const slices = useMemo(() => buildAllocation(summary), [summary])
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 15.915
  let offset = 25

  if (total <= 0) {
    return <p className="py-6 text-center text-sm text-muted">표시할 자산이 없습니다.</p>
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full" role="img" aria-label="자산 구성 비중 도넛 차트">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(var(--surface-3))" strokeWidth="4.2" />
          {slices.map((s) => {
            const pct = (s.value / total) * 100
            const el = (
              <circle
                key={s.label}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="4.2"
                strokeDasharray={`${Math.max(0, pct - 0.4)} ${100 - Math.max(0, pct - 0.4)}`}
                strokeDashoffset={offset}
              />
            )
            offset -= pct
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-subtle">총 자산</span>
          <span className="tabular px-3 text-[13px] font-bold leading-tight">{formatMoney(total, currency)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="tabular text-xs text-subtle">{formatMoney(s.value, currency)}</span>
            <span className="tabular w-14 text-right font-semibold">{formatRate((s.value / total) * 100, { sign: false, digits: 1 })}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
