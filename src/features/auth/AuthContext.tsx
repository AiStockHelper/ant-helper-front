import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import {
  clearTokens,
  getTokens,
  setAuthFailureHandler,
  setTokenRefreshedHandler,
  setTokens,
} from '@/api/client'
import type { Me } from '@/api/types'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: Status
  user: Me | null
  /** 사용자가 직접 로그아웃/탈퇴한 경우 true. 이때는 돌아갈 경로를 기억하지 않는다. */
  signedOutByUser: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<Me | null>(null)
  const [signedOutByUser, setSignedOutByUser] = useState(false)
  const [status, setStatus] = useState<Status>(() => (getTokens() ? 'loading' : 'anonymous'))

  const reset = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  useEffect(() => {
    setAuthFailureHandler(reset)
    setTokenRefreshedHandler((member) => setUser(member))
    return () => {
      setAuthFailureHandler(null)
      setTokenRefreshedHandler(null)
    }
  }, [reset])

  useEffect(() => {
    if (!getTokens()) return
    let cancelled = false
    authApi
      .me()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch((e: { status?: number }) => {
        if (cancelled) return
        // 네트워크 오류면 토큰을 유지하고 익명 상태로 두어 로그인 화면에서 재시도하게 한다.
        if (e?.status === 401 || e?.status === 403) clearTokens()
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password })
      queryClient.clear()
      setTokens(tokens)
      setSignedOutByUser(false)
      setUser(tokens.member)
      setStatus('authenticated')
    },
    [queryClient],
  )

  const signup = useCallback(
    async (email: string, password: string, nickname: string) => {
      await authApi.signup({ email, password, nickname })
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 서버 오류여도 로컬 로그아웃은 진행
    }
    setSignedOutByUser(true)
    reset()
  }, [reset])

  const updateNickname = useCallback(async (nickname: string) => {
    const me = await authApi.updateMe({ nickname })
    setUser(me)
  }, [])

  const deleteAccount = useCallback(async () => {
    await authApi.deleteMe()
    setSignedOutByUser(true)
    reset()
  }, [reset])

  const value = useMemo(
    () => ({ status, user, signedOutByUser, login, signup, logout, updateNickname, deleteAccount }),
    [status, user, signedOutByUser, login, signup, logout, updateNickname, deleteAccount],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
