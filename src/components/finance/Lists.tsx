import { cn } from '@/lib/cn'
import { currencyOf, formatDateTime, formatMoney, formatNumber, formatRate, priceTone, toneClass, type CurrencyCode } from '@/lib/format'
import { summarizeRealized } from '@/lib/pnl'
import type { Holding, OrderHistoryItem } from '@/api/types'
import { MarketBadge, OrderStatusBadge, PnL, SideBadge } from './parts'

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

/** 매도 체결의 실현손익: 금액과 손익률, 평균 매입단가. 원가(매수 기록)를 모르면 이유를 알려 준다. */
function RealizedCell({ o }: { o: OrderHistoryItem }) {
  if (o.side !== 'SELL' || !(o.executedQuantity > 0)) return <span className="text-subtle">-</span>
  const cur = currencyOf(o)
  if (o.realizedPnl == null || o.realizedPnlRate == null) {
    return (
      <span className="text-xs text-subtle" title="조회한 기간과 그 앞 3개월 안에 이 종목의 매수 기록이 없어 손익을 계산하지 못했어요.">
        계산 불가
      </span>
    )
  }
  const tone = toneClass(priceTone(o.realizedPnl))
  return (
    <div className="tabular">
      <div className={cn('font-semibold', tone)}>{formatMoney(o.realizedPnl, cur, { sign: true })}</div>
      <div className={cn('text-xs font-medium', tone)}>{formatRate(o.realizedPnlRate)}</div>
      {o.costPrice != null && <div className="text-[11px] text-subtle">평균단가 {formatMoney(o.costPrice, cur)}</div>}
    </div>
  )
}

/** 주문/체결 내역: md 이상은 표, 모바일은 카드 리스트. 매도 체결에는 실현손익(금액·수익률)이 붙는다. */
export function OrderList({ orders, className }: { orders: OrderHistoryItem[]; className?: string }) {
  if (orders.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">주문 내역이 없습니다.</p>
  }
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th className="px-4 py-2.5 text-left font-medium">주문시각</th>
              <th className="px-3 py-2.5 text-left font-medium">종목</th>
              <th className="px-3 py-2.5 text-left font-medium">구분</th>
              <th className="px-3 py-2.5 text-right font-medium">체결 (수량 · 평균가)</th>
              <th className="px-4 py-2.5 text-right font-medium">실현손익</th>
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
                    <div className="flex flex-col items-start gap-1">
                      <SideBadge side={o.side} />
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </td>
                  <td className="tabular px-3 py-3 text-right">
                    {o.executedQuantity > 0 ? (
                      <>
                        <div>
                          {formatNumber(o.executedQuantity)}
                          {o.executedQuantity !== o.orderQuantity && `/${formatNumber(o.orderQuantity)}`}주 · {formatMoney(o.averageExecutedPrice, cur)}
                        </div>
                        {o.executedAmount != null && <div className="text-xs text-subtle">체결금액 {formatMoney(o.executedAmount, cur)}</div>}
                      </>
                    ) : (
                      <div className="text-muted">
                        주문 {formatNumber(o.orderQuantity)}주 · {o.orderPrice > 0 ? formatMoney(o.orderPrice, cur) : '시장가'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RealizedCell o={o} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>      <ul className="divide-y divide-border md:hidden">
        {orders.map((o) => {
          const cur = currencyOf(o)
          const sold = o.side === 'SELL' && o.executedQuantity > 0
          return (
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
              {o.executedAmount != null && o.executedQuantity > 0 && (
                <div className="tabular text-xs text-subtle">체결금액 {formatMoney(o.executedAmount, cur)}</div>
              )}
              {sold && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-xs text-subtle">실현손익</span>
                  {o.realizedPnl != null && o.realizedPnlRate != null ? (
                    <span className={cn('tabular text-right font-semibold', toneClass(priceTone(o.realizedPnl)))}>
                      {formatMoney(o.realizedPnl, cur, { sign: true })} <span className="font-medium">({formatRate(o.realizedPnlRate)})</span>
                      {o.costPrice != null && <span className="block text-[11px] font-normal text-subtle">평균단가 {formatMoney(o.costPrice, cur)}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-subtle">매수 기록이 없어 계산 불가</span>
                  )}
                </div>
              )}
              <div className="tabular mt-1.5 text-xs text-subtle">
                {formatDateTime(o.orderedAt)} · #{o.orderNo}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 거래내역 맨 위 요약: 불러온 매도 체결의 실현손익 합계(원가 대비 수익률), 매도 건수, 승률. */
export function RealizedStrip({ orders, currency }: { orders: OrderHistoryItem[]; currency: CurrencyCode }) {
  const s = summarizeRealized(orders)
  if (s.sells === 0) return null
  const tone = toneClass(priceTone(s.realized))
  return (
    <div className="border-b border-border px-4 py-3.5">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-xs text-subtle">실현손익</dt>
          <dd className={cn('tabular mt-0.5 text-lg font-extrabold', s.known > 0 ? tone : 'text-subtle')}>
            {s.known > 0 ? (
              <>
                {formatMoney(s.realized, currency, { sign: true })} <span className="text-sm font-semibold">({formatRate(s.rate)})</span>
              </>
            ) : (
              '-'
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-subtle">매도 체결</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">
            {formatNumber(s.sells)}건
            {s.known > 0 && (
              <span className="ml-1 font-medium text-subtle">
                (수익 {formatNumber(s.wins)} · 손실 {formatNumber(s.losses)})
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-subtle">승률</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">{s.winRate == null ? '-' : formatRate(s.winRate, { digits: 1, sign: false })}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-4 text-subtle">
        불러온 거래내역 기준이에요. 매수 기록으로 평균 매입단가를 구해 계산하며, 수수료·세금은 빼지 않았어요.
        {s.unknown > 0 && ` 매수 기록이 없는 매도 ${formatNumber(s.unknown)}건은 합계에서 뺐어요.`}
      </p>
    </div>
  )
}