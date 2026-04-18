import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../hooks/useLocale'

export function ConfirmEmailPage() {
  const { user, profile } = useAuth()
  const { t } = useLocale()
  const identity = profile ? t('confirm.doneIdentity', { username: profile.username, code: profile.user_code }) : ''

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">{t('confirm.eyebrow')}</p>
        <h1>{user ? t('confirm.titleDone') : t('confirm.titlePending')}</h1>
        <p className="hero-text">
          {user
            ? t('confirm.doneText', { identity })
            : t('confirm.pendingText')}
        </p>

        <div className="modal-footer auth-actions">
          <Link to={user ? '/' : '/login'} className="primary-action">
            {user ? t('confirm.goWorkspace') : t('confirm.backToLogin')}
          </Link>
          {!user ? (
            <Link to="/register" className="ghost-action">
              {t('confirm.registerAgain')}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
