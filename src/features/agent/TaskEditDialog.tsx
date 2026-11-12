import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, ShieldAlert } from 'lucide-react'
import { agentApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { ParamInput, configFromValues, validateValues, valuesFromConfig, type Values } from '@/features/skills/ParamFields'
import { formatMoney, groupDigits, ungroup } from '@/lib/format'
import type { AgentTask, Skill, UpdateAgentTaskRequest } from '@/api/types'

/** 시장은 이미 보유 중인 종목·통화와 묶여 있어 켠 뒤에는 바꿀 수 없다. */
const LOCKED_KEYS = new Set(['market'])

const toNumber = (s: string) => Number(String(s).replace(/,/g, ''))

interface GenericForm {
  title: string
  budget: string
  maxPositionPct: string
  maxLossPct: string
  maxDailyBuy: string
}

function genericInitial(task: AgentTask): GenericForm {
  const l = task.ledger
  return {
    title: task.title,
    budget: l ? String(l.budget) : '',
    maxPositionPct: l?.maxPositionPct != null ? String(l.maxPositionPct) : '',
    maxLossPct: l?.maxLossPct != null ? String(l.maxLossPct) : '',
    maxDailyBuy: l?.maxDailyBuy != null ? String(l.maxDailyBuy) : l ? String(l.budget) : '',
  }
}

/**
 * 자동 실행의 설정·투자금 수정. 바꾼 항목만 서버로 보낸다.
 * - 스킬 작업: 스킬이 정의한 설정값을 모두 고칠 수 있다(시드·손절·점검 주기 등). 일정·한도는 서버가 다시 계산한다.
 * - 일반 작업: 시드와 한도(한 종목 비중·누적 손실·하루 매수)를 고친다.
 * 이미 보유 중인 종목과 손익 기록은 그대로이고, 다음 실행부터 새 설정이 적용된다.
 */
export function TaskEditDialog({ task, skill, open, onClose }: { task: AgentTask; skill?: Skill; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const isSkill = !!task.skillId
  const real = task.autonomous && task.accountType === 'REAL_TRADE'
  const running = task.status === 'RUNNING'
  const currency = task.ledger?.currency ?? 'KRW'
  const unit = currency === 'USD' ? '달러' : '원'

  const [values, setValues] = useState<Values>({})
  const [form, setForm] = useState<GenericForm>(() => genericInitial(task))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [agreed, setAgreed] = useState(false)

  // 열 때만 초기화한다(목록이 15초마다 새로고침돼도 입력 중인 값을 지우지 않는다).
  useEffect(() => {
    if (!open) return
    setErrors({})
    setAgreed(false)
    if (isSkill && skill) setValues(valuesFromConfig(skill, task.config))
    else setForm(genericInitial(task))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task.id, skill?.id])

  /** 서버로 보낼 변경분. 바뀐 게 없으면 null. */
  const patch = useMemo<UpdateAgentTaskRequest | null>(() => {
    if (isSkill) {
      if (!skill) return null
      const next = configFromValues(skill, values)
      const changed: Record<string, unknown> = {}
      for (const p of skill.params) {
        if (LOCKED_KEYS.has(p.key) || !(p.key in values)) continue
        const before = task.config[p.key]
        const after = next[p.key]
        const same = p.type === 'NUMBER' ? Number(before) === Number(after) : String(before ?? '') === String(after ?? '')
        if (!same) changed[p.key] = after
      }
      return Object.keys(changed).length > 0 ? { config: changed } : null
    }
    const l = task.ledger
    const body: UpdateAgentTaskRequest = {}
    if (form.title.trim() && form.title.trim() !== task.title) body.title = form.title.trim()
    if (l) {
      if (form.budget !== '' && toNumber(form.budget) !== l.budget) body.budget = toNumber(form.budget)
      if (form.maxPositionPct !== '' && toNumber(form.maxPositionPct) !== (l.maxPositionPct ?? NaN)) body.maxPositionPct = toNumber(form.maxPositionPct)
      if (form.maxLossPct !== '' && toNumber(form.maxLossPct) !== (l.maxLossPct ?? NaN)) body.maxLossPct = toNumber(form.maxLossPct)
      if (form.maxDailyBuy !== '' && toNumber(form.maxDailyBuy) !== (l.maxDailyBuy ?? l.budget)) body.maxDailyBuy = toNumber(form.maxDailyBuy)
    }
    return Object.keys(body).length > 0 ? body : null
  }, [isSkill, skill, values, form, task])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (isSkill) {
      if (skill) Object.assign(next, validateValues(skill, values))
    } else if (task.ledger) {
      const budget = toNumber(form.budget)
      if (form.budget === '' || Number.isNaN(budget) || budget <= 0) next.budget = '0보다 큰 금액을 입력해 주세요.'
      else if (budget < task.ledger.invested) next.budget = `지금 투자 중인 ${formatMoney(task.ledger.invested, currency)}보다 작게 줄일 수 없어요. 먼저 보유 종목을 정리하세요.`
      for (const [key, label] of [['maxPositionPct', '한 종목 비중'], ['maxLossPct', '누적 손실 한도']] as const) {
        const n = toNumber(form[key])
        if (form[key] === '' || Number.isNaN(n) || n <= 0 || n > 100) next[key] = `${label}은 0 초과 100 이하의 숫자여야 합니다.`
      }
      const daily = toNumber(form.maxDailyBuy)
      if (form.maxDailyBuy === '' || Number.isNaN(daily) || daily <= 0) next.maxDailyBuy = '0보다 큰 금액을 입력해 주세요.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: (body: UpdateAgentTaskRequest) => agentApi.update(task.id, { ...body, confirmRealTrading: real ? true : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent'] })
      toast.success('수정했어요. 다음 실행부터 새 설정으로 동작해요.')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = () => {
    if (!patch || !validate()) return
    save.mutate(patch)
  }

  const setField = (key: keyof GenericForm, v: string) => {
    setForm((f) => ({ ...f, [key]: v }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }
  const setParam = (key: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: v }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const disabledReason = running ? '지금 실행 중이라 설정을 바꿀 수 없어요. 잠시 뒤에 다시 시도해 주세요.' : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="설정 수정"
      description={task.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            취소
          </Button>
          <Button
            variant={real ? 'real' : 'primary'}
            onClick={submit}
            loading={save.isPending}
            disabled={!patch || !!disabledReason || (real && !agreed)}
          >
            {patch ? '변경 저장' : '바뀐 내용이 없어요'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {disabledReason && <p className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{disabledReason}</p>}

        {real && (
          <div className="flex items-start gap-2 rounded-xl border border-real/40 bg-real-soft p-3 text-sm text-real">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">실전 계좌의 자동 주문 설정입니다.</p>
              <p className="mt-0.5 text-xs">바꾸면 다음 실행부터 새 시드·한도로 실제 주문이 나갑니다. 저장할 때 이메일 인증번호를 한 번 더 확인해요.</p>
            </div>
          </div>
        )}

        {isSkill ? (
          skill ? (
            skill.params.map((p) =>
              LOCKED_KEYS.has(p.key) ? (
                <div key={p.key} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                  <span className="text-muted">{p.label}</span>
                  <span className="ml-2 font-medium">{p.options?.find((o) => o.value === String(task.config[p.key]))?.label ?? String(task.config[p.key] ?? '-')}</span>
                  <span className="ml-2 text-xs text-subtle">켠 뒤에는 바꿀 수 없어요</span>
                </div>
              ) : (
                <ParamInput key={p.key} param={p} value={values[p.key] ?? ''} onChange={(v) => setParam(p.key, v)} error={errors[p.key]} />
              ),
            )
          ) : (
            <p className="text-sm text-muted">스킬 정보를 불러오는 중이에요…</p>
          )
        ) : task.ledger ? (
          <>
            <Field label="이름" value={form.title} maxLength={200} onChange={(e) => setField('title', e.target.value)} />
            <Field
              label="시드(투자 한도)"
              inputMode="numeric"
              value={groupDigits(form.budget)}
              onChange={(e) => setField('budget', ungroup(e.target.value))}
              error={errors.budget}
              hint={`이 금액을 넘겨 사지 않아요. 지금 투자 중 ${formatMoney(task.ledger.invested, currency)} · 남은 예산 ${formatMoney(task.ledger.available, currency)}`}
              suffix={<span className="pr-2 text-xs text-subtle">{unit}</span>}
            />
            <Field
              label="한 종목 최대 비중"
              type="number"
              step="any"
              value={form.maxPositionPct}
              onChange={(e) => setField('maxPositionPct', e.target.value)}
              error={errors.maxPositionPct}
              hint="시드 대비 한 종목에 넣을 수 있는 최대 비율입니다."
              suffix={<span className="pr-2 text-xs text-subtle">%</span>}
            />
            <Field
              label="누적 손실 한도"
              type="number"
              step="any"
              value={form.maxLossPct}
              onChange={(e) => setField('maxLossPct', e.target.value)}
              error={errors.maxLossPct}
              hint="손실이 시드의 이 비율에 닿으면 신규 매수를 막습니다."
              suffix={<span className="pr-2 text-xs text-subtle">%</span>}
            />
            <Field
              label="하루 최대 매수 금액"
              inputMode="numeric"
              value={groupDigits(form.maxDailyBuy)}
              onChange={(e) => setField('maxDailyBuy', ungroup(e.target.value))}
              error={errors.maxDailyBuy}
              hint="하루에 새로 살 수 있는 총액입니다."
              suffix={<span className="pr-2 text-xs text-subtle">{unit}</span>}
            />
          </>
        ) : (
          <p className="text-sm text-muted">이 작업은 시드(투자 한도)가 없어 바꿀 설정이 없어요. 이름과 지시 내용은 ‘지시·설정’ 탭에서 수정하세요.</p>
        )}

        <p className="flex items-start gap-1.5 text-xs text-subtle">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          이미 보유 중인 종목과 손익 기록은 그대로예요. 시드를 줄여도 보유 종목은 자동으로 팔리지 않습니다.
        </p>

        {real && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--real-solid))]" />
            <span>실제 주문에 쓰이는 시드·한도를 바꾸는 것임을 확인했어요.</span>
          </label>
        )}
      </div>
    </Dialog>
  )
}
