import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { isEmailAvailable, signUpWithProfile } from '../lib/authApi'
import { getErrorMessage } from '../lib/errors'
import {
  clearPendingProfileDraft,
  isUsernameAvailable,
  isValidUsername,
  storePendingProfileDraft,
} from '../lib/profileApi'

type RegistrationStep = 1 | 2
type AvatarMode = 'upload' | 'url'

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Could not read avatar file.'))
    }
    reader.onerror = () => reject(new Error('Could not read avatar file.'))
    reader.readAsDataURL(file)
  })
}

export function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('upload')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const trimmedUsername = useMemo(() => username.trim(), [username])
  const normalizedBio = useMemo(() => bio.slice(0, 200), [bio])

  const handleContinue = () => {
    if (!email.trim()) {
      pushToast({ tone: 'error', title: 'Email is required' })
      return
    }

    if (password !== confirmPassword) {
      pushToast({ tone: 'error', title: 'Passwords do not match' })
      return
    }

    if (password.length < 8) {
      pushToast({ tone: 'error', title: 'Password is too short', message: 'Use at least 8 characters.' })
      return
    }

    setStep(2)
  }

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    if (!isValidUsername(trimmedUsername)) {
      pushToast({
        tone: 'error',
        title: 'Invalid username',
        message: 'Use 3-30 characters: letters, numbers and underscores only.',
      })
      return
    }

    if (normalizedBio.length > 200) {
      pushToast({ tone: 'error', title: 'Bio is too long', message: 'Keep it under 200 characters.' })
      return
    }

    if (avatarMode === 'url' && avatarUrl.trim() && !/^https?:\/\//i.test(avatarUrl.trim())) {
      pushToast({
        tone: 'error',
        title: 'Avatar URL is invalid',
        message: 'Use a full http or https image URL.',
      })
      return
    }

    setLoading(true)

    try {
      const availableEmail = await isEmailAvailable(email)
      if (!availableEmail) {
        pushToast({
          tone: 'error',
          title: 'Email is already taken',
          message: 'Use another email or log in to your existing account.',
        })
        return
      }

      const available = await isUsernameAvailable(trimmedUsername)
      if (!available) {
        pushToast({
          tone: 'error',
          title: 'Username is taken',
          message: 'Pick another handle before continuing.',
        })
        return
      }

      const avatarDataUrl =
        avatarMode === 'upload' && avatarFile ? await fileToDataUrl(avatarFile) : null
      const avatarUrlValue = avatarMode === 'url' ? avatarUrl.trim() || null : null

      storePendingProfileDraft({
        email,
        username: trimmedUsername,
        bio: normalizedBio.trim(),
        avatarUrl: avatarUrlValue,
        avatarDataUrl,
        avatarFileName: avatarFile?.name ?? null,
      })

      await signUpWithProfile({
        email,
        password,
        username: trimmedUsername,
        bio: normalizedBio.trim(),
        avatarUrl: avatarUrlValue,
      })

      pushToast({
        tone: 'success',
        title: 'Account created',
        message: 'Check your inbox, confirm your email, and we will finish syncing your profile setup.',
      })
      navigate('/confirm-email')
    } catch (error) {
      clearPendingProfileDraft()
      pushToast({
        tone: 'error',
        title: 'Registration failed',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Authentication</p>
        <h1>Create account</h1>
        <p className="hero-text">
          Start with your login details, then configure the player card that will appear across teams
          and tactics.
        </p>

        <div className="auth-stepper" aria-label="Registration steps">
          <span className={`auth-step ${step === 1 ? 'active' : 'complete'}`}>1. Account</span>
          <span className={`auth-step ${step === 2 ? 'active' : ''}`}>2. Profile setup</span>
        </div>

        {step === 1 ? (
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault()
              handleContinue()
            }}
          >
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>
            <label>
              Confirm password
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>

            <button type="submit" className="primary-action">
              Continue to profile setup
            </button>
          </form>
        ) : (
          <form className="stack-form" onSubmit={handleRegister}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]{3,30}"
              />
            </label>

            <div className="field-group">
              <span>Avatar source</span>
              <div className="badge-toggle-row">
                <button
                  type="button"
                  className={`filter-chip ${avatarMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setAvatarMode('upload')}
                >
                  Upload image
                </button>
                <button
                  type="button"
                  className={`filter-chip ${avatarMode === 'url' ? 'active' : ''}`}
                  onClick={() => setAvatarMode('url')}
                >
                  Use image URL
                </button>
              </div>
            </div>

            {avatarMode === 'upload' ? (
              <label>
                Avatar image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <label>
                Avatar URL
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  type="url"
                  placeholder="https://example.com/avatar.png"
                />
              </label>
            )}

            <label>
              Bio
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 200))}
                rows={4}
                maxLength={200}
              />
              <span className="muted-label">{bio.length}/200</span>
            </label>

            <div className="modal-footer">
              <button type="button" className="ghost-action" onClick={() => setStep(1)} disabled={loading}>
                Back
              </button>
              <button type="submit" className="primary-action" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        <p className="auth-meta">
          Already registered? <Link to="/login">Log in here</Link>
        </p>
      </div>
    </section>
  )
}
