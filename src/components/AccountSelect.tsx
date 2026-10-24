import { Check, ChevronDown, Wallet } from 'lucide-react'
import { Popover, MenuItem } from '@/components/ui/Popover'
import { AccountTypeBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { Account } from '@/api/types'

interface Props {
  accounts: Account[]
  value: number | null | undefined
  onChange: (id: number) => void
  size?: 'sm' | 'md'
  align?: 'start' | 'end'
  className?: string
  /** 선택 버튼에 계좌 별칭을 숨기고 배지만 보여준다 (좁은 공간용) */
  compact?: boolean
  disabled?: boolean
}

export function AccountSelect({ accounts, value, onChange, size = 'md', align = 'start', className, compact, disabled }: Props) {
  const selected = accounts.find((a) => a.id === value) ?? null
  const real = selected?.accountType === 'REAL_TRADE'

  return (
    <Popover
      role="listbox"
      align={align}
      width={260}
      trigger={({ open: _open, ...p }) => (
        <button
          {...p}
          disabled={disabled || accounts.length === 0}
          aria-label={selected ? `사용 계좌: ${selected.alias}` : '계좌 선택'}
          className={cn(
            'inline-flex min-w-0 items-center gap-2 rounded-xl border bg-surface px-2.5 text-left transition-colors',
            'hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60',
            size === 'sm' ? 'h-11 text-sm md:h-8' : 'h-11 text-sm md:h-10',
            real ? 'border-real/60' : 'border-border-strong',
            className,
          )}
        >
          {selected ? (
            <>
              <AccountTypeBadge type={selected.accountType} />
              {!compact && <span className="min-w-0 max-w-[5.5rem] flex-1 truncate sm:max-w-[10rem] font-medium">{selected.alias}</span>}
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 text-subtle" aria-hidden />
              <span className="text-muted">계좌 없음</span>
            </>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {accounts.map((a) => (
            <MenuItem
              key={a.id}
              role="option"
              label={a.alias}
              selected={a.id === value}
              onSelect={() => {
                onChange(a.id)
                close()
              }}
            >
              <AccountTypeBadge type={a.accountType} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.alias}</span>
                <span className="block truncate text-xs text-subtle tabular">
                  {a.accountNumberMasked}
                  {a.isDefault ? ' · 기본' : ''}
                </span>
              </span>
              {a.id === value && <Check className="h-4 w-4 shrink-0 text-brand-text" aria-hidden />}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}
