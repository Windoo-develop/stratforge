import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
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
  const { t } = useLocale()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const trimmedUsername = useMemo(() => username.trim(), [username])
  const normalizedBio = useMemo(() => bio.slice(0, 200), [bio])

  const handleContinue = () => {
    if (!email.trim()) {
      pushToast({ tone: 'error', title: t('auth.emailRequired') })
      return
    }

    if (password !== confirmPassword) {
      pushToast({ tone: 'error', title: t('auth.passwordMismatch') })
      return
    }

    if (password.length < 8) {
      pushToast({ tone: 'error', title: t('auth.passwordTooShort'), message: t('auth.passwordTooShortHint') })
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
        title: t('auth.invalidUsername'),
        message: t('auth.invalidUsernameHint'),
      })
      return
    }

    if (normalizedBio.length > 200) {
      pushToast({ tone: 'error', title: t('auth.bioTooLong'), message: t('auth.bioTooLongHint') })
      return
    }

    if (avatarMode === 'url' && avatarUrl.trim() && !/^https?:\/\//i.test(avatarUrl.trim())) {
      pushToast({
        tone: 'error',
        title: t('auth.invalidAvatarUrl'),
        message: t('auth.invalidAvatarUrlHint'),
      })
      return
    }

    setLoading(true)

    try {
      const availableEmail = await isEmailAvailable(email)
      if (!availableEmail) {
        pushToast({
          tone: 'error',
          title: t('auth.emailTaken'),
          message: t('auth.emailTakenHint'),
        })
        return
      }

      const available = await isUsernameAvailable(trimmedUsername)
      if (!available) {
        pushToast({
          tone: 'error',
          title: t('auth.usernameTaken'),
          message: t('auth.usernameTakenHint'),
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
        title: t('auth.accountCreated'),
        message: t('auth.accountCreatedHint'),
      })
      navigate('/confirm-email')
    } catch (error) {
      clearPendingProfileDraft()
      pushToast({
        tone: 'error',
        title: t('auth.registrationFailed'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">{t('auth.authentication')}</p>
        <h1>{t('auth.createAccount')}</h1>
        <p className="hero-text">{t('auth.registerSubtitle')}</p>

        <div className="auth-stepper" aria-label="Registration steps">
          <span className={`auth-step ${step === 1 ? 'active' : 'complete'}`}>{t('auth.stepAccount')}</span>
          <span className={`auth-step ${step === 2 ? 'active' : ''}`}>{t('auth.stepProfile')}</span>
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
              {t('auth.email')}
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              {t('auth.password')}
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>
            <label>
              {t('auth.confirmPassword')}
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>

            <button type="submit" className="primary-action">
              {t('auth.continueToProfile')}
            </button>
          </form>
        ) : (
          <form className="stack-form" onSubmit={handleRegister}>
            <label>
              {t('auth.username')}
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
              <span>{t('auth.avatarSource')}</span>
              <div className="badge-toggle-row">
                <button
                  type="button"
                  className={`filter-chip ${avatarMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setAvatarMode('upload')}
                >
                  {t('auth.uploadImage')}
                </button>
                <button
                  type="button"
                  className={`filter-chip ${avatarMode === 'url' ? 'active' : ''}`}
                  onClick={() => setAvatarMode('url')}
                >
                  {t('auth.useImageUrl')}
                </button>
              </div>
            </div>

            {avatarMode === 'upload' ? (
              <label>
                {t('auth.avatarImage')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <label>
                {t('auth.avatarUrl')}
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  type="url"
                  placeholder="https://example.com/avatar.png"
                />
              </label>
            )}

            <label>
              {t('auth.bio')}
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 200))}
                rows={4}
                maxLength={200}
                placeholder={t('auth.bioPlaceholder')}
              />
              <span className="muted-label">{bio.length}/200</span>
            </label>

            <div className="modal-footer">
              <button type="button" className="ghost-action" onClick={() => setStep(1)} disabled={loading}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-action" disabled={loading}>
                {loading ? `${t('auth.createAccount')}...` : t('auth.finishRegistration')}
              </button>
            </div>
          </form>
        )}

        <p className="auth-meta">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.loginHere')}</Link>
        </p>
      </div>
    </section>
  )
}
