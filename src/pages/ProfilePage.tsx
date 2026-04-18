import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Modal } from '../components/ui/Modal'
import { UserAvatar } from '../components/ui/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../hooks/useLocale'
import { useToast } from '../contexts/ToastContext'
import { hasAdvancedAccess } from '../lib/advancedAccess'
import {
  fetchMyAdvancedRegistrationRequest,
  isStandoffPlayerIdAvailable,
  submitAdvancedRegistrationRequest,
} from '../lib/advancedRegistrationApi'
import { getErrorMessage } from '../lib/errors'
import {
  buildFallbackProfileWithTeam,
  ensureProfileForUser,
  fetchProfileWithTeam,
  isProfilesSchemaUnavailable,
  updateProfileDetails,
} from '../lib/profileApi'
import { buildStoragePath, uploadFileToBucketList } from '../lib/storage'
import type { AdvancedRegistrationRequest, ProfileWithTeam } from '../types/domain'

function ProfilePageContent({ targetId, isSelf }: { targetId: string; isSelf: boolean }) {
  const { user, refreshProfile } = useAuth()
  const { t } = useLocale()
  const { pushToast } = useToast()
  const [profileView, setProfileView] = useState<ProfileWithTeam | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [bioDraft, setBioDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [advancedRequest, setAdvancedRequest] = useState<AdvancedRegistrationRequest | null>(null)
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false)
  const [advancedPlayerId, setAdvancedPlayerId] = useState('')
  const [advancedStatsFile, setAdvancedStatsFile] = useState<File | null>(null)
  const [advancedSubmitting, setAdvancedSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      if (isSelf && user && user.id === targetId) {
        await ensureProfileForUser(user)
      }

      return fetchProfileWithTeam(targetId)
    })()
      .then(async (nextProfile) => {
        if (!active) return

        setProfileView(nextProfile)
        setBioDraft(nextProfile.bio ?? '')
        setAvatarDraft(nextProfile.avatar_url ?? '')
        setAvatarFile(null)
        setAvatarPreviewUrl(null)

        if (isSelf && user && user.id === targetId) {
          try {
            const nextRequest = await fetchMyAdvancedRegistrationRequest(user.id)
            if (active) {
              setAdvancedRequest(nextRequest)
            }
          } catch {
            if (active) {
              setAdvancedRequest(null)
            }
          }
        } else if (active) {
          setAdvancedRequest(null)
        }
      })
      .catch((error) => {
        if (!active) return

        if (isSelf && user && user.id === targetId && isProfilesSchemaUnavailable(error)) {
          const fallbackProfile = buildFallbackProfileWithTeam(user)
          setProfileView(fallbackProfile)
          setBioDraft(fallbackProfile.bio ?? '')
          setAvatarDraft(fallbackProfile.avatar_url ?? '')
          setAvatarFile(null)
          setAvatarPreviewUrl(null)
          setAdvancedRequest(null)
          return
        }

        setProfileView(null)
      })
      .finally(() => {
        if (active) {
          setPageLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isSelf, targetId, user])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [avatarFile])

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSelf || !user || !profileView) return

    setSaving(true)

    try {
      let nextAvatarUrl = avatarDraft.trim() || null

      if (avatarFile) {
        nextAvatarUrl = await uploadFileToBucketList(
          ['avatars', 'team-avatars'],
          buildStoragePath(`profiles/${user.id}`, avatarFile.name),
          avatarFile,
        )
      }

      await updateProfileDetails({
        id: user.id,
        avatar_url: nextAvatarUrl,
        bio: bioDraft,
      })

      await refreshProfile()
      const nextProfile = await fetchProfileWithTeam(user.id)
      setProfileView(nextProfile)
      setBioDraft(nextProfile.bio ?? '')
      setAvatarDraft(nextProfile.avatar_url ?? '')
      setAvatarFile(null)
      setAvatarPreviewUrl(null)
      pushToast({ tone: 'success', title: t('profile.profileUpdated') })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('profile.couldNotSaveProfile'),
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const refreshAdvancedRequest = async () => {
    if (!user || !isSelf) return
    setAdvancedRequest(await fetchMyAdvancedRegistrationRequest(user.id))
  }

  const handleSubmitAdvancedRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSelf || !user || !advancedPlayerId.trim() || !advancedStatsFile) return

    setAdvancedSubmitting(true)

    try {
      const available = await isStandoffPlayerIdAvailable(advancedPlayerId, user.id)
      if (!available) {
        throw new Error(t('profile.standoffIdTaken'))
      }

      const screenshotUrl = await uploadFileToBucketList(
        ['advanced-registration-screenshots', 'lineup-screenshots'],
        buildStoragePath(`advanced-registration/${user.id}`, advancedStatsFile.name),
        advancedStatsFile,
      )

      await submitAdvancedRegistrationRequest({
        userId: user.id,
        email: user.email ?? '',
        standoffPlayerId: advancedPlayerId,
        statsScreenshotUrl: screenshotUrl,
      })

      await refreshAdvancedRequest()
      pushToast({
        tone: 'success',
        title: t('profile.requestSubmitted'),
        message: t('profile.requestSubmittedHint'),
      })
      setAdvancedModalOpen(false)
      setAdvancedPlayerId('')
      setAdvancedStatsFile(null)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('profile.couldNotSubmitRequest'),
        message: getErrorMessage(error),
      })
    } finally {
      setAdvancedSubmitting(false)
    }
  }

  if (pageLoading) {
    return <div className="page-loading">{t('profile.loading')}</div>
  }

  if (!profileView) {
    return (
      <section className="profile-page">
        <div className="profile-card profile-empty">
          <p className="eyebrow">{t('profile.title')}</p>
          <h1>{t('profile.notFound')}</h1>
          <p className="hero-text">{t('profile.notFoundHint')}</p>
        </div>
      </section>
    )
  }

  const advancedApproved = Boolean(profileView.advanced_access_enabled || advancedRequest?.status === 'approved')
  const advancedPending = advancedRequest?.status === 'pending'
  const advancedRejected = advancedRequest?.status === 'rejected'
  const advancedEnabled = hasAdvancedAccess(profileView)

  return (
    <section className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <UserAvatar
            username={profileView.username}
            avatarUrl={avatarPreviewUrl ?? (avatarDraft || profileView.avatar_url || null)}
            size="lg"
          />

          <div className="profile-heading">
            <p className="eyebrow">{t('profile.playerProfile')}</p>
            <h1>{profileView.username}</h1>
            <div className="profile-meta-row">
              <span className="profile-user-code">#{profileView.user_code}</span>
              <span className="muted-label">{profileView.id}</span>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <article className="profile-panel">
            <h2>{t('profile.bio')}</h2>
            <p>{profileView.bio?.trim() ? profileView.bio : t('profile.noBio')}</p>
          </article>

          <article className="profile-panel">
            <h2>{t('profile.standoffId')}</h2>
            <p>{profileView.standoff_player_id?.trim() ? profileView.standoff_player_id : t('common.none')}</p>
          </article>

          <article className="profile-panel">
            <h2>{t('profile.team')}</h2>
            {profileView.team_id && profileView.team ? (
              <div className="profile-team-row">
                <span>{profileView.team.name}</span>
                <Link to={`/team/${profileView.team.id}/roster`} className="ghost-action">
                  {t('common.openTeam')}
                </Link>
              </div>
            ) : (
              <span className="muted-label">{t('common.none')}</span>
            )}
          </article>

          {isSelf ? (
            <article className="profile-panel profile-panel-wide">
              <div className="profile-panel-header">
                <h2>{t('profile.advancedAccess')}</h2>
                {advancedApproved ? (
                  <span className="support-status-pill status-approved">{t('profile.approved')}</span>
                ) : advancedPending ? (
                  <span className="support-status-pill status-pending">{t('profile.pending')}</span>
                ) : advancedRejected ? (
                  <span className="support-status-pill status-rejected">{t('profile.rejected')}</span>
                ) : (
                  <span className="muted-label">{t('profile.notSubmitted')}</span>
                )}
              </div>

              {advancedApproved ? (
                <>
                  <p>{`${t('profile.advancedApprovedText')}${profileView.standoff_player_id?.trim() ? ` ${t('profile.verifiedId', { value: profileView.standoff_player_id })}` : ''}`}</p>
                  {advancedEnabled ? (
                    <div className="profile-advanced-actions">
                      <Link to="/dm" className="primary-action">
                        {t('profile.openDm')}
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : advancedPending ? (
                <>
                  <p>{t('profile.advancedPendingText')}</p>
                  <div className="profile-advanced-actions">
                    <button type="button" className="ghost-action" disabled>
                      {t('profile.requestUnderReview')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{t('profile.advancedIntro')}</p>
                  {advancedRejected && advancedRequest?.admin_notes ? (
                    <div className="profile-review-note">
                      <strong>{t('profile.adminNote')}</strong>
                      <p>{advancedRequest.admin_notes}</p>
                    </div>
                  ) : null}
                  <div className="profile-advanced-actions">
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => {
                        setAdvancedPlayerId(advancedRequest?.payload.standoff_player_id ?? '')
                        setAdvancedModalOpen(true)
                      }}
                    >
                      {advancedRejected ? t('profile.submitUpdatedRequest') : t('profile.applyAdvanced')}
                    </button>
                  </div>
                </>
              )}
            </article>
          ) : null}
        </div>

        {isSelf ? (
          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <div className="profile-edit-header">
              <h2>{t('profile.editProfile')}</h2>
              <span className="muted-label">{t('profile.editHint')}</span>
            </div>

            <div className="profile-edit-grid">
              <label>
                {t('auth.avatarUrl')}
                <input
                  value={avatarDraft}
                  onChange={(event) => setAvatarDraft(event.target.value)}
                  type="url"
                  placeholder="https://example.com/avatar.png"
                />
              </label>

              <label>
                {t('profile.uploadAvatar')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="profile-edit-bio">
                {t('profile.bio')}
                <textarea
                  value={bioDraft}
                  onChange={(event) => setBioDraft(event.target.value.slice(0, 200))}
                  rows={4}
                  maxLength={200}
                />
                <span className="muted-label">{bioDraft.length}/200</span>
              </label>
            </div>

            <div className="profile-edit-actions">
              <button type="submit" className="primary-action" disabled={saving}>
                {saving ? t('profile.savingProfile') : t('profile.saveProfile')}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <Modal
        open={advancedModalOpen}
        title={t('profile.advancedRegistration')}
        description={t('profile.advancedRegistrationDescription')}
        onClose={() => setAdvancedModalOpen(false)}
      >
        <form className="stack-form" onSubmit={handleSubmitAdvancedRequest}>
          <label>
            {t('profile.playerIdInput')}
            <input
              type="text"
              required
              value={advancedPlayerId}
              onChange={(event) => setAdvancedPlayerId(event.target.value)}
              placeholder={t('profile.playerIdPlaceholder')}
            />
          </label>

          <label>
            {t('profile.statsScreenshot')}
            <input
              type="file"
              required
              accept="image/*"
              onChange={(event) => setAdvancedStatsFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="ghost-action" onClick={() => setAdvancedModalOpen(false)} disabled={advancedSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary-action" disabled={advancedSubmitting}>
              {advancedSubmitting ? t('profile.submitting') : t('profile.sendForReview')}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

export function ProfilePage() {
  const { profileId } = useParams()
  const { profile, user, loading } = useAuth()
  const { t } = useLocale()
  const targetId = profileId ?? profile?.id ?? user?.id ?? null

  if (loading) {
    return <div className="page-loading">{t('profile.loading')}</div>
  }

  if (!targetId) {
    return (
      <section className="profile-page">
        <div className="profile-card profile-empty">
          <p className="eyebrow">{t('profile.title')}</p>
          <h1>{t('profile.notFound')}</h1>
          <p className="hero-text">{t('profile.routeNotFoundHint')}</p>
        </div>
      </section>
    )
  }

  return <ProfilePageContent key={targetId} targetId={targetId} isSelf={!profileId} />
}
