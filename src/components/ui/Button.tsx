import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'real'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover disabled:bg-brand/40',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  outline: 'border border-border-strong bg-surface text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90 dark:text-black',
  real: 'bg-real-solid text-white hover:opacity-90',
}

const sizes: Record<Size, string> = {
  sm: 'h-11 px-3 text-sm md:h-8',
  md: 'h-11 px-4 text-sm md:h-10',
  lg: 'h-12 px-5 text-base',
  icon: 'h-11 w-11 md:h-9 md:w-9',
  'icon-sm': 'h-11 w-11 md:h-8 md:w-8',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
