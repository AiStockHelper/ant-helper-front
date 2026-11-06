import type { ReactNode } from 'react'
import { UsdToggle } from '@/features/settings/UsdToggle'

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 pt-safe backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-4 py-2 md:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold md:text-xl">{title}</h1>
          {description && <p className="truncate text-xs text-muted">{description}</p>}
        </div>
        <UsdToggle className="hidden sm:inline-flex" />
        {actions}
      </div>
    </header>
  )
}

/** 스크롤되는 페이지 본문 래퍼 */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">{children}</div>
}
