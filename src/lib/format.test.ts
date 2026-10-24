import { describe, expect, it } from 'vitest'
import {
  currencyDigits,
  currencyOf,
  dateGroup,
  formatAmount,
  formatMoney,
  formatSignedAmount,
  marketOf,
  parseDate,
  formatCompactKRW,
  formatKRW,
  formatNumber,
  formatRate,
  formatRemaining,
  formatSigned,
  formatVolume,
  priceTone,
  toDateInputValue,
} from './format'

describe('formatKRW', () => {
  it('adds thousand separators and 원', () => {
    expect(formatKRW(1234567)).toBe('1,234,567원')
    expect(formatKRW(0)).toBe('0원')
  })
  it('handles negatives and sign option', () => {
    expect(formatKRW(-5000)).toBe('-5,000원')
    expect(formatKRW(5000, { sign: true })).toBe('+5,000원')
    expect(formatKRW(0, { sign: true })).toBe('0원')
  })
  it('rounds and tolerates invalid input', () => {
    expect(formatKRW(1234.6)).toBe('1,235원')
    expect(formatKRW(undefined)).toBe('-')
    expect(formatKRW(Number.NaN)).toBe('-')
  })
})

describe('formatRate', () => {
  it('signs by default', () => {
    expect(formatRate(1.25)).toBe('+1.25%')
    expect(formatRate(-0.5)).toBe('-0.50%')
  })
  it('zero has no sign, including values that round to zero', () => {
    expect(formatRate(0)).toBe('0.00%')
    expect(formatRate(0.001)).toBe('0.00%')
    expect(formatRate(-0.001)).toBe('0.00%')
  })
  it('supports no-sign and digits', () => {
    expect(formatRate(12.345, { sign: false, digits: 1 })).toBe('12.3%')
    expect(formatRate(null)).toBe('-')
  })
})

describe('other number formats', () => {
  it('formatNumber', () => {
    expect(formatNumber(1000000)).toBe('1,000,000')
    expect(formatNumber(null)).toBe('-')
  })
  it('formatSigned', () => {
    expect(formatSigned(1500)).toBe('+1,500')
    expect(formatSigned(-1500)).toBe('-1,500')
    expect(formatSigned(0)).toBe('0')
  })
  it('formatCompactKRW', () => {
    expect(formatCompactKRW(9500)).toBe('9,500원')
    expect(formatCompactKRW(2_000_000)).toBe('200만원')
    expect(formatCompactKRW(123_456_789)).toBe('1억 2,345만원')
    expect(formatCompactKRW(-30_000)).toBe('-3만원')
  })
  it('formatVolume', () => {
    expect(formatVolume(850)).toBe('850')
    expect(formatVolume(12_345_678)).toBe('1,235만')
  })
  it('priceTone: 상승=up, 하락=down', () => {
    expect(priceTone(10)).toBe('up')
    expect(priceTone(-10)).toBe('down')
    expect(priceTone(0)).toBe('flat')
  })
})

describe('dates', () => {
  const now = new Date(2026, 9, 24, 15, 0, 0)
  it('dateGroup', () => {
    expect(dateGroup(new Date(2026, 9, 24, 1, 0).toISOString(), now)).toBe('오늘')
    expect(dateGroup(new Date(2026, 9, 23, 23, 0).toISOString(), now)).toBe('어제')
    expect(dateGroup(new Date(2026, 9, 20, 10, 0).toISOString(), now)).toBe('지난 7일')
    expect(dateGroup(new Date(2026, 9, 10, 10, 0).toISOString(), now)).toBe('이전')
    expect(dateGroup('invalid', now)).toBe('이전')
  })
  it('toDateInputValue', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('formatRemaining', () => {
    expect(formatRemaining(9 * 60_000 + 41_000)).toBe('09:41')
    expect(formatRemaining(-10)).toBe('00:00')
  })
})

describe('currency formats', () => {
  it('formatMoney: KRW 는 0자리 ₩, USD 는 2자리 $', () => {
    expect(formatMoney(71200, 'KRW')).toBe('₩71,200')
    expect(formatMoney(189.5, 'USD')).toBe('$189.50')
    expect(formatMoney(1234567.891, 'USD')).toBe('$1,234,567.89')
    expect(formatMoney(71200.4)).toBe('₩71,200')
  })
  it('formatMoney: 음수/부호/0/무효값', () => {
    expect(formatMoney(-12.3, 'USD')).toBe('-$12.30')
    expect(formatMoney(12.3, 'USD', { sign: true })).toBe('+$12.30')
    expect(formatMoney(-5000, 'KRW')).toBe('-₩5,000')
    expect(formatMoney(0, 'USD', { sign: true })).toBe('$0.00')
    expect(formatMoney(-0.001, 'USD')).toBe('$0.00')
    expect(formatMoney(null, 'USD')).toBe('-')
    expect(formatMoney(Number.NaN)).toBe('-')
  })
  it('formatAmount / formatSignedAmount', () => {
    expect(formatAmount(189.5, 'USD')).toBe('189.50')
    expect(formatAmount(71200, 'KRW')).toBe('71,200')
    expect(formatSignedAmount(1.5, 'USD')).toBe('+1.50')
    expect(formatSignedAmount(-800, 'KRW')).toBe('-800')
    expect(formatSignedAmount(0, 'USD')).toBe('0.00')
  })
  it('currencyDigits / currencyOf / marketOf 는 누락 필드를 국내로 본다', () => {
    expect(currencyDigits('USD')).toBe(2)
    expect(currencyDigits('KRW')).toBe(0)
    expect(currencyDigits(undefined)).toBe(0)
    expect(currencyOf({})).toBe('KRW')
    expect(currencyOf({ currency: 'USD' })).toBe('USD')
    expect(marketOf(undefined)).toBe('KRX')
    expect(marketOf({ market: 'NASDAQ' })).toBe('NASDAQ')
    expect(marketOf({ market: 'XYZ' })).toBe('KRX')
  })
})
describe('parseDate', () => {
  it('+09:00 오프셋과 7자리 소수 초를 읽는다', () => {
    const a = parseDate('2026-10-24T22:55:09.0430481+09:00')
    expect(a?.toISOString()).toBe('2026-10-24T13:55:09.043Z')
    expect(parseDate('2026-10-25T09:00:00+09:00')?.toISOString()).toBe('2026-10-25T00:00:00.000Z')
    expect(parseDate('2026-10-24T22:55:09.5+09:00')?.toISOString()).toBe('2026-10-24T13:55:09.500Z')
    expect(parseDate('2026-10-24T22:55:09.123Z')?.toISOString()).toBe('2026-10-24T22:55:09.123Z')
  })
  it('잘못된 값은 null', () => {
    expect(parseDate('nope')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
})