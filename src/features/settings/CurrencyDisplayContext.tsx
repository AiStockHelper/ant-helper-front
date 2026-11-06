import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { marketApi } from '@/api/endpoints'
import { useAuth } from '@/features/auth/AuthContext'
import { setUsdDisplay, type UsdDisplay } from '@/lib/format'

const KEY = 'ant.usdDisplay'

interface Value {
  mode: UsdDisplay
  setMode: (m: UsdDisplay) => void
  /** 1달러가 몇 원인지. 아직 못 구했으면 null(이때는 달러로 보여 준다) */
  rate: number | null
  rateSource: string | null
}

const Ctx = createContext<Value | null>(null)

function readMode(): UsdDisplay {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'KRW' || v === 'BOTH' ? v : 'USD'
  } catch {
    return 'USD'
  }
}

/**
 * 해외(달러) 종목의 금액을 달러/원화 환산/함께 중에서 골라 보는 설정. 금액 표기는 format.ts 의 formatMoney 가 이 값을 따른다.
 * 금액 문자열을 만드는 곳이 많아서, 설정이나 환율이 바뀌면 하위 화면을 한 번 다시 그린다.
 */
export function CurrencyDisplayProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [mode, setModeState] = useState<UsdDisplay>(readMode)
  const q = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: () => marketApi.exchangeRate(),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
  const rate = q.data?.usdKrw ?? null
  // 렌더 중에 먼저 반영해야 아래 화면이 같은 값으로 그려진다.
  setUsdDisplay(mode, rate)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* 저장 못 해도 이번 접속에서는 동작 */
    }
  }, [mode])

  const setMode = useCallback((m: UsdDisplay) => setModeState(m), [])
  const value = useMemo(() => ({ mode, setMode, rate, rateSource: q.data?.source ?? null }), [mode, setMode, rate, q.data?.source])
  return (
    <Ctx.Provider value={value}>
      <Fragment key={`${mode}:${rate ? Math.round(rate) : 'x'}`}>{children}</Fragment>
    </Ctx.Provider>
  )
}

export function useCurrencyDisplay(): Value {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCurrencyDisplay must be used within CurrencyDisplayProvider')
  return v
}