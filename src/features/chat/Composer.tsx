import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, ShieldAlert, Square } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
  real?: boolean
  focusKey?: unknown
}

export function Composer({ onSend, onStop, streaming, disabled, real, focusKey }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.focus()
  }, [focusKey])

  const canSend = value.trim().length > 0 && !streaming && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value)
    setValue('')
  }

  return (
    <div className="px-3 pb-3 pt-2 md:px-6 md:pb-5">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            'rounded-3xl border bg-surface py-1 pl-3 pr-1 shadow-card transition-colors focus-within:ring-2',
            real ? 'border-real/70 focus-within:ring-real/30' : 'border-border-strong focus-within:border-brand focus-within:ring-brand/25',
          )}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={ref}
              value={value}
              rows={1}
              onChange={(e) => setValue(e.target.value)}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={() => (composing.current = false)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                // 한글 IME 조합 중 Enter 는 조합 확정이므로 전송하지 않는다.
                if (e.nativeEvent.isComposing || composing.current || e.keyCode === 229) return
                e.preventDefault()
                submit()
              }}
              placeholder="무엇이든 물어보세요"
              aria-label="메시지 입력"
              enterKeyHint="send"
              className="composer-input block max-h-[200px] min-h-[44px] w-full flex-1 resize-none bg-transparent px-2 py-[10px] leading-6 placeholder:text-subtle focus:outline-none"
            />
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="생성 중지"
                title="생성 중지"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fg text-bg hover:opacity-85"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="보내기"
                title="보내기 (Enter)"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg transition-opacity hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        {real ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-real">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            실전 계좌 사용 중 · 주문은 확인 카드에서 승인해야 실행됩니다
          </p>
        ) : (
          <p className="mt-2 hidden text-center text-xs text-subtle md:block">AI의 답변은 부정확할 수 있어요. 투자 판단의 책임은 본인에게 있습니다.</p>
        )}
      </div>
    </div>
  )
}
