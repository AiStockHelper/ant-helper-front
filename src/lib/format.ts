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

/** 금액 뒤에 붙이는 단위. 원화와 달러가 헷갈리지 않도록 항상 표시한다. */
const CURRENCY_UNIT: Record<CurrencyCode, string> = { KRW: '원', USD: '달러' }
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

// ── 달러 종목 금액을 어떻게 보여줄지 (USD 달러 / KRW 원화 환산 / BOTH 함께) ──────────────
export type UsdDisplay = 'USD' | 'KRW' | 'BOTH'

let usdDisplay: UsdDisplay = 'USD'
let usdKrw: number | null = null

/** 화면 전체가 같은 설정을 쓰도록 모듈에 보관한다. 환율이 없으면 달러 그대로 보여 준다. */
export function setUsdDisplay(mode: UsdDisplay, rate: number | null) {
  usdDisplay = mode
  usdKrw = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null
}

export function getUsdDisplay(): { mode: UsdDisplay; rate: number | null } {
  return { mode: usdDisplay, rate: usdKrw }
}

function plain(n: number, currency: CurrencyCode, opts: { sign?: boolean }): string {
  const body = formatAmount(Math.abs(n), currency)
  const isZero = Number(body.replace(/,/g, '')) === 0
  const unit = CURRENCY_UNIT[currency]
  if (n < 0 && !isZero) return `-${body}${unit}`
  if (opts.sign && n > 0 && !isZero) return `+${body}${unit}`
  return `${body}${unit}`
}

/** 단위가 붙은 금액: (KRW) "71,200원", (USD) "189.50달러". sign 이면 양수에 + 를 붙인다.
 *  달러 종목은 보기 설정에 따라 "약 261,531원" 또는 "189.50달러 (약 261,531원)" 로 바뀐다(환율을 알 때만). */
export function formatMoney(n: number | null | undefined, currency: CurrencyCode = 'KRW', opts: { sign?: boolean } = {}): string {
  if (!isNum(n)) return '-'
  if (currency === 'USD' && usdDisplay !== 'USD' && usdKrw) {
    const won = `약 ${plain(n * usdKrw, 'KRW', opts)}`.replace('약 -', '-약 ').replace('약 +', '+약 ')
    return usdDisplay === 'KRW' ? won : `${plain(n, 'USD', opts)} (${won})`
  }
  return plain(n, currency, opts)
}

/** 변동 금액(부호 포함, 단위 포함): (USD) 1.5 -> "+1.50달러" */
export function formatSignedAmount(n: number | null | undefined, currency: CurrencyCode = 'KRW'): string {
  if (!isNum(n)) return '-'
  const body = formatAmount(Math.abs(n), currency)
  const isZero = Number(body.replace(/,/g, '')) === 0
  if (currency === 'USD' && usdDisplay === 'KRW' && usdKrw) {
    const won = formatAmount(Math.abs(n) * usdKrw, 'KRW')
    return Number(won.replace(/,/g, '')) === 0 ? `${won}원` : `${n > 0 ? '+' : '-'}${won}원`
  }
  const unit = CURRENCY_UNIT[currency]
  if (isZero) return `${body}${unit}`
  return n > 0 ? `+${body}${unit}` : `-${body}${unit}`
}
/** 환율 표시: "1달러 = 1,380.50원" */
export function formatExchangeRate(rate: number | null | undefined): string {
  return isNum(rate) ? `1달러 = ${formatAmount(rate, 'USD')}원` : '-'
}

export type MarketCode = 'KRX' | 'NASDAQ' | 'NYSE' | 'AMEX'
export function marketOf(x: { market?: string | null } | null | undefined): MarketCode {
  const m = x?.market
  return m === 'NASDAQ' || m === 'NYSE' || m === 'AMEX' ? m : 'KRX'
}

// ── 채팅 시각 (카카오톡 스타일) ───────────────────────────
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "오전 9:07" / "오후 3:30" — 메시지 옆에 붙이는 시각 */
export function formatChatTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  if (!d) return ''
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "2026년 11월 5일 목요일" — 날짜가 바뀔 때 대화 사이에 넣는 구분선 */
export function formatDayDivider(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  if (!d) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`
}

export function sameDay(a: string | number | Date | null | undefined, b: string | number | Date | null | undefined): boolean {
  const x = toDate(a)
  const y = toDate(b)
  return !!x && !!y && startOfDay(x) === startOfDay(y)
}

// ── 금액 입력·본문 속 숫자에 천 단위 쉼표 ─────────────────────────

/** "1234567.5" -> "1,234,567.5". 숫자와 소수점 외의 글자는 버린다(입력창에서 쓴다). */
export function groupDigits(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  const intPart = dot >= 0 ? cleaned.slice(0, dot) : cleaned
  const frac = dot >= 0 ? cleaned.slice(dot + 1).replace(/\./g, '') : null
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac === null ? grouped : `${grouped}.${frac}`
}

/** 입력창의 값(쉼표 포함 가능)을 숫자 문자열로 되돌린다. */
export function ungroup(display: string): string {
  return display.replace(/[^\d.]/g, '')
}

// 뒷부분만 보는 전방탐색만 쓴다(오래된 사파리는 lookbehind 를 지원하지 않는다).
const MONEY_AFTER = /(^|[^\d,.])(\d{4,})(\.\d+)?(?=\s?(?:원|달러|USD|KRW))/g
const MONEY_AFTER_SYMBOL = /([$₩])(\d{4,})(\.\d+)?(?![\d,])/g

/**
 * AI 답변처럼 사람이 쓰지 않은 글에서 쉼표 없는 큰 금액("1250000원", "$12345.5")에 천 단위 쉼표를 넣는다.
 * 코드 블록(```)은 건드리지 않는다. 이미 쉼표가 있는 숫자와 "200만원" 같은 표현은 그대로 둔다.
 */
export function commaizeMoney(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(MONEY_AFTER, (_m, pre: string, int: string, frac?: string) => pre + groupDigits(int) + (frac ?? ''))
            .replace(MONEY_AFTER_SYMBOL, (_m, sym: string, int: string, frac?: string) => sym + groupDigits(int) + (frac ?? '')),
    )
    .join('')
}