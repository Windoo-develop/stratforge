import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { MAPS } from '../../data/maps'
import { GRENADE_BADGES, SIDE_BADGES, THROW_JUMP_OPTIONS, THROW_MOVEMENT_OPTIONS, THROW_STANCE_OPTIONS } from '../../data/throwSettings'
import { canAddLineups, canAddStrats, canEditOwnContent, isTeamCreator } from '../../data/teamHelpers'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../lib/errors'
import { buildStoragePath, uploadFileToBucket } from '../../lib/storage'
import {
  createInvite,
  createLineup,
  createStrat,
  deleteTeam,
  deleteLineup,
  deleteStrat,
  disbandTeam,
  fetchLineups,
  fetchStrats,
  fetchTeamDashboard,
  removeMember,
  updateLineup,
  updateMember,
  updateStrat,
} from '../../lib/teamApi'
import type { Lineup, Strat, Team, TeamMember } from '../../types/domain'

type DashboardSection = 'roster' | 'lineups' | 'strats'

type ConfirmationState =
  | { kind: 'kick'; member: TeamMember }
  | { kind: 'leave'; member: TeamMember }
  | { kind: 'disband-team' }
  | { kind: 'delete-team' }
  | { kind: 'delete-lineup'; lineup: Lineup }
  | { kind: 'delete-strat'; strat: Strat }
  | null

type LineupFormState = {
  name: string
  description: string
  video_url: string
  side: 'T' | 'CT'
  throw_stance: string
  throw_movement: string
  throw_jump: boolean
  grenade_type: 'smoke' | 'flash' | 'grenade' | 'molotov'
}

type StratFormState = {
  name: string
  note: string
  video_url: string
  side: 'T' | 'CT'
  types: string[]
}

function SideBadge({ side }: { side: 'T' | 'CT' }) {
  const config = SIDE_BADGES[side]
  return (
    <span className={`pill-badge ${config.className}`}>
      <img src={config.icon} alt="" />
      {config.label}
    </span>
  )
}

function GrenadeBadge({ type }: { type: Lineup['grenade_type'] }) {
  const config = GRENADE_BADGES[type]
  return (
    <span className={`pill-badge grenade-badge ${config.className}`}>
      <img src={config.icon} alt="" />
      {config.label}
    </span>
  )
}

function ToggleIconGroup<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; icon: string; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="icon-choice-grid">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          title={option.label}
          className={`icon-choice ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <img src={option.icon} alt="" />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function LineupModal({
  open,
  loading,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  initial?: Lineup | null
  onClose: () => void
  onSubmit: (form: LineupFormState, files: File[]) => Promise<void>
}) {
  const [form, setForm] = useState<LineupFormState>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    video_url: initial?.video_url ?? '',
    side: initial?.side ?? 'T',
    throw_stance: initial?.throw_stance ?? 'standing',
    throw_movement: initial?.throw_movement ?? 'stationary',
    throw_jump: initial?.throw_jump ?? false,
    grenade_type: initial?.grenade_type ?? 'smoke',
  })
  const [files, setFiles] = useState<File[]>([])

  return (
    <Modal open={open} title={initial ? 'Edit lineup' : 'Add lineup'} onClose={onClose}>
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(form, files)
        }}
      >
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
          />
        </label>

        <label>
          Video URL
          <input
            value={form.video_url}
            onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))}
            type="url"
          />
        </label>

        <div className="field-group">
          <span>Side</span>
          <div className="badge-toggle-row">
            {(['T', 'CT'] as const).map((side) => (
              <button
                key={side}
                type="button"
                className={`side-toggle ${form.side === side ? 'active' : ''} ${SIDE_BADGES[side].className}`}
                onClick={() => setForm((current) => ({ ...current, side }))}
              >
                <img src={SIDE_BADGES[side].icon} alt="" />
                {side}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span>Stance</span>
          <ToggleIconGroup
            options={THROW_STANCE_OPTIONS}
            value={form.throw_stance}
            onChange={(value) => setForm((current) => ({ ...current, throw_stance: value }))}
          />
        </div>

        <div className="field-group">
          <span>Movement</span>
          <ToggleIconGroup
            options={THROW_MOVEMENT_OPTIONS}
            value={form.throw_movement}
            onChange={(value) => setForm((current) => ({ ...current, throw_movement: value }))}
          />
        </div>

        <div className="field-group">
          <span>Jump</span>
          <ToggleIconGroup
            options={THROW_JUMP_OPTIONS}
            value={form.throw_jump}
            onChange={(value) => setForm((current) => ({ ...current, throw_jump: value }))}
          />
        </div>

        <div className="field-group">
          <span>Grenade type</span>
          <div className="badge-toggle-row">
            {(Object.keys(GRENADE_BADGES) as Array<Lineup['grenade_type']>).map((type) => (
              <button
                key={type}
                type="button"
                className={`grenade-toggle ${form.grenade_type === type ? 'active' : ''}`}
                onClick={() => setForm((current) => ({ ...current, grenade_type: type }))}
              >
                <img src={GRENADE_BADGES[type].icon} alt="" />
              </button>
            ))}
          </div>
        </div>

        <label>
          Screenshots {initial ? '(upload to replace/add)' : ''}
          <input
            type="file"
            multiple
            accept="image/*"
            required={!initial}
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Saving...' : initial ? 'Save lineup' : 'Create lineup'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function LineupPreviewModal({
  lineup,
  open,
  onClose,
}: {
  lineup: Lineup | null
  open: boolean
  onClose: () => void
}) {
  if (!lineup) return null

  return (
    <Modal open={open} title={lineup.name} description="Detailed lineup view" onClose={onClose}>
      <div className="lineup-detail-view">
        <img src={lineup.screenshots[0]} alt={lineup.name} className="lineup-detail-image" />

        <div className="content-badge-row">
          <GrenadeBadge type={lineup.grenade_type} />
          <SideBadge side={lineup.side} />
        </div>

        <p>{lineup.description || 'No description provided.'}</p>

        <div className="lineup-throw-icons lineup-throw-icons-detail">
          <img src={THROW_STANCE_OPTIONS.find((item) => item.value === lineup.throw_stance)?.icon ?? ''} alt="" />
          <img src={THROW_MOVEMENT_OPTIONS.find((item) => item.value === lineup.throw_movement)?.icon ?? ''} alt="" />
          <img src={lineup.throw_jump ? '/assets/editor/system/pose_jump.svg' : '/assets/editor/system/pose_still.svg'} alt="" />
        </div>

        <div className="content-meta-row">
          <span>{lineup.author?.username ?? 'Unknown author'}</span>
          <span>{new Date(lineup.created_at).toLocaleDateString()}</span>
        </div>

        {lineup.video_url ? (
          <a href={lineup.video_url} target="_blank" rel="noreferrer" className="ghost-action">
            Open video
          </a>
        ) : null}
      </div>
    </Modal>
  )
}

function StratModal({
  open,
  loading,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  initial?: Strat | null
  onClose: () => void
  onSubmit: (form: StratFormState) => Promise<void>
}) {
  const [form, setForm] = useState<StratFormState>({
    name: initial?.name ?? '',
    note: initial?.note ?? '',
    video_url: initial?.video_url ?? '',
    side: initial?.side ?? 'T',
    types: initial?.types ?? ['buyround'],
  })

  const toggleType = (type: string) => {
    setForm((current) => {
      const exists = current.types.includes(type)
      const nextTypes = exists ? current.types.filter((item) => item !== type) : [...current.types, type]
      return { ...current, types: nextTypes }
    })
  }

  return (
    <Modal open={open} title={initial ? 'Edit strat' : 'Add strat'} onClose={onClose}>
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (form.types.length === 0) return
          void onSubmit(form)
        }}
      >
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            required
          />
        </label>

        <label>
          Note
          <textarea
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            rows={4}
          />
        </label>

        <label>
          Video URL
          <input
            value={form.video_url}
            onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))}
            type="url"
          />
        </label>

        <div className="field-group">
          <span>Side</span>
          <div className="badge-toggle-row">
            {(['T', 'CT'] as const).map((side) => (
              <button
                key={side}
                type="button"
                className={`side-toggle ${form.side === side ? 'active' : ''} ${SIDE_BADGES[side].className}`}
                onClick={() => setForm((current) => ({ ...current, side }))}
              >
                <img src={SIDE_BADGES[side].icon} alt="" />
                {side}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span>Types</span>
          <div className="chip-row">
            {['buyround', 'force', 'pistol'].map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-chip ${form.types.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          {form.types.length === 0 ? <p className="form-hint error">Pick at least one strat type.</p> : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={loading || form.types.length === 0}>
            {loading ? 'Saving...' : initial ? 'Save strat' : 'Create strat'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function InviteModal({
  open,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onSubmit: (userCode: string) => Promise<void>
}) {
  const [userCode, setUserCode] = useState('')

  return (
    <Modal
      open={open}
      title="Invite player"
      description="Invite a player by their short user code."
      onClose={onClose}
    >
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(userCode)
        }}
      >
        <label>
          User code
          <input value={userCode} onChange={(event) => setUserCode(event.target.value.toUpperCase())} type="text" required />
        </label>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Inviting...' : 'Send invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RosterRow({
  member,
  team,
  isCreator,
  currentUserId,
  onRefresh,
  onConfirmKick,
  onConfirmLeave,
}: {
  member: TeamMember
  team: Team
  isCreator: boolean
  currentUserId: string
  onRefresh: () => Promise<void>
  onConfirmKick: (member: TeamMember) => void
  onConfirmLeave: (member: TeamMember) => void
}) {
  const [role, setRole] = useState(member.role)
  const [saving, setSaving] = useState(false)
  const { pushToast } = useToast()

  useEffect(() => {
    setRole(member.role)
  }, [member.role])

  const saveRole = async () => {
    if (!isCreator || role === member.role) return
    setSaving(true)

    try {
      await updateMember(member.id, { role })
      pushToast({ tone: 'success', title: 'Role updated' })
      await onRefresh()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not update role',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = async (field: 'can_add_lineups' | 'can_add_strats', value: boolean) => {
    setSaving(true)

    try {
      await updateMember(member.id, { [field]: value })
      pushToast({ tone: 'success', title: 'Permissions updated' })
      await onRefresh()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not update permissions',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const canManage = isCreator && member.user_id !== team.creator_id
  const isSelf = member.user_id === currentUserId

  return (
    <tr>
      <td>
        <div className="roster-user">
          {member.profile?.avatar_url ? (
            <img src={member.profile.avatar_url} alt="" className="team-avatar small" />
          ) : (
            <div className="team-avatar fallback small">
              {member.profile?.username.slice(0, 2).toUpperCase() ?? '??'}
            </div>
          )}
          <span>{member.profile?.username ?? 'Unknown'}</span>
        </div>
      </td>
      <td>#{member.profile?.user_code ?? '------'}</td>
      <td>
        {isCreator ? (
          <input
            className="table-input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onBlur={() => void saveRole()}
            disabled={!canManage || saving}
          />
        ) : (
          member.role
        )}
      </td>
      <td>
        <div className="permission-icons">
          <button
            type="button"
            className={`permission-toggle ${member.can_add_lineups ? 'active' : ''}`}
            title="Can add lineups"
            disabled={!canManage || saving}
            onClick={() => void togglePermission('can_add_lineups', !member.can_add_lineups)}
          >
            <img src="/assets/utilities/vector/smoke.svg" alt="" />
          </button>
          <button
            type="button"
            className={`permission-toggle ${member.can_add_strats ? 'active' : ''}`}
            title="Can add strats"
            disabled={!canManage || saving}
            onClick={() => void togglePermission('can_add_strats', !member.can_add_strats)}
          >
            <img src="/assets/editor/system/book.svg" alt="" />
          </button>
        </div>
      </td>
      <td>
        {canManage ? (
          <button type="button" className="danger-link" onClick={() => onConfirmKick(member)}>
            Kick
          </button>
        ) : !isCreator && isSelf ? (
          <button type="button" className="danger-link" onClick={() => onConfirmLeave(member)}>
            Leave team
          </button>
        ) : (
          <span className="muted-label">{member.user_id === team.creator_id ? 'Creator' : 'Member'}</span>
        )}
      </td>
    </tr>
  )
}

function MapSelector({
  activeMap,
  onSelect,
}: {
  activeMap: string
  onSelect: (mapId: string) => void
}) {
  return (
    <div className="map-pill-grid">
      {MAPS.map((map) => (
        <button
          key={map.id}
          type="button"
          className={`map-pill ${activeMap === map.id ? 'active' : ''}`}
          onClick={() => onSelect(map.id)}
          style={{ backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.15), rgba(2,6,23,0.84)), url(${map.backgroundSrc})` }}
        >
          <strong>{map.name}</strong>
        </button>
      ))}
    </div>
  )
}

export function TeamDashboardPage() {
  const { teamId, section } = useParams()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const { pushToast } = useToast()

  const activeSection = ['roster', 'lineups', 'strats'].includes(section ?? '')
    ? (section as DashboardSection)
    : 'roster'

  const [team, setTeam] = useState<Team | null>(null)
  const [membership, setMembership] = useState<TeamMember | null>(null)
  const [roster, setRoster] = useState<TeamMember[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [strats, setStrats] = useState<Strat[]>([])
  const [selectedMap, setSelectedMap] = useState(MAPS[0].id)
  const [loading, setLoading] = useState(true)
  const [lineupsLoading, setLineupsLoading] = useState(false)
  const [stratsLoading, setStratsLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [lineupModalOpen, setLineupModalOpen] = useState(false)
  const [lineupSaving, setLineupSaving] = useState(false)
  const [editingLineup, setEditingLineup] = useState<Lineup | null>(null)
  const [previewLineup, setPreviewLineup] = useState<Lineup | null>(null)
  const [stratModalOpen, setStratModalOpen] = useState(false)
  const [stratSaving, setStratSaving] = useState(false)
  const [editingStrat, setEditingStrat] = useState<Strat | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null)
  const [confirmationLoading, setConfirmationLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'All' | 'T' | 'CT'>('All')
  const [typeFilter, setTypeFilter] = useState<'all' | 'buyround' | 'force' | 'pistol'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const selectedMapMeta = MAPS.find((map) => map.id === selectedMap) ?? MAPS[0]

  const refreshDashboard = useCallback(async () => {
    if (!teamId || !profile) return
    setLoading(true)

    try {
      const bundle = await fetchTeamDashboard(teamId, profile.id)
      setTeam(bundle.team)
      setMembership(bundle.membership)
      setRoster(bundle.roster)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not load team',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }, [profile, pushToast, teamId])

  const refreshLineups = useCallback(async () => {
    if (!teamId) return
    setLineupsLoading(true)
    try {
      setLineups(await fetchLineups(teamId, selectedMapMeta.name))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not load lineups',
        message: getErrorMessage(error),
      })
    } finally {
      setLineupsLoading(false)
    }
  }, [pushToast, selectedMapMeta.name, teamId])

  const refreshStrats = useCallback(async () => {
    if (!teamId) return
    setStratsLoading(true)
    try {
      setStrats(await fetchStrats(teamId, selectedMapMeta.name))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not load strats',
        message: getErrorMessage(error),
      })
    } finally {
      setStratsLoading(false)
    }
  }, [pushToast, selectedMapMeta.name, teamId])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    if (activeSection === 'lineups') {
      void refreshLineups()
    }
    if (activeSection === 'strats') {
      void refreshStrats()
    }
  }, [activeSection, refreshLineups, refreshStrats])

  const creator = isTeamCreator(team, profile?.id)
  const canContributeLineups = canAddLineups(membership, creator)
  const canContributeStrats = canAddStrats(membership, creator)

  const filteredStrats = useMemo(() => {
    const source = [...strats]
    source.sort((a, b) =>
      sortOrder === 'newest'
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(a.created_at) - +new Date(b.created_at),
    )

    return source.filter((strat) => {
      const matchesSearch = strat.name.toLowerCase().includes(search.toLowerCase())
      const matchesSide = sideFilter === 'All' ? true : strat.side === sideFilter
      const matchesType = typeFilter === 'all' ? true : strat.types.includes(typeFilter)
      return matchesSearch && matchesSide && matchesType
    })
  }, [search, sideFilter, sortOrder, strats, typeFilter])

  if (!teamId || !profile) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return <section className="page-shell">Loading team dashboard...</section>
  }

  if (!team || !membership) {
    return <section className="page-shell">Team not found or access denied.</section>
  }

  const submitInvite = async (userCode: string) => {
    if (!team) return
    setInviteLoading(true)

    try {
      await createInvite(team.id, userCode)
      pushToast({ tone: 'success', title: 'Invite sent' })
      setInviteOpen(false)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not send invite',
        message: getErrorMessage(error),
      })
    } finally {
      setInviteLoading(false)
    }
  }

  const submitLineup = async (form: LineupFormState, files: File[]) => {
    if (!team || !profile) return
    setLineupSaving(true)

    try {
      let screenshots = editingLineup?.screenshots ?? []

      if (files.length > 0) {
        screenshots = await Promise.all(
          files.map((file) =>
            uploadFileToBucket(
              'lineup-screenshots',
              buildStoragePath(`lineups/${profile.id}/${team.id}`, file.name),
              file,
            ),
          ),
        )
      }

      if (!editingLineup && screenshots.length === 0) {
        throw new Error('Upload at least one screenshot.')
      }

      const payload = {
        team_id: team.id,
        author_id: profile.id,
        map: selectedMapMeta.name,
        name: form.name,
        description: form.description || null,
        video_url: form.video_url || null,
        side: form.side,
        throw_stance: form.throw_stance,
        throw_movement: form.throw_movement,
        throw_jump: form.throw_jump,
        grenade_type: form.grenade_type,
        screenshots,
      }

      if (editingLineup) {
        await updateLineup(editingLineup.id, payload)
        pushToast({ tone: 'success', title: 'Lineup updated' })
      } else {
        await createLineup(payload)
        pushToast({ tone: 'success', title: 'Lineup created' })
      }

      setLineupModalOpen(false)
      setEditingLineup(null)
      await refreshLineups()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not save lineup',
        message: getErrorMessage(error),
      })
    } finally {
      setLineupSaving(false)
    }
  }

  const submitStrat = async (form: StratFormState) => {
    if (!team || !profile) return
    setStratSaving(true)

    try {
      const payload = {
        team_id: team.id,
        author_id: profile.id,
        map: selectedMapMeta.name,
        name: form.name,
        types: form.types,
        side: form.side,
        note: form.note || null,
        video_url: form.video_url || null,
      }

      if (editingStrat) {
        await updateStrat(editingStrat.id, payload)
        pushToast({ tone: 'success', title: 'Strat updated' })
      } else {
        await createStrat(payload)
        pushToast({ tone: 'success', title: 'Strat created' })
      }

      setStratModalOpen(false)
      setEditingStrat(null)
      await refreshStrats()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not save strat',
        message: getErrorMessage(error),
      })
    } finally {
      setStratSaving(false)
    }
  }

  const confirmAction = async () => {
    if (!confirmation) return
    setConfirmationLoading(true)

    try {
      if (confirmation.kind === 'kick' || confirmation.kind === 'leave') {
        await removeMember(confirmation.member.id)
        pushToast({
          tone: 'success',
          title: confirmation.kind === 'kick' ? 'Member removed' : 'You left the team',
        })
        setConfirmation(null)
        await refreshDashboard()
        if (confirmation.kind === 'leave') {
          navigate('/')
        }
      }

      if (confirmation.kind === 'disband-team') {
        await disbandTeam(team.id, profile.id)
        pushToast({ tone: 'success', title: 'Team disbanded' })
        setConfirmation(null)
        await refreshProfile()
        await refreshDashboard()
      }

      if (confirmation.kind === 'delete-team') {
        await deleteTeam(team.id)
        pushToast({ tone: 'success', title: 'Team deleted' })
        setConfirmation(null)
        await refreshProfile()
        navigate('/')
      }

      if (confirmation.kind === 'delete-lineup') {
        await deleteLineup(confirmation.lineup.id)
        pushToast({ tone: 'success', title: 'Lineup deleted' })
        setConfirmation(null)
        await refreshLineups()
      }

      if (confirmation.kind === 'delete-strat') {
        await deleteStrat(confirmation.strat.id)
        pushToast({ tone: 'success', title: 'Strat deleted' })
        setConfirmation(null)
        await refreshStrats()
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Action failed',
        message: getErrorMessage(error),
      })
    } finally {
      setConfirmationLoading(false)
    }
  }

  return (
    <section className="page-shell team-dashboard-page">
      <div className="team-dashboard-header team-hub-panel">
        <div className="roster-user">
          {team.avatar_url ? (
            <img src={team.avatar_url} alt="" className="team-avatar" />
          ) : (
            <div className="team-avatar fallback">{team.name.slice(0, 2).toUpperCase()}</div>
          )}
          <div>
            <p className="eyebrow">Team Dashboard</p>
            <h1>{team.name}</h1>
            <span className="hero-text">
              {creator ? 'Creator access' : 'Member access'} · role: {membership.role}
            </span>
          </div>
        </div>

        <div className="dashboard-tabs">
          {(['roster', 'lineups', 'strats'] as DashboardSection[]).map((tab) => (
            <Link key={tab} to={`/team/${team.id}/${tab}`} className={`dashboard-tab ${activeSection === tab ? 'active' : ''}`}>
              {tab}
            </Link>
          ))}
        </div>
      </div>

      {activeSection === 'roster' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">Roster</p>
              <h3>Team members</h3>
            </div>
            {creator ? (
              <div className="inline-actions">
                <button type="button" className="ghost-action" onClick={() => setConfirmation({ kind: 'disband-team' })}>
                  Disband team
                </button>
                <button type="button" className="danger-action" onClick={() => setConfirmation({ kind: 'delete-team' })}>
                  Delete team
                </button>
                <button type="button" className="primary-action" onClick={() => setInviteOpen(true)}>
                  Invite by user code
                </button>
              </div>
            ) : null}
          </div>

          <div className="table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>User Code</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((member) => (
                  <RosterRow
                    key={member.id}
                    member={member}
                    team={team}
                    isCreator={creator}
                    currentUserId={profile.id}
                    onRefresh={refreshDashboard}
                    onConfirmKick={(nextMember) => setConfirmation({ kind: 'kick', member: nextMember })}
                    onConfirmLeave={(nextMember) => setConfirmation({ kind: 'leave', member: nextMember })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeSection === 'lineups' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">Lineups</p>
              <h3>Utility lineups by map</h3>
            </div>
          </div>

          <MapSelector activeMap={selectedMap} onSelect={setSelectedMap} />

          {lineupsLoading ? (
            <div className="empty-panel">
              <strong>Loading lineups...</strong>
            </div>
          ) : lineups.length ? (
            <div className="content-grid">
              {lineups.map((lineup) => {
                const canEdit = canEditOwnContent(membership, creator, lineup.author_id, profile.id, 'lineups')
                return (
                  <article key={lineup.id} className="content-card">
                    <div className="content-card-body">
                      <div className="content-badge-row">
                        <GrenadeBadge type={lineup.grenade_type} />
                        <SideBadge side={lineup.side} />
                      </div>
                      <h4>{lineup.name}</h4>
                      <p>{lineup.description || 'No description provided.'}</p>
                      <div className="lineup-throw-icons">
                        <img src={THROW_STANCE_OPTIONS.find((item) => item.value === lineup.throw_stance)?.icon ?? ''} alt="" />
                        <img src={THROW_MOVEMENT_OPTIONS.find((item) => item.value === lineup.throw_movement)?.icon ?? ''} alt="" />
                        <img src={lineup.throw_jump ? '/assets/editor/system/pose_jump.svg' : '/assets/editor/system/pose_still.svg'} alt="" />
                      </div>
                      <div className="content-meta-row">
                        <span>{lineup.author?.username ?? 'Unknown author'}</span>
                        <span>{new Date(lineup.created_at).toLocaleDateString()}</span>
                      </div>
                      {(canEdit || creator) ? (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => setPreviewLineup(lineup)}
                          >
                            View
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className="ghost-action"
                              onClick={() => {
                                setEditingLineup(lineup)
                                setLineupModalOpen(true)
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          {creator ? (
                            <button
                              type="button"
                              className="danger-link"
                              onClick={() => setConfirmation({ kind: 'delete-lineup', lineup })}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => setPreviewLineup(lineup)}
                          >
                            View
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <strong>No lineups for {selectedMapMeta.name}</strong>
              <span>Create the first lineup for this map when permissions allow it.</span>
            </div>
          )}
        </div>
      ) : null}

      {activeSection === 'strats' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">Strats</p>
              <h3>Team strategy board</h3>
            </div>
          </div>

          <MapSelector activeMap={selectedMap} onSelect={setSelectedMap} />

          <div className="filter-bar">
            <input
              className="table-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by strat name"
            />
            <div className="chip-row">
              {['All', 'T', 'CT'].map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`filter-chip ${sideFilter === side ? 'active' : ''}`}
                  onClick={() => setSideFilter(side as 'All' | 'T' | 'CT')}
                >
                  {side}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {['all', 'buyround', 'force', 'pistol'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
                  onClick={() => setTypeFilter(type as 'all' | 'buyround' | 'force' | 'pistol')}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() => setSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))}
            >
              {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>

          {stratsLoading ? (
            <div className="empty-panel">
              <strong>Loading strats...</strong>
            </div>
          ) : filteredStrats.length ? (
            <div className="content-grid">
              {filteredStrats.map((strat) => {
                const canEdit = canEditOwnContent(membership, creator, strat.author_id, profile.id, 'strats')
                return (
                  <article key={strat.id} className="content-card compact">
                    <div className="content-card-body">
                      <div className="content-badge-row">
                        <SideBadge side={strat.side} />
                        {strat.types.map((type) => (
                          <span key={type} className="filter-chip active small">{type}</span>
                        ))}
                      </div>
                      <h4>{strat.name}</h4>
                      <p>{strat.note || 'No note provided.'}</p>
                      <div className="content-meta-row">
                        <span>{strat.author?.username ?? 'Unknown author'}</span>
                        <span>{new Date(strat.created_at).toLocaleDateString()}</span>
                      </div>
                      {(canEdit || creator) ? (
                        <div className="inline-actions">
                          {canEdit ? (
                            <button
                              type="button"
                              className="ghost-action"
                              onClick={() => {
                                setEditingStrat(strat)
                                setStratModalOpen(true)
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          {creator ? (
                            <button
                              type="button"
                              className="danger-link"
                              onClick={() => setConfirmation({ kind: 'delete-strat', strat })}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <strong>No strats match the current filters</strong>
              <span>Change map or filters, or create the first strategy for this section.</span>
            </div>
          )}
        </div>
      ) : null}

      {activeSection === 'lineups' && canContributeLineups ? (
        <button
          type="button"
          className="fab-action"
          onClick={() => {
            setEditingLineup(null)
            setLineupModalOpen(true)
          }}
        >
          Add line-up
        </button>
      ) : null}

      {activeSection === 'strats' && canContributeStrats ? (
        <button
          type="button"
          className="fab-action"
          onClick={() => {
            setEditingStrat(null)
            setStratModalOpen(true)
          }}
        >
          Add Strat
        </button>
      ) : null}

      <InviteModal
        key={`invite-${String(inviteOpen)}`}
        open={inviteOpen}
        loading={inviteLoading}
        onClose={() => setInviteOpen(false)}
        onSubmit={submitInvite}
      />

      <LineupModal
        key={`lineup-${editingLineup?.id ?? 'new'}-${String(lineupModalOpen)}`}
        open={lineupModalOpen}
        loading={lineupSaving}
        initial={editingLineup}
        onClose={() => {
          setLineupModalOpen(false)
          setEditingLineup(null)
        }}
        onSubmit={submitLineup}
      />

      <LineupPreviewModal
        lineup={previewLineup}
        open={Boolean(previewLineup)}
        onClose={() => setPreviewLineup(null)}
      />

      <StratModal
        key={`strat-${editingStrat?.id ?? 'new'}-${String(stratModalOpen)}`}
        open={stratModalOpen}
        loading={stratSaving}
        initial={editingStrat}
        onClose={() => {
          setStratModalOpen(false)
          setEditingStrat(null)
        }}
        onSubmit={submitStrat}
      />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.kind === 'kick'
            ? 'Kick player'
            : confirmation?.kind === 'leave'
              ? 'Leave team'
              : confirmation?.kind === 'disband-team'
                ? 'Disband team'
                : confirmation?.kind === 'delete-team'
                  ? 'Delete team'
              : confirmation?.kind === 'delete-lineup'
                ? 'Delete lineup'
                : 'Delete strat'
        }
        description={
          confirmation?.kind === 'kick'
            ? `Remove ${confirmation.member.profile?.username ?? 'this member'} from the roster?`
            : confirmation?.kind === 'leave'
              ? 'Are you sure you want to leave this team?'
              : confirmation?.kind === 'disband-team'
                ? 'Remove every member except the creator from this team?'
                : confirmation?.kind === 'delete-team'
                  ? 'Delete this team permanently? This removes the roster, line-ups and strats.'
              : confirmation?.kind === 'delete-lineup'
                ? `Delete lineup "${confirmation.lineup.name}"?`
                : confirmation?.kind === 'delete-strat'
                  ? `Delete strat "${confirmation.strat.name}"?`
                  : ''
        }
        danger
        loading={confirmationLoading}
        confirmLabel={
          confirmation?.kind === 'delete-team'
            ? 'Delete team'
            : confirmation?.kind === 'disband-team'
              ? 'Disband team'
              : 'Confirm'
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmAction()}
      />
    </section>
  )
}
