import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import { useToast } from '../contexts/ToastContext'
import { signInWithGoogle, signInWithPassword } from '../lib/authApi'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useLocale()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      await signInWithPassword(email, password)
      pushToast({ tone: 'success', title: t('auth.welcomeBack') })
      navigate(location.state?.from?.pathname ?? '/')
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('auth.loginFailed'),
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (loading) return
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('auth.googleLoginFailed'),
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">{t('auth.authentication')}</p>
        <h1>{t('auth.login')}</h1>
        <p className="hero-text">{t('auth.loginSubtitle')}</p>

        <form className="stack-form" onSubmit={handleEmailLogin}>
          <label>
            {t('auth.email')}
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            {t('auth.password')}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>

          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <button type="button" className="ghost-action auth-google" onClick={handleGoogleLogin} disabled={loading}>
          {t('auth.continueWithGoogle')}
        </button>

        <p className="auth-meta">
          {t('auth.needAccount')} <Link to="/register">{t('auth.registerHere')}</Link>
        </p>
      </div>
    </section>
  )
}
