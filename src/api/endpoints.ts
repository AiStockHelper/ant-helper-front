import { api, rawFetch, toApiError } from './client'
import { readSseStream } from './sse'
import type {
  Account,
  AccountDetail,
  AccountSummary,
  Action,
  AuthTokens,
  ChatStreamEvent,
  Conversation,
  ConversationDetail,
  CreateAccountRequest,
  LoginChallenge,
  Me,
  OrderHistoryItem,
  OrderRequestItem,
  StepUpChallenge,
  OrderScope,
  PageResponse,
  AgentTask,
  AgentTaskDetail,
  CreateAgentTaskRequest,
  UpdateAgentTaskRequest,
  Skill,
} from './types'

export const authApi = {
  signup: (body: { email: string; password: string; nickname: string }) =>
    api.post<{ id: number; email: string; nickname: string }>('/auth/signup', body, { auth: false }),
  login: (body: { email: string; password: string }) => api.post<LoginChallenge>('/auth/login', body, { auth: false }),
  verifyLogin: (body: { challengeId: string; code: string }) =>
    api.post<AuthTokens>('/auth/login/verify', body, { auth: false }),
  stepUpRequest: () => api.post<StepUpChallenge>('/auth/step-up/request'),
  stepUpVerify: (body: { challengeId: string; code: string }) => api.post<void>('/auth/step-up/verify', body),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<Me>('/auth/me'),
  updateMe: (body: { nickname: string }) => api.patch<Me>('/auth/me', body),
  deleteMe: () => api.delete<void>('/auth/me'),
}

export const accountsApi = {
  list: () => api.get<Account[]>('/accounts'),
  create: (body: CreateAccountRequest) => api.post<Account>('/accounts', body),
  detail: (id: number) => api.get<AccountDetail>(`/accounts/${id}`),
  update: (id: number, body: { alias?: string; isDefault?: boolean }) => api.patch<Account>(`/accounts/${id}`, body),
  remove: (id: number) => api.delete<void>(`/accounts/${id}`),
  summary: (id: number) => api.get<AccountSummary>(`/accounts/${id}/summary`),
  orders: (id: number, p: { from: string; to: string; page: number; size: number; scope?: OrderScope }) =>
    api.get<PageResponse<OrderHistoryItem>>(
      `/accounts/${id}/orders?from=${p.from}&to=${p.to}&page=${p.page}&size=${p.size}&scope=${p.scope ?? 'DOMESTIC'}`,
    ),
}

export const marketApi = {
  /** 1달러가 몇 원인지. 구하지 못하면 usdKrw 가 null */
  exchangeRate: (accountId?: number) =>
    api.get<{ usdKrw: number | null; source: string | null; asOf: string | null }>('/stocks/exchange-rate' + (accountId != null ? '?accountId=' + accountId : '')),
}

export const skillsApi = {
  list: () => api.get<Skill[]>('/skills'),
}

export const agentApi = {
  list: (p: { accountId?: number; skillId?: string; status?: string } = {}) => {
    const q = new URLSearchParams()
    if (p.accountId != null) q.set('accountId', String(p.accountId))
    if (p.skillId) q.set('skillId', p.skillId)
    if (p.status) q.set('status', p.status)
    const qs = q.toString()
    return api.get<AgentTask[]>(`/agent/tasks${qs ? `?${qs}` : ''}`)
  },
  create: (body: CreateAgentTaskRequest) => api.post<AgentTask>('/agent/tasks', body),
  detail: (id: number) => api.get<AgentTaskDetail>(`/agent/tasks/${id}`),
  pause: (id: number) => api.post<AgentTask>(`/agent/tasks/${id}/pause`),
  resume: (id: number) => api.post<AgentTask>(`/agent/tasks/${id}/resume`),
  runNow: (id: number) => api.post<void>(`/agent/tasks/${id}/run`),
  liquidate: (id: number) => api.post<{ orders: number; lines: string[] }>(`/agent/tasks/${id}/liquidate`),
  cancel: (id: number) => api.delete<AgentTask>(`/agent/tasks/${id}`),
  /** 걸어 둔 지시(정리본)·제목 수정. mode=APPEND 면 기존 정리본 뒤에 추가 지시로 덧붙인다. */
  update: (id: number, body: UpdateAgentTaskRequest) => api.patch<AgentTask>(`/agent/tasks/${id}`, body),
  pauseAll: () => api.post<{ paused: number }>('/agent/pause-all'),
}
export const orderQueueApi = {
  list: (p: { accountId?: number; status?: 'PENDING' | 'FAILED' | 'SUCCESS' } = {}) => {
    const q = new URLSearchParams()
    if (p.accountId != null) q.set('accountId', String(p.accountId))
    if (p.status) q.set('status', p.status)
    const qs = q.toString()
    return api.get<OrderRequestItem[]>('/order-requests' + (qs ? '?' + qs : ''))
  },
  remove: (id: number) => api.delete<void>('/order-requests/' + id),
  removeFailed: (accountId?: number) => api.delete<{ deleted: number }>('/order-requests' + (accountId != null ? '?accountId=' + accountId : '')),
}

export const chatApi = {
  conversations: (p: { q?: string; page: number; size: number }) => {
    const q = new URLSearchParams({ page: String(p.page), size: String(p.size) })
    if (p.q) q.set('q', p.q)
    return api.get<PageResponse<Conversation>>(`/chat/conversations?${q.toString()}`)
  },
  create: (body: { accountId?: number | null }) => api.post<Conversation>('/chat/conversations', body),
  get: (id: number) => api.get<ConversationDetail>(`/chat/conversations/${id}`),
  update: (id: number, body: { title?: string; pinned?: boolean; accountId?: number | null }) =>
    api.patch<Conversation>(`/chat/conversations/${id}`, body),
  remove: (id: number) => api.delete<void>(`/chat/conversations/${id}`),
  removeAll: () => api.delete<void>('/chat/conversations'),
  suggestions: () => api.get<string[]>('/chat/suggestions'),
  approve: (id: number) => api.post<Action>(`/chat/actions/${id}/approve`),
  reject: (id: number) => api.post<Action>(`/chat/actions/${id}/reject`),
  getAction: (id: number) => api.get<Action>(`/chat/actions/${id}`),
}

export interface StreamHandle {
  onEvent: (ev: ChatStreamEvent) => void
  signal: AbortSignal
}

async function stream(path: string, body: unknown, { onEvent, signal }: StreamHandle) {
  const res = await rawFetch(path, {
    method: 'POST',
    body: body ?? {},
    signal,
    headers: { Accept: 'text/event-stream' },
  })
  if (!res.ok) throw await toApiError(res)
  if (!res.body) throw new Error('스트림을 열 수 없습니다.')
  await readSseStream(res.body, ({ event, data }) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    onEvent({ event, data: parsed } as ChatStreamEvent)
  })
}

export const chatStream = {
  send: (
    conversationId: number,
    body: { content: string; accountId?: number | null; editMessageId?: number },
    handle: StreamHandle,
  ) => stream(`/chat/conversations/${conversationId}/messages`, body, handle),
  regenerate: (conversationId: number, handle: StreamHandle) =>
    stream(`/chat/conversations/${conversationId}/regenerate`, {}, handle),
}
