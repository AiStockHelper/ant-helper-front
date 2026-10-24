import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi, chatStream } from '@/api/endpoints'
import { ApiError, errorMessage, isAbortError } from '@/api/client'
import type { Action, ChatStreamEvent, Conversation, Message } from '@/api/types'

export type ChatMessage = Message & { _key?: string }

export interface StreamErrorState {
  message: string
  network: boolean
}

interface Options {
  conversationId: number | undefined
  getAccountId: () => number | null | undefined
  navigateToConversation: (id: number) => void
}

type Attempt =
  | { kind: 'send'; text: string; editMessageId?: number }
  | { kind: 'regenerate' }

let tempSeq = 0

function tempMessage(role: Message['role'], content: string): ChatMessage {
  return {
    id: -(++tempSeq),
    _key: `tmp-${tempSeq}`,
    role,
    content,
    status: role === 'ASSISTANT' ? 'STREAMING' : 'COMPLETE',
    toolCalls: [],
    cards: [],
    actions: [],
    model: null,
    createdAt: new Date().toISOString(),
  }
}

function stripMessages(c: Conversation & { messages?: Message[] }): Conversation {
  const { messages: _messages, ...rest } = c
  return rest
}

export function useChat({ conversationId, getAccountId, navigateToConversation }: Options) {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState<StreamErrorState | null>(null)
  const [authId, setAuthId] = useState<number | null>(null)
  const [prevId, setPrevId] = useState(conversationId)
  const [loadedData, setLoadedData] = useState<unknown>(null)

  const abortRef = useRef<AbortController | null>(null)
  const runRef = useRef(0)
  const streamConvRef = useRef<number | null>(null)
  const streamingRef = useRef(false)
  const attemptRef = useRef<Attempt | null>(null)
  const metaRef = useRef(false)
  const idRef = useRef(conversationId)
  const getAccountRef = useRef(getAccountId)
  idRef.current = conversationId
  getAccountRef.current = getAccountId

  // 대화가 바뀌면 이전 대화의 상태를 비운다. (방금 만든 대화로 이동하는 경우는 유지)
  if (prevId !== conversationId) {
    setPrevId(conversationId)
    if (conversationId !== authId) {
      setAuthId(null)
      setMessages([])
      setConversation(null)
      setStreamError(null)
      setLoadedData(null)
    }
  }

  const needsLoad = conversationId != null && conversationId !== authId
  const query = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => chatApi.get(conversationId as number),
    enabled: needsLoad,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
  })

  if (query.data && needsLoad && query.data !== loadedData && !streamingRef.current && query.data.id === conversationId) {
    setLoadedData(query.data)
    setMessages(query.data.messages)
    setConversation(stripMessages(query.data))
  }

  useEffect(() => {
    if (streamConvRef.current != null && conversationId !== streamConvRef.current) {
      runRef.current++
      abortRef.current?.abort()
      streamConvRef.current = null
      streamingRef.current = false
      setStreaming(false)
    }
  }, [conversationId])

  useEffect(
    () => () => {
      runRef.current++
      abortRef.current?.abort()
    },
    [],
  )

  const runStream = useCallback(
    async (attempt: Attempt) => {
      if (streamingRef.current) return
      attemptRef.current = attempt
      metaRef.current = false
      streamingRef.current = true
      setStreaming(true)
      setStreamError(null)

      const run = ++runRef.current
      const controller = new AbortController()
      abortRef.current = controller
      const alive = () => runRef.current === run

      let assistantId = 0
      let pending = ''
      let raf = 0
      let finished = false

      const patch = (fn: (m: ChatMessage) => ChatMessage) => {
        if (!alive()) return
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)))
      }
      const flush = () => {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        if (!pending) return
        const text = pending
        pending = ''
        patch((m) => ({ ...m, content: m.content + text }))
      }

      const tmpUser = attempt.kind === 'send' ? tempMessage('USER', attempt.text) : null
      const tmpAssistant = tempMessage('ASSISTANT', '')
      assistantId = tmpAssistant.id

      setMessages((prev) => {
        let base = prev
        if (attempt.kind === 'send') {
          if (attempt.editMessageId != null) {
            const i = prev.findIndex((m) => m.id === attempt.editMessageId)
            if (i >= 0) base = prev.slice(0, i)
          }
        } else {
          let lastUser = -1
          prev.forEach((m, i) => {
            if (m.role === 'USER') lastUser = i
          })
          base = lastUser >= 0 ? prev.slice(0, lastUser + 1) : prev
        }
        return [...base, ...(tmpUser ? [tmpUser] : []), tmpAssistant]
      })

      const onEvent = (ev: ChatStreamEvent) => {
        if (!alive()) return
        if (ev.event !== 'delta') flush()
        switch (ev.event) {
          case 'meta': {
            metaRef.current = true
            const { conversation: conv, userMessage, assistantMessageId } = ev.data
            const tmpAssistantId = assistantId
            assistantId = assistantMessageId
            setConversation(conv)
            setMessages((prev) =>
              prev.map((m) => {
                if (tmpUser && m.id === tmpUser.id) return { ...userMessage, _key: m._key }
                if (m.id === tmpAssistantId) return { ...m, id: assistantMessageId }
                return m
              }),
            )
            qc.invalidateQueries({ queryKey: ['conversations'] })
            break
          }
          case 'delta':
            pending += ev.data.text
            if (!raf) raf = requestAnimationFrame(flush)
            break
          case 'tool':
            patch((m) => {
              const exists = m.toolCalls.some((t) => t.id === ev.data.id)
              return {
                ...m,
                toolCalls: exists ? m.toolCalls.map((t) => (t.id === ev.data.id ? { ...t, ...ev.data } : t)) : [...m.toolCalls, ev.data],
              }
            })
            break
          case 'card':
            patch((m) => ({ ...m, cards: [...m.cards, ev.data] }))
            break
          case 'action':
            patch((m) => ({
              ...m,
              actions: m.actions.some((a) => a.id === ev.data.id)
                ? m.actions.map((a) => (a.id === ev.data.id ? ev.data : a))
                : [...m.actions, ev.data],
            }))
            break
          case 'title':
            setConversation((c) => (c ? { ...c, title: ev.data.title } : c))
            qc.invalidateQueries({ queryKey: ['conversations'] })
            break
          case 'done':
            finished = true
            patch((m) => ({ ...ev.data.message, _key: m._key }))
            break
          case 'error':
            finished = true
            patch((m) => ({ ...m, status: 'ERROR' }))
            setStreamError({ message: ev.data.message || '응답을 생성하지 못했습니다.', network: false })
            break
        }
      }

      try {
        let convId = idRef.current
        if (convId == null) {
          const created = await chatApi.create({ accountId: getAccountRef.current() ?? undefined })
          if (!alive()) return
          convId = created.id
          setConversation(created)
          setAuthId(created.id)
          streamConvRef.current = created.id
          qc.invalidateQueries({ queryKey: ['conversations'] })
          navigateToConversation(created.id)
        }
        streamConvRef.current = convId
        const handle = { signal: controller.signal, onEvent }
        if (attempt.kind === 'send') {
          await chatStream.send(
            convId,
            { content: attempt.text, accountId: getAccountRef.current() ?? undefined, editMessageId: attempt.editMessageId },
            handle,
          )
        } else {
          await chatStream.regenerate(convId, handle)
        }
        flush()
        if (!finished && alive()) {
          patch((m) => ({ ...m, status: m.content || m.cards.length ? 'STOPPED' : 'ERROR' }))
          setStreamError({ message: '응답이 중간에 끊겼습니다.', network: false })
        }
      } catch (e) {
        flush()
        if (!alive()) return
        if (isAbortError(e)) {
          patch((m) => ({ ...m, status: 'STOPPED' }))
        } else {
          const network = (e instanceof ApiError && e.isNetwork) || e instanceof TypeError || !navigator.onLine
          patch((m) => ({ ...m, status: 'ERROR' }))
          setStreamError({
            message: network ? '네트워크 연결이 끊어졌습니다. 연결을 확인한 뒤 다시 시도해 주세요.' : errorMessage(e, '응답을 생성하지 못했습니다.'),
            network,
          })
        }
      } finally {
        if (raf) cancelAnimationFrame(raf)
        if (alive()) {
          streamingRef.current = false
          streamConvRef.current = null
          abortRef.current = null
          setStreaming(false)
          qc.invalidateQueries({ queryKey: ['conversations'] })
          qc.invalidateQueries({ queryKey: ['summary'] })
          qc.invalidateQueries({ queryKey: ['orders'] })
          qc.invalidateQueries({ queryKey: ['scheduled'] })
        }
      }
    },
    [navigateToConversation, qc],
  )

  const send = useCallback((content: string, editMessageId?: number) => {
    const text = content.trim()
    if (!text) return
    void runStream({ kind: 'send', text, editMessageId })
  }, [runStream])

  const regenerate = useCallback(() => void runStream({ kind: 'regenerate' }), [runStream])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  /** 실패 후 재시도. 서버에 사용자 메시지가 저장됐으면(meta 수신) 재생성, 아니면 그대로 다시 전송 */
  const retry = useCallback(() => {
    const attempt = attemptRef.current
    if (!attempt || streamingRef.current) return
    if (attempt.kind === 'send' && !metaRef.current) {
      setMessages((prev) => {
        const next = [...prev]
        while (next.length && next[next.length - 1].id < 0) next.pop()
        return next
      })
      void runStream(attempt)
    } else {
      void runStream({ kind: 'regenerate' })
    }
  }, [runStream])
  const updateAction = useCallback((action: Action) => {
    setMessages((prev) =>
      prev.map((m) => (m.actions.some((a) => a.id === action.id) ? { ...m, actions: m.actions.map((a) => (a.id === action.id ? action : a)) } : m)),
    )
  }, [])

  return {
    messages,
    conversation,
    setConversation,
    streaming,
    streamError,
    loading: needsLoad && query.isPending,
    loadError: needsLoad && query.isError ? query.error : null,
    reload: query.refetch,
    send,
    regenerate,
    stop,
    retry,
    updateAction,
  }
}
