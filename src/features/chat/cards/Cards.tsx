import { Component, useMemo, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  Ban,
  CheckCircle2,
  Coins,
  LineChart,
  ListOrdered,
  Search,
  Sparkles,
  Trophy,
  Wallet,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { currencyOf, formatAmount, formatDateTime, formatMoney, formatNumber, formatVolume, priceTone, toneClass } from '@/lib/format'
import { HoldingsList, OrderList } from '@/components/finance/Lists'
import { DirectionBadge, MarketBadge, PriceChange, SideBadge, Stat } from '@/components/finance/parts'
import { SectionTitle, SummaryBlock } from '@/components/finance/Summary'
import { AgentTaskList } from '@/features/agent/AgentTasks'
import { useChatUi } from '../ChatContext'
import { CandleChart } from './CandleChart'
import type {
  AccountSummary,
  AgentTask,
  Candle,
  CandlesCardData,
  Card,
  LlmPicksData,
  OrderHistoryItem,
  OrderResultData,
  Prediction,
  Quote,
  Recommendation,
  StockSearchItem,
} from '@/api/types'

function CardShell({
  icon,
  title,
  aside,
  children,
  className,
  flush,
}: {
  icon: ReactNode
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-surface shadow-card', className)}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-brand-text" aria-hidden>
          {icon}
        </span>
        <h3 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold">{title}</h3>
        {aside}
      </header>
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

function QuoteCard({ data }: { data: Quote }) {
  const tone = priceTone(data.change)
  const cur = currencyOf(data)
  return (
    <CardShell icon={<LineChart className="h-4 w-4" />} title="현재가" aside={<span className="tabular text-xs text-subtle">{formatDateTime(data.asOf)} 기준</span>}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-base font-bold">{data.name}</span>
            <MarketBadge market={data.market} />
          </p>
          <p className="tabular text-xs text-subtle">{data.productNumber}</p>
        </div>
        <div className="text-right">
          <p className={cn('tabular text-3xl font-extrabold tracking-tight', toneClass(tone))}>{formatMoney(data.price, cur)}</p>
          <PriceChange change={data.change} rate={data.changeRate} currency={cur} className="text-sm" />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Stat label="시가" value={formatMoney(data.open, cur)} />
        <Stat label="고가" value={<span className="text-up">{formatMoney(data.high, cur)}</span>} />
        <Stat label="저가" value={<span className="text-down">{formatMoney(data.low, cur)}</span>} />
        <Stat label="거래량" value={formatVolume(data.volume)} />
      </dl>
    </CardShell>
  )
}

const PERIOD_LABEL = { D: '일봉', W: '주봉', M: '월봉' } as const

/** `Candle[]`(구형) 과 `{ productNumber, name, market, currency, period, candles }` 모두 허용 */
function normalizeCandles(data: Candle[] | CandlesCardData | null | undefined): CandlesCardData {
  if (Array.isArray(data)) return { candles: data }
  return { ...(data ?? {}), candles: data?.candles ?? [] }
}

function CandlesCard({ data }: { data: Candle[] | CandlesCardData }) {
  const d = normalizeCandles(data)
  const candles = d.candles
  if (candles.length === 0) return <p className="text-sm text-muted">차트 데이터가 없습니다.</p>
  const first = candles[0]
  const last = candles[candles.length - 1]
  const rate = first.close ? ((last.close - first.close) / first.close) * 100 : 0
  const period = PERIOD_LABEL[d.period ?? 'D'] ?? '일봉'
  const unit = d.period === 'W' ? '주' : d.period === 'M' ? '개월' : '일'
  return (
    <CardShell
      icon={<BarChart3 className="h-4 w-4" />}
      title={
        <>
          {d.name && <span className="truncate">{d.name}</span>}
          {d.market && <MarketBadge market={d.market} />}
          <span className="shrink-0 font-normal text-muted">
            {period} · 최근 {candles.length}
            {unit}
          </span>
        </>
      }
      aside={<PriceChange rate={rate} showAmount={false} className="text-xs" />}
    >
      <CandleChart candles={candles} currency={currencyOf(d)} />
    </CardShell>
  )
}

function ConfidenceGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const r = 40
  const c = Math.PI * r
  return (
    <div className="relative h-[68px] w-[120px] shrink-0" role="img" aria-label={`신뢰도 ${Math.round(v)}%`}>
      <svg viewBox="0 0 100 56" className="h-full w-full">
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="rgb(var(--surface-3))" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke="rgb(var(--brand))"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <span className="tabular text-xl font-extrabold">{Math.round(v)}</span>
        <span className="text-xs text-subtle">%</span>
      </div>
    </div>
  )
}

const toneBadge = { POSITIVE: 'up', NEGATIVE: 'down', NEUTRAL: 'neutral' } as const

function PredictionCard({ data }: { data: Prediction }) {
  const tone = priceTone(data.predictedChangeRate)
  const cur = currencyOf(data)
  return (
    <CardShell
      icon={<Sparkles className="h-4 w-4" />}
      title={
        <>
          <span className="truncate">{data.name} 내일 예측</span>
          <MarketBadge market={data.market} />
        </>
      }
      aside={<DirectionBadge direction={data.direction} />}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-subtle">예상 종가</p>
          <p className={cn('tabular text-2xl font-extrabold', toneClass(tone))}>{formatMoney(data.predictedPrice, cur)}</p>
          <p className="tabular mt-0.5 text-sm text-muted">
            현재 {formatMoney(data.currentPrice, cur)} <PriceChange rate={data.predictedChangeRate} showAmount={false} className="ml-1" />
          </p>
        </div>
        <div className="flex flex-col items-center">
          <ConfidenceGauge value={data.confidence} />
          <span className="mt-1 text-xs text-subtle">신뢰도</span>
        </div>
      </div>
      {data.summary && <p className="mt-3 text-sm leading-relaxed text-muted">{data.summary}</p>}
      {data.signals?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="예측 신호">
          {data.signals.map((s) => (
            <li key={s.name}>
              <Badge tone={toneBadge[s.tone] ?? 'neutral'} className="!font-medium">
                {s.name} · {s.value}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        통계 기반 참고 지표이며 수익을 보장하지 않습니다.
      </p>
    </CardShell>
  )
}

function RecommendationsCard({ data }: { data: Recommendation[] }) {
  const { sendMessage, busy } = useChatUi()
  return (
    <CardShell
      icon={<Trophy className="h-4 w-4" />}
      title={
        <>
          모델 추천 TOP {data.length}
          {data[0]?.asOf && <span className="text-xs font-normal text-subtle">{data[0].asOf} 마감 기준</span>}
        </>
      }
      flush
    >
      <ol className="divide-y divide-border">
        {data.map((r, i) => {
          const cur = currencyOf(r)
          return (
            <li key={`${r.market ?? 'KRX'}-${r.productNumber}`} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted',
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => sendMessage(`${r.name} 시세 알려줘`)}
                      className="flex min-w-0 items-center gap-1.5 truncate text-left font-semibold hover:text-brand-text disabled:pointer-events-none"
                    >
                      <span className="truncate">{r.name}</span>
                      <MarketBadge market={r.market} />
                      <span className="tabular text-xs font-normal text-subtle">{r.productNumber}</span>
                    </button>
                    <div className="tabular flex items-center gap-2 text-sm">
                      <span>{formatMoney(r.currentPrice, cur)}</span>
                      <PriceChange rate={r.predictedChangeRate} showAmount={false} className="text-sm" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <DirectionBadge direction={r.direction} />
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, r.confidence))}%` }} />
                    </div>
                    <span className="tabular text-xs text-subtle">
                      신뢰도 {Math.round(r.confidence)}% · 점수 {Number(r.score).toFixed(1)}
                    </span>
                  </div>
                  {r.reasons?.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {r.reasons.slice(0, 3).map((reason) => (
                        <li key={reason} className="flex gap-1.5">
                          <span aria-hidden>·</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </CardShell>
  )
}

function SearchCard({ data }: { data: StockSearchItem[] }) {
  const { sendMessage, busy } = useChatUi()
  return (
    <CardShell icon={<Search className="h-4 w-4" />} title={`검색 결과 ${data.length}건`} flush>
      {data.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">검색 결과가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((s) => (
            <li key={`${s.market}-${s.productNumber}`}>
              <button
                type="button"
                disabled={busy}
                onClick={() => sendMessage(`${s.name} 시세 알려줘`)}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 disabled:pointer-events-none"
                aria-label={`${s.name} 시세 조회`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="tabular block truncate text-xs text-subtle">
                    {s.productNumber}
                    {s.nameEn && s.nameEn !== s.name ? ` · ${s.nameEn}` : ''}
                  </span>
                </span>
                <MarketBadge market={String(s.market)} />
                {s.currency === 'USD' && <Badge>USD</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  )
}

/** 잔고 카드: 국내(KRW) 요약 + 보유 종목 표, overseas 가 있으면 해외(USD) 섹션을 추가 */
function BalanceCard({ data }: { data: AccountSummary }) {
  const overseas = data.overseas ?? null
  return (
    <CardShell icon={<Wallet className="h-4 w-4" />} title="계좌 잔고" aside={<span className="tabular text-xs text-subtle">{formatDateTime(data.asOf)} 기준</span>} flush>
      <div className="p-4">
        <SectionTitle aside={<Badge>국내 · KRW</Badge>}>국내 주식</SectionTitle>
        <div className="mt-3">
          <SummaryBlock totals={data} currency="KRW" big={false} />
        </div>
      </div>
      {data.holdings?.length > 0 && (
        <div className="border-t border-border">
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-subtle">보유 종목 {data.holdings.length}개</p>
          <HoldingsList holdings={data.holdings} />
        </div>
      )}
      {overseas && (
        <div className="border-t-4 border-surface-2">
          <div className="p-4">
            <SectionTitle
              aside={
                <span className="flex items-center gap-1.5">
                  {data.exchangeRate != null && (
                    <span className="tabular text-[11px] text-subtle">환율 {formatAmount(data.exchangeRate, 'USD')}원/$</span>
                  )}
                  <Badge tone="brand">해외 · USD</Badge>
                </span>
              }
            >
              해외 주식
            </SectionTitle>
            <div className="mt-3">
              <SummaryBlock totals={overseas} currency="USD" big={false} />
            </div>
          </div>
          {overseas.holdings?.length > 0 && (
            <div className="border-t border-border">
              <p className="px-4 pb-1 pt-3 text-xs font-semibold text-subtle">보유 종목 {overseas.holdings.length}개</p>
              <HoldingsList holdings={overseas.holdings} />
            </div>
          )}
        </div>
      )}
    </CardShell>
  )
}

/** 구형 `holdings` 카드도 계속 지원 */
function HoldingsCard({ data }: { data: AccountSummary }) {
  return (
    <CardShell icon={<Wallet className="h-4 w-4" />} title={`보유 종목 ${data.holdings.length}개`} flush>
      <HoldingsList holdings={data.holdings} />
    </CardShell>
  )
}

function OrdersCard({ data }: { data: OrderHistoryItem[] }) {
  return (
    <CardShell icon={<ListOrdered className="h-4 w-4" />} title={`주문 내역 ${data.length}건`} flush>
      <OrderList orders={data} />
    </CardShell>
  )
}

function OrderResultCard({ data }: { data: OrderResultData }) {
  const ok = data.success
  const cancel = data.side === ''
  const cur = currencyOf(data)
  return (
    <CardShell
      icon={cancel ? <Ban className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
      title={cancel ? '주문 취소 결과' : '주문 결과'}
      aside={data.side ? <SideBadge side={data.side} /> : undefined}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-danger" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-semibold">
            {cancel ? (ok ? '주문이 취소되었습니다' : '주문 취소에 실패했습니다') : ok ? '주문이 접수되었습니다' : '주문에 실패했습니다'}
          </p>
          <p className="mt-0.5 text-sm text-muted">{data.message}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Stat
          label="종목"
          value={
            <span className="flex items-center gap-1.5">
              <span className="truncate">{data.name || '-'}</span>
              {data.name && <MarketBadge market={data.market} />}
            </span>
          }
        />
        <Stat label="수량" value={data.quantity ? `${formatNumber(data.quantity)}주` : '-'} />
        <Stat label={cur === 'USD' ? '가격 (지정가)' : '가격'} value={data.price ? formatMoney(data.price, cur) : cancel ? '-' : '시장가'} />
        <Stat label="주문번호" value={data.orderNo ?? '-'} />
      </dl>
    </CardShell>
  )
}

function LlmPicksCard({ data }: { data: LlmPicksData }) {
  const { sendMessage, busy } = useChatUi()
  const picks = data?.picks ?? []
  return (
    <CardShell
      icon={<BrainCircuit className="h-4 w-4" />}
      title={
        <>
          AI 의견 {picks.length}종목
          <Badge tone="brand">LLM 판단</Badge>
        </>
      }
      flush
    >
      <ul className="divide-y divide-border">
        {picks.map((p) => {
          const cur = currencyOf(p)
          return (
            <li key={`${p.market ?? 'KRX'}-${p.productNumber}`} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => sendMessage(`${p.name} 시세 알려줘`)}
                  className="flex min-w-0 items-center gap-1.5 truncate text-left font-semibold hover:text-brand-text disabled:pointer-events-none"
                >
                  <span className="truncate">{p.name}</span>
                  <MarketBadge market={p.market} />
                  <span className="tabular text-xs font-normal text-subtle">{p.productNumber}</span>
                </button>
                <span className="tabular text-sm">{formatMoney(p.currentPrice, cur)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {p.outlook && <Badge tone="brand">{p.outlook}</Badge>}
                {p.inModelTop ? (
                  <Badge tone="success">모델 추천과 일치{p.modelRank ? ` · ${p.modelRank}위` : ''}</Badge>
                ) : p.modelAnalyzed ? (
                  <Badge tone="neutral">
                    모델 {p.modelRank ? `${p.modelTotal ? `${p.modelTotal}종목 중 ` : ''}${p.modelRank}위` : '분석됨'} (추천 밖)
                  </Badge>
                ) : (
                  <Badge tone="warning">모델 분석 없음</Badge>
                )}
                {p.modelDirection && <DirectionBadge direction={p.modelDirection} />}
              </div>
              {p.reason && <p className="mt-2 text-sm text-muted">{p.reason}</p>}
            </li>
          )
        })}
      </ul>
      <p className="border-t border-border px-4 py-2 text-xs text-subtle">
        AI가 지표와 일반 지식으로 고른 의견입니다. 모델 분석이 없는 종목은 모델의 뒷받침이 없습니다. 실시간 뉴스·공시는 반영되지 않았고, 투자 권유가 아닙니다.
      </p>
    </CardShell>
  )
}

function AgentTasksCard({ data }: { data: AgentTask[] }) {
  return (
    <CardShell icon={<Bot className="h-4 w-4" />} title={`자동 실행 ${data.length}건`} flush>
      <AgentTaskList tasks={data} showAccount />
    </CardShell>
  )
}

class CardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return <p className="rounded-xl border border-dashed border-border-strong px-3 py-2 text-sm text-muted">카드를 표시할 수 없습니다.</p>
    }
    return this.props.children
  }
}

function renderCard(card: Card) {
  const d = card.data
  switch (card.type) {
    case 'quote':
      return <QuoteCard data={d as Quote} />
    case 'candles':
      return <CandlesCard data={d} />
    case 'prediction':
      return <PredictionCard data={d as Prediction} />
    case 'recommendations':
      return <RecommendationsCard data={(d ?? []) as Recommendation[]} />
    case 'search':
      return <SearchCard data={(d ?? []) as StockSearchItem[]} />
    case 'balance':
      return <BalanceCard data={d as AccountSummary} />
    case 'holdings':
      return <HoldingsCard data={d as AccountSummary} />
    case 'orders':
      return <OrdersCard data={(d ?? []) as OrderHistoryItem[]} />
    case 'order_result':
      return <OrderResultCard data={d as OrderResultData} />
    case 'llm_recommendations':
      return <LlmPicksCard data={d as LlmPicksData} />
    case 'agent_tasks':
      return <AgentTasksCard data={(d ?? []) as AgentTask[]} />
    default:
      return null
  }
}

export function CardRenderer({ card }: { card: Card }) {
  const node = useMemo(() => renderCard(card), [card])
  if (!node) return null
  return (
    <div className="animate-fade-in">
      <CardBoundary>{node}</CardBoundary>
    </div>
  )
}
