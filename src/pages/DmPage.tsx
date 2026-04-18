import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { MAPS } from '../data/maps'
import { DM_MODES, getDmModeLabel } from '../data/dmModes'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../hooks/useLocale'
import { useToast } from '../contexts/ToastContext'
import { createDmLobby, extractLobbyAccessId, fetchActiveDmLobbies } from '../lib/dmApi'
import { getErrorMessage } from '../lib/errors'
import type { DmLobby, DmLobbyMode } from '../types/domain'

const DM_REFRESH_INTERVAL_MS = 30_000

function formatRemainingTime(expiresAt: string, now: number, lessThanMinuteLabel: string, template: string) {
  const remainingMs = Math.max(new Date(expiresAt).getTime() - now, 0)
  const totalMinutes = Math.ceil(remainingMs / 60_000)

  if (totalMinutes <= 1) return lessThanMinuteLabel
  return template.replace('{{minutes}}', String(totalMinutes))
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
  const { t } = useLocale()
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
        title: t('dm.couldNotLoad'),
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
        title: t('dm.created'),
        message: t('dm.createdHint'),
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('dm.createFailed'),
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
        title: t('dm.copied', { value: label }),
      })
    } catch {
      pushToast({
        tone: 'error',
        title: t('dm.copyFailed', { value: label.toLowerCase() }),
        message: t('dm.copyFailedHint'),
      })
    }
  }

  if (!profile) {
    return <section className="page-shell">{t('dm.loadingWorkspace')}</section>
  }

  return (
    <section className="page-shell dm-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">{t('dm.eyebrow')}</p>
          <h1>{t('dm.title')}</h1>
          <span className="hero-text">{t('dm.subtitle')}</span>
        </div>

        <div className="chip-row dm-tab-actions">
          <button
            type="button"
            className={`filter-chip ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            {t('dm.joinExisting')}
          </button>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            {t('dm.createLobby')}
          </button>
        </div>
      </div>

      <div className="team-hub dm-summary-grid">
        <article className="team-hub-panel dm-summary-card">
          <p className="eyebrow">{t('dm.verifiedAccount')}</p>
          <strong>{t('profile.standoffId')}</strong>
          <span className="dm-summary-value">{profile.standoff_player_id}</span>
          <span className="muted-label">{t('dm.verifiedHint')}</span>
        </article>

        <article className="team-hub-panel dm-summary-card">
          <p className="eyebrow">{t('dm.liveQueue')}</p>
          <strong>{activeLobbies.length}</strong>
          <span className="dm-summary-value">{activeLobbies.length === 1 ? t('dm.activeLobby') : t('dm.activeLobbies')}</span>
          <span className="muted-label">{t('dm.expireHint')}</span>
        </article>
      </div>

      {activeTab === 'join' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">{t('dm.joinLobby')}</p>
              <h3>{t('dm.availableRooms')}</h3>
            </div>

            <button type="button" className="ghost-action" onClick={() => void refreshLobbies()} disabled={refreshing}>
              {refreshing ? t('common.loading') : t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="empty-panel">
              <strong>{t('dm.loadingLobbies')}</strong>
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
                          <span className="dm-expiry-pill">{formatRemainingTime(lobby.expires_at, now, t('dm.expiresLessThanMinute'), t('dm.expiresInMinutes'))}</span>
                        </div>
                      </div>

                      <div className="content-card-head">
                        <div>
                          <h4>{getDmModeLabel(lobby.mode)}</h4>
                          <p>
                            {t('dm.hostPrefix', { value: `${lobby.creator?.username ?? t('dm.verifiedPlayer')} · #${lobby.creator?.user_code ?? 'N/A'}` })}
                          </p>
                        </div>
                      </div>

                      <div className="content-badge-row">
                        <span className="pill-badge">{lobby.headshots_only ? 'HS only' : t('dm.allHits')}</span>
                        <span className="pill-badge">{map.location}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <strong>{t('dm.noActiveLobbies')}</strong>
              <span>{t('dm.noActiveLobbiesHint')}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">{t('dm.createLobby')}</p>
              <h3>{t('dm.publishLobby')}</h3>
            </div>
          </div>

          <form className="stack-form dm-create-form" onSubmit={handleCreateLobby}>
            <div className="field-group">
              <label>{t('dm.map')}</label>
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
              <label>{t('dm.mode')}</label>
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
              <label>{t('dm.headshotsOnly')}</label>
              <div className="chip-row">
                <button
                  type="button"
                  className={`filter-chip ${!headshotsOnly ? 'active' : ''}`}
                  onClick={() => setHeadshotsOnly(false)}
                >
                  {t('common.off')}
                </button>
                <button
                  type="button"
                  className={`filter-chip ${headshotsOnly ? 'active' : ''}`}
                  onClick={() => setHeadshotsOnly(true)}
                >
                  {t('common.on')}
                </button>
              </div>
            </div>

            <label>
              {t('dm.lobbyLinkOrId')}
              <input
                type="text"
                required
                value={lobbyLink}
                onChange={(event) => setLobbyLink(event.target.value)}
                placeholder={t('dm.lobbyLinkPlaceholder')}
              />
              <span className="muted-label">{t('dm.lobbyLinkHint')}</span>
            </label>

            <div className="profile-edit-actions">
              <button type="submit" className="primary-action" disabled={creating}>
                {creating ? t('dm.creating') : t('dm.createLobbyAction')}
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        open={Boolean(selectedLobby)}
        title={selectedLobby ? `${getMapMeta(selectedLobby.map_id).name} · ${getDmModeLabel(selectedLobby.mode)}` : t('dm.detailFallbackTitle')}
        description={t('dm.detailDescription')}
        onClose={() => setSelectedLobby(null)}
      >
        {selectedLobby ? (
          <div className="dm-detail-grid">
            <div className="content-badge-row">
              <span className="pill-badge">{getMapMeta(selectedLobby.map_id).name}</span>
              <span className="pill-badge">{getDmModeLabel(selectedLobby.mode)}</span>
              <span className="pill-badge">{selectedLobby.headshots_only ? 'HS only' : t('dm.allHits')}</span>
            </div>

            <div className="profile-review-note">
              <strong>{t('dm.lobbyId')}</strong>
              <p>{extractLobbyAccessId(selectedLobby.lobby_link)}</p>
            </div>

            <div className="profile-review-note">
              <strong>{t('dm.lobbyAccess')}</strong>
              <p>{selectedLobby.lobby_link}</p>
            </div>

            <div className="dm-detail-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => void handleCopy(extractLobbyAccessId(selectedLobby.lobby_link), t('dm.lobbyId'))}
              >
                {t('dm.copyLobbyId')}
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={() => void handleCopy(selectedLobby.lobby_link, t('dm.lobbyAccess'))}
              >
                {t('dm.copyLobbyAccess')}
              </button>
              {looksLikeUrl(selectedLobby.lobby_link) ? (
                <a href={selectedLobby.lobby_link} target="_blank" rel="noreferrer" className="ghost-action">
                  {t('dm.openLobbyLink')}
                </a>
              ) : null}
            </div>

            <span className="muted-label">{formatRemainingTime(selectedLobby.expires_at, now, t('dm.expiresLessThanMinute'), t('dm.expiresInMinutes'))}</span>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
