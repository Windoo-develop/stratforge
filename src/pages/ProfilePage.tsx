import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserAvatar } from '../components/ui/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getErrorMessage } from '../lib/errors'
import {
  buildFallbackProfileWithTeam,
  ensureProfileForUser,
  fetchProfileWithTeam,
  isProfilesSchemaUnavailable,
  updateProfileDetails,
} from '../lib/profileApi'
import { buildStoragePath, uploadFileToBucketList } from '../lib/storage'
import type { ProfileWithTeam } from '../types/domain'

function ProfilePageContent({ targetId, isSelf }: { targetId: string; isSelf: boolean }) {
  const { user, refreshProfile } = useAuth()
  const { pushToast } = useToast()
  const [profileView, setProfileView] = useState<ProfileWithTeam | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [bioDraft, setBioDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      if (isSelf && user && user.id === targetId) {
        await ensureProfileForUser(user)
      }

      return fetchProfileWithTeam(targetId)
    })()
      .then((nextProfile) => {
        if (active) {
          setProfileView(nextProfile)
          setBioDraft(nextProfile.bio ?? '')
          setAvatarDraft(nextProfile.avatar_url ?? '')
          setAvatarFile(null)
          setAvatarPreviewUrl(null)
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
      pushToast({ tone: 'success', title: 'Profile updated' })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not save profile',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  if (pageLoading) {
    return <div className="page-loading">Loading profile...</div>
  }

  if (!profileView) {
    return (
      <section className="profile-page">
        <div className="profile-card profile-empty">
          <p className="eyebrow">Profile</p>
          <h1>Profile not found</h1>
          <p className="hero-text">We couldn&apos;t load that player card.</p>
        </div>
      </section>
    )
  }

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
            <p className="eyebrow">Player Profile</p>
            <h1>{profileView.username}</h1>
            <div className="profile-meta-row">
              <span className="profile-user-code">#{profileView.user_code}</span>
              <span className="muted-label">{profileView.id}</span>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <article className="profile-panel">
            <h2>Bio</h2>
            <p>{profileView.bio?.trim() ? profileView.bio : 'No bio added yet.'}</p>
          </article>

          <article className="profile-panel">
            <h2>Team</h2>
            {profileView.team_id && profileView.team ? (
              <div className="profile-team-row">
                <span>{profileView.team.name}</span>
                <Link to={`/team/${profileView.team.id}/roster`} className="ghost-action">
                  Open team
                </Link>
              </div>
            ) : (
              <span className="muted-label">None</span>
            )}
          </article>
        </div>

        {isSelf ? (
          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <div className="profile-edit-header">
              <h2>Edit profile</h2>
              <span className="muted-label">Update your avatar and bio, then save.</span>
            </div>

            <div className="profile-edit-grid">
              <label>
                Avatar URL
                <input
                  value={avatarDraft}
                  onChange={(event) => setAvatarDraft(event.target.value)}
                  type="url"
                  placeholder="https://example.com/avatar.png"
                />
              </label>

              <label>
                Upload avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="profile-edit-bio">
                Bio
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
                {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  )
}

export function ProfilePage() {
  const { profileId } = useParams()
  const { profile, user, loading } = useAuth()
  const targetId = profileId ?? profile?.id ?? user?.id ?? null

  if (loading) {
    return <div className="page-loading">Loading profile...</div>
  }

  if (!targetId) {
    return (
      <section className="profile-page">
        <div className="profile-card profile-empty">
          <p className="eyebrow">Profile</p>
          <h1>Profile not found</h1>
          <p className="hero-text">We couldn&apos;t resolve a player for this route.</p>
        </div>
      </section>
    )
  }

  return <ProfilePageContent key={targetId} targetId={targetId} isSelf={!profileId} />
}
