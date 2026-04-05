import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
