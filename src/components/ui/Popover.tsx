import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

interface PopoverProps {
  trigger: (props: {
    ref: (el: HTMLElement | null) => void
    onClick: () => void
    'aria-haspopup': 'menu' | 'listbox'
    'aria-expanded': boolean
    'aria-controls': string | undefined
    open: boolean
  }) => ReactNode
  children: (ctx: { close: () => void }) => ReactNode
  align?: 'start' | 'end'
  role?: 'menu' | 'listbox'
  width?: number | 'trigger'
  className?: string
}

interface Pos {
  top?: number
  bottom?: number
  left?: number
  right?: number
  minWidth?: number
  maxHeight: number
}

/** 포털 + fixed 위치 팝오버. 스크롤 컨테이너 안에서도 잘리지 않는다. */
export function Popover({ trigger, children, align = 'start', role = 'menu', width, className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus?.()
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow
    const next: Pos = {
      maxHeight: Math.max(160, Math.min(360, (openUp ? spaceAbove : spaceBelow) - 16)),
    }
    if (openUp) next.bottom = vh - r.top + 6
    else next.top = r.bottom + 6
    if (align === 'end') next.right = Math.max(8, vw - r.right)
    else next.left = Math.max(8, Math.min(r.left, vw - 8 - 200))
    if (width === 'trigger') next.minWidth = r.width
    else if (typeof width === 'number') next.minWidth = width
    setPos(next)
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, close])

  useEffect(() => {
    if (open && pos) {
      const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"],[role="option"]')
      first?.focus()
    }
  }, [open, pos])

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="option"]') ?? [])
    if (items.length === 0) return
    e.preventDefault()
    const idx = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
    items[next].focus()
  }

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el
        },
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': role,
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        open,
      })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role={role}
            onKeyDown={onPanelKey}
            style={pos ?? { visibility: 'hidden', top: 0, left: 0, maxHeight: 300 }}
            className={cn(
              'fixed z-[95] min-w-[10rem] max-w-[calc(100vw-1rem)] animate-pop-in overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop',
              className,
            )}
          >
            {children({ close })}
          </div>,
          document.body,
        )}
    </>
  )
}

interface MenuItemProps {
  icon?: ReactNode
  label: string
  onSelect: () => void
  danger?: boolean
  role?: 'menuitem' | 'option'
  selected?: boolean
  className?: string
  children?: ReactNode
}

export function MenuItem({ icon, label, onSelect, danger, role = 'menuitem', selected, className, children }: MenuItemProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? !!selected : undefined}
      onClick={onSelect}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm md:min-h-[36px]',
        'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
        danger ? 'text-danger' : 'text-fg',
        selected && 'bg-surface-2',
        className,
      )}
    >
      {icon}
      {children ?? <span className="min-w-0 flex-1 truncate">{label}</span>}
    </button>
  )
}
