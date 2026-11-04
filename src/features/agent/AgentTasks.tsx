import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, MessageSquare, Pause, Play, Square, Zap } from 'lucide-react'
import { agentApi, skillsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { AgentStatusBadge, EmptyState, MarketBadge, PnL, SideBadge, Stat } from '@/components/finance/parts'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDateTime, formatMoney, formatRate } from '@/lib/format'
import type { AgentPosition, AgentRun, AgentTask, AgentTrade, Skill } from '@/api/types'

const live = (t: AgentTask) => t.status === 'ACTIVE' || t.status === 'RUNNING' || t.status === 'PAUSED'

/** 자동 실행 작업 목록(읽기 전용 표시). 채팅 카드와 관리 화면이 함께 쓴다. */
export function AgentTaskList({
  tasks,
  showAccount,
  onOpen,
  renderActions,
}: {
  tasks: AgentTask[]
  showAccount?: boolean
  onOpen?: (task: AgentTask) => void
  renderActions?: (task: AgentTask) => ReactNode
}) {
  if (tasks.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">등록된 자동 실행이 없습니다.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.id} className="px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentStatusBadge status={t.status} />
            {showAccount && t.accountType && <AccountTypeBadge type={t.accountType} />}
            {t.skillName && <Badge tone="brand">스킬</Badge>}
            {t.autonomous && t.accountType === 'REAL_TRADE' && <Badge tone="real">자율 주문</Badge>}
            {t.createdBy === 'AGENT' && <Badge tone="neutral">AI가 예약</Badge>}
          </div>
          {onOpen ? (
            <button type="button" onClick={() => onOpen(t)} className="mt-1.5 block w-full text-left text-sm font-semibold hover:underline">
              {t.title}
            </button>
          ) : (
            <p className="mt-1.5 text-sm font-semibold">{t.title}</p>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {t.scheduleLabel}
            {t.nextRunAt && t.status === 'ACTIVE' && <span className="tabular"> · 다음 {formatDateTime(t.nextRunAt)}</span>}
          </p>
          {t.ledger && (
            <p className="tabular mt-1 text-xs text-muted">
              시드 {formatMoney(t.ledger.budget, t.ledger.currency)} · 손익{' '}
              <PnL amount={t.ledger.totalPnl} rate={t.ledger.totalPnlPct} currency={t.ledger.currency} className="text-xs" /> · 보유{' '}
              {t.ledger.openPositions}종목
            </p>
          )}
          {t.pausedReason && t.status !== 'ACTIVE' && <p className="mt-1 text-xs text-warning">{t.pausedReason}</p>}
          {t.lastResult && <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-subtle">{t.lastResult}</p>}
          {renderActions && <div className="mt-2.5 flex flex-wrap gap-1.5">{renderActions(t)}</div>}
        </li>
      ))}
    </ul>
  )
}

/** 일시정지·재개·지금 실행·중지·상세를 모두 제공하는 관리용 목록 */
export function AgentTaskManager({ tasks, showAccount }: { tasks: AgentTask[]; showAccount?: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [openId, setOpenId] = useState<number | null>(null)
  const [stopTarget, setStopTarget] = useState<AgentTask | null>(null)
  const [sellTarget, setSellTarget] = useState<AgentTask | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['agent'] })
  const fail = (e: unknown) => toast.error(errorMessage(e))

  const pause = useMutation({ mutationFn: (t: AgentTask) => agentApi.pause(t.id), onSuccess: () => (refresh(), toast.success('일시정지했어요.')), onError: fail })
  const resume = useMutation({ mutationFn: (t: AgentTask) => agentApi.resume(t.id), onSuccess: () => (refresh(), toast.success('다시 시작했어요.')), onError: fail })
  const runNow = useMutation({
    mutationFn: (t: AgentTask) => agentApi.runNow(t.id),
    onSuccess: () => {
      toast.success('실행을 시작했어요. 결과는 잠시 후 상세에서 확인할 수 있어요.')
      window.setTimeout(refresh, 4000)
      window.setTimeout(refresh, 15000)
      refresh()
    },
    onError: fail,
  })
  const stop = useMutation({
    mutationFn: (t: AgentTask) => agentApi.cancel(t.id),
    onSuccess: () => {
      refresh()
      toast.success('자동 실행을 중지했어요.')
      setStopTarget(null)
    },
    onError: fail,
  })
  const sell = useMutation({
    mutationFn: (t: AgentTask) => agentApi.liquidate(t.id),
    onSuccess: (r) => {
      refresh()
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success(r.orders > 0 ? `${r.orders}건 매도 주문을 접수했어요.` : '매도할 종목이 없거나 주문하지 못했어요.')
      setSellTarget(null)
    },
    onError: (e) => {
      fail(e)
      setSellTarget(null)
    },
  })

  return (
    <>
      <AgentTaskList
        tasks={tasks}
        showAccount={showAccount}
        onOpen={(t) => setOpenId(t.id)}
        renderActions={(t) => (
          <>
            <Button variant="outline" size="sm" onClick={() => setOpenId(t.id)}>
              상세
            </Button>
            {t.status === 'ACTIVE' && (
              <>
                <Button variant="outline" size="sm" onClick={() => runNow.mutate(t)} disabled={runNow.isPending}>
                  <Zap className="h-3.5 w-3.5" aria-hidden />
                  지금 실행
                </Button>
                <Button variant="outline" size="sm" onClick={() => pause.mutate(t)} disabled={pause.isPending}>
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                  일시정지
                </Button>
              </>
            )}
            {t.status === 'PAUSED' && (
              <Button variant="primary" size="sm" onClick={() => resume.mutate(t)} disabled={resume.isPending}>
                <Play className="h-3.5 w-3.5" aria-hidden />
                다시 시작
              </Button>
            )}
            {live(t) && (
              <Button variant="outline" size="sm" onClick={() => setStopTarget(t)}>
                <Square className="h-3.5 w-3.5" aria-hidden />
                중지
              </Button>
            )}
          </>
        )}
      />

      <ConfirmDialog
        open={!!stopTarget}
        title="자동 실행을 중지할까요?"
        description={stopTarget?.title}
        confirmLabel="중지"
        cancelLabel="닫기"
        destructive
        loading={stop.isPending}
        onConfirm={() => stopTarget && stop.mutate(stopTarget)}
        onClose={() => setStopTarget(null)}
      >
        <p className="text-sm text-muted">중지하면 다시 시작할 수 없습니다.</p>
        {stopTarget?.ledger && stopTarget.ledger.openPositions > 0 && (
          <div className="mt-3 rounded-xl bg-warning-soft p-3 text-sm">
            <p className="font-semibold text-warning">이 작업이 매수한 {stopTarget.ledger.openPositions}개 종목이 계좌에 남아 있어요.</p>
            <p className="mt-1 text-muted">그냥 중지하면 계좌에는 그대로 있지만 더 이상 자동으로 관리(익절·손절)되지 않습니다.</p>
            <Button
              variant={stopTarget.accountType === 'REAL_TRADE' ? 'real' : 'primary'}
              size="sm"
              className="mt-2"
              onClick={() => {
                setSellTarget(stopTarget)
                setStopTarget(null)
              }}
            >
              먼저 보유 종목을 모두 매도하기
            </Button>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!sellTarget}
        title="보유 종목을 모두 매도할까요?"
        description={sellTarget?.title}
        confirmLabel="모두 매도"
        cancelLabel="취소"
        destructive
        loading={sell.isPending}
        onConfirm={() => sellTarget && sell.mutate(sellTarget)}
        onClose={() => setSellTarget(null)}
      >
        <p className="text-sm text-muted">
          이 작업이 매수한 종목을 지금 시장가(미국은 지정가)로 매도합니다.
          {sellTarget?.accountType === 'REAL_TRADE' && <strong className="text-real"> 실전 계좌에서 실제로 주문됩니다.</strong>} 장이 열려
          있을 때만 가능하며, 매도 후 작업을 중지하려면 다시 ‘중지’를 눌러 주세요.
        </p>
      </ConfirmDialog>

      <AgentTaskDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </section>
  )
}

function PositionRow({ p }: { p: AgentPosition }) {
  const open = p.status === 'OPEN'
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{p.name}</span>
          <MarketBadge market={p.market} />
        </div>
        <div className="tabular text-xs text-subtle">
          {p.symbol} · {p.quantity.toLocaleString()}주 · 평균 {formatMoney(p.avgPrice, p.currency)}
          {open && p.lastPrice != null && <> → 현재 {formatMoney(p.lastPrice, p.currency)}</>}
        </div>
        {!open && p.exitReason && <div className="text-xs text-subtle">{p.exitReason}</div>}
      </div>
      <div className="shrink-0 text-right">
        {open ? (
          <PnL amount={p.unrealizedPnl} rate={p.pnlPct} currency={p.currency} className="text-xs" />
        ) : (
          <span className="tabular text-xs font-semibold">{formatMoney(p.realizedPnl, p.currency, { sign: true })}</span>
        )}
        <div className="text-[11px] text-subtle">{open ? '평가손익' : p.status === 'CLOSED' ? '실현손익' : '관리 종료'}</div>
      </div>
    </li>
  )
}

function TradeRow({ t }: { t: AgentTrade }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <SideBadge side={t.side} />
          <span className="truncate font-medium">{t.name}</span>
          <span className="tabular text-xs text-subtle">{t.quantity.toLocaleString()}주</span>
        </div>
        {t.reason && <div className="text-xs text-subtle">{t.reason}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular text-xs font-semibold">{formatMoney(t.price, t.currency)}</div>
        <div className="tabular text-[11px] text-subtle">{formatDateTime(t.createdAt)}</div>
      </div>
    </li>
  )
}

function RunRow({ r }: { r: AgentRun }) {
  const tone = r.status === 'DONE' ? 'success' : r.status === 'FAILED' ? 'danger' : 'neutral'
  const label = r.status === 'DONE' ? '완료' : r.status === 'FAILED' ? '실패' : '건너뜀'
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-subtle">
        <Badge tone={tone}>{label}</Badge>
        {r.manual && <Badge tone="neutral">수동</Badge>}
        <span className="tabular">{formatDateTime(r.startedAt)}</span>
      </div>
      {r.summary && <p className="mt-1 whitespace-pre-line text-sm">{r.summary}</p>}
      {r.events.length > 0 && (
        <details className="mt-1 text-xs text-muted">
          <summary className="cursor-pointer select-none">실행 과정 {r.events.length}건</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {r.events.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function configRows(task: AgentTask, skill: Skill | undefined): [string, string][] {
  if (!skill) return []
  return skill.params
    .filter((p) => task.config[p.key] !== undefined && task.config[p.key] !== '')
    .map((p) => {
      const raw = task.config[p.key]
      const opt = p.options?.find((o) => o.value === String(raw))
      return [p.label, `${opt ? opt.label : String(raw)}${p.unit && !opt ? ` ${p.unit}` : ''}`]
    })
}

export function AgentTaskDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['agent', 'detail', id],
    queryFn: () => agentApi.detail(id!),
    enabled: id != null,
    refetchInterval: 15_000,
  })
  const skills = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list, staleTime: 5 * 60_000, enabled: id != null })
  const d = q.data
  const t = d?.task
  const skill = skills.data?.find((s) => s.id === t?.skillId)
  const openPositions = d?.positions.filter((p) => p.status === 'OPEN') ?? []
  const closedPositions = d?.positions.filter((p) => p.status !== 'OPEN').slice(0, 10) ?? []

  return (
    <Dialog
      open={id != null}
      onClose={onClose}
      size="lg"
      title={t?.title ?? '자동 실행 상세'}
      description={
        t && (
          <span className="flex flex-wrap items-center gap-1.5">
            <AgentStatusBadge status={t.status} />
            {t.accountType && <AccountTypeBadge type={t.accountType} />}
            <span>{t.scheduleLabel}</span>
          </span>
        )
      }
      footer={
        <>
          {t?.conversationId && (
            <Link
              to={`/chat/${t.conversationId}`}
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-medium hover:bg-surface-3 md:h-10"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              결과 대화 보기
            </Link>
          )}
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      {q.isLoading || !d || !t ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-danger">{errorMessage(q.error)}</p>
      ) : (
        <div>
          {t.pausedReason && t.status !== 'ACTIVE' && (
            <div className="mb-4 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{t.pausedReason}</div>
          )}

          <Section title="개요">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Stat label="계좌" value={t.accountLabel} />
              <Stat label="다음 실행" value={t.status === 'ACTIVE' && t.nextRunAt ? formatDateTime(t.nextRunAt) : '-'} />
              <Stat label="마지막 실행" value={t.lastRunAt ? formatDateTime(t.lastRunAt) : '아직 없음'} />
              <Stat label="실행 횟수" value={`${t.runCount}회${t.failCount > 0 ? ` (연속 실패 ${t.failCount})` : ''}`} />
              <Stat label="주문 방식" value={t.autonomous || t.accountType === 'PAPER_TRADE' ? '자동 주문' : '주문 불가(조회·보고만)'} />
              <Stat label="만든 주체" value={t.createdBy === 'AGENT' ? 'AI가 스스로 예약' : '사용자'} />
            </dl>
          </Section>

          {t.ledger && (
            <Section title="시드와 손익">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Stat label="시드" value={formatMoney(t.ledger.budget, t.ledger.currency)} />
                <Stat label="남은 예산" value={formatMoney(t.ledger.available, t.ledger.currency)} />
                <Stat label="투자 중" value={formatMoney(t.ledger.invested, t.ledger.currency)} />
                <Stat
                  label="누적 손익"
                  value={<PnL amount={t.ledger.totalPnl} rate={t.ledger.totalPnlPct} currency={t.ledger.currency} />}
                />
                <Stat label="실현 손익" value={formatMoney(t.ledger.realizedPnl, t.ledger.currency, { sign: true })} />
                <Stat label="평가 손익" value={formatMoney(t.ledger.unrealizedPnl, t.ledger.currency, { sign: true })} />
              </dl>
              <p className="mt-2 text-xs text-subtle">
                한도: 한 종목 {t.ledger.maxPositionPct != null ? `${formatRate(t.ledger.maxPositionPct, { sign: false, digits: 0 })}` : '-'} · 누적 손실{' '}
                {t.ledger.maxLossPct != null ? formatRate(t.ledger.maxLossPct, { sign: false, digits: 0 }) : '-'} · 오늘 매수{' '}
                {formatMoney(t.ledger.boughtToday, t.ledger.currency)} / {formatMoney(t.ledger.maxDailyBuy ?? t.ledger.budget, t.ledger.currency)}. 수수료·세금은 반영되지 않았습니다.
              </p>
            </Section>
          )}

          {(openPositions.length > 0 || closedPositions.length > 0) && (
            <Section title="이 작업이 관리하는 종목">
              {openPositions.length > 0 ? (
                <ul className="divide-y divide-border">{openPositions.map((p) => <PositionRow key={p.id} p={p} />)}</ul>
              ) : (
                <p className="text-sm text-muted">지금 보유 중인 종목이 없습니다.</p>
              )}
              {closedPositions.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer select-none text-muted">정리된 종목 {closedPositions.length}건</summary>
                  <ul className="divide-y divide-border">{closedPositions.map((p) => <PositionRow key={p.id} p={p} />)}</ul>
                </details>
              )}
            </Section>
          )}

          {d.trades.length > 0 && (
            <Section title="최근 주문">
              <ul className="divide-y divide-border">{d.trades.slice(0, 15).map((x) => <TradeRow key={x.id} t={x} />)}</ul>
            </Section>
          )}

          <Section title="최근 실행 기록">
            {d.runs.length === 0 ? (
              <p className="text-sm text-muted">아직 기록된 실행이 없습니다. 아무 일도 없었던 점검은 기록하지 않습니다.</p>
            ) : (
              <ul className="divide-y divide-border">{d.runs.map((r) => <RunRow key={r.id} r={r} />)}</ul>
            )}
          </Section>

          {t.instruction && (
            <Section title="지시 내용">
              <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{t.instruction}</p>
            </Section>
          )}

          {d.memory && (
            <Section title="AI가 남긴 메모">
              <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{d.memory}</p>
            </Section>
          )}

          {configRows(t, skill).length > 0 && (
            <Section title="스킬 설정">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                {configRows(t, skill).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </div>
      )}
    </Dialog>
  )
}

export function NoAgentTasks({ action }: { action?: ReactNode }) {
  return (
    <EmptyState
      icon={<Bot className="h-6 w-6" />}
      title="자동 실행이 없어요"
      description="채팅에서 ‘매일 아침 9시에 …해줘’처럼 요청하거나, 스킬 메뉴에서 자동매매를 켜 보세요."
      action={action}
      className={cn('py-10')}
    />
  )
}
