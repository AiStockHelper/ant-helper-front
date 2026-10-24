import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react'
import { chatApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatRemaining, parseDate } from '@/lib/format'
import type { Action, ActionStatus } from '@/api/types'

const statusInfo: Record<ActionStatus, { label: string; tone: Parameters<typeof Badge>[0]['tone'] }> = {
  PENDING: { label: '승인 대기', tone: 'warning' },
  APPROVED: { label: '처리 중', tone: 'brand' },
  EXECUTED: { label: '실행됨', tone: 'success' },
  REJECTED: { label: '거절됨', tone: 'neutral' },
  FAILED: { label: '실패', tone: 'danger' },
  EXPIRED: { label: '만료됨', tone: 'neutral' },
}

export function ActionCard({ action, onChange }: { action: Action; onChange: (a: Action) => void }) {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [confirming, setConfirming] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const real = action.accountType === 'REAL_TRADE'
  const expiresMs = parseDate(action.expiresAt)?.getTime() ?? 0
  const remaining = expiresMs - now
  const pending = action.status === 'PENDING'
  const expired = pending && remaining <= 0
  const status: ActionStatus = expired ? 'EXPIRED' : action.status

  useEffect(() => {
    if (!pending) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [pending])

  const afterChange = (a: Action) => {
    onChange(a)
    setConfirming(false)
    setAgreed(false)
    queryClient.invalidateQueries({ queryKey: ['summary'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['scheduled'] })
  }

  const approve = useMutation({
    mutationFn: () => chatApi.approve(action.id),
    onSuccess: afterChange,
    onError: async (e) => {
      setError(errorMessage(e))
      // 서버 쪽 최신 상태(만료/이미 처리됨 등)를 반영
      try {
        onChange(await chatApi.getAction(action.id))
      } catch {
        /* ignore */
      }
    },
  })
  const reject = useMutation({
    mutationFn: () => chatApi.reject(action.id),
    onSuccess: afterChange,
    onError: (e) => setError(errorMessage(e)),
  })

  const busy = approve.isPending || reject.isPending
  const info = statusInfo[status]

  const onApproveClick = () => {
    setError(null)
    if (real && !confirming) {
      setConfirming(true)
      return
    }
    approve.mutate()
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border-2 bg-surface shadow-card animate-fade-in',
        real && pending && !expired ? 'border-real/70' : 'border-border',
      )}
      aria-label={`확인 카드: ${action.title}`}
    >
      {real && (
        <div className="flex items-center gap-2 bg-real-solid px-4 py-1.5 text-xs font-bold text-white">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          실전 계좌 · 실제 자금으로 거래됩니다
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-subtle">주문 확인</p>
            <h3 className="mt-0.5 text-base font-bold leading-snug">{action.title}</h3>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>
        {action.summary && <p className="mt-1.5 text-sm text-muted">{action.summary}</p>}

        <dl className="mt-3 divide-y divide-border rounded-xl bg-surface-2 px-3.5 text-sm">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-muted">계좌</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-medium">
              <AccountTypeBadge type={action.accountType} />
              <span className="truncate">{action.accountLabel}</span>
            </dd>
          </div>
          {action.details.map((d) => (
            <div key={d.label} className="flex items-start justify-between gap-3 py-2.5">
              <dt className="shrink-0 text-muted">{d.label}</dt>
              <dd className="tabular min-w-0 break-words text-right font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>

        {status === 'PENDING' && (
          <>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted" aria-live="off">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              남은 시간 <span className="tabular font-semibold text-fg">{formatRemaining(remaining)}</span>
              <span className="text-subtle">· 시간이 지나면 자동으로 만료됩니다</span>
            </p>

            {real && confirming && (
              <div className="mt-3 rounded-xl border border-real/50 bg-real-soft p-3.5">
                <p className="flex items-start gap-2 text-sm font-semibold text-real">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  한 번 더 확인해 주세요. 승인 즉시 실전 계좌에 반영되며 되돌릴 수 없습니다.
                </p>
                <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[rgb(var(--real-solid))]"
                  />
                  <span>위 주문 내용을 확인했으며 실전 주문 실행에 동의합니다.</span>
                </label>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => reject.mutate()} disabled={busy} loading={reject.isPending}>
                {confirming ? '취소' : '거절'}
              </Button>
              <Button
                variant={real ? 'real' : 'primary'}
                className="flex-[1.4]"
                onClick={onApproveClick}
                loading={approve.isPending}
                disabled={busy || (real && confirming && !agreed)}
              >
                {real && confirming ? '실전 주문 실행' : real ? '승인…' : '승인'}
              </Button>
            </div>
          </>
        )}

        {status === 'APPROVED' && <p className="mt-3 text-sm text-muted">승인되어 처리 중입니다…</p>}

        {(status === 'EXECUTED' || status === 'FAILED') && action.result && (
          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm',
              action.result.success ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
            role="status"
          >
            {action.result.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-semibold">{action.result.message}</p>
              {action.result.orderNo && <p className="tabular mt-0.5 text-xs opacity-80">주문번호 {action.result.orderNo}</p>}
            </div>
          </div>
        )}
        {status === 'REJECTED' && <p className="mt-3 text-sm text-muted">거절했습니다. 주문은 실행되지 않았어요.</p>}
        {status === 'EXPIRED' && <p className="mt-3 text-sm text-muted">유효 시간이 지나 만료되었습니다. 다시 요청해 주세요.</p>}
      </div>
    </section>
  )
}
