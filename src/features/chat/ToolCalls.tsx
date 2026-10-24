import { useState } from 'react'
import { AlertCircle, Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ToolCall } from '@/api/types'

function Chip({ tool }: { tool: ToolCall }) {
  const running = tool.status === 'RUNNING'
  const failed = tool.status === 'ERROR'
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        running ? 'border-brand/40 bg-brand-soft text-brand-text' : failed ? 'border-danger/40 bg-danger-soft text-danger' : 'border-border bg-surface-2 text-muted',
      )}
      title={tool.summary}
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : failed ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
      )}
      <span className="truncate">
        {tool.label}
        {running ? ' 중…' : failed ? ' 실패' : ''}
      </span>
      {!running && tool.summary && <span className="hidden truncate text-subtle sm:inline">· {tool.summary}</span>}
    </span>
  )
}

/** 실행 중인 도구는 칩으로, 모두 끝나면 "도구 N개 사용" 한 줄로 접힌다. */
export function ToolCalls({ tools }: { tools: ToolCall[] }) {
  const [open, setOpen] = useState(false)
  if (tools.length === 0) return null
  const allDone = tools.every((t) => t.status !== 'RUNNING')
  const collapsible = allDone && tools.length > 1

  if (collapsible && !open) {
    const failed = tools.filter((t) => t.status === 'ERROR').length
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-fg"
      >
        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        도구 {tools.length}개 사용{failed > 0 ? ` (실패 ${failed})` : ''}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
      {tools.map((t) => (
        <Chip key={t.id} tool={t} />
      ))}
      {collapsible && (
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-subtle hover:text-fg" aria-expanded>
          접기
        </button>
      )}
    </div>
  )
}
