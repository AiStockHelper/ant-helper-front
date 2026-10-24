import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LineChart, MessageSquareText, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { errorMessage } from '@/api/client'
import { useAuth } from './AuthContext'

function useReturnTo(): string {
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string; search?: string; hash?: string } } | null)?.from
  if (from && from.pathname !== '/login' && from.pathname !== '/signup') {
    return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
  }
  return '/chat'
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-600 to-violet-900 p-12 text-white lg:flex">
        <Logo className="[&_span]:text-white [&_span_span]:text-white/70" />
        <div>
          <h2 className="text-3xl font-extrabold leading-snug tracking-tight">
            채팅 한 줄로
            <br />
            시세 · 예측 · 주문까지.
          </h2>
          <ul className="mt-8 space-y-4 text-white/90">
            {[
              [MessageSquareText, '“삼성전자 10주 사줘”처럼 말하면 알아서 처리해요'],
              [LineChart, '시세, 차트, 내일 예측과 추천 종목을 카드로 한눈에'],
              [ShieldCheck, '실전 주문은 반드시 확인 카드로 한 번 더 승인'],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof LineChart
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <span>{text as string}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="text-xs text-white/60">투자 판단의 책임은 본인에게 있으며, 예측은 참고용입니다.</p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-5 py-10 pb-[calc(2.5rem+var(--safe-bottom))] pt-[calc(2.5rem+var(--safe-top))]">
        <div className="w-full max-w-sm animate-fade-in">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </main>
    </div>
  )
}

function PasswordField({ label, value, onChange, error, autoComplete, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | null
  autoComplete: string
  hint?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      error={error}
      hint={hint}
      suffix={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:text-fg"
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  )
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const returnTo = useReturnTo()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (status === 'authenticated') return <Navigate to={returnTo} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(errorMessage(err, '로그인에 실패했습니다.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="다시 만나서 반가워요"
      subtitle="로그인하고 AI 채팅으로 주식을 관리해 보세요."
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to="/signup" state={location.state} className="font-semibold text-brand-text hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
        <PasswordField label="비밀번호" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          로그인
        </Button>
      </form>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { status, signup } = useAuth()
  const navigate = useNavigate()
  const returnTo = useReturnTo()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (status === 'authenticated') return <Navigate to={returnTo} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = '올바른 이메일 주소를 입력해 주세요.'
    if (!nickname.trim()) next.nickname = '닉네임을 입력해 주세요.'
    else if (nickname.trim().length > 20) next.nickname = '닉네임은 20자 이하로 입력해 주세요.'
    if (password.length < 8) next.password = '비밀번호는 8자 이상이어야 합니다.'
    if (confirm !== password) next.confirm = '비밀번호가 일치하지 않습니다.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      await signup(email.trim(), password, nickname.trim())
      navigate(returnTo, { replace: true })
    } catch (err) {
      setFormError(errorMessage(err, '회원가입에 실패했습니다.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Ant Helper 시작하기"
      subtitle="이메일로 간편하게 가입하세요."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-brand-text hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="닉네임"
          autoComplete="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={errors.nickname}
        />
        <PasswordField
          label="비밀번호"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={errors.password}
          hint="8자 이상"
        />
        <PasswordField
          label="비밀번호 확인"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          회원가입
        </Button>
      </form>
    </AuthLayout>
  )
}
