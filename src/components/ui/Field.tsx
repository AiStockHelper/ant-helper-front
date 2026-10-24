import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string | null
  suffix?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, suffix, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const descId = `${inputId}-desc`
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error || hint ? descId : undefined}
          className={cn(
            'h-11 w-full rounded-xl border bg-surface px-3.5 text-fg placeholder:text-subtle md:h-10',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
            error ? 'border-danger' : 'border-border-strong',
            suffix ? 'pr-11' : '',
          )}
          {...rest}
        />
        {suffix && <div className="absolute inset-y-0 right-1 flex items-center">{suffix}</div>}
      </div>
      {(error || hint) && (
        <p id={descId} className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-subtle')}>
          {error || hint}
        </p>
      )}
    </div>
  )
})

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors md:h-8',
              active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="로딩 중"
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-brand', className)}
    />
  )
}
