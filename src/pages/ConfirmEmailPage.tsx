import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ConfirmEmailPage() {
  const { user, profile } = useAuth()

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Email confirmation</p>
        <h1>{user ? 'Email confirmed' : 'Confirm your email'}</h1>
        <p className="hero-text">
          {user
            ? `You are signed in${profile ? ` as ${profile.username} (#${profile.user_code})` : ''}.`
            : 'Open the confirmation link from the email Supabase sent you. After that, you can log in and access team features.'}
        </p>

        <div className="modal-footer auth-actions">
          <Link to={user ? '/' : '/login'} className="primary-action">
            {user ? 'Go to workspace' : 'Back to login'}
          </Link>
          {!user ? (
            <Link to="/register" className="ghost-action">
              Register again
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
