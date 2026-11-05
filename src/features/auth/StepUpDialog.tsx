import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { errorMessage, setStepUpHandler } from '@/api/client'
import type { StepUpChallenge } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CodeInput } from './CodeInput'

/**
 * 실계좌 등록·주문 승인·자동매매 시작처럼 민감한 요청을 서버가 거절(S-010)하면 자동으로 뜨는 이메일 인증번호 창.
 * 통과하면 하던 요청이 이어서 실행된다. 인증은 서버에서 일정 시간(기본 10분) 유지된다.
 */
export function StepUpDialog() {
  const [open, setOpen] = useState(false)
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendLeft, setResendLeft] = useState(0)
  const pending = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null)

  const sendCode = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const c = await authApi.stepUpRequest()
      setChallenge(c)
      setCode('')
      setResendLeft(c.resendAfterSeconds)
    } catch (e) {
      setError(errorMessage(e, '인증번호를 보내지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }, [])

  const finish = useCallback((ok: boolean) => {
    pending.current?.resolve(ok)
    pending.current = null
    setOpen(false)
    setChallenge(null)
    setCode('')
    setError(null)
  }, [])

  useEffect(() => {
    setStepUpHandler(() => {
      if (pending.current) return pending.current.promise
      let resolve!: (ok: boolean) => void
      const promise = new Promise<boolean>((r) => {
        resolve = r
      })
      pending.current = { promise, resolve }
      setOpen(true)
      void sendCode()
      return promise
    })
    return () => setStepUpHandler(null)
  }, [sendCode])

  useEffect(() => {
    if (resendLeft <= 0) return
    const id = window.setTimeout(() => setResendLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [resendLeft])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    if (code.length !== 6) {
      setError('인증번호 6자리를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await authApi.stepUpVerify({ challengeId: challenge.challengeId, code })
      finish(true)
    } catch (err) {
      setError(errorMessage(err, '인증에 실패했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => finish(false)}
      closeOnBackdrop={false}
      size="sm"
      title="본인 확인"
      description="실계좌를 보호하기 위해 이메일로 보낸 인증번호를 한 번 더 확인합니다."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-text">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            확인하면 {challenge?.validMinutes ?? 10}분 동안은 다시 묻지 않습니다. 인증번호는 {Math.round((challenge?.expiresInSeconds ?? 300) / 60)}분
            안에 입력해 주세요.
          </span>
        </div>
        <CodeInput value={code} onChange={setCode} />
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={resendLeft > 0 || busy}
            onClick={() => void sendCode()}
            className="text-sm font-semibold text-brand-text hover:underline disabled:text-subtle disabled:no-underline"
          >
            {resendLeft > 0 ? `다시 받기 (${resendLeft}초)` : '인증번호 다시 받기'}
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => finish(false)}>
              취소
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!challenge}>
              확인
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
