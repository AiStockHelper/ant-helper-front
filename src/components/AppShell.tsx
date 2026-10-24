import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Landmark, MessageSquare, PieChart, Settings, X, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { ConversationList } from '@/features/chat/ConversationList'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/cn'

const NAV: { to: string; label: string; short: string; icon: LucideIcon }[] = [
  { to: '/chat', label: '채팅', short: '채팅', icon: MessageSquare },
  { to: '/portfolio', label: '내 계좌', short: '내 계좌', icon: PieChart },
  { to: '/accounts', label: '계좌 관리', short: '계좌', icon: Landmark },
  { to: '/settings', label: '설정', short: '설정', icon: Settings },
]

export interface ShellContext {
  openDrawer: () => void
}

export function useShell() {
  return useOutletContext<ShellContext>()
}

function SideNav() {
  return (
    <nav aria-label="주요 메뉴" className="grid gap-0.5 px-3">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-soft text-brand-text' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserChip() {
  const { user } = useAuth()
  return (
    <NavLink
      to="/settings"
      className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-border px-3 py-2 hover:bg-surface-2"
      aria-label="내 정보 및 설정"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-text">
        {user?.nickname?.slice(0, 1) ?? '?'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{user?.nickname}</span>
        <span className="block truncate text-xs text-subtle">{user?.email}</span>
      </span>
    </NavLink>
  )
}

function TabBar() {
  return (
    <nav
      aria-label="하단 메뉴"
      className="mobile-tabbar z-30 shrink-0 border-t border-border bg-surface/95 pb-safe backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ to, short, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  isActive ? 'text-brand-text' : 'text-subtle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-[22px] w-[22px]', isActive && 'stroke-[2.4]')} aria-hidden />
                  {short}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()

  useEffect(() => setDrawer(false), [location.pathname])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface py-4 md:flex">
        <Logo className="mb-4 px-5" />
        <SideNav />
        <div className="mx-3 my-3 h-px bg-border" />
        <ConversationList />
        <UserChip />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="relative flex min-h-0 flex-1 flex-col">
          <Outlet context={{ openDrawer: () => setDrawer(true) } satisfies ShellContext} />
        </main>
        <TabBar />
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="대화 이력">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-[320px] animate-slide-in-left flex-col bg-surface pb-safe pt-safe shadow-pop">
            <div className="flex items-center justify-between px-4 py-3">
              <Logo />
              <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="닫기">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ConversationList onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
