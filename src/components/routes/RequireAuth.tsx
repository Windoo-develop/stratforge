import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLocale } from '../../hooks/useLocale'
import { hasAdvancedAccess } from '../../lib/advancedAccess'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const { t } = useLocale()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">{t('common.loading')}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function RequireAnonymous() {
  const { user, loading } = useAuth()
  const { t } = useLocale()

  if (loading) {
    return <div className="page-loading">{t('common.loading')}</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const { user, isAdmin, loading } = useAuth()
  const { t } = useLocale()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">{t('common.loading')}</div>
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
  const { t } = useLocale()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">{t('common.loading')}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasAdvancedAccess(profile)) {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
