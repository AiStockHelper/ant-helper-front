import { Field, Segmented } from '@/components/ui/Field'
import { groupDigits, ungroup } from '@/lib/format'
import type { Skill, SkillParam } from '@/api/types'

/** 입력 중인 값. 숫자도 문자열로 들고 있다가 보낼 때만 숫자로 바꾼다. */
export type Values = Record<string, string | boolean>

export function initialValues(skill: Skill): Values {
  const v: Values = {}
  for (const p of skill.params) {
    v[p.key] = p.type === 'BOOLEAN' ? Boolean(p.defaultValue) : p.defaultValue == null ? '' : String(p.defaultValue)
  }
  return v
}

/** 이미 켜 둔 작업의 설정값으로 입력 상태를 만든다(없는 항목은 스킬 기본값). */
export function valuesFromConfig(skill: Skill, config: Record<string, unknown> | null | undefined): Values {
  const v = initialValues(skill)
  for (const p of skill.params) {
    const raw = config?.[p.key]
    if (raw === undefined || raw === null) continue
    v[p.key] = p.type === 'BOOLEAN' ? Boolean(raw) : String(raw)
  }
  return v
}

export function validateValues(skill: Skill, values: Values): Record<string, string> {
  const next: Record<string, string> = {}
  for (const p of skill.params) {
    const raw = values[p.key]
    if (p.type === 'NUMBER') {
      const n = Number(String(raw).replace(/,/g, ''))
      if (String(raw).trim() === '' || Number.isNaN(n)) next[p.key] = '숫자를 입력해 주세요.'
      else if (p.min != null && n < p.min) next[p.key] = `${p.min.toLocaleString()} 이상이어야 합니다.`
      else if (p.max != null && n > p.max) next[p.key] = `${p.max.toLocaleString()} 이하여야 합니다.`
    }
  }
  return next
}

export function configFromValues(skill: Skill, values: Values): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const p of skill.params) {
    const raw = values[p.key]
    if (p.type === 'NUMBER') c[p.key] = Number(String(raw).replace(/,/g, ''))
    else if (p.type === 'BOOLEAN') c[p.key] = Boolean(raw)
    else if (String(raw).trim() !== '') c[p.key] = String(raw).trim()
  }
  return c
}

export function ParamInput({
  param,
  value,
  onChange,
  error,
}: {
  param: SkillParam
  value: string | boolean
  onChange: (v: string | boolean) => void
  error?: string
}) {
  const range =
    param.min != null && param.max != null && param.type === 'NUMBER'
      ? `${param.min.toLocaleString()} ~ ${param.max >= 1e9 ? '제한 없음' : param.max.toLocaleString()}`
      : null
  const hint = (
    <>
      {param.help}
      {range && (
        <span className="text-subtle">
          {' '}
          (허용 범위 {range}
          {param.unit ? ` ${param.unit}` : ''})
        </span>
      )}
    </>
  )
  if (param.type === 'SELECT') {
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium">{param.label}</p>
        <Segmented
          label={param.label}
          value={String(value)}
          onChange={(v) => onChange(v)}
          options={(param.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
        />
        {param.help && <p className="mt-1.5 text-xs text-subtle">{param.help}</p>}
      </div>
    )
  }
  if (param.type === 'BOOLEAN') {
    return (
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" />
        <span>
          <span className="font-medium">{param.label}</span>
          {param.help && <span className="block text-xs text-subtle">{param.help}</span>}
        </span>
      </label>
    )
  }
  // 금액(시드)은 입력하는 동안에도 천 단위 쉼표가 보이게 한다. 상태에는 쉼표 없는 숫자만 보관한다.
  const money = param.type === 'NUMBER' && param.key === 'budget'
  return (
    <Field
      label={param.label + (param.required ? '' : ' (선택)')}
      type={param.type === 'NUMBER' && !money ? 'number' : 'text'}
      inputMode={money ? 'numeric' : param.type === 'NUMBER' ? 'decimal' : undefined}
      step={param.type === 'NUMBER' && !money ? 'any' : undefined}
      value={money ? groupDigits(String(value)) : String(value)}
      onChange={(e) => onChange(money ? ungroup(e.target.value) : e.target.value)}
      error={error}
      hint={hint}
      suffix={param.unit ? <span className="pr-2 text-xs text-subtle">{param.unit}</span> : undefined}
    />
  )
}
