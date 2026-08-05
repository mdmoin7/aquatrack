import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  canAccessSocietyReadings,
  homePath,
  isGuestRole,
  isMeterReaderRole,
} from '@/lib/roles'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemo, profileMissing } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner label="Authenticating..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!isDemo && profileMissing && !isGuestRole(user.role) && location.pathname !== '/setup-profile') {
    return <Navigate to="/setup-profile" replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (isGuestRole(user.role) || user.role === 'resident' || isMeterReaderRole(user.role)) {
    return <Navigate to={homePath(user.role)} replace />
  }

  return <>{children}</>
}

export function BlockDashboardRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (isGuestRole(user.role) || user.role === 'resident') {
    return <Navigate to={homePath(user.role)} replace />
  }

  return <>{children}</>
}

/** Readings & society-wide meter data — admin, meter reader, and guest. */
export function SocietyReadingsRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'resident') return <Navigate to="/resident" replace />
  if (!canAccessSocietyReadings(user.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Flat analytics & timelines — all signed-in roles including guest. */
export function AnalyticsRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

/** Blocks guest viewers from resident-only and admin pages. */
export function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (isGuestRole(user.role)) return <Navigate to="/readings" replace />

  return <>{children}</>
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner label="Loading..." />
  if (user) {
    return <Navigate to={homePath(user.role)} replace />
  }

  return <>{children}</>
}
