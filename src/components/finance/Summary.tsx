import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { BaselineInfo } from '@/api/types'
import { cn } from '@/lib/cn'
import { formatDate, formatMoney, formatRate, priceTone, toneClass, type CurrencyCode } from '@/lib/format'
import { BaselineDialog } from './BaselineDialog'
import { PnL, PriceChange, Stat } from './parts'

export interface SummaryTotals {
  cash: number
  totalPurchaseAmount: number
  totalEvaluationAmount: number
  totalAssets: number
  profitLoss: number
  profitLossRate: number
}

/**
 * 한 통화(국내 KRW 또는 해외 USD)의 자산 요약. 통화를 섞어 합산하지 않는다.
 * 증권사 앱처럼 총자산 아래에 '기준 자산(원금) 대비 손익과 수익률'을 크게 보여 주고,
 * 지금 보유한 종목의 평가손익(평가금액 − 매입금액)은 아래 칸에서 따로 보여 준다.
 */
export function SummaryBlock({
  totals,
  currency,
  label = '총 자산',
  big = true,
  baseline,
  accountId,
}: {
  totals: SummaryTotals
  currency: CurrencyCode
  label?: string
  big?: boolean
  /** 기준 자산 대비 손익. 없으면 보유 종목 평가손익만 보여 준다. */
  baseline?: BaselineInfo | null
  /** 있으면 기준 자산을 직접 정할 수 있다 */
  accountId?: number
}) {
  const [editing, setEditing] = useState(false)
  const holdingsTone = priceTone(totals.profitLoss)
  const editableId = accountId != null && totals.totalAssets > 0 ? accountId : null
  const canEdit = editableId != null

  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn('tabular font-extrabold tracking-tight', big ? 'mt-1 text-3xl md:text-4xl' : 'mt-0.5 text-2xl')}>
        {formatMoney(totals.totalAssets, currency)}
      </p>

      {baseline ? (
        <div className="mt-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <PriceChange change={baseline.pnl} rate={baseline.pnlRate} currency={currency} className={big ? 'text-base md:text-lg' : 'text-sm'} />
            <span className="text-xs text-subtle">기준 자산 대비</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
            <span>
              기준 자산 <span className="tabular">{formatMoney(baseline.amount, currency)}</span>
            </span>
            <span aria-hidden>·</span>
            <span>
              {formatDate(baseline.at)} {baseline.manual ? '직접 설정' : '처음 조회한 시점'}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="-my-1 inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-medium text-brand-text hover:bg-surface-2"
                aria-label="기준 자산 수정"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                수정
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <p className={cn('tabular text-sm font-semibold', toneClass(holdingsTone))}>
            보유 종목 평가손익 {formatMoney(totals.profitLoss, currency, { sign: true })} ({formatRate(totals.profitLossRate)})
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 inline-flex h-8 items-center gap-1 rounded-md text-xs font-medium text-brand-text hover:underline"
            >
              <Pencil className="h-3 w-3" aria-hidden />
              기준 자산을 정하면 전체 손익을 볼 수 있어요
            </button>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        <Stat label="예수금 (주문가능)" value={formatMoney(totals.cash, currency)} />
        <Stat label="주식 평가금액" value={formatMoney(totals.totalEvaluationAmount, currency)} />
        <Stat label="매입금액" value={formatMoney(totals.totalPurchaseAmount, currency)} />
        <Stat
          label="보유 종목 평가손익"
          value={<PnL amount={totals.profitLoss} rate={totals.profitLossRate} currency={currency} className="!font-semibold" />}
          sub={<span className="text-subtle">매입금액 대비</span>}
        />
      </dl>

      {editableId != null && (
        <BaselineDialog
          open={editing}
          onClose={() => setEditing(false)}
          accountId={editableId}
          currency={currency}
          baseline={baseline}
          totalAssets={totals.totalAssets}
        />
      )}
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
