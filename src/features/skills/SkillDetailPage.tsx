import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Landmark, ShieldAlert } from 'lucide-react'
import { agentApi, skillsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { AccountSelect } from '@/components/AccountSelect'
import { PageBody, PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/finance/parts'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAccounts } from '@/features/accounts/useAccounts'
import { AgentTaskManager } from '@/features/agent/AgentTasks'
import { ParamInput, configFromValues, initialValues, validateValues, type Values } from '@/features/skills/ParamFields'
import { Markdown } from '@/features/chat/Markdown'
import { cn } from '@/lib/cn'
import { groupDigits } from '@/lib/format'
import type { Skill } from '@/api/types'

// 시장을 바꾸면 시드 기본값도 그 통화에 맞는 값으로 바꿔 준다(사용자가 직접 고친 값은 건드리지 않는다).
const BUDGET_DEFAULTS: Record<string, string> = { KRX: '5000000', US: '3000' }

/** 시드 기본값의 통화를 정할 시장. market 선택이 있으면 그 값, 없으면 ETF 코드(6자리 숫자면 한국, 아니면 미국). */
function budgetMarketOf(values: Values): 'KRX' | 'US' {
  if (values.market === 'US' || values.market === 'KRX') return values.market
  const etf = values.etf
  if (typeof etf === 'string' && etf) return /^\d{6}$/.test(etf) ? 'KRX' : 'US'
  return 'KRX'
}
function StartForm({ skill }: { skill: Skill }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { accounts, defaultAccount, isLoading } = useAccounts()
  const [accountId, setAccountId] = useState<number | null>(null)
  const [values, setValues] = useState<Values>(() => initialValues(skill))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (accountId == null && defaultAccount) setAccountId(defaultAccount.id)
  }, [accountId, defaultAccount])

  const account = accounts.find((a) => a.id === accountId) ?? null
  const real = account?.accountType === 'REAL_TRADE'
  const hasPaper = accounts.some((a) => a.accountType === 'PAPER_TRADE')

  const set = (key: string, v: string | boolean) => {
    setValues((prev) => {
      const next = { ...prev, [key]: v }
      if ((key === 'market' || key === 'etf') && 'budget' in prev && Object.values(BUDGET_DEFAULTS).includes(String(prev.budget))) {
        next.budget = BUDGET_DEFAULTS[budgetMarketOf(next)] ?? prev.budget
      }
      return next
    })
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const validate = () => {
    const next = validateValues(skill, values)
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const config = () => configFromValues(skill, values)

  const create = useMutation({
    mutationFn: (confirm: boolean) => agentApi.create({ accountId: accountId!, skillId: skill.id, config: config(), confirmRealTrading: confirm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent'] })
      toast.success('스킬을 켰어요. 다음 장 시간부터 자동으로 동작합니다.')
      setConfirmOpen(false)
      setAgreed(false)
    },
    onError: (e) => {
      toast.error(errorMessage(e))
      setConfirmOpen(false)
    },
  })

  const onSubmit = () => {
    if (!account || !validate()) return
    if (real && skill.trades) {
      setAgreed(false)
      setConfirmOpen(true)
    } else {
      create.mutate(false)
    }
  }

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Landmark className="h-6 w-6" />}
        title="먼저 증권 계좌를 연결하세요"
        description="스킬은 연결된 증권 계좌로 동작합니다. 연습은 모의투자 계좌부터 하는 걸 권해요."
        action={
          <Link to="/accounts" className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand-hover">
            계좌 등록하러 가기
          </Link>
        }
      />
    )
  }

  const budgetText = skill.params.some((p) => p.key === 'budget') ? `${values.budget ? groupDigits(String(values.budget)) : '-'}${budgetMarketOf(values) === 'US' ? '달러' : '원'}` : null

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium">사용할 계좌</p>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        {real && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-real-soft px-3 py-2 text-xs font-medium text-real" role="note">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            실전 계좌입니다. 실제 돈으로 사람 확인 없이 주문됩니다.
            {hasPaper && ' 처음이라면 모의 계좌로 먼저 해 보세요.'}
          </p>
        )}
      </div>

      {skill.params.map((p) => (
        <ParamInput key={p.key} param={p} value={values[p.key]} onChange={(v) => set(p.key, v)} error={errors[p.key]} />
      ))}

      <Button variant={real ? 'real' : 'primary'} size="lg" className="w-full" onClick={onSubmit} loading={create.isPending && !confirmOpen} disabled={!account}>
        {real ? '실전 계좌에서 시작하기…' : '시작하기'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="실전 계좌에서 자동 매매를 시작할까요?"
        description={account && `${account.alias} (실전)`}
        confirmLabel="동의하고 시작"
        cancelLabel="취소"
        destructive
        loading={create.isPending}
        confirmDisabled={!agreed}
        onConfirm={() => create.mutate(true)}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 rounded-xl border border-real/40 bg-real-soft p-3 text-real">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="font-semibold">시작하면 장이 열릴 때마다 AI가 사람의 확인 없이 실제 주문을 냅니다.</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {budgetText && <li>사용할 시드: {budgetText} (이 금액을 넘겨 매수하지 않습니다)</li>}
            <li>서버가 한도를 코드로 강제하며, 손실이 한도에 닿으면 전량 매도 후 스스로 멈춥니다.</li>
            <li>수익은 보장되지 않으며 원금 손실이 날 수 있습니다. 수수료·세금은 계산에 반영되지 않습니다.</li>
            <li>주문이 나가면 이메일로도 알려 드립니다. 언제든 ‘일시정지’·‘비상 정지’로 멈출 수 있어요.</li>
          </ul>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--real-solid))]" />
            <span>위 내용을 이해했고, 실전 계좌의 자동 주문에 동의합니다.</span>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('mb-5 rounded-2xl border border-border bg-surface shadow-card', className)}>
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  )
}

export function SkillDetailPage() {
  const { skillId } = useParams()
  const skillsQ = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list, staleTime: 5 * 60_000 })
  const tasksQ = useQuery({ queryKey: ['agent', 'skill', skillId], queryFn: () => agentApi.list({ skillId }), enabled: !!skillId, refetchInterval: 20_000 })
  const skill = skillsQ.data?.find((s) => s.id === skillId)
  const tasks = useMemo(() => (tasksQ.data ?? []).filter((t) => t.status !== 'CANCELED' && t.status !== 'DONE'), [tasksQ.data])
  const ended = (tasksQ.data ?? []).filter((t) => t.status === 'CANCELED' || t.status === 'DONE')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={skill?.name ?? '스킬'}
        description={skill?.category}
        actions={
          <Link to="/skills" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg md:h-9">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            목록
          </Link>
        }
      />
      <PageBody>
        {skillsQ.isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : !skill ? (
          <EmptyState title="스킬을 찾을 수 없어요" description="목록으로 돌아가 다시 선택해 주세요." />
        ) : (
          <div className="grid gap-x-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <Card title="내가 켠 스킬">
                {tasksQ.isLoading ? (
                  <div className="p-4">
                    <Skeleton className="h-16" />
                  </div>
                ) : tasks.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">아직 켜 둔 항목이 없어요. 아래에서 설정하고 시작해 보세요.</p>
                ) : (
                  <AgentTaskManager tasks={tasks} showAccount />
                )}
                {ended.length > 0 && (
                  <details className="border-t border-border px-4 py-3 text-sm">
                    <summary className="cursor-pointer select-none text-muted">종료된 항목 {ended.length}개</summary>
                    <ul className="mt-2 space-y-1.5">
                      {ended.slice(0, 10).map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-xs text-subtle">
                          <Badge tone="neutral">종료</Badge>
                          <span className="truncate">{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <Card title="새로 시작하기" className="lg:sticky lg:top-20">
                <div className="p-4">
                  {skill.trades && (
                    <p className="mb-4 flex items-center gap-1.5 text-xs text-muted">
                      <AccountTypeBadge type="PAPER_TRADE" /> 모의 계좌로 먼저 연습해 보세요.
                    </p>
                  )}
                  <StartForm key={skill.id} skill={skill} />
                </div>
              </Card>
            </div>

            <div className="min-w-0 lg:col-start-1 lg:row-start-2">
              <Card title="이 스킬은 어떻게 동작하나요?">
                <div className="px-4 py-4">
                  <Markdown text={skill.detail} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageBody>
    </div>
  )
}
