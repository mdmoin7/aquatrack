import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemo, profileMissing } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner label="Authenticating..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!isDemo && profileMissing && location.pathname !== '/setup-profile') {
    return <Navigate to="/setup-profile" replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'resident') return <Navigate to="/resident" replace />

  return <>{children}</>
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner label="Loading..." />
  if (user) {
    return <Navigate to={user.role === 'resident' ? '/resident' : '/'} replace />
  }

  return <>{children}</>
}
