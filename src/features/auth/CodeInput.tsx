import { Field } from '@/components/ui/Field'

/** 이메일로 받은 6자리 인증번호 입력칸 (숫자만, 모바일 자동 완성 지원). */
export function CodeInput({ value, onChange, error, autoFocus = true }: {
  value: string
  onChange: (v: string) => void
  error?: string | null
  autoFocus?: boolean
}) {
  return (
    <Field
      label="인증번호 6자리"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      error={error}
      autoFocus={autoFocus}
      data-autofocus
      className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.4em]"
    />
  )
}