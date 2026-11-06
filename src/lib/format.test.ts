import { afterEach, describe, expect, it } from 'vitest'
import {
  currencyDigits,
  currencyOf,
  dateGroup,
  formatAmount,
  formatMoney,
  commaizeMoney,
  formatChatTime,
  formatDayDivider,
  formatExchangeRate,
  formatSignedAmount,
  getUsdDisplay,
  groupDigits,
  setUsdDisplay,
  sameDay,
  ungroup,
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
  it('formatMoney: 원화는 "원", 달러는 "달러"를 뒤에 붙여 구분한다', () => {
    expect(formatMoney(71200, 'KRW')).toBe('71,200원')
    expect(formatMoney(189.5, 'USD')).toBe('189.50달러')
    expect(formatMoney(1234567.891, 'USD')).toBe('1,234,567.89달러')
    expect(formatMoney(71200.4)).toBe('71,200원')
  })
  it('formatMoney: 음수/부호/0/무효값', () => {
    expect(formatMoney(-12.3, 'USD')).toBe('-12.30달러')
    expect(formatMoney(12.3, 'USD', { sign: true })).toBe('+12.30달러')
    expect(formatMoney(-5000, 'KRW')).toBe('-5,000원')
    expect(formatMoney(5000, 'KRW', { sign: true })).toBe('+5,000원')
    expect(formatMoney(0, 'USD', { sign: true })).toBe('0.00달러')
    expect(formatMoney(-0.001, 'USD')).toBe('0.00달러')
    expect(formatMoney(null, 'USD')).toBe('-')
    expect(formatMoney(Number.NaN)).toBe('-')
  })
  it('formatAmount(숫자만) / formatSignedAmount(부호+단위) / formatExchangeRate', () => {
    expect(formatAmount(189.5, 'USD')).toBe('189.50')
    expect(formatAmount(71200, 'KRW')).toBe('71,200')
    expect(formatSignedAmount(1.5, 'USD')).toBe('+1.50달러')
    expect(formatSignedAmount(-800, 'KRW')).toBe('-800원')
    expect(formatSignedAmount(0, 'USD')).toBe('0.00달러')
    expect(formatExchangeRate(1380.5)).toBe('1달러 = 1,380.50원')
    expect(formatExchangeRate(undefined)).toBe('-')
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

describe('chat time (카카오톡 스타일)', () => {
  it('formatChatTime: 오전/오후 12시간제', () => {
    expect(formatChatTime(new Date(2026, 10, 5, 0, 5))).toBe('오전 12:05')
    expect(formatChatTime(new Date(2026, 10, 5, 9, 7))).toBe('오전 9:07')
    expect(formatChatTime(new Date(2026, 10, 5, 12, 0))).toBe('오후 12:00')
    expect(formatChatTime(new Date(2026, 10, 5, 15, 30))).toBe('오후 3:30')
    expect(formatChatTime(null)).toBe('')
    expect(formatChatTime('not-a-date')).toBe('')
  })
  it('formatDayDivider: 연월일과 요일', () => {
    expect(formatDayDivider(new Date(2026, 10, 5, 10, 0))).toBe('2026년 11월 5일 목요일')
    expect(formatDayDivider(new Date(2026, 0, 31, 23, 59))).toBe('2026년 1월 31일 토요일')
  })
  it('sameDay: 자정을 기준으로 날짜가 바뀐다', () => {
    expect(sameDay(new Date(2026, 10, 5, 0, 0), new Date(2026, 10, 5, 23, 59))).toBe(true)
    expect(sameDay(new Date(2026, 10, 5, 23, 59), new Date(2026, 10, 6, 0, 0))).toBe(false)
    expect(sameDay(null, new Date())).toBe(false)
  })
})

describe('달러 ↔ 원 보기 설정', () => {
  afterEach(() => setUsdDisplay('USD', null))

  it('기본은 달러 그대로, 원화 종목은 영향받지 않는다', () => {
    expect(formatMoney(189.5, 'USD')).toBe('189.50달러')
    setUsdDisplay('KRW', 1380)
    expect(formatMoney(71200, 'KRW')).toBe('71,200원')
  })

  it('원화 환산: 환율을 곱해 약 N원으로 보여 준다', () => {
    setUsdDisplay('KRW', 1380)
    expect(formatMoney(100, 'USD')).toBe('약 138,000원')
    expect(formatMoney(-2.5, 'USD')).toBe('-약 3,450원')
    expect(formatMoney(2.5, 'USD', { sign: true })).toBe('+약 3,450원')
    expect(formatSignedAmount(-1.5, 'USD')).toBe('-2,070원')
  })

  it('함께 보기: 달러와 환산 원화를 같이', () => {
    setUsdDisplay('BOTH', 1380)
    expect(formatMoney(100, 'USD')).toBe('100.00달러 (약 138,000원)')
    expect(formatMoney(-100, 'USD')).toBe('-100.00달러 (-약 138,000원)')
  })

  it('환율을 모르면 달러로 보여 준다', () => {
    setUsdDisplay('KRW', null)
    expect(formatMoney(100, 'USD')).toBe('100.00달러')
    setUsdDisplay('BOTH', Number.NaN)
    expect(getUsdDisplay().rate).toBeNull()
  })
})

describe('천 단위 쉼표', () => {
  it('groupDigits / ungroup', () => {
    expect(groupDigits('1234567')).toBe('1,234,567')
    expect(groupDigits('1234567.50')).toBe('1,234,567.50')
    expect(groupDigits('12a3,4')).toBe('1,234')
    expect(groupDigits('999')).toBe('999')
    expect(groupDigits('')).toBe('')
    expect(groupDigits('1234.')).toBe('1,234.')
    expect(ungroup('1,234,567.5')).toBe('1234567.5')
  })

  it('commaizeMoney: 쉼표 없는 큰 금액만 고친다', () => {
    expect(commaizeMoney('삼성전자 1250000원 매수')).toBe('삼성전자 1,250,000원 매수')
    expect(commaizeMoney('총 12345.67달러입니다')).toBe('총 12,345.67달러입니다')
    expect(commaizeMoney('현재가 71200 원')).toBe('현재가 71,200 원')
    expect(commaizeMoney('가격은 $12345.5 입니다')).toBe('가격은 $12,345.5 입니다')
    expect(commaizeMoney('₩1250000')).toBe('₩1,250,000')
  })

  it('commaizeMoney: 이미 쉼표가 있거나 금액이 아닌 숫자는 그대로', () => {
    expect(commaizeMoney('1,250,000원')).toBe('1,250,000원')
    expect(commaizeMoney('200만원 어치')).toBe('200만원 어치')
    expect(commaizeMoney('종목코드 005930 은 삼성전자')).toBe('종목코드 005930 은 삼성전자')
    expect(commaizeMoney('거래량 1250000주')).toBe('거래량 1250000주')
    expect(commaizeMoney('500원')).toBe('500원')
    expect(commaizeMoney('2026년 11월 5일')).toBe('2026년 11월 5일')
  })

  it('commaizeMoney: 코드 블록은 건드리지 않는다', () => {
    const src = '```\nprice = 1250000원\n```\n1250000원'
    expect(commaizeMoney(src)).toBe('```\nprice = 1250000원\n```\n1,250,000원')
  })
})