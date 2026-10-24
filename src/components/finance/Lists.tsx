import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AccountTypeBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { currencyOf, formatDateTime, formatMoney, formatNumber, formatRate, priceTone, toneClass } from '@/lib/format'
import type { Holding, OrderHistoryItem, ScheduledTask } from '@/api/types'
import { MarketBadge, OrderStatusBadge, PnL, SideBadge, TaskStatusBadge } from './parts'

function StockName({ name, market, code }: { name: string; market?: string; code: string }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-semibold">{name}</span>
        <MarketBadge market={market} />
      </div>
      <div className="tabular text-xs text-subtle">{code}</div>
    </>
  )
}

/** 보유 종목: md 이상은 표, 모바일은 카드 리스트. 금액은 각 종목의 currency 로 표시 */
export function HoldingsList({ holdings, className }: { holdings: Holding[]; className?: string }) {
  if (holdings.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">보유 중인 종목이 없습니다.</p>
  }
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th className="px-4 py-2.5 text-left font-medium">종목</th>
              <th className="px-3 py-2.5 text-right font-medium">보유수량</th>
              <th className="px-3 py-2.5 text-right font-medium">평균단가</th>
              <th className="px-3 py-2.5 text-right font-medium">현재가</th>
              <th className="px-3 py-2.5 text-right font-medium">평가금액</th>
              <th className="px-4 py-2.5 text-right font-medium">평가손익</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const cur = currencyOf(h)
              return (
                <tr key={`${h.market ?? 'KRX'}-${h.productNumber}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <StockName name={h.name} market={h.market} code={h.productNumber} />
                  </td>
                  <td className="tabular px-3 py-3 text-right">{formatNumber(h.quantity)}주</td>
                  <td className="tabular px-3 py-3 text-right">{formatMoney(h.averagePrice, cur)}</td>
                  <td className="tabular px-3 py-3 text-right">{formatMoney(h.currentPrice, cur)}</td>
                  <td className="tabular px-3 py-3 text-right font-medium">{formatMoney(h.evaluationAmount, cur)}</td>
                  <td className="px-4 py-3 text-right">
                    <PnL amount={h.profitLoss} rate={h.profitLossRate} currency={cur} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {holdings.map((h) => {
          const cur = currencyOf(h)
          return (
            <li key={`${h.market ?? 'KRX'}-${h.productNumber}`} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold">{h.name}</span>
                    <MarketBadge market={h.market} />
                  </div>
                  <div className="tabular text-xs text-subtle">
                    {h.productNumber} · {formatNumber(h.quantity)}주
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular font-semibold">{formatMoney(h.evaluationAmount, cur)}</div>
                  <div className={cn('tabular text-xs font-semibold', toneClass(priceTone(h.profitLoss)))}>
                    {formatMoney(h.profitLoss, cur, { sign: true })} ({formatRate(h.profitLossRate)})
                  </div>
                </div>
              </div>
              <div className="tabular mt-2 flex justify-between text-xs text-subtle">
                <span>평균 {formatMoney(h.averagePrice, cur)}</span>
                <span>현재 {formatMoney(h.currentPrice, cur)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function execLabel(o: OrderHistoryItem) {
  const cur = currencyOf(o)
  if (o.executedQuantity > 0) {
    return `${formatNumber(o.executedQuantity)}/${formatNumber(o.orderQuantity)}주 · 체결가 ${formatMoney(o.averageExecutedPrice, cur)}`
  }
  return `${formatNumber(o.orderQuantity)}주 · ${o.orderPrice > 0 ? formatMoney(o.orderPrice, cur) : '시장가'}`
}

/** 주문/체결 내역: md 이상은 표, 모바일은 카드 리스트 */
export function OrderList({ orders, className }: { orders: OrderHistoryItem[]; className?: string }) {
  if (orders.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">주문 내역이 없습니다.</p>
  }
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th className="px-4 py-2.5 text-left font-medium">주문시각</th>
              <th className="px-3 py-2.5 text-left font-medium">종목</th>
              <th className="px-3 py-2.5 text-left font-medium">구분</th>
              <th className="px-3 py-2.5 text-right font-medium">주문 (수량 · 가격)</th>
              <th className="px-3 py-2.5 text-right font-medium">체결 (수량 · 평균가)</th>
              <th className="px-4 py-2.5 text-right font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const cur = currencyOf(o)
              return (
                <tr key={o.orderNo + o.orderedAt} className="border-b border-border last:border-0">
                  <td className="tabular whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(o.orderedAt)}</td>
                  <td className="px-3 py-3">
                    <StockName name={o.name} market={o.market} code={o.productNumber} />
                  </td>
                  <td className="px-3 py-3">
                    <SideBadge side={o.side} />
                  </td>
                  <td className="tabular px-3 py-3 text-right">
                    {formatNumber(o.orderQuantity)}주 · {o.orderPrice > 0 ? formatMoney(o.orderPrice, cur) : '시장가'}
                  </td>
                  <td className="tabular px-3 py-3 text-right">
                    {o.executedQuantity > 0 ? `${formatNumber(o.executedQuantity)}주 · ${formatMoney(o.averageExecutedPrice, cur)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {orders.map((o) => (
          <li key={o.orderNo + o.orderedAt} className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SideBadge side={o.side} />
                <span className="truncate font-semibold">{o.name}</span>
                <MarketBadge market={o.market} />
              </div>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="tabular mt-1.5 text-sm text-muted">{execLabel(o)}</div>
            <div className="tabular mt-0.5 text-xs text-subtle">
              {formatDateTime(o.orderedAt)} · #{o.orderNo}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 예약 작업 리스트. onCancel 이 있으면 SCHEDULED 항목에 취소 버튼 */
export function ScheduledTaskList({
  tasks,
  onCancel,
  showAccount,
}: {
  tasks: ScheduledTask[]
  onCancel?: (task: ScheduledTask) => void
  showAccount?: boolean
}) {
  if (tasks.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">예약된 작업이 없습니다.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TaskStatusBadge status={t.status} />
              {showAccount && <AccountTypeBadge type={t.accountType} />}
              {typeof t.params?.market === 'string' && <MarketBadge market={t.params.market} />}
              <span className="tabular text-xs text-subtle">{formatDateTime(t.runAt)} 실행</span>
            </div>
            <p className="mt-1.5 text-sm font-semibold">{t.title}</p>
            {t.resultMessage && <p className="mt-0.5 text-xs text-muted">{t.resultMessage}</p>}
          </div>
          {onCancel && t.status === 'SCHEDULED' && (
            <Button variant="outline" size="sm" onClick={() => onCancel(t)} aria-label={`${t.title} 예약 취소`}>
              <X className="h-3.5 w-3.5" aria-hidden />
              취소
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
