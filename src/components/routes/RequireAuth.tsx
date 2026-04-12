import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasAdvancedAccess } from '../../lib/advancedAccess'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">Loading workspace...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function RequireAnonymous() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-loading">Loading workspace...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">Loading workspace...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RequireAdvanced() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">Loading workspace...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasAdvancedAccess(profile)) {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
