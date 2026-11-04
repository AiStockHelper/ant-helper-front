import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { formatMoney, formatRate, formatSignedAmount, marketOf, priceTone, toneClass, toneSymbol, type CurrencyCode } from '@/lib/format'
import type { AgentStatus, Direction, OrderSide, OrderStatus } from '@/api/types'

/** ▲ +1,200 (+1.25%) */
export function PriceChange({
  change,
  rate,
  className,
  showAmount = true,
  currency = 'KRW',
}: {
  change?: number
  rate: number
  className?: string
  showAmount?: boolean
  currency?: CurrencyCode
}) {
  const tone = priceTone(rate)
  return (
    <span className={cn('tabular inline-flex items-center gap-1 font-semibold', toneClass(tone), className)}>
      <span aria-hidden className="text-[0.7em]">
        {toneSymbol(tone)}
      </span>
      {showAmount && change !== undefined && <span>{formatSignedAmount(change, currency)}</span>}
      <span>{showAmount && change !== undefined ? `(${formatRate(rate)})` : formatRate(rate)}</span>
    </span>
  )
}

export function PnL({ amount, rate, className, currency = 'KRW' }: { amount: number; rate: number; className?: string; currency?: CurrencyCode }) {
  const tone = priceTone(amount)
  return (
    <span className={cn('tabular font-semibold', toneClass(tone), className)}>
      {formatMoney(amount, currency, { sign: true })} <span className="font-medium">({formatRate(rate)})</span>
    </span>
  )
}

export function Stat({ label, value, className, sub }: { label: string; value: ReactNode; className?: string; sub?: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-sm font-semibold">{value}</dd>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  )
}

/** 시장 배지: KRX / NASDAQ / NYSE / AMEX (텍스트 배지) */
export function MarketBadge({ market, className }: { market?: string | null; className?: string }) {
  const m = marketOf({ market })
  return (
    <Badge tone={m === 'KRX' ? 'neutral' : 'brand'} className={cn('!px-1 !py-0 text-[10px] leading-4 tracking-wide', className)}>
      {m}
    </Badge>
  )
}

export function SideBadge({ side }: { side: OrderSide }) {
  // 한국식: 매수=빨강, 매도=파랑
  return side === 'BUY' ? <Badge tone="up">매수</Badge> : <Badge tone="down">매도</Badge>
}

const orderStatus: Record<OrderStatus, { label: string; tone: Parameters<typeof Badge>[0]['tone'] }> = {
  FILLED: { label: '체결', tone: 'success' },
  PARTIAL: { label: '부분체결', tone: 'warning' },
  PENDING: { label: '대기', tone: 'brand' },
  CANCELED: { label: '취소', tone: 'neutral' },
  REJECTED: { label: '거부', tone: 'danger' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = orderStatus[status] ?? { label: status, tone: 'neutral' as const }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  FILLED: '체결',
  PARTIAL: '부분체결',
  PENDING: '대기',
  CANCELED: '취소',
  REJECTED: '거부',
}

const agentStatus: Record<AgentStatus, { label: string; tone: Parameters<typeof Badge>[0]['tone'] }> = {
  ACTIVE: { label: '동작 중', tone: 'success' },
  RUNNING: { label: '실행 중…', tone: 'brand' },
  PAUSED: { label: '일시정지', tone: 'warning' },
  DONE: { label: '완료', tone: 'neutral' },
  CANCELED: { label: '중지됨', tone: 'neutral' },
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const s = agentStatus[status] ?? { label: status, tone: 'neutral' as const }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  if (direction === 'UP') return <Badge tone="up">▲ 상승</Badge>
  if (direction === 'DOWN') return <Badge tone="down">▼ 하락</Badge>
  return <Badge tone="neutral">– 보합</Badge>
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-subtle">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
