import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui/Modal'
import { PremiumHero } from '../components/home/PremiumHero'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { MapEditorWorkspace } from '../features/editor/MapEditorWorkspace'
import { getErrorMessage } from '../lib/errors'
import { ensureProfileForUser } from '../lib/profileApi'
import {
  buildStoragePath,
  isBucketNotFoundError,
  uploadFileToBucketList,
} from '../lib/storage'
import { acceptInvite, createTeam, fetchMyTeams, fetchPendingInvites, joinTeam } from '../lib/teamApi'
import type { Team, TeamInvite } from '../types/domain'

function CreateTeamModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (teamId: string) => void
}) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const { pushToast } = useToast()
  const { user } = useAuth()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return

    setLoading(true)

    try {
      await ensureProfileForUser(user)

      let avatarUrl: string | null = null

      if (avatar) {
        try {
          avatarUrl = await uploadFileToBucketList(
            ['team-avatars', 'avatars'],
            buildStoragePath(`teams/${user.id}`, avatar.name),
            avatar,
          )
        } catch (error) {
          if (!isBucketNotFoundError(error)) {
            throw error
          }
        }
      }

      const teamId = await createTeam({ name, password, avatarUrl })
      pushToast({ tone: 'success', title: 'Team created' })
      onCreated(teamId)
      onClose()
      setName('')
      setPassword('')
      setAvatar(null)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Unable to create team',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create team"
      description="Create a private team with avatar and password-protected access."
    >
      <form className="stack-form" onSubmit={handleSubmit} autoComplete="off">
        <label>
          Team name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            required
            name="team_display_name"
            autoComplete="organization"
            data-lpignore="true"
          />
        </label>
        <label>
          Team password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            minLength={6}
            name="team_access_code"
            autoComplete="new-password"
            data-lpignore="true"
          />
        </label>
        <label>
          Team avatar
          <input type="file" accept="image/*" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} />
        </label>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Creating...' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function JoinTeamModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean
  onClose: () => void
  onJoined: (teamId: string) => void
}) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { pushToast } = useToast()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    try {
      const teamId = await joinTeam({ name, password })
      pushToast({ tone: 'success', title: 'Joined team' })
      onJoined(teamId)
      onClose()
      setName('')
      setPassword('')
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Unable to join team',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join team"
      description="Enter the team name and password provided by the creator."
    >
      <form className="stack-form" onSubmit={handleSubmit} autoComplete="off">
        <label>
          Team name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            required
            name="team_join_name"
            autoComplete="organization"
            data-lpignore="true"
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            name="team_join_access_code"
            autoComplete="new-password"
            data-lpignore="true"
          />
        </label>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Joining...' : 'Join team'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TeamHub({
  teams,
  invites,
  onRefresh,
}: {
  teams: Team[]
  invites: TeamInvite[]
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const teamId = await acceptInvite(inviteId)
      pushToast({ tone: 'success', title: 'Invite accepted' })
      await onRefresh()
      navigate(`/team/${teamId}/roster`)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not accept invite',
        message: getErrorMessage(error),
      })
    }
  }

  return (
    <section className="team-hub">
      <div className="team-hub-panel">
        <div className="map-library-header">
          <div>
            <p className="eyebrow">Teams</p>
            <h3>My team dashboards</h3>
          </div>
        </div>

        <div className="team-grid">
          {teams.length ? (
            teams.map((team) => (
              <Link key={team.id} to={`/team/${team.id}/roster`} className="team-card">
                {team.avatar_url ? <img src={team.avatar_url} alt="" className="team-avatar" /> : <div className="team-avatar fallback">{team.name.slice(0, 2).toUpperCase()}</div>}
                <div className="team-card-copy">
                  <strong>{team.name}</strong>
                  <span>Open roster, line-ups and strats</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-panel">
              <strong>No teams yet</strong>
              <span>Create one or join an existing squad to unlock shared lineups and strats.</span>
            </div>
          )}
        </div>
      </div>

      <div className="team-hub-panel">
        <div className="map-library-header">
          <div>
            <p className="eyebrow">Invites</p>
            <h3>Pending team invites</h3>
          </div>
        </div>

        <div className="stack-list">
          {invites.length ? (
            invites.map((invite) => (
              <div key={invite.id} className="invite-card">
                <div>
                  <strong>{invite.team?.name ?? 'Team invite'}</strong>
                  <span>Pending invite for your user code</span>
                </div>
                <button type="button" className="primary-action" onClick={() => void handleAcceptInvite(invite.id)}>
                  Accept
                </button>
              </div>
            ))
          ) : (
            <div className="empty-panel">
              <strong>No invites right now</strong>
              <span>When a creator invites your user code, it will show up here.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  const { profile, refreshProfile, user } = useAuth()
  const { pushToast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const navigate = useNavigate()

  const refreshHomeData = useCallback(async () => {
    if (!profile) {
      setTeams([])
      setInvites([])
      return
    }

    setLoading(true)
    try {
      const [nextTeams, nextInvites] = await Promise.all([
        fetchMyTeams(profile.id),
        fetchPendingInvites(profile.user_code),
      ])
      setTeams(nextTeams)
      setInvites(nextInvites)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not load teams',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }, [profile, pushToast])

  useEffect(() => {
    void refreshHomeData()
  }, [refreshHomeData])

  const primaryTeam = teams[0] ?? null
  const hasExistingTeam = Boolean(primaryTeam)

  return (
    <div className="page-shell">
      <PremiumHero
        isAuthenticated={Boolean(user)}
        signedInLabel={profile ? `${profile.username} · #${profile.user_code}` : undefined}
        onMakeTeam={() => {
          if (user) {
            if (hasExistingTeam && primaryTeam) {
              navigate(`/team/${primaryTeam.id}/roster`)
              return
            }
            setCreateOpen(true)
            return
          }

          navigate('/register')
        }}
        onMasterMap={() => {
          document.getElementById('tactical-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      <section className="home-actions">
        <div className="hero-copy">
          <p className="eyebrow">Team Features</p>
          <h2>From blueprint hero to live team workflows.</h2>
          <p className="hero-text">
            Authentication, team dashboards, roster permissions, lineup libraries and strat notes now
            wrap around the shared Sandstone tactical board.
          </p>
        </div>

        <div className="topbar-actions">
          {user ? (
            hasExistingTeam && primaryTeam ? (
              <Link to={`/team/${primaryTeam.id}/roster`} className="primary-action">
                Open team
              </Link>
            ) : (
              <>
                <button type="button" className="ghost-action" onClick={() => setJoinOpen(true)}>
                  Join team
                </button>
                <button type="button" className="primary-action" onClick={() => setCreateOpen(true)}>
                  Create team
                </button>
              </>
            )
          ) : (
            <>
              <Link to="/login" className="ghost-action">
                Login to join teams
              </Link>
              <Link to="/register" className="primary-action">
                Register
              </Link>
            </>
          )}
        </div>
      </section>

      {user && profile ? (
        loading ? (
          <div className="team-hub-panel">
            <strong>Loading teams...</strong>
          </div>
        ) : (
          <TeamHub teams={teams} invites={invites} onRefresh={refreshHomeData} />
        )
      ) : null}

      <div id="tactical-editor" className="scroll-mt-28">
        <MapEditorWorkspace />
      </div>

      <CreateTeamModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(teamId) => {
          void (async () => {
            await refreshProfile()
            await refreshHomeData()
            navigate(`/team/${teamId}/roster`)
          })()
        }}
      />

      <JoinTeamModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(teamId) => {
          void (async () => {
            await refreshProfile()
            await refreshHomeData()
            navigate(`/team/${teamId}/roster`)
          })()
        }}
      />
    </div>
  )
}
