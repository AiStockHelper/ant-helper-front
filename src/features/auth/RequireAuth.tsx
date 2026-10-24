import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { useAuth } from './AuthContext'

export function SplashScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg">
      <LogoMark className="h-14 w-14 animate-pulse" />
    </div>
  )
}

export function RequireAuth() {
  const { status, signedOutByUser } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <SplashScreen />
  if (status === 'anonymous') {
    if (signedOutByUser) return <Navigate to="/login" replace />
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />
  }
  return <Outlet />
}
