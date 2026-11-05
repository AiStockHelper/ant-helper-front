import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Landmark, RefreshCw, ShieldAlert } from 'lucide-react'
import { accountsApi, agentApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { AccountSelect } from '@/components/AccountSelect'
import { PageBody, PageHeader } from '@/components/PageHeader'
import { AllocationDonut } from '@/components/finance/AllocationDonut'
import { HoldingsList, OrderList } from '@/components/finance/Lists'
import { EmptyState, ORDER_STATUS_LABEL, PnL } from '@/components/finance/parts'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAccounts } from '@/features/accounts/useAccounts'
import { cn } from '@/lib/cn'
import { SectionTitle, SummaryBlock } from '@/components/finance/Summary'
import { Segmented } from '@/components/ui/Field'
import { formatAmount, formatDate, formatTime, toDateInputValue } from '@/lib/format'
import { AgentTaskManager, NoAgentTasks } from '@/features/agent/AgentTasks'
import { OrderQueue } from '@/features/orderqueue/OrderQueue'
import type { OrderScope, OrderStatus } from '@/api/types'

type TabKey = 'overview' | 'holdings' | 'orders' | 'queue' | 'automation' | 'info'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'holdings', label: '보유 종목' },
  { key: 'orders', label: '거래내역' },
  { key: 'queue', label: '주문 큐' },
  { key: 'automation', label: '자동화' },
  { key: 'info', label: '계좌정보' },
]
const LAST_ACCOUNT_KEY = 'ant.portfolio.account'

function Card({ children, className, title, aside }: { children: React.ReactNode; className?: string; title?: string; aside?: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-surface shadow-card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  )
}

function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title="데이터를 불러오지 못했어요"
      description={errorMessage(error)}
      action={
        <Button variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
      }
    />
  )
}

function Overview({ accountId }: { accountId: number }) {
  const q = useQuery({ queryKey: ['summary', accountId], queryFn: () => accountsApi.summary(accountId) })
  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    )
  }
  if (q.isError || !q.data) return <QueryError error={q.error} onRetry={() => q.refetch()} />
  const s = q.data
  const o = s.overseas ?? null
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle aside={<Badge>국내 · KRW</Badge>}>국내 주식</SectionTitle>
        <div className="mt-3">
          <SummaryBlock totals={s} currency="KRW" />
        </div>
      </Card>
      <Card title="보유 비중 · 국내" className="p-0">
        <div className="p-4 md:p-5">
          <AllocationDonut summary={s} currency="KRW" />
        </div>
      </Card>
      {o && (
        <>
          <Card className="p-5">
            <SectionTitle
              aside={
                <span className="flex items-center gap-2">
                  {s.exchangeRate != null && <span className="tabular text-xs text-subtle">환율 {formatAmount(s.exchangeRate, 'USD')}원/$</span>}
                  <Badge tone="brand">해외 · USD</Badge>
                </span>
              }
            >
              해외 주식
            </SectionTitle>
            <div className="mt-3">
              <SummaryBlock totals={o} currency="USD" />
            </div>
          </Card>
          <Card title="보유 비중 · 해외" className="p-0">
            <div className="p-4 md:p-5">
              <AllocationDonut summary={o} currency="USD" />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
function ScopeToggle({ value, onChange }: { value: OrderScope; onChange: (v: OrderScope) => void }) {
  return (
    <Segmented<OrderScope>
      label="국내/해외"
      value={value}
      onChange={onChange}
      options={[
        { value: 'DOMESTIC', label: '국내 (KRW)' },
        { value: 'OVERSEAS', label: '해외 (USD)' },
      ]}
    />
  )
}

function Holdings({ accountId }: { accountId: number }) {
  const q = useQuery({ queryKey: ['summary', accountId], queryFn: () => accountsApi.summary(accountId) })
  const [sort, setSort] = useState<'value' | 'rate'>('value')
  const [scope, setScope] = useState<OrderScope>('DOMESTIC')
  const overseas = q.data?.overseas ?? null
  const active = scope === 'OVERSEAS' && overseas ? overseas : q.data
  const currency = scope === 'OVERSEAS' && overseas ? 'USD' : 'KRW'
  const sorted = useMemo(() => {
    const list = [...(active?.holdings ?? [])]
    return list.sort((a, b) => (sort === 'value' ? b.evaluationAmount - a.evaluationAmount : b.profitLossRate - a.profitLossRate))
  }, [active, sort])
  if (q.isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (q.isError || !q.data || !active) return <QueryError error={q.error} onRetry={() => q.refetch()} />
  return (
    <div className="space-y-3">
      {overseas && <ScopeToggle value={scope} onChange={setScope} />}
      <Card
        title={`${currency === 'USD' ? '해외' : '국내'} 보유 종목 ${active.holdings.length}개`}
        aside={
          <div className="flex items-center gap-2">
            <PnL amount={active.profitLoss} rate={active.profitLossRate} currency={currency} className="hidden text-xs sm:inline" />
            <select
              aria-label="정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'value' | 'rate')}
              className="h-9 rounded-lg border border-border-strong bg-surface px-2 text-sm"
            >
              <option value="value">평가금액순</option>
              <option value="rate">수익률순</option>
            </select>
          </div>
        }
      >
        <HoldingsList holdings={sorted} />
      </Card>
    </div>
  )
}
const PRESETS = [
  { key: '1w', label: '1주일', days: 7 },
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: 'custom', label: '직접 설정', days: 0 },
] as const

const ORDER_STATUSES: (OrderStatus | 'ALL')[] = ['ALL', 'FILLED', 'PARTIAL', 'PENDING', 'CANCELED', 'REJECTED']

function Orders({ accountId }: { accountId: number }) {
  const today = toDateInputValue(new Date())
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['key']>('1m')
  const [from, setFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(today)
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [scope, setScope] = useState<OrderScope>('DOMESTIC')

  const choose = (key: (typeof PRESETS)[number]['key']) => {
    setPreset(key)
    const p = PRESETS.find((x) => x.key === key)
    if (p && p.days > 0) {
      setFrom(toDateInputValue(new Date(Date.now() - p.days * 86400000)))
      setTo(toDateInputValue(new Date()))
    }
  }

  const rangeInvalid = from > to
  const q = useInfiniteQuery({
    queryKey: ['orders', accountId, scope, from, to],
    queryFn: ({ pageParam }) => accountsApi.orders(accountId, { from, to, page: pageParam, size: 30, scope }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: !rangeInvalid,
  })

  const all = q.data?.pages.flatMap((p) => p.content) ?? []
  const items = status === 'ALL' ? all : all.filter((o) => o.status === status)

  return (
    <Card>
      <div className="space-y-3 border-b border-border p-4">
        <ScopeToggle value={scope} onChange={setScope} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="조회 기간">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => choose(p.key)}
              className={cn(
                'h-11 rounded-full border px-3.5 text-sm font-medium md:h-8',
                preset === p.key ? 'border-brand bg-brand-soft text-brand-text' : 'border-border-strong text-muted hover:bg-surface-2',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="시작일"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 rounded-xl border border-border-strong bg-surface px-3 md:h-9"
            />
            <span className="text-subtle">~</span>
            <input
              type="date"
              aria-label="종료일"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-xl border border-border-strong bg-surface px-3 md:h-9"
            />
          </div>
        )}
        {rangeInvalid && <p className="text-sm text-danger">시작일이 종료일보다 늦을 수 없어요.</p>}
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="상태 필터">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'h-11 shrink-0 rounded-full px-3.5 text-sm font-medium md:h-8',
                status === s ? 'bg-fg text-bg' : 'bg-surface-2 text-muted hover:bg-surface-3',
              )}
            >
              {s === 'ALL' ? '전체' : ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <OrderList orders={items} />
          {q.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="outline" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
                더 보기
              </Button>
              {status !== 'ALL' && <p className="mt-2 text-xs text-subtle">상태 필터는 불러온 내역 안에서만 적용돼요.</p>}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

const AGENT_FILTERS: { key: 'LIVE' | 'ENDED' | 'ALL'; label: string }[] = [
  { key: 'LIVE', label: '진행 중' },
  { key: 'ENDED', label: '종료' },
  { key: 'ALL', label: '전체' },
]

function Automation({ accountId }: { accountId: number }) {
  const [filter, setFilter] = useState<'LIVE' | 'ENDED' | 'ALL'>('LIVE')
  const q = useQuery({ queryKey: ['agent', 'account', accountId], queryFn: () => agentApi.list({ accountId }), refetchInterval: 20_000 })
  const all = q.data ?? []
  const tasks = all.filter((t) => {
    const ended = t.status === 'DONE' || t.status === 'CANCELED'
    return filter === 'ALL' || (filter === 'LIVE' ? !ended : ended)
  })

  return (
    <Card>
      <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-b border-border p-4" role="group" aria-label="상태 필터">
        {AGENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'h-11 shrink-0 rounded-full px-3.5 text-sm font-medium md:h-8',
              filter === f.key ? 'bg-fg text-bg' : 'bg-surface-2 text-muted hover:bg-surface-3',
            )}
          >
            {f.label}
          </button>
        ))}
        <Link to="/skills" className="ml-auto shrink-0 text-sm font-medium text-brand-text hover:underline">
          스킬 보기
        </Link>
      </div>
      {q.isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : tasks.length === 0 ? (
        <NoAgentTasks />
      ) : (
        <AgentTaskManager tasks={tasks} />
      )}
    </Card>
  )
}
function Info({ accountId }: { accountId: number }) {
  const q = useQuery({ queryKey: ['account', accountId], queryFn: () => accountsApi.detail(accountId) })
  if (q.isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (q.isError || !q.data) return <QueryError error={q.error} onRetry={() => q.refetch()} />
  const a = q.data
  const token = { VALID: ['정상', 'success'], EXPIRED: ['만료', 'danger'], UNKNOWN: ['확인 불가', 'neutral'] } as const
  const [tokenLabel, tokenTone] = token[a.tokenStatus] ?? token.UNKNOWN
  const rows: [string, React.ReactNode][] = [
    ['별칭', a.alias],
    ['계좌번호', <span className="tabular" key="n">{a.accountNumberMasked}</span>],
    ['상품코드', <span className="tabular" key="p">{a.accountProductCode}</span>],
    ['계좌 유형', <AccountTypeBadge key="t" type={a.accountType} />],
    ['KIS 환경', a.kisEnvironment === 'REAL' ? '실전 서버' : '모의 서버'],
    ['토큰 상태', <Badge key="s" tone={tokenTone}>{tokenLabel}</Badge>],
    ['기본 계좌', a.isDefault ? '예' : '아니오'],
    ['등록일', formatDate(a.createdAt)],
  ]
  return (
    <Card>
      <dl className="divide-y divide-border px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border p-3">
        <Link to="/accounts" className="inline-flex h-11 items-center px-2 text-sm font-medium text-brand-text hover:underline md:h-9">
          계좌 관리로 이동
        </Link>
      </div>
    </Card>
  )
}

export function PortfolioPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { accounts, defaultAccount, isLoading } = useAccounts()

  const paramId = Number(params.get('account'))
  const storedId = Number(localStorage.getItem(LAST_ACCOUNT_KEY))
  const account =
    accounts.find((a) => a.id === paramId) ?? accounts.find((a) => a.id === storedId) ?? defaultAccount ?? null
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview') as TabKey

  useEffect(() => {
    if (account) localStorage.setItem(LAST_ACCOUNT_KEY, String(account.id))
  }, [account])

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => next.set(k, v))
    setParams(next, { replace: true })
  }

  const summaryUpdatedAt = useQuery({
    queryKey: ['summary', account?.id],
    queryFn: () => accountsApi.summary(account!.id),
    enabled: !!account,
  }).dataUpdatedAt
  const fetching = useIsFetching({ predicate: (qy) => ['summary', 'orders', 'account'].includes(qy.queryKey[0] as string) && qy.queryKey[1] === account?.id })

  const refresh = () => {
    if (!account) return
    ;['summary', 'orders', 'account'].forEach((k) => qc.invalidateQueries({ queryKey: [k, account.id] }))
    qc.invalidateQueries({ queryKey: ['agent'] })
    qc.invalidateQueries({ queryKey: ['order-requests'] })
  }

  const real = account?.accountType === 'REAL_TRADE'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="내 계좌"
        actions={
          account && (
            <div className="flex items-center gap-2">
              <AccountSelect accounts={accounts} value={account.id} onChange={(id) => update({ account: String(id) })} align="end" />
              <Button variant="outline" size="icon" onClick={refresh} aria-label="새로고침" disabled={fetching > 0}>
                <RefreshCw className={cn('h-4 w-4', fetching > 0 && 'animate-spin')} />
              </Button>
            </div>
          )
        }
      />
      <PageBody>
        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !account ? (
          <EmptyState
            icon={<Landmark className="h-6 w-6" />}
            title="연결된 계좌가 없어요"
            description="증권 계좌를 등록하면 자산 현황과 거래내역을 확인할 수 있어요."
            action={
              <Link to="/accounts" className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand-hover">
                계좌 등록하러 가기
              </Link>
            }
          />
        ) : (
          <>
            {real && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-real/40 bg-real-soft px-3.5 py-2.5 text-sm font-medium text-real" role="note">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                실전 계좌의 실제 자산입니다.
              </div>
            )}
            <div className="mb-4 flex items-center justify-between gap-3 text-xs text-subtle">
              <span className="truncate">
                {account.alias} · <span className="tabular">{account.accountNumberMasked}</span>
              </span>
              <span className="tabular shrink-0">{summaryUpdatedAt ? `마지막 갱신 ${formatTime(summaryUpdatedAt, true)}` : ''}</span>
            </div>
            <div role="tablist" aria-label="내 계좌 메뉴" className="scrollbar-none -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls="portfolio-panel"
                  onClick={() => update({ tab: t.key })}
                  className={cn(
                    '-mb-px h-12 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors',
                    tab === t.key ? 'border-brand text-brand-text' : 'border-transparent text-muted hover:text-fg',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="portfolio-panel" aria-labelledby={`tab-${tab}`} key={`${account.id}-${tab}`} className="animate-fade-in">
              {tab === 'overview' && <Overview accountId={account.id} />}
              {tab === 'holdings' && <Holdings accountId={account.id} />}
              {tab === 'orders' && <Orders accountId={account.id} />}
              {tab === 'queue' && <OrderQueue accountId={account.id} />}
              {tab === 'automation' && <Automation accountId={account.id} />}
              {tab === 'info' && <Info accountId={account.id} />}
            </div>
          </>
        )}
      </PageBody>
    </div>
  )
}
