import { cn } from '@/lib/cn'
import { formatMoney, formatRate, priceTone, toneClass, type CurrencyCode } from '@/lib/format'
import { Stat } from './parts'

export interface SummaryTotals {
  cash: number
  totalPurchaseAmount: number
  totalEvaluationAmount: number
  totalAssets: number
  profitLoss: number
  profitLossRate: number
}

/** 한 통화(국내 KRW 또는 해외 USD)의 자산 요약. 통화를 섞어 합산하지 않는다. */
export function SummaryBlock({
  totals,
  currency,
  label = '총 자산',
  big = true,
}: {
  totals: SummaryTotals
  currency: CurrencyCode
  label?: string
  big?: boolean
}) {
  const tone = priceTone(totals.profitLoss)
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn('tabular font-extrabold tracking-tight', big ? 'mt-1 text-3xl md:text-4xl' : 'text-2xl')}>
        {formatMoney(totals.totalAssets, currency)}
      </p>
      <p className={cn('tabular mt-1 text-sm font-semibold', toneClass(tone))}>
        평가손익 {formatMoney(totals.profitLoss, currency, { sign: true })} ({formatRate(totals.profitLossRate)})
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <Stat label="예수금 (주문가능)" value={formatMoney(totals.cash, currency)} />
        <Stat label="매입금액" value={formatMoney(totals.totalPurchaseAmount, currency)} />
        <Stat label="주식 평가금액" value={formatMoney(totals.totalEvaluationAmount, currency)} />
      </dl>
    </div>
  )
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold">{children}</h3>
      {aside}
    </div>
  )
}
