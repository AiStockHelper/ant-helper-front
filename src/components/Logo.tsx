import { useId } from 'react'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  const gid = `ant-logo-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8 shrink-0', className)} fill="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gid})`} />
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29 14 L23 7 M35 14 L41 7" />
        <path d="M32 29 L19 23 L14 27 M32 29 L17 34 L13 40 M32 31 L21 44 L18 51" />
        <path d="M32 29 L45 23 L50 27 M32 29 L47 34 L51 40 M32 31 L43 44 L46 51" />
      </g>
      <g fill="#fff">
        <circle cx="32" cy="18" r="5.6" />
        <circle cx="32" cy="29.5" r="5" />
        <ellipse cx="32" cy="45" rx="8" ry="9.5" />
      </g>
    </svg>
  )
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && (
        <span className="text-[17px] font-extrabold tracking-tight">
          Ant Helper<span className="ml-1.5 text-xs font-medium text-subtle">개미 헬퍼</span>
        </span>
      )}
    </div>
  )
}
