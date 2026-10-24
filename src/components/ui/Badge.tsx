import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { AccountType } from '@/api/types'

type Tone = 'neutral' | 'brand' | 'real' | 'paper' | 'up' | 'down' | 'success' | 'danger' | 'warning'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand-text',
  real: 'bg-real-soft text-real',
  paper: 'bg-paper-soft text-paper',
  up: 'bg-up-soft text-up',
  down: 'bg-down-soft text-down',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function AccountTypeBadge({ type, className }: { type: AccountType; className?: string }) {
  const real = type === 'REAL_TRADE'
  return (
    <Badge tone={real ? 'real' : 'paper'} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', real ? 'bg-real' : 'bg-paper')} aria-hidden />
      {real ? '실전' : '모의'}
    </Badge>
  )
}
