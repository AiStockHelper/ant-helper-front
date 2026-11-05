import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Clock, ListChecks, Trash2 } from 'lucide-react'
import { orderQueueApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import type { OrderRequestItem } from '@/api/types'
import { EmptyState, MarketBadge, SideBadge } from '@/components/finance/parts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatAmount, formatDateTime } from '@/lib/format'

const SOURCE_LABEL: Record<OrderRequestItem['source'], string> = {
  CHAT_ACTION: '채팅 승인',
  AGENT: '자동 실행',
  MANUAL: '직접',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

function Row({ r, action }: { r: OrderRequestItem; action?: React.ReactNode }) {
  const price = r.limitPrice != null ? `${formatAmount(r.limitPrice, r.currency)} ${r.currency === 'KRW' ? '원' : '달러'} 지정가` : '시장가'
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <SideBadge side={r.side} />
        <MarketBadge market={r.market} />
        <Badge tone="neutral">{SOURCE_LABEL[r.source]}</Badge>
        {r.status === 'RETRY_WAIT' && <Badge tone="warning">재시도 대기 {r.attempts}/{r.maxRetries + 1}</Badge>}
        {r.status === 'SENDING' && <Badge tone="brand">전송 중</Badge>}
        {r.status === 'FAILED' && <Badge tone="danger">실패 · {r.attempts}회 시도</Badge>}
        {r.status === 'SUCCESS' && <Badge tone="success">접수 완료</Badge>}
      </div>
      <p className="mt-1.5 text-sm font-semibold">
        {r.name ?? r.symbol} <span className="font-normal text-muted">{r.quantity.toLocaleString('ko-KR')}주 · {price}</span>
      </p>
      <p className="mt-0.5 text-xs text-subtle">
        {r.accountName} · 요청 {formatDateTime(r.createdAt)}
        {r.status === 'RETRY_WAIT' && r.nextAttemptAt && <span> · 다음 시도 {formatDateTime(r.nextAttemptAt)}</span>}
        {r.status === 'SUCCESS' && r.orderNo && <span> · 주문번호 {r.orderNo}</span>}
        {r.status === 'FAILED' && r.completedAt && <span> · 종료 {formatDateTime(r.completedAt)}</span>}
      </p>
      {r.lastError && r.status !== 'SUCCESS' && <p className="mt-1 text-xs text-warning">{r.lastError}</p>}
      {action && <div className="mt-2 flex gap-1.5">{action}</div>}
    </li>
  )
}

/** 주문 대기열: 재시도 중인 주문, 실패한 주문(지울 수 있음), 최근 접수된 주문. */
export function OrderQueue({ accountId }: { accountId: number }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [confirmAll, setConfirmAll] = useState(false)

  const q = useQuery({
    queryKey: ['order-requests', accountId],
    queryFn: () => orderQueueApi.list({ accountId }),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === 'RETRY_WAIT' || r.status === 'SENDING') ? 6000 : false,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['order-requests'] })

  const remove = useMutation({
    mutationFn: (id: number) => orderQueueApi.remove(id),
    onSuccess: () => {
      refresh()
      toast.success('목록에서 지웠어요.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const removeAll = useMutation({
    mutationFn: () => orderQueueApi.removeFailed(accountId),
    onSuccess: (r) => {
      refresh()
      setConfirmAll(false)
      toast.success(`실패한 주문 ${r.deleted}건을 지웠어요.`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (q.isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (q.isError || !q.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="주문 큐를 불러오지 못했어요"
        description={errorMessage(q.error)}
        action={
          <Button variant="outline" onClick={() => q.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const pending = q.data.filter((r) => r.status === 'RETRY_WAIT' || r.status === 'SENDING')
  const failed = q.data.filter((r) => r.status === 'FAILED')
  const done = q.data.filter((r) => r.status === 'SUCCESS').slice(0, 10)

  if (q.data.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="h-6 w-6" />}
        title="주문 큐가 비어 있어요"
        description="주문은 증권사로 보내기 전에 여기에 기록돼요. 일시적인 오류로 실패하면 최대 10번까지 자동으로 다시 보내고, 끝내 실패한 주문은 여기에 남아요."
      />
    )
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Section title={`다시 시도 중 ${pending.length}건`} hint="일시적인 오류로 접수되지 않은 주문이에요. 자동으로 다시 보냅니다.">
          <ul className="divide-y divide-border">
            {pending.map((r) => (
              <Row
                key={r.id}
                r={r}
                action={
                  r.status === 'RETRY_WAIT' && (
                    <Button size="sm" variant="outline" loading={remove.isPending && remove.variables === r.id} onClick={() => remove.mutate(r.id)}>
                      <Clock className="h-3.5 w-3.5" /> 재시도 취소
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        </Section>
      )}

      <Section title={`실패한 주문 ${failed.length}건`} hint="끝내 접수되지 못한 주문이에요. 확인하고 지워도 돼요. 지워도 증권사 계좌에는 영향이 없어요.">
        {failed.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">실패한 주문이 없어요.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {failed.map((r) => (
                <Row
                  key={r.id}
                  r={r}
                  action={
                    <Button size="sm" variant="outline" loading={remove.isPending && remove.variables === r.id} onClick={() => remove.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> 지우기
                    </Button>
                  }
                />
              ))}
            </ul>
            <div className="border-t border-border p-3 text-right">
              <Button size="sm" variant="ghost" onClick={() => setConfirmAll(true)}>
                실패한 주문 모두 지우기
              </Button>
            </div>
          </>
        )}
      </Section>

      {done.length > 0 && (
        <Section title="최근 접수된 주문">
          <ul className="divide-y divide-border">
            {done.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </Section>
      )}

      <ConfirmDialog
        open={confirmAll}
        title="실패한 주문을 모두 지울까요?"
        description="목록에서만 지워지고, 증권사 계좌에는 영향이 없어요."
        confirmLabel="모두 지우기"
        destructive
        loading={removeAll.isPending}
        onConfirm={() => removeAll.mutate()}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  )
}
