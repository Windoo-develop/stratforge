import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { MAPS } from '../data/maps'
import { DM_MODES, getDmModeLabel } from '../data/dmModes'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { createDmLobby, extractLobbyAccessId, fetchActiveDmLobbies } from '../lib/dmApi'
import { getErrorMessage } from '../lib/errors'
import type { DmLobby, DmLobbyMode } from '../types/domain'

const DM_REFRESH_INTERVAL_MS = 30_000

function formatRemainingTime(expiresAt: string, now: number) {
  const remainingMs = Math.max(new Date(expiresAt).getTime() - now, 0)
  const totalMinutes = Math.ceil(remainingMs / 60_000)

  if (totalMinutes <= 1) return 'Expires in less than a minute'
  return `Expires in ${totalMinutes} min`
}

function getMapMeta(mapId: string) {
  return MAPS.find((map) => map.id === mapId) ?? MAPS[0]!
}

function looksLikeUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function DmPage() {
  const { profile } = useAuth()
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join')
  const [lobbies, setLobbies] = useState<DmLobby[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedLobby, setSelectedLobby] = useState<DmLobby | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [mapId, setMapId] = useState(MAPS[0]?.id ?? 'sandstone')
  const [mode, setMode] = useState<DmLobbyMode>('dm')
  const [headshotsOnly, setHeadshotsOnly] = useState(false)
  const [lobbyLink, setLobbyLink] = useState('')

  const refreshLobbies = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setRefreshing(true)

    try {
      const nextLobbies = await fetchActiveDmLobbies()
      setLobbies(nextLobbies)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not load DM lobbies',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [pushToast])

  useEffect(() => {
    void refreshLobbies()

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
      void refreshLobbies(true)
    }, DM_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshLobbies])

  useEffect(() => {
    if (!selectedLobby) return

    if (new Date(selectedLobby.expires_at).getTime() <= now) {
      setSelectedLobby(null)
    }
  }, [now, selectedLobby])

  const activeLobbies = useMemo(
    () => lobbies.filter((lobby) => new Date(lobby.expires_at).getTime() > now),
    [lobbies, now],
  )

  const handleCreateLobby = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return

    setCreating(true)

    try {
      const createdLobby = await createDmLobby({
        creatorId: profile.id,
        mapId,
        mode,
        headshotsOnly,
        lobbyLink,
      })

      setLobbies((current) => [createdLobby, ...current.filter((item) => item.id !== createdLobby.id)])
      setSelectedLobby(createdLobby)
      setActiveTab('join')
      setLobbyLink('')
      setHeadshotsOnly(false)
      setMode('dm')
      setMapId(MAPS[0]?.id ?? mapId)

      pushToast({
        tone: 'success',
        title: 'DM lobby created',
        message: 'Your lobby is now live for 20 minutes.',
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not create DM lobby',
        message: getErrorMessage(error),
      })
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      pushToast({
        tone: 'success',
        title: `${label} copied`,
      })
    } catch {
      pushToast({
        tone: 'error',
        title: `Could not copy ${label.toLowerCase()}`,
        message: 'Clipboard access is unavailable in this browser session.',
      })
    }
  }

  if (!profile) {
    return <section className="page-shell">Loading DM workspace...</section>
  }

  return (
    <section className="page-shell dm-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">DM</p>
          <h1>Death Match lobbies</h1>
          <span className="hero-text">
            Join fresh warmup rooms from verified players or publish your own DM lobby with map, mode, and HS-only settings.
          </span>
        </div>

        <div className="chip-row dm-tab-actions">
          <button
            type="button"
            className={`filter-chip ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join existing
          </button>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create lobby
          </button>
        </div>
      </div>

      <div className="team-hub dm-summary-grid">
        <article className="team-hub-panel dm-summary-card">
          <p className="eyebrow">Verified Account</p>
          <strong>Standoff 2 ID</strong>
          <span className="dm-summary-value">{profile.standoff_player_id}</span>
          <span className="muted-label">Only verified players with an approved game ID can access this section.</span>
        </article>

        <article className="team-hub-panel dm-summary-card">
          <p className="eyebrow">Live Queue</p>
          <strong>{activeLobbies.length}</strong>
          <span className="dm-summary-value">{activeLobbies.length === 1 ? 'active lobby' : 'active lobbies'}</span>
          <span className="muted-label">Cards disappear automatically 20 minutes after creation.</span>
        </article>
      </div>

      {activeTab === 'join' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">Join lobby</p>
              <h3>Available rooms</h3>
            </div>

            <button type="button" className="ghost-action" onClick={() => void refreshLobbies()} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="empty-panel">
              <strong>Loading DM lobbies...</strong>
            </div>
          ) : activeLobbies.length ? (
            <div className="content-grid dm-lobby-grid">
              {activeLobbies.map((lobby) => {
                const map = getMapMeta(lobby.map_id)
                return (
                  <button
                    key={lobby.id}
                    type="button"
                    className="content-card dm-lobby-card"
                    onClick={() => setSelectedLobby(lobby)}
                  >
                    <div className="content-card-body">
                      <div className="dm-lobby-hero" style={{ backgroundImage: `url(${map.backgroundSrc})` }}>
                        <div className="dm-lobby-hero-copy">
                          <span className="dm-map-label">{map.name}</span>
                          <span className="dm-expiry-pill">{formatRemainingTime(lobby.expires_at, now)}</span>
                        </div>
                      </div>

                      <div className="content-card-head">
                        <div>
                          <h4>{getDmModeLabel(lobby.mode)}</h4>
                          <p>
                            Host: {lobby.creator?.username ?? 'Verified player'} · #{lobby.creator?.user_code ?? 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="content-badge-row">
                        <span className="pill-badge">{lobby.headshots_only ? 'HS only' : 'All hits'}</span>
                        <span className="pill-badge">{map.location}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <strong>No active DM lobbies right now</strong>
              <span>Create a new room or refresh again in a moment.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">Create lobby</p>
              <h3>Publish a room for 20 minutes</h3>
            </div>
          </div>

          <form className="stack-form dm-create-form" onSubmit={handleCreateLobby}>
            <div className="field-group">
              <label>Map</label>
              <div className="map-pill-grid">
                {MAPS.map((map) => (
                  <button
                    key={map.id}
                    type="button"
                    className={`map-pill ${map.id === mapId ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${map.backgroundSrc})` }}
                    onClick={() => setMapId(map.id)}
                  >
                    <strong>{map.name}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Mode</label>
              <div className="chip-row">
                {DM_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`filter-chip ${mode === item.id ? 'active' : ''}`}
                    onClick={() => setMode(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>Headshots only</label>
              <div className="chip-row">
                <button
                  type="button"
                  className={`filter-chip ${!headshotsOnly ? 'active' : ''}`}
                  onClick={() => setHeadshotsOnly(false)}
                >
                  Off
                </button>
                <button
                  type="button"
                  className={`filter-chip ${headshotsOnly ? 'active' : ''}`}
                  onClick={() => setHeadshotsOnly(true)}
                >
                  On
                </button>
              </div>
            </div>

            <label>
              Lobby link or lobby ID
              <input
                type="text"
                required
                value={lobbyLink}
                onChange={(event) => setLobbyLink(event.target.value)}
                placeholder="Paste the lobby invite link or the room ID"
              />
              <span className="muted-label">Other verified players will open the card and copy this access value.</span>
            </label>

            <div className="profile-edit-actions">
              <button type="submit" className="primary-action" disabled={creating}>
                {creating ? 'Creating...' : 'Create DM lobby'}
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        open={Boolean(selectedLobby)}
        title={selectedLobby ? `${getMapMeta(selectedLobby.map_id).name} · ${getDmModeLabel(selectedLobby.mode)}` : 'DM lobby'}
        description="Copy the lobby access and jump into the room before the card expires."
        onClose={() => setSelectedLobby(null)}
      >
        {selectedLobby ? (
          <div className="dm-detail-grid">
            <div className="content-badge-row">
              <span className="pill-badge">{getMapMeta(selectedLobby.map_id).name}</span>
              <span className="pill-badge">{getDmModeLabel(selectedLobby.mode)}</span>
              <span className="pill-badge">{selectedLobby.headshots_only ? 'HS only' : 'All hits'}</span>
            </div>

            <div className="profile-review-note">
              <strong>Lobby ID</strong>
              <p>{extractLobbyAccessId(selectedLobby.lobby_link)}</p>
            </div>

            <div className="profile-review-note">
              <strong>Lobby access value</strong>
              <p>{selectedLobby.lobby_link}</p>
            </div>

            <div className="dm-detail-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => void handleCopy(extractLobbyAccessId(selectedLobby.lobby_link), 'Lobby ID')}
              >
                Copy lobby ID
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={() => void handleCopy(selectedLobby.lobby_link, 'Lobby access')}
              >
                Copy access value
              </button>
              {looksLikeUrl(selectedLobby.lobby_link) ? (
                <a href={selectedLobby.lobby_link} target="_blank" rel="noreferrer" className="ghost-action">
                  Open lobby link
                </a>
              ) : null}
            </div>

            <span className="muted-label">{formatRemainingTime(selectedLobby.expires_at, now)}</span>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
