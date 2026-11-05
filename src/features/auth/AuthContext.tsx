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
import type { LoginChallenge, Me } from '@/api/types'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: Status
  user: Me | null
  /** 사용자가 직접 로그아웃/탈퇴한 경우 true. 이때는 돌아갈 경로를 기억하지 않는다. */
  signedOutByUser: boolean
  /** 1단계: 비밀번호 확인 후 이메일로 인증번호를 보낸다. */
  login: (email: string, password: string) => Promise<LoginChallenge>
  /** 2단계: 이메일로 받은 6자리 인증번호로 로그인을 마친다. */
  verifyLogin: (challengeId: string, code: string) => Promise<void>
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

  const login = useCallback((email: string, password: string) => authApi.login({ email, password }), [])

  const verifyLogin = useCallback(
    async (challengeId: string, code: string) => {
      const tokens = await authApi.verifyLogin({ challengeId, code })
      queryClient.clear()
      setTokens(tokens)
      setSignedOutByUser(false)
      setUser(tokens.member)
      setStatus('authenticated')
    },
    [queryClient],
  )

  /** 가입만 한다. 로그인은 이메일 인증번호 단계를 거쳐야 하므로 호출한 쪽이 로그인 화면으로 보낸다. */
  const signup = useCallback(async (email: string, password: string, nickname: string) => {
    await authApi.signup({ email, password, nickname })
  }, [])
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
    () => ({ status, user, signedOutByUser, login, verifyLogin, signup, logout, updateNickname, deleteAccount }),
    [status, user, signedOutByUser, login, verifyLogin, signup, logout, updateNickname, deleteAccount],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
