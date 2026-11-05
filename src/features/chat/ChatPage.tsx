import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, MessageSquarePlus, Menu, RefreshCw, WifiOff, Landmark, AlertCircle } from 'lucide-react'
import { chatApi } from '@/api/endpoints'
import { ApiError, errorMessage } from '@/api/client'
import { AccountSelect } from '@/components/AccountSelect'
import { useShell } from '@/components/AppShell'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useAccounts } from '@/features/accounts/useAccounts'
import { cn } from '@/lib/cn'
import { formatDayDivider, sameDay } from '@/lib/format'
import { ChatUiContext } from './ChatContext'
import { Composer } from './Composer'
import { MessageItem } from './MessageItem'
import { useChat } from './useChat'

const FALLBACK_SUGGESTIONS = ['삼성전자 주가 알려줘', '내 계좌 잔고 보여줘', '내일 오를 만한 종목 추천해줘', '삼성전자 10주 사줘']
const DRAFT_ACCOUNT_KEY = 'ant.chat.account'

/** 날짜가 바뀌는 곳에 들어가는 구분선 ("2026년 11월 5일 목요일") */
function DayDivider({ iso }: { iso: string }) {
  const text = formatDayDivider(iso)
  if (!text) return null
  return (
    <div className="flex justify-center" role="separator" aria-label={text}>
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{text}</span>
    </div>
  )
}
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function MessageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="대화를 불러오는 중">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-2/5 rounded-2xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

export function ChatPage() {
  const params = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { openDrawer } = useShell()
  const online = useOnline()
  const { accounts, defaultAccount, isSuccess: accountsLoaded } = useAccounts()

  const rawId = params.conversationId
  const parsedId = rawId != null ? Number(rawId) : undefined
  const invalidId = rawId != null && !Number.isInteger(parsedId)
  const conversationId = invalidId ? undefined : parsedId

  const [draftAccountId, setDraftAccountId] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(DRAFT_ACCOUNT_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  })

  const resolveAccount = (id: number | null | undefined) => accounts.find((a) => a.id === id) ?? null
  const [accountOverride, setAccountOverride] = useState<number | null>(null)

  const navigateToConversation = useCallback((id: number) => navigate(`/chat/${id}`, { replace: true }), [navigate])

  // 계좌는 useChat 이 반환하는 conversation 에 의존하므로 ref 로 최신 값을 전달한다.
  const accountIdRef = useRef<number | null>(null)
  const getAccountId = useCallback(() => accountIdRef.current, [])
  const chat = useChat({ conversationId, getAccountId, navigateToConversation })
  const { messages, conversation, streaming, streamError, loading, loadError } = chat

  const baseAccountId = conversationId != null ? conversation?.accountId ?? null : draftAccountId
  const selectedAccount =
    resolveAccount(accountOverride) ?? resolveAccount(baseAccountId) ?? defaultAccount
  const selectedAccountId = selectedAccount?.id ?? null
  accountIdRef.current = selectedAccountId
  const real = selectedAccount?.accountType === 'REAL_TRADE'

  useEffect(() => setAccountOverride(null), [conversationId, conversation?.accountId])

  const changeAccount = async (id: number) => {
    setAccountOverride(id)
    if (conversation) {
      try {
        const updated = await chatApi.update(conversation.id, { accountId: id })
        chat.setConversation(updated)
      } catch (e) {
        setAccountOverride(null)
        toast.error(errorMessage(e))
      }
    } else {
      setDraftAccountId(id)
      localStorage.setItem(DRAFT_ACCOUNT_KEY, String(id))
    }
  }

  const suggestions = useQuery({ queryKey: ['suggestions'], queryFn: chatApi.suggestions, staleTime: 5 * 60_000, retry: 1 })

  // ── 스크롤 ─────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    stick.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setShowJump(false)
  }, [])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    stick.current = dist < 80
    setShowJump(dist > 240)
  }

  useEffect(() => {
    const content = contentRef.current
    const el = scrollRef.current
    if (!content || !el) return
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [conversationId, scrollToBottom])

  const { send: chatSend } = chat
  const handleSend = useCallback(
    (text: string) => {
      stick.current = true
      chatSend(text)
      requestAnimationFrame(() => scrollToBottom())
    },
    [chatSend, scrollToBottom],
  )

  const handleEdit = useCallback(
    (content: string, messageId: number) => {
      stick.current = true
      chatSend(content, messageId)
    },
    [chatSend],
  )

  const ui = useMemo(() => ({ sendMessage: (t: string) => handleSend(t), busy: streaming }), [handleSend, streaming])

  useEffect(() => {
    document.title = conversation?.title && conversationId ? `${conversation.title} · Ant Helper` : 'Ant Helper · 개미 헬퍼'
  }, [conversation?.title, conversationId])

  if (invalidId) return <Navigate to="/chat" replace />

  const notFound = loadError instanceof ApiError && loadError.status === 404
  const isEmpty = messages.length === 0 && !loading && !loadError
  const lastIdx = messages.length - 1
  const title = conversationId ? conversation?.title || '대화' : '새 채팅'

  return (
    <ChatUiContext.Provider value={ui}>
    <div className="flex h-full min-h-0 flex-col">
      <header className="z-20 flex shrink-0 items-center gap-1.5 border-b border-border bg-bg/90 px-2 pt-safe backdrop-blur md:px-5">
        <div className="flex h-14 w-full items-center gap-1.5">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={openDrawer} aria-label="대화 이력 열기">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate px-1 text-base font-semibold md:text-lg">{title}</h1>
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={changeAccount}
            align="end"
            size="sm"
            disabled={streaming}
          />
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chat')} aria-label="새 채팅">
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {accountsLoaded && accounts.length === 0 && (
        <div className="shrink-0 border-b border-brand/20 bg-brand-soft px-4 py-2.5" role="status">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Landmark className="h-5 w-5 shrink-0 text-brand-text" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">증권 계좌를 등록해 주세요.</span>{' '}
              <span className="text-muted">시세 조회와 주문 기능은 계좌 연결 후 사용할 수 있어요.</span>
            </p>
            <Link
              to="/accounts"
              className="flex h-11 shrink-0 items-center rounded-xl bg-brand px-3.5 text-sm font-medium text-brand-fg hover:bg-brand-hover md:h-9"
            >
              계좌 등록
            </Link>
          </div>
        </div>
      )}

      {!online && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning" role="alert">
          <WifiOff className="h-4 w-4" aria-hidden />
          오프라인 상태입니다. 연결되면 다시 시도할 수 있어요.
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin h-full overflow-y-auto overscroll-contain">
          <div ref={contentRef} className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
            {loading ? (
              <MessageSkeleton />
            ) : loadError ? (
              <div className="flex flex-col items-center py-20 text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-subtle" aria-hidden />
                <p className="font-semibold">{notFound ? '대화를 찾을 수 없어요' : '대화를 불러오지 못했어요'}</p>
                <p className="mt-1 text-sm text-muted">{notFound ? '삭제되었거나 접근 권한이 없는 대화입니다.' : errorMessage(loadError)}</p>
                <div className="mt-4 flex gap-2">
                  {!notFound && (
                    <Button variant="outline" onClick={() => chat.reload()}>
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      다시 시도
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => navigate('/chat')}>
                    새 채팅
                  </Button>
                </div>
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center pb-6 pt-[8vh] text-center">
                <LogoMark className="h-14 w-14" />
                <h2 className="mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">
                  {user?.nickname ? `${user.nickname}님, ` : ''}무엇을 도와드릴까요?
                </h2>
                <p className="mt-2 text-sm text-muted">시세 조회, 예측, 주문, 예약 주문까지 채팅으로 말해 보세요.</p>
                <ul className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2" aria-label="예시 질문">
                  {(suggestions.data?.length ? suggestions.data : FALLBACK_SUGGESTIONS).slice(0, 6).map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => handleSend(s)}
                        disabled={streaming}
                        className="min-h-[48px] w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm shadow-card transition-colors hover:border-brand/50 hover:bg-brand-soft disabled:opacity-60"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-7" role="log" aria-live="off" aria-label="대화 내용">
                {messages.map((m, i) => (
                  <Fragment key={m._key ?? m.id}>
                    {(i === 0 || !sameDay(messages[i - 1].createdAt, m.createdAt)) && <DayDivider iso={m.createdAt} />}
                    <MessageItem
                      message={m}
                      isLast={i === lastIdx}
                      live={streaming && i === lastIdx && m.role === 'ASSISTANT'}
                      busy={streaming}
                      onRegenerate={chat.regenerate}
                      onEdit={handleEdit}
                      onActionChange={chat.updateAction}
                    />
                  </Fragment>
                ))}
                {streamError && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
                  >
                    {streamError.network ? <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />}
                    <span className="min-w-0 flex-1">{streamError.message}</span>
                    <Button size="sm" variant="outline" onClick={chat.retry} disabled={streaming}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      다시 시도
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="맨 아래로 이동"
          className={cn(
            'absolute bottom-3 left-1/2 flex h-11 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-pop transition-all md:h-9',
            showJump ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          )}
          tabIndex={showJump ? 0 : -1}
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
          {streaming ? '새 답변 보기' : '아래로'}
        </button>
      </div>

      <Composer
        onSend={handleSend}
        onStop={chat.stop}
        streaming={streaming}
        disabled={loading || !!loadError || !online}
        real={real}
        focusKey={conversationId}
      />
    </div>
    </ChatUiContext.Provider>
  )
}
