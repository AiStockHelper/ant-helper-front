import type { OrderHistoryItem } from '@/api/types'
import { ungroup } from './format'

export interface RealizedSummary {
  /** 원가를 아는 매도들의 실현손익 합계(수수료·세금 제외) */
  realized: number
  /** 그 매도들의 매입 원가 합계(평균 매입단가 × 수량) */
  costBasis: number
  /** realized ÷ costBasis (%) */
  rate: number
  /** 체결된 매도 건수 */
  sells: number
  /** 그중 손익을 계산한 건수 */
  known: number
  /** 손익을 계산하지 못한 건수(조회 기간 앞 3개월 안에 매수 기록이 없는 매도) */
  unknown: number
  wins: number
  losses: number
  /** 손익을 계산한 건수 중 수익 건수 비율(%). 계산한 건이 없으면 null */
  winRate: number | null
}

/** 체결된 매도 주문들의 실현손익 요약. 매수와 체결되지 않은 주문은 세지 않는다. */
export function summarizeRealized(orders: OrderHistoryItem[]): RealizedSummary {
  let realized = 0
  let costBasis = 0
  let sells = 0
  let known = 0
  let wins = 0
  let losses = 0
  for (const o of orders) {
    if (o.side !== 'SELL' || !(o.executedQuantity > 0)) continue
    sells += 1
    if (o.realizedPnl == null) continue
    known += 1
    realized += o.realizedPnl
    if (o.costPrice != null) costBasis += o.costPrice * o.executedQuantity
    if (o.realizedPnl > 0) wins += 1
    else if (o.realizedPnl < 0) losses += 1
  }
  return {
    realized,
    costBasis,
    rate: costBasis > 0 ? (realized / costBasis) * 100 : 0,
    sells,
    known,
    unknown: sells - known,
    wins,
    losses,
    winRate: known > 0 ? (wins / known) * 100 : null,
  }
}

/** 금액 입력칸의 글자("12,345,678")를 숫자로. 0 이하이거나 숫자가 아니면 null. */
export function parseAmountInput(text: string): number | null {
  const raw = ungroup(text)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
