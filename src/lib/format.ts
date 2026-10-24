const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

export type Tone = 'up' | 'down' | 'flat'

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 1234567 -> "1,234,567" */
export function formatNumber(n: number | null | undefined): string {
  if (!isNum(n)) return '-'
  return nf.format(Math.round(n))
}

/** 1234567 -> "1,234,567원", sign 옵션이면 "+1,234원" */
export function formatKRW(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (!isNum(n)) return '-'
  const rounded = Math.round(n)
  const body = `${nf.format(Math.abs(rounded))}원`
  if (rounded < 0) return `-${body}`
  if (opts.sign && rounded > 0) return `+${body}`
  return body
}

/** 1.25 -> "+1.25%", -0.5 -> "-0.50%", 0 -> "0.00%" */
export function formatRate(n: number | null | undefined, opts: { digits?: number; sign?: boolean } = {}): string {
  if (!isNum(n)) return '-'
  const digits = opts.digits ?? 2
  const sign = opts.sign ?? true
  const fixed = Math.abs(n).toFixed(digits)
  const isZero = Number(fixed) === 0
  if (isZero) return `${fixed}%`
  if (n < 0) return `-${fixed}%`
  return `${sign ? '+' : ''}${fixed}%`
}

/** 부호 포함 숫자: 1234 -> "+1,234" */
export function formatSigned(n: number | null | undefined): string {
  if (!isNum(n)) return '-'
  const r = Math.round(n)
  if (r > 0) return `+${nf.format(r)}`
  if (r < 0) return `-${nf.format(Math.abs(r))}`
  return '0'
}

/** 큰 금액을 억/만 단위로: 123456789 -> "1억 2,345만원" */
export function formatCompactKRW(n: number | null | undefined): string {
  if (!isNum(n)) return '-'
  const abs = Math.abs(Math.round(n))
  const sign = n < 0 ? '-' : ''
  if (abs < 10000) return `${sign}${nf.format(abs)}원`
  const eok = Math.floor(abs / 100_000_000)
  const man = Math.floor((abs % 100_000_000) / 10000)
  const parts: string[] = []
  if (eok > 0) parts.push(`${nf.format(eok)}억`)
  if (man > 0) parts.push(`${nf.format(man)}만`)
  return `${sign}${parts.join(' ')}원`
}

export function priceTone(n: number | null | undefined): Tone {
  if (!isNum(n) || n === 0) return 'flat'
  return n > 0 ? 'up' : 'down'
}

export function toneClass(tone: Tone): string {
  if (tone === 'up') return 'text-up'
  if (tone === 'down') return 'text-down'
  return 'text-muted'
}

export function toneSymbol(tone: Tone): string {
  if (tone === 'up') return '▲'
  if (tone === 'down') return '▼'
  return '–'
}

const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
const timeSecFmt = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * ISO-8601 문자열을 Date 로. 백엔드가 소수점 초를 7자리(2026-10-24T22:55:09.0430481+09:00)로 주는 경우도
 * 엔진 구현(Safari 등)에 상관없이 읽도록 소수부를 3자리로 맞춘다.
 */
export function parseDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const s = typeof v === 'string' ? v.replace(/(\.\d{3})\d+/, '$1').replace(/\.(\d{1,2})(?=Z|[+-]\d{2}:?\d{2}$)/, (_m, d: string) => `.${d.padEnd(3, '0')}`) : v
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const toDate = parseDate

export function formatDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  return d ? dateFmt.format(d) : '-'
}

export function formatShortDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  return d ? shortDateFmt.format(d) : '-'
}

export function formatTime(v: string | number | Date | null | undefined, withSeconds = false): string {
  const d = toDate(v)
  if (!d) return '-'
  return (withSeconds ? timeSecFmt : timeFmt).format(d)
}

/** "10월 24일 09:00" */
export function formatDateTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  return d ? `${shortDateFmt.format(d)} ${timeFmt.format(d)}` : '-'
}

/** Date -> "2026-10-24" (로컬 기준) */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 남은 시간(ms)을 "09:41" 로. 0 이하이면 "00:00" */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type DateGroup = '오늘' | '어제' | '지난 7일' | '이전'

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 대화 이력 날짜 그룹 */
export function dateGroup(iso: string, now: Date = new Date()): DateGroup {
  const d = toDate(iso)
  if (!d) return '이전'
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / dayMs)
  if (diffDays <= 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays <= 7) return '지난 7일'
  return '이전'
}

export function formatVolume(n: number | null | undefined): string {
  if (!isNum(n)) return '-'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${nf.format(Math.round(n / 10_000))}만`
  return nf.format(n)
}

// ── 통화별 표기 (해외주식) ───────────────────────
export type CurrencyCode = 'KRW' | 'USD'

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { KRW: '₩', USD: '$' }
const usdFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 통화별 소수 자리. KRW 0, USD 2 */
export function currencyDigits(currency: CurrencyCode | null | undefined): number {
  return currency === 'USD' ? 2 : 0
}

/** currency 필드가 없는(구버전) 응답은 KRW 로 본다 */
export function currencyOf(x: { currency?: string | null } | null | undefined): CurrencyCode {
  return x?.currency === 'USD' ? 'USD' : 'KRW'
}

/** 숫자만(통화 기호 없이) 통화 자릿수로: (KRW) 71200 -> "71,200", (USD) 189.5 -> "189.50" */
export function formatAmount(n: number | null | undefined, currency: CurrencyCode = 'KRW'): string {
  if (!isNum(n)) return '-'
  return currency === 'USD' ? usdFmt.format(Math.abs(n) < 0.005 ? 0 : n) : nf.format(Math.round(n))
}

/** 통화 기호 포함: (KRW) "₩71,200", (USD) "$189.50". sign 이면 양수에 + */
export function formatMoney(n: number | null | undefined, currency: CurrencyCode = 'KRW', opts: { sign?: boolean } = {}): string {
  if (!isNum(n)) return '-'
  const body = formatAmount(Math.abs(n), currency)
  const isZero = Number(body.replace(/,/g, '')) === 0
  const symbol = CURRENCY_SYMBOL[currency]
  if (n < 0 && !isZero) return `-${symbol}${body}`
  if (opts.sign && n > 0 && !isZero) return `+${symbol}${body}`
  return `${symbol}${body}`
}

/** 부호 포함 숫자(기호 없음): (USD) 1.5 -> "+1.50" */
export function formatSignedAmount(n: number | null | undefined, currency: CurrencyCode = 'KRW'): string {
  if (!isNum(n)) return '-'
  const body = formatAmount(Math.abs(n), currency)
  const isZero = Number(body.replace(/,/g, '')) === 0
  if (isZero) return body
  return n > 0 ? `+${body}` : `-${body}`
}

export type MarketCode = 'KRX' | 'NASDAQ' | 'NYSE' | 'AMEX'
export function marketOf(x: { market?: string | null } | null | undefined): MarketCode {
  const m = x?.market
  return m === 'NASDAQ' || m === 'NYSE' || m === 'AMEX' ? m : 'KRX'
}