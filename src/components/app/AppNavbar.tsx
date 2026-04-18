import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLocale } from '../../hooks/useLocale'
import { hasAdvancedAccess } from '../../lib/advancedAccess'
import { useToast } from '../../contexts/ToastContext'
import { UserAvatar } from '../ui/UserAvatar'

export function AppNavbar() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const { t } = useLocale()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navbarRef = useRef<HTMLElement | null>(null)
  const displayName =
    profile?.username ??
    (typeof user?.user_metadata?.username === 'string' ? user.user_metadata.username : null) ??
    user?.email?.split('@')[0] ??
    'Player'
  const displayAvatar =
    profile?.avatar_url ??
    (typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null)
  const displayCode = profile?.user_code ?? `ID ${user?.id.slice(0, 8) ?? ''}`
  const advancedEnabled = hasAdvancedAccess(profile)

  useEffect(() => {
    if (!mobileOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!navbarRef.current?.contains(target)) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [mobileOpen])

  const handleSignOut = async () => {
    try {
      await signOut()
      pushToast({ tone: 'success', title: t('nav.signedOut') })
      setMobileOpen(false)
      navigate('/')
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('nav.signOutFailed'),
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
    }
  }

  return (
    <>
      <header ref={navbarRef} className={`app-navbar ${mobileOpen ? 'menu-open' : ''}`}>
        <div className="app-navbar-row">
          <div className="navbar-primary">
            <Link to="/" className="brand-lockup">
              <img src="/stratforge-logo.svg" alt="" />
              <div>
                <span>StratForge</span>
                <small>{t('nav.brandTagline')}</small>
              </div>
            </Link>
          </div>

          <div className="navbar-spacer" />

          {user ? (
            <div className="navbar-links navbar-desktop-links">
              {advancedEnabled ? (
                  <Link to="/dm" className="navbar-link">
                  {t('nav.dm')}
                  </Link>
                ) : null}
              <Link to="/support" className="navbar-link">
                {t('nav.support')}
              </Link>
              {isAdmin ? (
                <Link to="/admin" className="navbar-link">
                  {t('nav.admin')}
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="navbar-user navbar-desktop-user">
            {user ? (
              <>
                <Link to="/profile" className="navbar-profile-card">
                  <UserAvatar username={displayName} avatarUrl={displayAvatar} size="sm" />
                  <div className="navbar-profile-copy">
                    <strong>{displayName}</strong>
                    <span>{profile?.user_code ? `#${displayCode}` : displayCode}</span>
                  </div>
                </Link>
                <button type="button" className="ghost-action" onClick={handleSignOut}>
                  {t('nav.logOut')}
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="primary-action">
                  {t('nav.signUp')}
                </Link>
                <Link to="/login" className="ghost-action">
                  {t('nav.logIn')}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className={`navbar-menu-button ${mobileOpen ? 'open' : ''}`}
            aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`navbar-mobile-shell ${mobileOpen ? 'open' : ''}`}>
          <nav className="navbar-mobile-panel">
            {user ? (
              <>
                {advancedEnabled ? (
                  <Link to="/dm" className="navbar-mobile-link" onClick={() => setMobileOpen(false)}>
                    {t('nav.dm')}
                  </Link>
                ) : null}
                <Link to="/support" className="navbar-mobile-link" onClick={() => setMobileOpen(false)}>
                  {t('nav.support')}
                </Link>
                {isAdmin ? (
                  <Link to="/admin" className="navbar-mobile-link" onClick={() => setMobileOpen(false)}>
                    {t('nav.admin')}
                  </Link>
                ) : null}
                <Link to="/profile" className="navbar-mobile-profile" onClick={() => setMobileOpen(false)}>
                  <UserAvatar username={displayName} avatarUrl={displayAvatar} size="md" />
                  <div className="navbar-profile-copy">
                    <strong>{displayName}</strong>
                    <span>{profile?.user_code ? `#${displayCode}` : displayCode}</span>
                  </div>
                </Link>
                <button type="button" className="ghost-action" onClick={handleSignOut}>
                  {t('nav.logOut')}
                </button>
              </>
            ) : (
              <div className="navbar-mobile-auth">
                <Link to="/register" className="primary-action" onClick={() => setMobileOpen(false)}>
                  {t('nav.signUp')}
                </Link>
                <Link to="/login" className="ghost-action" onClick={() => setMobileOpen(false)}>
                  {t('nav.logIn')}
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <button
        type="button"
        aria-label={t('nav.closeOverlay')}
        className={`navbar-mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
    </>
  )
}
