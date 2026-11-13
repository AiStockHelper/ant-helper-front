import { describe, expect, it } from 'vitest'
import type { OrderHistoryItem } from '@/api/types'
import { parseAmountInput, summarizeRealized } from './pnl'

function order(p: Partial<OrderHistoryItem>): OrderHistoryItem {
  return {
    orderNo: '1',
    orderedAt: '2026-11-10T10:00:00+09:00',
    side: 'SELL',
    productNumber: '005930',
    name: '삼성전자',
    orderQuantity: 10,
    orderPrice: 0,
    executedQuantity: 10,
    averageExecutedPrice: 70000,
    status: 'FILLED',
    ...p,
  }
}

describe('summarizeRealized', () => {
  it('손익을 계산한 매도의 합계, 수익률(원가 대비), 승률을 낸다', () => {
    const s = summarizeRealized([
      order({ realizedPnl: 28000, costPrice: 70000, executedQuantity: 4 }), // +28,000 (원가 280,000)
      order({ realizedPnl: -70000, costPrice: 70000, executedQuantity: 10 }), // -70,000 (원가 700,000)
      order({ realizedPnl: 0, costPrice: 50000, executedQuantity: 2 }), // 본전
    ])
    expect(s.realized).toBe(-42000)
    expect(s.costBasis).toBe(280000 + 700000 + 100000)
    expect(s.rate).toBeCloseTo((-42000 / 1080000) * 100, 6)
    expect(s.sells).toBe(3)
    expect(s.known).toBe(3)
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)
    expect(s.winRate).toBeCloseTo(33.333, 2)
  })

  it('매수·미체결 주문은 세지 않고, 원가를 모르는 매도는 따로 센다', () => {
    const s = summarizeRealized([
      order({ side: 'BUY', realizedPnl: null }),
      order({ executedQuantity: 0, status: 'PENDING' }),
      order({ realizedPnl: null, costPrice: null }), // 매수 기록이 없어 계산 못 함
      order({ realizedPnl: 1000, costPrice: 100, executedQuantity: 10 }),
    ])
    expect(s.sells).toBe(2)
    expect(s.known).toBe(1)
    expect(s.unknown).toBe(1)
    expect(s.realized).toBe(1000)
    expect(s.winRate).toBe(100)
  })

  it('아무것도 계산할 수 없으면 0 과 null 이다', () => {
    const s = summarizeRealized([])
    expect(s).toMatchObject({ realized: 0, costBasis: 0, rate: 0, sells: 0, known: 0, unknown: 0, winRate: null })
    expect(summarizeRealized([order({ realizedPnl: null })]).winRate).toBeNull()
  })
})

describe('parseAmountInput', () => {
  it('쉼표가 든 글자를 숫자로 바꾸고, 비었거나 0 이하면 null', () => {
    expect(parseAmountInput('12,345,678')).toBe(12345678)
    expect(parseAmountInput('3,000.50')).toBe(3000.5)
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('0')).toBeNull()
    expect(parseAmountInput('abc')).toBeNull()
  })
})
