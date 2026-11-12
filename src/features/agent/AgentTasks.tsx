import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronDown, MessageSquare, Pause, Pencil, Play, Plus, RefreshCw, Square, Zap } from 'lucide-react'
import { agentApi, skillsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { AgentStatusBadge, EmptyState, MarketBadge, PnL, SideBadge, Stat } from '@/components/finance/parts'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { TaskEditDialog } from '@/features/agent/TaskEditDialog'
import { cn } from '@/lib/cn'
import { formatDateTime, formatMoney, formatRate } from '@/lib/format'
import type { AgentPosition, AgentRevision, AgentRun, AgentTask, AgentTrade, Skill } from '@/api/types'

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

/**
 * 한국투자증권 앱 등 이 앱 밖에서 직접 매매한 것을 자동 실행 장부에 반영한다(taskId 를 주면 그 작업만).
 * 서버도 10분마다 스스로 맞추지만, 방금 한 매매를 바로 보고 싶을 때 쓴다.
 */
function useSync(taskId?: number) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: () => agentApi.sync(taskId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['agent'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast.success(r.lines.length > 0 ? `앱 밖에서 직접 매매한 내역 ${r.lines.length}건을 장부에 반영했어요.` : '이미 증권사 계좌와 같아요.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

function SyncButton({ taskId, label = '계좌와 동기화' }: { taskId?: number; label?: string }) {
  const sync = useSync(taskId)
  return (
    <Button size="sm" variant="outline" onClick={() => sync.mutate()} loading={sync.isPending} title="한국투자증권 앱 등에서 직접 매매한 내역을 반영해요">
      <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {label}
    </Button>
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
      {tasks.some((t) => live(t) && t.ledger && t.ledger.openPositions > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="min-w-0 flex-1 text-xs text-subtle">한국투자증권 앱에서 직접 사고판 내용은 10분마다 자동으로 반영돼요. 바로 보려면 눌러 주세요.</p>
          <SyncButton />
        </div>
      )}
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

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <div className="mb-2 flex min-h-[32px] items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {action}
      </div>
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

type RunFilter = 'ALL' | AgentRun['status']

const RUN_LABEL: Record<AgentRun['status'], string> = { DONE: '완료', FAILED: '실패', SKIPPED: '건너뜀' }
const RUN_TONE: Record<AgentRun['status'], 'success' | 'danger' | 'neutral'> = { DONE: 'success', FAILED: 'danger', SKIPPED: 'neutral' }
const RUN_DOT: Record<AgentRun['status'], string> = { DONE: 'bg-success', FAILED: 'bg-danger', SKIPPED: 'bg-border-strong' }
const RUN_PAGE = 5

/** 요약의 첫 줄. 접힌 상태에서는 이것만 보여 줘서 목록이 길어지지 않게 한다. */
const headline = (summary?: string | null) =>
  (summary ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean) ?? ''

function RunItem({ r, open, onToggle }: { r: AgentRun; open: boolean; onToggle: () => void }) {
  const lines = (r.summary ?? '').split('\n').filter((s) => s.trim()).length
  const expandable = r.events.length > 0 || lines > 1 || headline(r.summary).length > 90
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={!expandable}
        className={cn('flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left', expandable && 'hover:bg-surface-2')}
      >
        <span className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', RUN_DOT[r.status])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            <Badge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Badge>
            {r.manual && <Badge tone="neutral">수동</Badge>}
            <span className="tabular">{formatDateTime(r.startedAt)}</span>
            {r.events.length > 0 && <span>· 과정 {r.events.length}건</span>}
          </span>
          {r.summary && (
            <span className={cn('mt-1 block text-sm', open ? 'whitespace-pre-line' : 'line-clamp-2')}>{open ? r.summary : headline(r.summary)}</span>
          )}
        </span>
        {expandable && <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />}
      </button>
      {open && r.events.length > 0 && (
        <ul className="mb-2 ml-9 mr-2 max-h-64 list-disc space-y-0.5 overflow-y-auto rounded-lg bg-surface-2 py-2 pl-6 pr-3 text-xs text-muted">
          {r.events.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * 최근 실행 기록. 한 줄 요약만 보이고 눌러서 펼치며, 상태별로 걸러 볼 수 있다.
 * 처음엔 5건만 보여 줘서 아래 내용(지시·설정)이 밀려나지 않는다.
 */
function RunList({ runs }: { runs: AgentRun[] }) {
  const [filter, setFilter] = useState<RunFilter>('ALL')
  const [shown, setShown] = useState(RUN_PAGE)
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())

  const counts = useMemo(() => {
    const c = { ALL: runs.length, DONE: 0, FAILED: 0, SKIPPED: 0 }
    for (const r of runs) c[r.status]++
    return c
  }, [runs])
  const filtered = filter === 'ALL' ? runs : runs.filter((r) => r.status === filter)
  const visible = filtered.slice(0, shown)

  const toggle = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (runs.length === 0) {
    return <p className="text-sm text-muted">아직 기록된 실행이 없습니다. 아무 일도 없었던 점검은 기록하지 않습니다.</p>
  }

  const chips: { key: RunFilter; label: string }[] = [
    { key: 'ALL', label: '전체' },
    { key: 'DONE', label: '완료' },
    { key: 'FAILED', label: '실패' },
    { key: 'SKIPPED', label: '건너뜀' },
  ]

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="실행 기록 필터">
        {chips
          .filter((c) => c.key === 'ALL' || counts[c.key] > 0)
          .map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={filter === c.key}
              onClick={() => {
                setFilter(c.key)
                setShown(RUN_PAGE)
              }}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium',
                filter === c.key ? 'border-brand bg-brand-soft text-brand-text' : 'border-border text-muted hover:bg-surface-2',
              )}
            >
              {c.label} <span className="tabular">{counts[c.key]}</span>
            </button>
          ))}
        {openIds.size > 0 && (
          <button type="button" onClick={() => setOpenIds(new Set())} className="ml-auto text-xs text-muted underline-offset-2 hover:underline">
            모두 접기
          </button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {visible.map((r) => (
          <RunItem key={r.id} r={r} open={openIds.has(r.id)} onToggle={() => toggle(r.id)} />
        ))}
      </ul>
      {filtered.length > shown && (
        <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setShown((n) => n + RUN_PAGE)}>
          더 보기 ({filtered.length - shown}건 남음)
        </Button>
      )}
      {filtered.length === 0 && <p className="py-3 text-sm text-muted">해당하는 기록이 없어요.</p>}
      <p className="mt-2 text-[11px] text-subtle">최근 20건까지 보관해 보여 드려요.</p>
    </div>
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

const MAX_INSTRUCTION = 4000

/**
 * 걸어 둔 지시(정리본) 보기·수정·추가. 저장하면 다음 실행부터 새 내용으로 동작하고 이전 내용은 이력에 남는다.
 * 실전 계좌에서 자동 주문하는 작업은 저장할 때 이메일 인증번호를 한 번 더 확인한다(창이 자동으로 뜬다).
 */
function InstructionSection({ task, revisions }: { task: AgentTask; revisions: AgentRevision[] }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [mode, setMode] = useState<'view' | 'edit' | 'append'>('view')
  const [title, setTitle] = useState(task.title)
  const [text, setText] = useState('')
  const editable = !task.skillId && (task.status === 'ACTIVE' || task.status === 'RUNNING' || task.status === 'PAUSED')

  const save = useMutation({
    mutationFn: () =>
      mode === 'append'
        ? agentApi.update(task.id, { instruction: text, mode: 'APPEND' })
        : agentApi.update(task.id, { title: title.trim() || undefined, instruction: text, mode: 'REPLACE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent'] })
      toast.success(mode === 'append' ? '추가 지시를 저장했어요. 다음 실행부터 적용돼요.' : '정리본을 수정했어요. 다음 실행부터 적용돼요.')
      setMode('view')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const startEdit = () => {
    setTitle(task.title)
    setText(task.instruction ?? '')
    setMode('edit')
  }
  const startAppend = () => {
    setText('')
    setMode('append')
  }
  const over = mode === 'append' ? (task.instruction?.length ?? 0) + text.length + 30 > MAX_INSTRUCTION : text.length > MAX_INSTRUCTION

  return (
    <Section title="지시 내용 (정리본)">
      {mode === 'view' ? (
        <>
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{task.instruction}</p>
          {editable && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" /> 수정
              </Button>
              <Button size="sm" variant="outline" onClick={startAppend}>
                <Plus className="h-3.5 w-3.5" /> 지시 추가
              </Button>
            </div>
          )}
          {task.skillId && <p className="mt-2 text-xs text-subtle">스킬로 켠 작업은 스킬 화면에서 설정을 바꿀 수 있어요.</p>}
          {revisions.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer select-none text-muted">이전 정리본 {revisions.length}건</summary>
              <ul className="mt-2 space-y-2">
                {revisions.map((r, i) => (
                  <li key={`${r.at}-${i}`} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-subtle">
                      {formatDateTime(r.at)}에 {r.by === 'CHAT' ? '채팅 승인으로' : '화면에서'} 바뀌기 전 내용{r.title ? ` · ${r.title}` : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{r.instruction}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {mode === 'edit' && (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">제목</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 md:h-10"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">{mode === 'append' ? '추가할 지시' : '정리본 전체'}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={mode === 'append' ? 5 : 12}
              placeholder={mode === 'append' ? '예: 손절은 -3%로 바꾸고, 하루에 한 종목만 사 줘' : ''}
              className="w-full resize-y rounded-xl border border-border-strong bg-surface p-3 text-sm leading-relaxed"
            />
            <span className={cn('mt-1 block text-xs', over ? 'text-danger' : 'text-subtle')}>
              {mode === 'append' ? `추가 후 전체 ${((task.instruction?.length ?? 0) + text.length).toLocaleString('ko-KR')}자` : `${text.length.toLocaleString('ko-KR')}자`} / 최대{' '}
              {MAX_INSTRUCTION.toLocaleString('ko-KR')}자
            </span>
          </label>
          {task.autonomous && task.accountType === 'REAL_TRADE' && (
            <p className="rounded-lg bg-real-soft px-3 py-2 text-xs text-real">실전 계좌의 자동 주문 지시를 바꾸는 것이라 저장할 때 이메일 인증번호를 한 번 더 확인해요.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode('view')} disabled={save.isPending}>
              취소
            </Button>
            <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!text.trim() || over}>
              저장
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}
type TabKey = 'overview' | 'holdings' | 'runs' | 'settings'

function TabBar({ value, onChange, items }: { value: TabKey; onChange: (k: TabKey) => void; items: { key: TabKey; label: string; count?: number }[] }) {
  const move = (dir: 1 | -1) => {
    const i = items.findIndex((it) => it.key === value)
    onChange(items[(i + dir + items.length) % items.length].key)
  }
  return (
    <div
      role="tablist"
      aria-label="자동 실행 상세"
      className="-mx-1 mb-4 flex gap-0.5 overflow-x-auto border-b border-border px-1"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') move(1)
        else if (e.key === 'ArrowLeft') move(-1)
      }}
    >
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            id={`agent-tab-${it.key}`}
            aria-selected={active}
            aria-controls={`agent-panel-${it.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.key)}
            className={cn(
              'relative shrink-0 px-3.5 py-3 text-sm font-medium transition-colors',
              active ? 'text-fg after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand' : 'text-muted hover:text-fg',
            )}
          >
            {it.label}
            {it.count != null && it.count > 0 && <span className="tabular ml-1 text-xs text-subtle">{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function AgentTaskDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>('overview')
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    setTab('overview')
    setEditing(false)
  }, [id])

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
  const isLive = !!t && (t.status === 'ACTIVE' || t.status === 'RUNNING' || t.status === 'PAUSED')
  // 스킬 작업은 설정값으로, 일반 작업은 시드·한도로 고친다. AI가 만든 하위 작업의 한도는 상위 작업에서 바꾼다.
  const canEditSettings = isLive && !!t && (t.skillId ? !!skill : !!t.ledger && !t.parentTaskId)
  const editButton = canEditSettings && (
    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
      <Pencil className="h-3.5 w-3.5" aria-hidden /> 수정
    </Button>
  )

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
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-danger">{errorMessage(q.error)}</p>
      ) : (
        <div>
          {t.pausedReason && t.status !== 'ACTIVE' && (
            <div className="mb-4 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{t.pausedReason}</div>
          )}

          <TabBar
            value={tab}
            onChange={setTab}
            items={[
              { key: 'overview', label: '개요' },
              { key: 'holdings', label: '보유·주문', count: openPositions.length },
              { key: 'runs', label: '실행 기록', count: d.runs.length },
              { key: 'settings', label: '지시·설정' },
            ]}
          />

          {tab === 'overview' && (
            <div role="tabpanel" id="agent-panel-overview" aria-labelledby="agent-tab-overview">
              {t.ledger && (
                <Section
                  title="시드와 손익"
                  action={
                    (isLive || editButton) && (
                      <div className="flex gap-1.5">
                        {isLive && <SyncButton taskId={t.id} label="동기화" />}
                        {editButton}
                      </div>
                    )
                  }
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <Stat label="시드" value={formatMoney(t.ledger.budget, t.ledger.currency)} />
                    <Stat label="남은 예산" value={formatMoney(t.ledger.available, t.ledger.currency)} />
                    <Stat label="투자 중" value={formatMoney(t.ledger.invested, t.ledger.currency)} />
                    <Stat label="누적 손익" value={<PnL amount={t.ledger.totalPnl} rate={t.ledger.totalPnlPct} currency={t.ledger.currency} />} />
                    <Stat label="실현 손익" value={formatMoney(t.ledger.realizedPnl, t.ledger.currency, { sign: true })} />
                    <Stat label="평가 손익" value={formatMoney(t.ledger.unrealizedPnl, t.ledger.currency, { sign: true })} />
                  </dl>
                  <p className="mt-2 text-xs text-subtle">
                    한도: 한 종목 {t.ledger.maxPositionPct != null ? formatRate(t.ledger.maxPositionPct, { sign: false, digits: 0 }) : '-'} · 누적 손실{' '}
                    {t.ledger.maxLossPct != null ? formatRate(t.ledger.maxLossPct, { sign: false, digits: 0 }) : '-'} · 오늘 매수{' '}
                    {formatMoney(t.ledger.boughtToday, t.ledger.currency)} / {formatMoney(t.ledger.maxDailyBuy ?? t.ledger.budget, t.ledger.currency)}. 수수료·세금은 반영되지 않았습니다.
                  </p>
                </Section>
              )}

              <Section title="진행 상황" action={!t.ledger ? editButton : undefined}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Stat label="계좌" value={t.accountLabel} />
                  <Stat label="다음 실행" value={t.status === 'ACTIVE' && t.nextRunAt ? formatDateTime(t.nextRunAt) : '-'} />
                  <Stat label="마지막 실행" value={t.lastRunAt ? formatDateTime(t.lastRunAt) : '아직 없음'} />
                  <Stat label="실행 횟수" value={`${t.runCount}회${t.failCount > 0 ? ` (연속 실패 ${t.failCount})` : ''}`} />
                  <Stat label="주문 방식" value={t.autonomous || t.accountType === 'PAPER_TRADE' ? '자동 주문' : '주문 불가(조회·보고만)'} />
                  <Stat label="만든 주체" value={t.createdBy === 'AGENT' ? 'AI가 스스로 예약' : '사용자'} />
                </dl>
              </Section>

              {t.lastResult && (
                <Section title="최근 결과">
                  <p className="line-clamp-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{t.lastResult}</p>
                  <button type="button" onClick={() => setTab('runs')} className="mt-1.5 text-xs font-medium text-brand-text hover:underline">
                    실행 기록 보기 ({d.runs.length}건)
                  </button>
                </Section>
              )}

              {t.instruction && (
                <Section title="지시 내용">
                  <p className="line-clamp-4 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{t.instruction}</p>
                  <button type="button" onClick={() => setTab('settings')} className="mt-1.5 text-xs font-medium text-brand-text hover:underline">
                    전체 보기{isLive && !t.skillId ? ' · 수정' : ''}
                  </button>
                </Section>
              )}
            </div>
          )}

          {tab === 'holdings' && (
            <div role="tabpanel" id="agent-panel-holdings" aria-labelledby="agent-tab-holdings">
              {openPositions.length === 0 && closedPositions.length === 0 && d.trades.length === 0 && (
                <p className="text-sm text-muted">아직 이 작업이 관리하는 종목이나 주문이 없어요.</p>
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
            </div>
          )}

          {tab === 'runs' && (
            <div role="tabpanel" id="agent-panel-runs" aria-labelledby="agent-tab-runs">
              <RunList runs={d.runs} />
            </div>
          )}

          {tab === 'settings' && (
            <div role="tabpanel" id="agent-panel-settings" aria-labelledby="agent-tab-settings">
              {(t.instruction || !t.skillId) && <InstructionSection task={t} revisions={d.revisions ?? []} />}

              {configRows(t, skill).length > 0 && (
                <Section title="스킬 설정" action={editButton}>
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

              {d.memory && (
                <Section title="AI가 남긴 메모">
                  <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{d.memory}</p>
                </Section>
              )}
            </div>
          )}

          <TaskEditDialog task={t} skill={skill} open={editing} onClose={() => setEditing(false)} />
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
