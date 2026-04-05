import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { signInWithGoogle, signInWithPassword } from '../lib/authApi'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      await signInWithPassword(email, password)
      pushToast({ tone: 'success', title: 'Welcome back' })
      navigate(location.state?.from?.pathname ?? '/')
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Login failed',
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
        title: 'Google login failed',
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Authentication</p>
        <h1>Login</h1>
        <p className="hero-text">Access your teams, lineups and strats with email/password or Google.</p>

        <form className="stack-form" onSubmit={handleEmailLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>

          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <button type="button" className="ghost-action auth-google" onClick={handleGoogleLogin} disabled={loading}>
          Continue with Google
        </button>

        <p className="auth-meta">
          Need an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </section>
  )
}
