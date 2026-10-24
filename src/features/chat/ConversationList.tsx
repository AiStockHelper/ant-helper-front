import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react'
import { chatApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { dateGroup, type DateGroup } from '@/lib/format'
import type { Conversation } from '@/api/types'

const PAGE_SIZE = 30

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

interface Group {
  label: string
  items: Conversation[]
}

function groupConversations(list: Conversation[]): Group[] {
  const pinned = list.filter((c) => c.pinned)
  const rest = list.filter((c) => !c.pinned)
  const order: DateGroup[] = ['오늘', '어제', '지난 7일', '이전']
  const buckets = new Map<DateGroup, Conversation[]>()
  rest.forEach((c) => {
    const g = dateGroup(c.updatedAt)
    buckets.set(g, [...(buckets.get(g) ?? []), c])
  })
  const groups: Group[] = []
  if (pinned.length) groups.push({ label: '고정됨', items: pinned })
  order.forEach((g) => {
    const items = buckets.get(g)
    if (items?.length) groups.push({ label: g, items })
  })
  return groups
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (commit: boolean) => {
    if (finished.current) return
    finished.current = true
    const next = value.trim()
    onDone(commit && next && next !== initial ? next : null)
  }
  return (
    <input
      ref={ref}
      value={value}
      maxLength={100}
      aria-label="대화 이름"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
          e.preventDefault()
          finish(true)
        } else if (e.key === 'Escape') {
          finish(false)
        }
      }}
      className="mx-1 h-9 min-w-0 flex-1 rounded-lg border border-brand bg-surface px-2.5 text-sm outline-none"
    />
  )
}

function Item({
  c,
  active,
  onNavigate,
  onDelete,
}: {
  c: Conversation
  active: boolean
  onNavigate?: () => void
  onDelete: (c: Conversation) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [renaming, setRenaming] = useState(false)

  const patch = useMutation({
    mutationFn: (body: { title?: string; pinned?: boolean }) => chatApi.update(c.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (renaming) {
    return (
      <div className="flex items-center">
        <RenameInput
          initial={c.title}
          onDone={(title) => {
            setRenaming(false)
            if (title) patch.mutate({ title })
          }}
        />
      </div>
    )
  }

  return (
    <div className={cn('group relative flex items-center rounded-xl', active ? 'bg-surface-3' : 'hover:bg-surface-2')}>
      <NavLink
        to={`/chat/${c.id}`}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm md:min-h-[38px]"
      >
        {c.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-subtle" aria-label="고정됨" />}
        <span className={cn('truncate', active && 'font-semibold')}>{c.title || '새 대화'}</span>
      </NavLink>
      <Popover
        align="end"
        trigger={({ open, ...p }) => (
          <button
            {...p}
            aria-label={`${c.title} 메뉴`}
            className={cn(
              'mr-1 flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-surface-3 hover:text-fg md:h-8',
              open ? 'opacity-100' : 'md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100',
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuItem
              icon={<Pencil className="h-4 w-4 text-muted" />}
              label="이름 변경"
              onSelect={() => {
                close()
                setRenaming(true)
              }}
            />
            <MenuItem
              icon={c.pinned ? <PinOff className="h-4 w-4 text-muted" /> : <Pin className="h-4 w-4 text-muted" />}
              label={c.pinned ? '고정 해제' : '상단에 고정'}
              onSelect={() => {
                close()
                patch.mutate({ pinned: !c.pinned })
              }}
            />
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label="삭제"
              danger
              onSelect={() => {
                close()
                onDelete(c)
              }}
            />
          </>
        )}
      </Popover>
    </div>
  )
}

export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const match = useMatch('/chat/:conversationId')
  const activeId = match ? Number(match.params.conversationId) : null

  const [q, setQ] = useState('')
  const debounced = useDebounced(q.trim(), 300)
  const [toDelete, setToDelete] = useState<Conversation | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const query = useInfiniteQuery({
    queryKey: ['conversations', debounced],
    queryFn: ({ pageParam }) => chatApi.conversations({ q: debounced || undefined, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    placeholderData: (prev) => prev,
  })

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.content) ?? [], [query.data])
  const groups = useMemo(() => groupConversations(items), [items])

  const del = useMutation({
    mutationFn: (id: number) => chatApi.remove(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      if (activeId === id) navigate('/chat')
      setToDelete(null)
      toast.success('대화를 삭제했어요.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const delAll = useMutation({
    mutationFn: chatApi.removeAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      setConfirmAll(false)
      navigate('/chat')
      onNavigate?.()
      toast.success('모든 대화를 삭제했어요.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => {
            navigate('/chat')
            onNavigate?.()
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />새 채팅
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="대화 검색"
            aria-label="대화 검색"
            className="h-11 w-full rounded-xl border border-transparent bg-surface-2 pl-9 pr-9 text-sm placeholder:text-subtle focus:border-brand focus:outline-none md:h-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="검색어 지우기"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-subtle hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <nav aria-label="대화 이력" className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {query.isLoading ? (
          <div className="space-y-2 px-1 pt-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="px-3 py-6 text-center text-sm text-muted">
            <p>대화 목록을 불러오지 못했어요.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => query.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center text-sm text-subtle">
            <MessageSquare className="mb-2 h-6 w-6" aria-hidden />
            {debounced ? '검색 결과가 없어요.' : '아직 대화가 없어요.'}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-3" aria-label={g.label}>
              <h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-subtle">{g.label}</h3>
              <div className="space-y-0.5">
                {g.items.map((c) => (
                  <Item key={c.id} c={c} active={c.id === activeId} onNavigate={onNavigate} onDelete={setToDelete} />
                ))}
              </div>
            </section>
          ))
        )}
        {query.hasNextPage && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
            더 보기
          </Button>
        )}
      </nav>

      {items.length > 0 && !debounced && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setConfirmAll(true)}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-subtle hover:bg-surface-2 hover:text-danger md:min-h-[36px]"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            모든 대화 삭제
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="대화를 삭제할까요?"
        description={toDelete ? `“${toDelete.title}” 대화가 영구적으로 삭제됩니다.` : undefined}
        confirmLabel="삭제"
        destructive
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={confirmAll}
        title="모든 대화를 삭제할까요?"
        description="저장된 모든 대화와 메시지가 삭제되며 되돌릴 수 없습니다."
        confirmLabel="모두 삭제"
        destructive
        loading={delAll.isPending}
        onConfirm={() => delAll.mutate()}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  )
}
