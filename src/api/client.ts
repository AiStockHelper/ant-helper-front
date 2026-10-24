import type { ApiEnvelope, AuthTokens, Me } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const TOKEN_KEY = 'ant.auth'

interface StoredTokens {
  accessToken: string
  refreshToken: string
}

export class ApiError extends Error {
  status: number
  code?: string
  reasons?: string[]

  constructor(status: number, message: string, code?: string, reasons?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.reasons = reasons
  }

  get isNetwork() {
    return this.status === 0
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function getTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredTokens) : null
  } catch {
    return null
  }
}

export function setTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }))
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
}

let authFailureHandler: (() => void) | null = null
let tokenRefreshedHandler: ((member: Me) => void) | null = null

export function setAuthFailureHandler(fn: (() => void) | null) {
  authFailureHandler = fn
}

export function setTokenRefreshedHandler(fn: ((member: Me) => void) | null) {
  tokenRefreshedHandler = fn
}

let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const tokens = getTokens()
  if (!tokens?.refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
    if (!res.ok) return false
    const body = (await res.json()) as ApiEnvelope<AuthTokens>
    if (!body.isSuccess || !body.data) return false
    setTokens(body.data)
    if (body.data.member) tokenRefreshedHandler?.(body.data.member)
    return true
  } catch {
    return false
  }
}

/** 동시에 여러 요청이 401 을 받아도 refresh 는 한 번만 보낸다. */
function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

export interface RawOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  auth?: boolean
  headers?: Record<string, string>
}

/** 인증 헤더 + 401 시 refresh 1회 재시도. Response 를 그대로 돌려준다. */
export async function rawFetch(path: string, opts: RawOptions = {}): Promise<Response> {
  const auth = opts.auth !== false
  const send = () => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    const token = getTokens()?.accessToken
    if (auth && token) headers.Authorization = `Bearer ${token}`
    return fetch(`${API_BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  }

  const guarded = async () => {
    try {
      return await send()
    } catch (e) {
      if (isAbortError(e)) throw e
      throw new ApiError(0, '네트워크 연결을 확인해 주세요.', 'NETWORK')
    }
  }

  let res = await guarded()
  if (res.status === 401 && auth) {
    const ok = await refreshOnce()
    if (ok) {
      res = await guarded()
    }
    if (!ok || res.status === 401) {
      clearTokens()
      authFailureHandler?.()
      throw new ApiError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.', 'S-001')
    }
  }
  return res
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiEnvelope<unknown>> | null = null
  try {
    body = (await res.json()) as Partial<ApiEnvelope<unknown>>
  } catch {
    body = null
  }
  const message = body?.message || defaultMessage(res.status)
  return new ApiError(res.status, message, body?.code, body?.reasons)
}

function defaultMessage(status: number): string {
  if (status === 401) return '인증이 필요합니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return '요청한 항목을 찾을 수 없습니다.'
  if (status >= 500) return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  return '요청을 처리하지 못했습니다.'
}

async function request<T>(method: string, path: string, body?: unknown, opts: Omit<RawOptions, 'method' | 'body'> = {}) {
  const res = await rawFetch(path, { ...opts, method, body })
  if (!res.ok) throw await toApiError(res)
  const text = await res.text()
  if (!text) return undefined as T
  let json: ApiEnvelope<T>
  try {
    json = JSON.parse(text) as ApiEnvelope<T>
  } catch {
    throw new ApiError(res.status, '서버 응답을 해석하지 못했습니다.')
  }
  if (json.isSuccess === false) {
    throw new ApiError(res.status, json.message || defaultMessage(res.status), json.code, json.reasons)
  }
  return json.data as T
}

export const api = {
  get: <T>(path: string, opts?: Omit<RawOptions, 'method' | 'body'>) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RawOptions, 'method' | 'body'>) =>
    request<T>('POST', path, body ?? undefined, opts),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export function errorMessage(e: unknown, fallback = '문제가 발생했습니다. 다시 시도해 주세요.'): string {
  if (e instanceof ApiError) {
    const extra = e.reasons?.length ? ` (${e.reasons.join(', ')})` : ''
    return `${e.message}${extra}`
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}
