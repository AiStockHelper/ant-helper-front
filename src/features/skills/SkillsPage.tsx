import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, OctagonAlert, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { agentApi, skillsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { PageBody, PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/finance/parts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'
import type { AgentTask, Skill } from '@/api/types'

const ICONS: Record<string, typeof Sparkles> = { 자동매매: TrendingUp }

export function skillIcon(category: string) {
  return ICONS[category] ?? Sparkles
}

function SkillCard({ skill, tasks }: { skill: Skill; tasks: AgentTask[] }) {
  const Icon = skillIcon(skill.category)
  const running = tasks.filter((t) => t.status === 'ACTIVE' || t.status === 'RUNNING').length
  const paused = tasks.filter((t) => t.status === 'PAUSED').length
  return (
    <Link
      to={`/skills/${skill.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/50"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-base font-bold leading-snug">{skill.name}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{skill.category}</Badge>
            {skill.trades && <Badge tone="warning">주문을 냅니다</Badge>}
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <p className="mt-3 text-sm text-muted">{skill.summary}</p>
      <div className="mt-3 text-xs">
        {running + paused > 0 ? (
          <span className="font-semibold text-success">
            {running > 0 && `동작 중 ${running}개`}
            {running > 0 && paused > 0 && ' · '}
            {paused > 0 && <span className="text-warning">일시정지 {paused}개</span>}
          </span>
        ) : (
          <span className="text-subtle">아직 켜지 않았어요</span>
        )}
      </div>
    </Link>
  )
}

export function SkillsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [confirmStop, setConfirmStop] = useState(false)
  const skillsQ = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list, staleTime: 5 * 60_000 })
  const tasksQ = useQuery({ queryKey: ['agent', 'all'], queryFn: () => agentApi.list(), refetchInterval: 30_000 })
  const tasks = tasksQ.data ?? []
  const liveCount = tasks.filter((t) => t.status === 'ACTIVE' || t.status === 'RUNNING').length

  const pauseAll = useMutation({
    mutationFn: agentApi.pauseAll,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['agent'] })
      toast.success(`자동 실행 ${r.paused}개를 모두 일시정지했어요.`)
      setConfirmStop(false)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="스킬"
        description="미리 만들어진 자동화 기능을 켜서 쓰세요"
        actions={
          liveCount > 0 && (
            <Button variant="outline" onClick={() => setConfirmStop(true)} className="border-danger/50 text-danger">
              <OctagonAlert className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">비상 정지</span>
              <span className="sm:hidden">정지</span>
            </Button>
          )
        }
      />
      <PageBody>
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p>
            스킬은 서버가 정해진 시간에 대신 실행합니다. <strong className="text-fg">모의 계좌에서 먼저 충분히 확인</strong>한 뒤 실전에 쓰세요. 모든 자동 주문은 설정한
            시드·종목별·손실 한도 안에서만 나가고, 언제든 일시정지하거나 중지할 수 있습니다.
          </p>
        </div>

        {skillsQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : skillsQ.isError ? (
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="스킬 목록을 불러오지 못했어요"
            description={errorMessage(skillsQ.error)}
            action={
              <Button variant="outline" onClick={() => skillsQ.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {skillsQ.data?.map((s) => (
              <SkillCard key={s.id} skill={s} tasks={tasks.filter((t) => t.skillId === s.id && t.status !== 'CANCELED' && t.status !== 'DONE')} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-subtle">
          새 스킬은 계속 추가됩니다. 정해진 틀이 없는 자동화(예: “매일 9시에 시세 요약해줘”)는 채팅으로 요청하면 AI가 예약합니다.
        </p>
      </PageBody>

      <ConfirmDialog
        open={confirmStop}
        title="모든 자동 실행을 일시정지할까요?"
        description="스킬과 채팅으로 예약한 모든 자동 실행이 멈춥니다. 보유 종목은 그대로 남습니다."
        confirmLabel="모두 일시정지"
        cancelLabel="닫기"
        destructive
        loading={pauseAll.isPending}
        onConfirm={() => pauseAll.mutate()}
        onClose={() => setConfirmStop(false)}
      />
    </div>
  )
}
