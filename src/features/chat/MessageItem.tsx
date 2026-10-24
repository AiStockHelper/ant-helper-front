import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Copy, Pencil, RefreshCw, Square } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { cn } from '@/lib/cn'
import { copyText } from '@/lib/clipboard'
import type { Action } from '@/api/types'
import { ActionCard } from './ActionCard'
import { CardRenderer } from './cards/Cards'
import { Markdown } from './Markdown'
import { ToolCalls } from './ToolCalls'
import type { ChatMessage } from './useChat'

function IconAction({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40 md:h-8 md:w-8"
    >
      {children}
    </button>
  )
}

function CopyAction({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <IconAction
      label={done ? '복사됨' : '복사'}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        }
      }}
    >
      {done ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </IconAction>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2" role="status" aria-label="답변 생성 중">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-subtle" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

interface Props {
  message: ChatMessage
  isLast: boolean
  /** 이 메시지가 현재 생성 중인 어시스턴트 메시지인지 */
  live: boolean
  busy: boolean
  onRegenerate: () => void
  onEdit: (content: string, messageId: number) => void
  onActionChange: (a: Action) => void
}

function UserMessage({ message, busy, onEdit }: Pick<Props, 'message' | 'busy' | 'onEdit'>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [draft, editing])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    setEditing(false)
    onEdit(text, message.id)
  }

  if (editing) {
    return (
      <div className="flex w-full justify-end">
        <div className="w-full max-w-[min(100%,36rem)] rounded-2xl border border-brand/50 bg-surface p-3 shadow-card">
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape') {
                setEditing(false)
                setDraft(message.content)
              }
            }}
            rows={1}
            aria-label="메시지 수정"
            className="w-full resize-none bg-transparent leading-relaxed outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(message.content)
              }}
              className="h-11 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 md:h-8"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="h-11 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50 md:h-8"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-soft px-4 py-2.5 leading-relaxed text-fg md:max-w-[80%]">
        {message.content}
      </div>
      <div className="-mb-2 mt-0.5 flex opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <CopyAction text={message.content} />
        <IconAction
          label="메시지 수정"
          disabled={busy}
          onClick={() => {
            setDraft(message.content)
            setEditing(true)
          }}
        >
          <Pencil className="h-4 w-4" />
        </IconAction>
      </div>
    </div>
  )
}

export const MessageItem = memo(function MessageItem({ message, isLast, live, busy, onRegenerate, onEdit, onActionChange }: Props) {
  if (message.role === 'USER') {
    return <UserMessage message={message} busy={busy} onEdit={onEdit} />
  }

  const empty = !message.content && message.cards.length === 0 && message.actions.length === 0
  const showDots = live && empty && !message.toolCalls.some((t) => t.status === 'RUNNING')
  const stopped = message.status === 'STOPPED'
  const failed = message.status === 'ERROR'

  return (
    <div className="group flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <ToolCalls tools={message.toolCalls} />
        {message.cards.map((c, i) => (
          <CardRenderer key={`${c.type}-${i}`} card={c} />
        ))}
        {message.content && <Markdown text={message.content} streaming={live} />}
        {showDots && <TypingDots />}
        {message.actions.map((a) => (
          <ActionCard key={a.id} action={a} onChange={onActionChange} />
        ))}
        {stopped && (
          <p className="flex items-center gap-1.5 text-xs text-subtle">
            <Square className="h-3 w-3 fill-current" aria-hidden />
            생성을 중지했어요.
          </p>
        )}
        {failed && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            답변을 끝까지 생성하지 못했어요.
          </p>
        )}
        {!live && (message.content || failed || stopped) && (
          <div className={cn('-ml-2 -mb-2 flex opacity-100 transition-opacity', !isLast && 'md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100')}>
            {message.content && <CopyAction text={message.content} />}
            {isLast && (
              <IconAction label="다시 생성" onClick={onRegenerate} disabled={busy}>
                <RefreshCw className="h-4 w-4" />
              </IconAction>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
