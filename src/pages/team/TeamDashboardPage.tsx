import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CommentThread } from '../../components/team/CommentThread'
import { ReplayStepBoardModal } from '../../components/team/ReplayStepBoardModal'
import { ScenePreviewBoard } from '../../components/team/ScenePreviewBoard'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { getMapAnchorLabel, getMapAnchors } from '../../data/mapAnchors'
import { MAPS } from '../../data/maps'
import { TEAM_ROLE_PRESETS, TEAM_ROLE_PRESET_LABELS } from '../../data/teamRoles'
import { GRENADE_BADGES, SIDE_BADGES, THROW_JUMP_OPTIONS, THROW_MOVEMENT_OPTIONS, THROW_STANCE_OPTIONS } from '../../data/throwSettings'
import { canAddLineups, canAddStrats, canEditOwnContent, isTeamCreator } from '../../data/teamHelpers'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useLocale } from '../../hooks/useLocale'
import { getErrorMessage } from '../../lib/errors'
import { exportNodeAsPng } from '../../lib/shareCard'
import { buildStoragePath, uploadFileToBucket } from '../../lib/storage'
import {
  addLineupFavorite,
  createInvite,
  createLineup,
  createLineupComment,
  createStrat,
  createStratComment,
  deleteTeam,
  deleteLineupComment,
  deleteLineup,
  deleteStratComment,
  deleteStrat,
  disbandTeam,
  fetchFavoriteLineupIds,
  fetchLineupComments,
  fetchLineups,
  fetchStratComments,
  fetchStratVersions,
  fetchStrats,
  fetchTeamDashboard,
  recordStratVersion,
  removeLineupFavorite,
  removeMember,
  replaceStratLinkedLineups,
  restoreStratVersion,
  updateLineup,
  updateMember,
  updateStrat,
} from '../../lib/teamApi'
import type {
  Lineup,
  LineupComment,
  Strat,
  StratComment,
  StratReplayStep,
  StratTrainingChecklistItem,
  StratVersion,
  Team,
  TeamMember,
  TeamRolePreset,
} from '../../types/domain'
import type { MapDefinition, SceneState } from '../../types/editor'

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
  anchor_ids: string[]
}

type StratFormState = {
  name: string
  note: string
  video_url: string
  side: 'T' | 'CT'
  types: string[]
  anchor_ids: string[]
  linked_lineup_ids: string[]
  replay_steps: StratReplayStep[]
  training_checklist: StratTrainingChecklistItem[]
}

type SupportedLocale = 'en' | 'ru'

const ROLE_PRESET_LABELS: Record<SupportedLocale, Record<TeamRolePreset, string>> = {
  en: TEAM_ROLE_PRESET_LABELS,
  ru: {
    igl: 'IGL',
    entry: 'Энтри',
    support: 'Саппорт',
    lurker: 'Луркер',
    awp: 'AWP',
  },
}

const STRAT_TYPE_LABELS: Record<SupportedLocale, Record<'buyround' | 'force' | 'pistol', string>> = {
  en: {
    buyround: 'buyround',
    force: 'force',
    pistol: 'pistol',
  },
  ru: {
    buyround: 'закуп',
    force: 'форс',
    pistol: 'пистолеты',
  },
}

const GRENADE_TYPE_LABELS: Record<SupportedLocale, Record<Lineup['grenade_type'], string>> = {
  en: {
    smoke: 'Smoke',
    flash: 'Flash',
    grenade: 'HE',
    molotov: 'Molotov',
  },
  ru: {
    smoke: 'Смок',
    flash: 'Флеш',
    grenade: 'HE',
    molotov: 'Молотов',
  },
}

function getRolePresetLabel(locale: SupportedLocale, rolePreset: TeamRolePreset) {
  return ROLE_PRESET_LABELS[locale][rolePreset]
}

function getStratTypeLabel(locale: SupportedLocale, type: 'buyround' | 'force' | 'pistol') {
  return STRAT_TYPE_LABELS[locale][type]
}

function getGrenadeTypeLabel(locale: SupportedLocale, type: Lineup['grenade_type']) {
  return GRENADE_TYPE_LABELS[locale][type]
}

function createEmptyScene(): SceneState {
  return { entities: [], paths: [] }
}

function createReplayStep(index: number): StratReplayStep {
  return {
    id: crypto.randomUUID(),
    title: `Step ${index}`,
    note: null,
    scene: createEmptyScene(),
  }
}

function createTrainingChecklistItem(index: number): StratTrainingChecklistItem {
  return {
    id: crypto.randomUUID(),
    title: `Task ${index}`,
    note: null,
    role_preset: null,
    step_id: null,
  }
}

function AnchorPills({
  mapId,
  anchorIds,
}: {
  mapId: string
  anchorIds: string[]
}) {
  if (!anchorIds.length) return null

  return (
    <div className="anchor-pill-row">
      {anchorIds.map((anchorId) => (
        <span key={anchorId} className="anchor-pill">
          {getMapAnchorLabel(mapId, anchorId)}
        </span>
      ))}
    </div>
  )
}

function RolePresetBadge({ rolePreset }: { rolePreset: TeamRolePreset | null }) {
  const { locale, t } = useLocale()

  if (!rolePreset) {
    return <span className="muted-label">{t('common.none')}</span>
  }

  return (
    <span className={`role-preset-badge role-preset-${rolePreset}`}>
      {getRolePresetLabel(locale, rolePreset)}
    </span>
  )
}

function FavoriteButton({
  active,
  onClick,
  withLabel = false,
}: {
  active: boolean
  onClick: () => void
  withLabel?: boolean
}) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'

  return (
    <button
      type="button"
      className={`favorite-toggle ${active ? 'active' : ''} ${withLabel ? 'with-label' : ''}`}
      aria-label={active ? (isRu ? 'Убрать из избранного' : 'Remove from favorites') : isRu ? 'Добавить в избранное' : 'Add to favorites'}
      aria-pressed={active}
      title={active ? (isRu ? 'Сохранено в избранное' : 'Saved to favorites') : isRu ? 'Сохранить в избранное' : 'Save to favorites'}
      onClick={onClick}
    >
      <span aria-hidden="true">★</span>
      {withLabel ? <span>{active ? (isRu ? 'В избранном' : 'Favorited') : isRu ? 'Добавить в избранное' : 'Add to favorites'}</span> : null}
    </button>
  )
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
  const { locale } = useLocale()
  const config = GRENADE_BADGES[type]
  return (
    <span className={`pill-badge grenade-badge ${config.className}`}>
      <img src={config.icon} alt="" />
      {getGrenadeTypeLabel(locale, type)}
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
  map,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  initial?: Lineup | null
  map: MapDefinition
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
    anchor_ids: initial?.anchor_ids ?? [],
  })
  const [files, setFiles] = useState<File[]>([])
  const mapAnchors = getMapAnchors(map.id)
  const { locale, t } = useLocale()
  const isRu = locale === 'ru'

  const toggleAnchor = (anchorId: string) => {
    setForm((current) => {
      const exists = current.anchor_ids.includes(anchorId)
      return {
        ...current,
        anchor_ids: exists
          ? current.anchor_ids.filter((id) => id !== anchorId)
          : [...current.anchor_ids, anchorId],
      }
    })
  }

  return (
    <Modal open={open} title={initial ? (isRu ? 'Редактировать лайнап' : 'Edit lineup') : isRu ? 'Добавить лайнап' : 'Add lineup'} onClose={onClose}>
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(form, files)
        }}
      >
        <label>
          {isRu ? 'Название' : 'Name'}
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            required
          />
        </label>

        <label>
          {isRu ? 'Описание' : 'Description'}
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
          />
        </label>

        <label>
          {isRu ? 'Ссылка на видео' : 'Video URL'}
          <input
            value={form.video_url}
            onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))}
            type="url"
          />
        </label>

        <div className="field-group">
          <span>{isRu ? 'Сторона' : 'Side'}</span>
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
          <span>{isRu ? 'Стойка' : 'Stance'}</span>
          <ToggleIconGroup
            options={THROW_STANCE_OPTIONS}
            value={form.throw_stance}
            onChange={(value) => setForm((current) => ({ ...current, throw_stance: value }))}
          />
        </div>

        <div className="field-group">
          <span>{isRu ? 'Движение' : 'Movement'}</span>
          <ToggleIconGroup
            options={THROW_MOVEMENT_OPTIONS}
            value={form.throw_movement}
            onChange={(value) => setForm((current) => ({ ...current, throw_movement: value }))}
          />
        </div>

        <div className="field-group">
          <span>{isRu ? 'Прыжок' : 'Jump'}</span>
          <ToggleIconGroup
            options={THROW_JUMP_OPTIONS}
            value={form.throw_jump}
            onChange={(value) => setForm((current) => ({ ...current, throw_jump: value }))}
          />
        </div>

        <div className="field-group">
          <span>{isRu ? 'Тип гранаты' : 'Grenade type'}</span>
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

        <div className="field-group">
          <span>{isRu ? 'Закрепленные точки / anchors' : 'Pinned callouts / anchors'}</span>
          <div className="anchor-chip-grid">
            {mapAnchors.map((anchor) => (
              <button
                key={anchor.id}
                type="button"
                className={`anchor-chip ${form.anchor_ids.includes(anchor.id) ? 'active' : ''}`}
                onClick={() => toggleAnchor(anchor.id)}
              >
                {anchor.label}
              </button>
            ))}
          </div>
          <p className="form-hint">
            {isRu
              ? 'Используйте anchors, чтобы пометить точную зону, к которой относится этот лайнап.'
              : 'Use anchors to tag the exact area this lineup belongs to.'}
          </p>
        </div>

        <label>
          {isRu ? 'Скриншоты' : 'Screenshots'} {initial ? (isRu ? '(загрузите, чтобы заменить или добавить)' : '(upload to replace/add)') : ''}
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
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? (isRu ? 'Сохраняем...' : 'Saving...') : initial ? (isRu ? 'Сохранить лайнап' : 'Save lineup') : isRu ? 'Создать лайнап' : 'Create lineup'}
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
  mapId,
  currentUserId,
  canModerate,
  isFavorite,
  onToggleFavorite,
}: {
  lineup: Lineup | null
  open: boolean
  onClose: () => void
  mapId: string
  currentUserId: string
  canModerate: boolean
  isFavorite: boolean
  onToggleFavorite: (lineup: Lineup) => Promise<void> | void
}) {
  const [comments, setComments] = useState<LineupComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const { pushToast } = useToast()
  const { locale, formatDate } = useLocale()
  const isRu = locale === 'ru'

  const refreshComments = useCallback(async () => {
    if (!lineup) return

    setLoadingComments(true)

    try {
      setComments(await fetchLineupComments(lineup.id))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось загрузить обсуждение лайнапа' : 'Could not load lineup discussion',
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingComments(false)
    }
  }, [lineup, pushToast])

  useEffect(() => {
    if (open) {
      void refreshComments()
    }
  }, [open, refreshComments])

  if (!lineup) return null

  return (
    <Modal open={open} title={lineup.name} description={isRu ? 'Подробный просмотр лайнапа' : 'Detailed lineup view'} onClose={onClose}>
      <div className="lineup-detail-view">
        <img src={lineup.screenshots[0]} alt={lineup.name} className="lineup-detail-image" />

        <div className="content-badge-row">
          <GrenadeBadge type={lineup.grenade_type} />
          <SideBadge side={lineup.side} />
        </div>

        <AnchorPills mapId={mapId} anchorIds={lineup.anchor_ids} />

        <p>{lineup.description || (isRu ? 'Описание не добавлено.' : 'No description provided.')}</p>

        <div className="lineup-throw-icons lineup-throw-icons-detail">
          <img src={THROW_STANCE_OPTIONS.find((item) => item.value === lineup.throw_stance)?.icon ?? ''} alt="" />
          <img src={THROW_MOVEMENT_OPTIONS.find((item) => item.value === lineup.throw_movement)?.icon ?? ''} alt="" />
          <img src={lineup.throw_jump ? '/assets/editor/system/pose_jump.svg' : '/assets/editor/system/pose_still.svg'} alt="" />
        </div>

        <div className="content-meta-row">
          <span>{lineup.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}</span>
          <span>{formatDate(lineup.created_at)}</span>
        </div>

        <div className="inline-actions">
          <FavoriteButton active={isFavorite} withLabel onClick={() => void onToggleFavorite(lineup)} />
          {lineup.video_url ? (
            <a href={lineup.video_url} target="_blank" rel="noreferrer" className="ghost-action">
              {isRu ? 'Открыть видео' : 'Open video'}
            </a>
          ) : null}
        </div>

        <CommentThread
          title={isRu ? 'Обсуждение лайнапа' : 'Lineup discussion'}
          comments={comments}
          loading={loadingComments}
          currentUserId={currentUserId}
          canModerate={canModerate}
          placeholder={isRu ? 'Добавьте заметку, предупреждение или совет по этому лайнапу...' : 'Add a note, warning or setup tip for this lineup...'}
          submitLabel={isRu ? 'Отправить комментарий' : 'Post comment'}
          onSubmit={async (body) => {
            try {
              await createLineupComment({
                lineupId: lineup.id,
                teamId: lineup.team_id,
                authorId: currentUserId,
                body,
              })
              await refreshComments()
            } catch (error) {
              pushToast({
                tone: 'error',
                title: isRu ? 'Не удалось отправить комментарий к лайнапу' : 'Could not post lineup comment',
                message: getErrorMessage(error),
              })
              throw error
            }
          }}
          onDelete={async (commentId) => {
            try {
              await deleteLineupComment(commentId)
              await refreshComments()
            } catch (error) {
              pushToast({
                tone: 'error',
                title: isRu ? 'Не удалось удалить комментарий к лайнапу' : 'Could not delete lineup comment',
                message: getErrorMessage(error),
              })
              throw error
            }
          }}
        />
      </div>
    </Modal>
  )
}

function StratModal({
  open,
  loading,
  initial,
  availableLineups,
  map,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  initial?: Strat | null
  availableLineups: Lineup[]
  map: MapDefinition
  onClose: () => void
  onSubmit: (form: StratFormState) => Promise<void>
}) {
  const [form, setForm] = useState<StratFormState>({
    name: initial?.name ?? '',
    note: initial?.note ?? '',
    video_url: initial?.video_url ?? '',
    side: initial?.side ?? 'T',
    types: initial?.types ?? ['buyround'],
    anchor_ids: initial?.anchor_ids ?? [],
    linked_lineup_ids: initial?.linked_lineups?.map((lineup) => lineup.id) ?? [],
    replay_steps: initial?.replay_steps ?? [],
    training_checklist: initial?.training_checklist ?? [],
  })
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const mapAnchors = getMapAnchors(map.id)
  const { locale, t } = useLocale()
  const isRu = locale === 'ru'

  const toggleType = (type: string) => {
    setForm((current) => {
      const exists = current.types.includes(type)
      const nextTypes = exists ? current.types.filter((item) => item !== type) : [...current.types, type]
      return { ...current, types: nextTypes }
    })
  }

  const toggleLinkedLineup = (lineupId: string) => {
    setForm((current) => {
      const exists = current.linked_lineup_ids.includes(lineupId)
      return {
        ...current,
        linked_lineup_ids: exists
          ? current.linked_lineup_ids.filter((id) => id !== lineupId)
          : [...current.linked_lineup_ids, lineupId],
      }
    })
  }

  const toggleAnchor = (anchorId: string) => {
    setForm((current) => {
      const exists = current.anchor_ids.includes(anchorId)
      return {
        ...current,
        anchor_ids: exists
          ? current.anchor_ids.filter((id) => id !== anchorId)
          : [...current.anchor_ids, anchorId],
      }
    })
  }

  return (
    <Modal open={open} title={initial ? (isRu ? 'Редактировать стратегию' : 'Edit strat') : isRu ? 'Добавить стратегию' : 'Add strat'} onClose={onClose}>
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (form.types.length === 0) return
          void onSubmit(form)
        }}
      >
        <label>
          {isRu ? 'Название' : 'Name'}
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            required
          />
        </label>

        <label>
          {isRu ? 'Заметка' : 'Note'}
          <textarea
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            rows={4}
          />
        </label>

        <label>
          {isRu ? 'Ссылка на видео' : 'Video URL'}
          <input
            value={form.video_url}
            onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))}
            type="url"
          />
        </label>

        <div className="field-group">
          <span>{isRu ? 'Сторона' : 'Side'}</span>
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
          <span>{isRu ? 'Типы' : 'Types'}</span>
          <div className="chip-row">
            {['buyround', 'force', 'pistol'].map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-chip ${form.types.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
              >
                {getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}
              </button>
            ))}
          </div>
          {form.types.length === 0 ? <p className="form-hint error">{isRu ? 'Выберите хотя бы один тип стратегии.' : 'Pick at least one strat type.'}</p> : null}
        </div>

        <div className="field-group">
          <span>{isRu ? 'Закрепленные точки / anchors' : 'Pinned callouts / anchors'}</span>
          <div className="anchor-chip-grid">
            {mapAnchors.map((anchor) => (
              <button
                key={anchor.id}
                type="button"
                className={`anchor-chip ${form.anchor_ids.includes(anchor.id) ? 'active' : ''}`}
                onClick={() => toggleAnchor(anchor.id)}
              >
                {anchor.label}
              </button>
            ))}
          </div>
          <p className="form-hint">{isRu ? 'Отметьте ключевые зоны, которые эта стратегия контролирует или через которые заканчивается.' : 'Tag the key areas this strat controls or finishes through.'}</p>
        </div>

        <div className="field-group">
          <span>{isRu ? 'Связанные лайнапы' : 'Linked lineups'}</span>
          {availableLineups.length ? (
            <div className="linked-lineup-grid">
              {availableLineups.map((lineup) => {
                const active = form.linked_lineup_ids.includes(lineup.id)

                return (
                  <button
                    key={lineup.id}
                    type="button"
                    className={`linked-lineup-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleLinkedLineup(lineup.id)}
                  >
                    <strong>{lineup.name}</strong>
                    <span>{getGrenadeTypeLabel(locale, lineup.grenade_type)} · {lineup.side}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="form-hint">{isRu ? 'На этой карте пока нет лайнапов. Сначала создайте их, затем привяжите к стратегии.' : 'No lineups on this map yet. Create them first, then link them to the strat.'}</p>
          )}
        </div>

        <div className="field-group">
          <div className="replay-steps-header">
            <span>{isRu ? 'Мини replay flow' : 'Mini replay flow'}</span>
            <button
              type="button"
              className="ghost-action"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  replay_steps: [...current.replay_steps, createReplayStep(current.replay_steps.length + 1)],
                }))
              }
            >
              {isRu ? 'Добавить шаг' : 'Add step'}
            </button>
          </div>

          {form.replay_steps.length ? (
            <div className="replay-step-list">
              {form.replay_steps.map((step, index) => (
                <article key={step.id} className="replay-step-card">
                  <label>
                    {isRu ? 'Название шага' : 'Step title'}
                    <input
                      type="text"
                      value={step.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          replay_steps: current.replay_steps.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>

                  <label>
                    {isRu ? 'Заметка к шагу' : 'Step note'}
                    <textarea
                      rows={2}
                      value={step.note ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          replay_steps: current.replay_steps.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, note: event.target.value || null }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>

                  <div className="replay-step-actions">
                    <button type="button" className="ghost-action" onClick={() => setEditingStepIndex(index)}>
                      {isRu ? 'Редактировать доску' : 'Edit board'}
                    </button>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          replay_steps: current.replay_steps.filter((_, itemIndex) => itemIndex !== index),
                          training_checklist: current.training_checklist.map((task) =>
                            task.step_id === step.id
                              ? { ...task, step_id: null }
                              : task,
                          ),
                        }))
                      }
                    >
                      {isRu ? 'Удалить' : 'Remove'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="form-hint">{isRu ? 'Добавьте шаги с доской, чтобы превратить стратегию в пошаговый replay.' : 'Add board steps to turn this strat into a guided round-by-round replay.'}</p>
          )}
        </div>

        <div className="field-group">
          <div className="replay-steps-header">
            <span>{isRu ? 'Тренировочный чеклист' : 'Training checklist'}</span>
            <button
              type="button"
              className="ghost-action"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  training_checklist: [
                    ...current.training_checklist,
                    createTrainingChecklistItem(current.training_checklist.length + 1),
                  ],
                }))
              }
            >
              {isRu ? 'Добавить задачу' : 'Add task'}
            </button>
          </div>

          {form.training_checklist.length ? (
            <div className="training-task-list">
              {form.training_checklist.map((task, index) => (
                <article key={task.id} className="training-task-card">
                  <label>
                    {isRu ? 'Название задачи' : 'Task title'}
                    <input
                      type="text"
                      value={task.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          training_checklist: current.training_checklist.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>

                  <div className="training-task-row">
                    <label>
                      {isRu ? 'Роль' : 'Role preset'}
                      <select
                        className="table-input"
                        value={task.role_preset ?? ''}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            training_checklist: current.training_checklist.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, role_preset: (event.target.value as TeamRolePreset | '') || null }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="">{isRu ? 'Любая роль' : 'Any role'}</option>
                        {TEAM_ROLE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {getRolePresetLabel(locale, preset.value)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      {isRu ? 'Шаг replay' : 'Replay step'}
                      <select
                        className="table-input"
                        value={task.step_id ?? ''}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            training_checklist: current.training_checklist.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, step_id: event.target.value || null }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="">{isRu ? 'Все шаги' : 'All steps'}</option>
                        {form.replay_steps.map((step, stepIndex) => (
                          <option key={step.id} value={step.id}>
                            {stepIndex + 1}. {step.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    {isRu ? 'Заметка к задаче' : 'Task note'}
                    <textarea
                      rows={2}
                      value={task.note ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          training_checklist: current.training_checklist.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, note: event.target.value || null }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>

                  <div className="replay-step-actions">
                    <span className="form-hint">{isRu ? 'Привяжите задачу к конкретному шагу replay или оставьте общей.' : 'Attach the task to one replay step or keep it global.'}</span>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          training_checklist: current.training_checklist.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      {isRu ? 'Удалить' : 'Remove'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="form-hint">{isRu ? 'Добавьте тренировочные задачи, чтобы команда могла отрабатывать стратегию по чеклисту.' : 'Add drill tasks so teammates can run the strat as a checklist during practice.'}</p>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary-action" disabled={loading || form.types.length === 0}>
            {loading ? (isRu ? 'Сохраняем...' : 'Saving...') : initial ? (isRu ? 'Сохранить стратегию' : 'Save strat') : isRu ? 'Создать стратегию' : 'Create strat'}
          </button>
        </div>
      </form>

      <ReplayStepBoardModal
        key={`replay-step-board-${editingStepIndex !== null ? form.replay_steps[editingStepIndex]?.id ?? 'new' : 'closed'}-${String(editingStepIndex !== null)}`}
        open={editingStepIndex !== null}
        map={map}
        scene={editingStepIndex !== null ? form.replay_steps[editingStepIndex]?.scene ?? createEmptyScene() : createEmptyScene()}
        onClose={() => setEditingStepIndex(null)}
        onSave={(scene) => {
          if (editingStepIndex === null) return

          setForm((current) => ({
            ...current,
            replay_steps: current.replay_steps.map((step, index) =>
              index === editingStepIndex
                ? { ...step, scene }
                : step,
            ),
          }))
          setEditingStepIndex(null)
        }}
      />
    </Modal>
  )
}

function StratShareCard({
  strat,
  map,
}: {
  strat: Strat
  map: MapDefinition
}) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const primaryStep = strat.replay_steps[0] ?? null
  const linkedLineups = strat.linked_lineups ?? []
  const previewLineups = linkedLineups.slice(0, 3)

  return (
    <div
      className="share-card"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.24), rgba(2,6,23,0.88)), url(${map.backgroundSrc})`,
      }}
    >
      <div className="share-card-topbar">
        <div>
          <p className="share-card-eyebrow">{isRu ? 'StratForge Share Card' : 'StratForge Share Card'}</p>
          <h3>{strat.name}</h3>
        </div>
        <span className="share-card-map">{map.name}</span>
      </div>

      <div className="content-badge-row">
        <SideBadge side={strat.side} />
        {strat.types.map((type) => (
          <span key={type} className="filter-chip active small">{getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}</span>
        ))}
      </div>

      <AnchorPills mapId={map.id} anchorIds={strat.anchor_ids} />

      <p className="share-card-note">
        {strat.note || (isRu ? 'Коротко разберите с командой ключевые маршруты, тайминги, утилити и условие победы в этом раунде.' : 'Brief your team with the key pathing, timings, utility and win condition for this round.')}
      </p>

      <div className="share-card-grid">
        <div className="share-card-panel">
          <span className="share-card-label">{isRu ? 'Снимок исполнения' : 'Execution snapshot'}</span>
          <strong>{primaryStep?.title ?? (isRu ? 'Replay-шагов пока нет' : 'No replay steps yet')}</strong>
          <p>{primaryStep?.note || (isRu ? 'Добавьте replay-шаги, чтобы превратить это в пошаговый тактический разбор.' : 'Add replay steps to turn this into a guided tactical walkthrough.')}</p>
        </div>

        <div className="share-card-panel">
          <span className="share-card-label">{isRu ? 'Привязанная утилита' : 'Attached utility'}</span>
          {previewLineups.length ? (
            <div className="share-card-lineups">
              {previewLineups.map((lineup) => (
                <span key={lineup.id} className="share-card-lineup-pill">
                  {lineup.name}
                </span>
              ))}
            </div>
          ) : (
            <p>{isRu ? 'Связанных лайнапов пока нет.' : 'No linked lineups yet.'}</p>
          )}
        </div>
      </div>

      <div className="share-card-footer">
        <span>{strat.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}</span>
        <span>{linkedLineups.length} {isRu ? 'лайнапов' : 'lineups'}</span>
        <span>{strat.replay_steps.length} {isRu ? 'шагов' : 'steps'}</span>
        <span>{strat.training_checklist.length} {isRu ? 'задач' : 'tasks'}</span>
      </div>
    </div>
  )
}

function StratPreviewModal({
  strat,
  open,
  onClose,
  map,
  currentUserId,
  canModerate,
  onOpenLineup,
  onOpenPresentation,
  onOpenTraining,
  onOpenVersionHistory,
}: {
  strat: Strat | null
  open: boolean
  onClose: () => void
  map: MapDefinition
  currentUserId: string
  canModerate: boolean
  onOpenLineup: (lineup: Lineup) => void
  onOpenPresentation: (strat: Strat) => void
  onOpenTraining: (strat: Strat) => void
  onOpenVersionHistory: (strat: Strat) => void
}) {
  const [comments, setComments] = useState<StratComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [exportingCard, setExportingCard] = useState(false)
  const { pushToast } = useToast()
  const { locale, formatDate } = useLocale()
  const isRu = locale === 'ru'
  const shareCardRef = useRef<HTMLDivElement | null>(null)

  const replaySteps = strat?.replay_steps ?? []
  const activeStep = replaySteps[activeStepIndex] ?? replaySteps[0] ?? null
  const linkedLineups = strat?.linked_lineups ?? []
  const trainingChecklist = strat?.training_checklist ?? []

  const refreshComments = useCallback(async () => {
    if (!strat) return

    setLoadingComments(true)

    try {
      setComments(await fetchStratComments(strat.id))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось загрузить обсуждение стратегии' : 'Could not load strat discussion',
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingComments(false)
    }
  }, [pushToast, strat])

  useEffect(() => {
    if (open) {
      setActiveStepIndex(0)
      void refreshComments()
    }
  }, [open, refreshComments])

  if (!strat) return null

  return (
    <Modal open={open} title={strat.name} description={isRu ? 'Подробный просмотр стратегии' : 'Detailed strat view'} onClose={onClose}>
      <div className="strat-detail-view">
        <div className="content-badge-row">
          <SideBadge side={strat.side} />
          {strat.types.map((type) => (
            <span key={type} className="filter-chip active small">{getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}</span>
          ))}
        </div>

        <AnchorPills mapId={map.id} anchorIds={strat.anchor_ids} />

        <p>{strat.note || (isRu ? 'Заметка не добавлена.' : 'No note provided.')}</p>

        <div className="content-meta-row">
          <span>{strat.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}</span>
          <span>{formatDate(strat.created_at)}</span>
        </div>

        {strat.video_url ? (
          <a href={strat.video_url} target="_blank" rel="noreferrer" className="ghost-action">
            {isRu ? 'Открыть видео' : 'Open video'}
          </a>
        ) : null}

        <div className="inline-actions">
          <button type="button" className="primary-action" onClick={() => onOpenPresentation(strat)}>
            {isRu ? 'Режим презентации' : 'Presentation mode'}
          </button>
          <button type="button" className="ghost-action" onClick={() => onOpenTraining(strat)}>
            {isRu ? 'Режим тренировки' : 'Training mode'}
          </button>
          <button
            type="button"
            className="ghost-action"
            disabled={exportingCard}
            onClick={async () => {
              if (!shareCardRef.current) return

              setExportingCard(true)
              try {
                const safeName = strat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'strat'
                await exportNodeAsPng(shareCardRef.current, `${safeName}-share-card.png`)
                pushToast({ tone: 'success', title: isRu ? 'Карточка экспортирована' : 'Share card exported' })
              } catch (error) {
                pushToast({
                  tone: 'error',
                  title: isRu ? 'Не удалось экспортировать share card' : 'Could not export share card',
                  message: getErrorMessage(error),
                })
              } finally {
                setExportingCard(false)
              }
            }}
          >
            {exportingCard ? (isRu ? 'Экспортируем...' : 'Exporting...') : isRu ? 'Экспортировать share card' : 'Export share card'}
          </button>
          <button type="button" className="ghost-action" onClick={() => onOpenVersionHistory(strat)}>
            {isRu ? 'История версий' : 'Version history'}
          </button>
        </div>

        <section className="detail-section">
          <div className="detail-section-header">
            <h4>{isRu ? 'Связанные лайнапы' : 'Linked lineups'}</h4>
            <span>{linkedLineups.length} {isRu ? 'прикреплено' : 'attached'}</span>
          </div>

          {linkedLineups.length ? (
            <div className="linked-lineup-grid linked-lineup-grid-preview">
              {linkedLineups.map((lineup) => (
                <button
                  key={lineup.id}
                  type="button"
                  className="linked-lineup-chip active"
                  onClick={() => onOpenLineup(lineup)}
                >
                  <strong>{lineup.name}</strong>
                    <span>{getGrenadeTypeLabel(locale, lineup.grenade_type)} · {lineup.side}</span>
                  </button>
                ))}
              </div>
          ) : (
            <p className="form-hint">{isRu ? 'У этой стратегии пока нет связанных лайнапов.' : 'No linked lineups yet for this strat.'}</p>
          )}
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <h4>{isRu ? 'Мини replay flow' : 'Mini replay flow'}</h4>
            <span>{replaySteps.length} {isRu ? 'шагов' : 'steps'}</span>
          </div>

          {activeStep ? (
            <div className="replay-player">
              <ScenePreviewBoard map={map} scene={activeStep.scene} />

              <div className="replay-player-sidebar">
                <div className="replay-player-current">
                  <strong>{activeStep.title}</strong>
                  <p>{activeStep.note || (isRu ? 'Заметка к шагу не добавлена.' : 'No step note provided.')}</p>
                </div>

                <div className="replay-player-controls">
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={activeStepIndex === 0}
                    onClick={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
                  >
                    {isRu ? 'Назад' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={activeStepIndex >= replaySteps.length - 1}
                    onClick={() => setActiveStepIndex((current) => Math.min(replaySteps.length - 1, current + 1))}
                  >
                    {isRu ? 'Далее' : 'Next'}
                  </button>
                </div>

                <div className="replay-step-pill-row">
                  {replaySteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      className={`replay-step-pill ${index === activeStepIndex ? 'active' : ''}`}
                      onClick={() => setActiveStepIndex(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="form-hint">{isRu ? 'Replay-шагов пока нет. Добавьте их при редактировании этой стратегии.' : 'No replay steps yet. Add them when editing this strat.'}</p>
          )}
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <h4>{isRu ? 'Тренировочный чеклист' : 'Training checklist'}</h4>
            <span>{trainingChecklist.length} {isRu ? 'задач' : 'tasks'}</span>
          </div>

          {trainingChecklist.length ? (
            <div className="training-preview-list">
              {trainingChecklist.slice(0, 4).map((task) => (
                <div key={task.id} className="training-preview-item">
                  <div className="training-check-header">
                    <strong>{task.title}</strong>
                    <RolePresetBadge rolePreset={task.role_preset} />
                  </div>
                  <p>{task.note || (isRu ? 'Дополнительная заметка не добавлена.' : 'No extra note provided.')}</p>
                </div>
              ))}
              {trainingChecklist.length > 4 ? (
                <p className="form-hint">{isRu ? 'Откройте режим тренировки, чтобы пройти весь чеклист.' : 'Open Training mode to work through the full checklist.'}</p>
              ) : null}
            </div>
          ) : (
            <p className="form-hint">{isRu ? 'Тренировочных задач пока нет. Добавьте их при редактировании стратегии.' : 'No training tasks yet. Add them while editing the strat.'}</p>
          )}
        </section>

        <CommentThread
          title={isRu ? 'Обсуждение стратегии' : 'Strat discussion'}
          comments={comments}
          loading={loadingComments}
          currentUserId={currentUserId}
          canModerate={canModerate}
          placeholder={isRu ? 'Обсудите тайминги, роли или правки для этой стратегии...' : 'Discuss timings, roles or adjustments for this strat...'}
          submitLabel={isRu ? 'Отправить комментарий' : 'Post comment'}
          onSubmit={async (body) => {
            try {
              await createStratComment({
                stratId: strat.id,
                teamId: strat.team_id,
                authorId: currentUserId,
                body,
              })
              await refreshComments()
            } catch (error) {
              pushToast({
                tone: 'error',
                title: isRu ? 'Не удалось отправить комментарий к стратегии' : 'Could not post strat comment',
                message: getErrorMessage(error),
              })
              throw error
            }
          }}
          onDelete={async (commentId) => {
            try {
              await deleteStratComment(commentId)
              await refreshComments()
            } catch (error) {
              pushToast({
                tone: 'error',
                title: isRu ? 'Не удалось удалить комментарий к стратегии' : 'Could not delete strat comment',
                message: getErrorMessage(error),
              })
              throw error
            }
          }}
        />

        <div className="share-card-export-shell" aria-hidden="true">
          <div ref={shareCardRef}>
            <StratShareCard strat={strat} map={map} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function StratVersionHistoryModal({
  strat,
  open,
  onClose,
  currentUserId,
  canRestore,
  onRestored,
}: {
  strat: Strat | null
  open: boolean
  onClose: () => void
  currentUserId: string
  canRestore: boolean
  onRestored: () => Promise<void>
}) {
  const [versions, setVersions] = useState<StratVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const { pushToast } = useToast()
  const { locale, formatDateTime } = useLocale()
  const isRu = locale === 'ru'

  const refreshVersions = useCallback(async () => {
    if (!strat) return

    setLoading(true)

    try {
      setVersions(await fetchStratVersions(strat.id))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось загрузить историю версий' : 'Could not load version history',
        message: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }, [pushToast, strat])

  useEffect(() => {
    if (open) {
      void refreshVersions()
    }
  }, [open, refreshVersions])

  if (!strat) return null

  return (
    <Modal
      open={open}
      title={`${strat.name} · ${isRu ? 'История версий' : 'Version history'}`}
      description={isRu ? 'Просматривайте прошлые снапшоты и откатывайтесь к более раннему тактическому плану.' : 'Browse previous snapshots and roll back to an earlier tactical plan.'}
      onClose={onClose}
      className="modal-card-wide"
    >
      {loading ? (
        <div className="empty-panel">
          <strong>{isRu ? 'Загружаем версии...' : 'Loading versions...'}</strong>
        </div>
      ) : versions.length ? (
        <div className="version-history-list">
          {versions.map((version, index) => (
            <article key={version.id} className="version-history-card">
              <div className="version-history-header">
                <div>
                  <strong>{isRu ? 'Версия' : 'Version'} {versions.length - index}</strong>
                  <span>
                    {formatDateTime(version.created_at)} · {version.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}
                  </span>
                </div>
                {canRestore ? (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={restoringId === version.id}
                    onClick={async () => {
                      setRestoringId(version.id)
                      try {
                        await restoreStratVersion(version.id, currentUserId)
                        await onRestored()
                        pushToast({
                          tone: 'success',
                          title: isRu ? 'Версия восстановлена' : 'Version restored',
                          message: isRu ? `Стратегия "${version.snapshot.name}" снова активна.` : `"${version.snapshot.name}" is active again.`,
                        })
                        onClose()
                      } catch (error) {
                        pushToast({
                          tone: 'error',
                          title: isRu ? 'Не удалось восстановить версию' : 'Could not restore version',
                          message: getErrorMessage(error),
                        })
                      } finally {
                        setRestoringId(null)
                      }
                    }}
                  >
                    {restoringId === version.id ? (isRu ? 'Восстанавливаем...' : 'Restoring...') : isRu ? 'Восстановить эту версию' : 'Restore this version'}
                  </button>
                ) : null}
              </div>

              <div className="content-badge-row">
                <SideBadge side={version.snapshot.side} />
                {version.snapshot.types.map((type) => (
                  <span key={type} className="filter-chip active small">{getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}</span>
                ))}
              </div>

              <p>{version.snapshot.note || (isRu ? 'Для этой версии заметка не добавлена.' : 'No note provided for this version.')}</p>

              <div className="content-meta-row">
                <span>{version.snapshot.linked_lineup_ids.length} {isRu ? 'связанных лайнапов' : 'linked lineups'}</span>
                <span>{version.snapshot.replay_steps.length} {isRu ? 'replay-шагов' : 'replay steps'}</span>
                <span>{version.snapshot.training_checklist.length} {isRu ? 'тренировочных задач' : 'training tasks'}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <strong>{isRu ? 'Сохраненных версий пока нет' : 'No saved versions yet'}</strong>
          <span>{isRu ? 'Первые снапшоты появятся после создания или редактирования этой стратегии с включенной системой версий.' : 'The first snapshots appear after you create or edit this strat with the new version system enabled.'}</span>
        </div>
      )}
    </Modal>
  )
}

function StratPresentationModeModal({
  strat,
  map,
  open,
  onClose,
}: {
  strat: Strat | null
  map: MapDefinition
  open: boolean
  onClose: () => void
}) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const [activeStepIndex, setActiveStepIndex] = useState(0)

  if (!strat) return null

  const replaySteps = strat.replay_steps
  const activeStep = replaySteps[activeStepIndex] ?? replaySteps[0] ?? null

  return (
    <Modal
      open={open}
      title={strat.name}
      description={isRu ? 'Режим презентации' : 'Presentation mode'}
      onClose={onClose}
      className="modal-card-wide presentation-modal"
      bodyClassName="presentation-modal-body"
    >
      <div className="presentation-shell">
        <section className="presentation-stage">
          <div className="content-badge-row">
            <SideBadge side={strat.side} />
            {strat.types.map((type) => (
              <span key={type} className="filter-chip active small">{getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}</span>
            ))}
          </div>

          <AnchorPills mapId={map.id} anchorIds={strat.anchor_ids} />

          <div className="presentation-summary-card">
            <strong>{activeStep?.title ?? (isRu ? 'Сводка по раунду' : 'Round summary')}</strong>
            <p>{activeStep?.note || strat.note || (isRu ? 'Проведите команду по таймингам, утилите и условию победы в этом раунде.' : 'Walk the team through the timing, utility and win condition for this round.')}</p>
          </div>

          {activeStep ? (
            <ScenePreviewBoard map={map} scene={activeStep.scene} />
          ) : (
            <div className="detail-section">
              <strong>{isRu ? 'Replay flow пока нет' : 'No replay flow yet'}</strong>
              <p className="form-hint">
                {isRu
                  ? 'У этой стратегии пока нет replay-шагов. Добавьте их в режиме редактирования, чтобы открыть пошаговую презентацию.'
                  : 'This strat does not have replay steps yet. Add them in edit mode to unlock slide-by-slide presentation.'}
              </p>
            </div>
          )}

          {strat.video_url ? (
            <a href={strat.video_url} target="_blank" rel="noreferrer" className="ghost-action">
              {isRu ? 'Открыть референс-видео' : 'Open reference video'}
            </a>
          ) : null}
        </section>

        <aside className="presentation-sidebar">
          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Flow' : 'Flow'}</h4>
              <span>{replaySteps.length || 1} {isRu ? 'слайд(ов)' : `slide${replaySteps.length === 1 ? '' : 's'}`}</span>
            </div>

            {replaySteps.length ? (
              <div className="presentation-step-list">
                {replaySteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`presentation-step-card ${index === activeStepIndex ? 'active' : ''}`}
                    onClick={() => setActiveStepIndex(index)}
                  >
                    <span className="presentation-step-index">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.note || (isRu ? 'Заметка к шагу не добавлена.' : 'No step note provided.')}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="form-hint">{isRu ? 'Используйте этот слайд-сводку для быстрого мобильного брифинга.' : 'Use this summary slide for a quick mobile briefing.'}</p>
            )}

            {replaySteps.length ? (
              <div className="replay-player-controls">
                <button
                  type="button"
                  className="ghost-action"
                  disabled={activeStepIndex === 0}
                  onClick={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
                >
                  {isRu ? 'Назад' : 'Previous'}
                </button>
                <button
                  type="button"
                  className="ghost-action"
                  disabled={activeStepIndex >= replaySteps.length - 1}
                  onClick={() => setActiveStepIndex((current) => Math.min(replaySteps.length - 1, current + 1))}
                >
                  {isRu ? 'Далее' : 'Next'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Связанные лайнапы' : 'Linked lineups'}</h4>
              <span>{strat.linked_lineups?.length ?? 0}</span>
            </div>

            {strat.linked_lineups?.length ? (
              <div className="linked-lineup-grid linked-lineup-grid-preview">
                {strat.linked_lineups.map((lineup) => (
                  <div key={lineup.id} className="linked-lineup-chip">
                    <strong>{lineup.name}</strong>
                    <span>{getGrenadeTypeLabel(locale, lineup.grenade_type)} · {lineup.side}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-hint">{isRu ? 'К этой стратегии пока не прикреплены связанные лайнапы.' : 'No linked lineups attached to this strat yet.'}</p>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  )
}

function StratTrainingModeModal({
  strat,
  map,
  open,
  onClose,
}: {
  strat: Strat | null
  map: MapDefinition
  open: boolean
  onClose: () => void
}) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([])

  if (!strat) return null

  const replaySteps = strat.replay_steps
  const activeStep = replaySteps[activeStepIndex] ?? replaySteps[0] ?? null
  const visibleTasks = activeStep
    ? strat.training_checklist.filter((task) => !task.step_id || task.step_id === activeStep.id)
    : strat.training_checklist
  const completedVisibleCount = visibleTasks.filter((task) => completedTaskIds.includes(task.id)).length

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    )
  }

  return (
    <Modal
      open={open}
      title={strat.name}
      description={isRu ? 'Режим тренировки' : 'Training mode'}
      onClose={onClose}
      className="modal-card-wide training-modal"
      bodyClassName="training-modal-body"
    >
      <div className="training-shell">
        <section className="training-stage">
          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Статус тренировки' : 'Practice status'}</h4>
              <span>
                {completedTaskIds.length}/{strat.training_checklist.length} {isRu ? 'выполнено' : 'completed'}
              </span>
            </div>

            <div className="training-progress-track">
              <div
                className="training-progress-value"
                style={{
                  width: `${strat.training_checklist.length ? (completedTaskIds.length / strat.training_checklist.length) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="inline-actions">
              <button type="button" className="ghost-action" onClick={() => setCompletedTaskIds([])}>
                {isRu ? 'Сбросить чеклист' : 'Reset checklist'}
              </button>
            </div>
          </div>

          {activeStep ? (
            <ScenePreviewBoard map={map} scene={activeStep.scene} />
          ) : (
            <div className="detail-section">
              <strong>{isRu ? 'Replay-шагов пока нет' : 'No replay steps yet'}</strong>
              <p className="form-hint">
                {isRu
                  ? 'Режим тренировки работает и без шагов на доске, но replay flow делает практику намного понятнее.'
                  : 'Training mode still works without board steps, but adding replay flow makes practice much clearer.'}
              </p>
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Текущий фокус' : 'Current focus'}</h4>
              <span>{activeStep ? `${isRu ? 'Шаг' : 'Step'} ${activeStepIndex + 1}` : isRu ? 'Обзор' : 'Overview'}</span>
            </div>
            <strong>{activeStep?.title ?? (isRu ? 'Чеклист на весь раунд' : 'Whole-round checklist')}</strong>
            <p>{activeStep?.note || strat.note || (isRu ? 'Пройдитесь по утилите, ролям, занятию пространства и контрольным точкам коммуникации.' : 'Run through utility, roles, space-taking and communication checkpoints.')}</p>
          </div>
        </section>

        <aside className="training-sidebar">
          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Replay flow' : 'Replay flow'}</h4>
              <span>{replaySteps.length} {isRu ? 'шагов' : 'steps'}</span>
            </div>

            {replaySteps.length ? (
              <>
                <div className="presentation-step-list">
                  {replaySteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      className={`presentation-step-card ${index === activeStepIndex ? 'active' : ''}`}
                      onClick={() => setActiveStepIndex(index)}
                    >
                      <span className="presentation-step-index">{index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.note || (isRu ? 'Заметка к шагу не добавлена.' : 'No step note provided.')}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="replay-player-controls">
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={activeStepIndex === 0}
                    onClick={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
                  >
                    {isRu ? 'Назад' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={activeStepIndex >= replaySteps.length - 1}
                    onClick={() => setActiveStepIndex((current) => Math.min(replaySteps.length - 1, current + 1))}
                  >
                    {isRu ? 'Далее' : 'Next'}
                  </button>
                </div>
              </>
            ) : (
              <p className="form-hint">{isRu ? 'Replay-шагов пока нет. Добавьте их в режиме редактирования для пошаговых командных тренировок.' : 'No replay steps yet. Add them in edit mode for guided team drills.'}</p>
            )}
          </div>

          <div className="detail-section">
            <div className="detail-section-header">
              <h4>{isRu ? 'Чеклист' : 'Checklist'}</h4>
              <span>{visibleTasks.length ? `${completedVisibleCount}/${visibleTasks.length}` : '0/0'} {isRu ? 'на этом шаге' : 'on this step'}</span>
            </div>

            {visibleTasks.length ? (
              <div className="training-task-checklist">
                {visibleTasks.map((task) => {
                  const checked = completedTaskIds.includes(task.id)

                  return (
                    <label key={task.id} className={`training-check-item ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTask(task.id)}
                      />
                      <div>
                        <div className="training-check-header">
                          <strong>{task.title}</strong>
                          <RolePresetBadge rolePreset={task.role_preset} />
                        </div>
                        <p>{task.note || (isRu ? 'Дополнительная заметка не добавлена.' : 'No extra note provided.')}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="form-hint">{isRu ? 'К этому шагу пока не привязаны элементы чеклиста. Добавьте их при редактировании стратегии.' : 'No checklist items tied to this step yet. Add them while editing the strat.'}</p>
            )}
          </div>
        </aside>
      </div>
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
  const { locale, t } = useLocale()
  const isRu = locale === 'ru'

  return (
    <Modal
      open={open}
      title={isRu ? 'Пригласить игрока' : 'Invite player'}
      description={isRu ? 'Пригласите игрока по его короткому user code.' : 'Invite a player by their short user code.'}
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
          {isRu ? 'User code' : 'User code'}
          <input value={userCode} onChange={(event) => setUserCode(event.target.value.toUpperCase())} type="text" required />
        </label>

        <div className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? (isRu ? 'Приглашаем...' : 'Inviting...') : isRu ? 'Отправить приглашение' : 'Send invite'}
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
  const [rolePreset, setRolePreset] = useState<TeamRolePreset | ''>(member.role_preset ?? '')
  const [saving, setSaving] = useState(false)
  const { pushToast } = useToast()
  const { locale, t } = useLocale()
  const isRu = locale === 'ru'

  useEffect(() => {
    setRole(member.role)
    setRolePreset(member.role_preset ?? '')
  }, [member.role, member.role_preset])

  const saveRole = async () => {
    if (!isCreator || role === member.role) return
    setSaving(true)

    try {
      await updateMember(member.id, { role })
      pushToast({ tone: 'success', title: isRu ? 'Роль обновлена' : 'Role updated' })
      await onRefresh()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось обновить роль' : 'Could not update role',
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
      pushToast({ tone: 'success', title: isRu ? 'Права обновлены' : 'Permissions updated' })
      await onRefresh()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось обновить права' : 'Could not update permissions',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const saveRolePreset = async (nextPreset: TeamRolePreset | '') => {
    if (!isCreator) return
    setSaving(true)

    try {
      await updateMember(member.id, { role_preset: nextPreset || null })
      pushToast({ tone: 'success', title: isRu ? 'Preset обновлен' : 'Preset updated' })
      await onRefresh()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось обновить preset' : 'Could not update preset',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const canManagePermissions = isCreator && member.user_id !== team.creator_id
  const canEditRoleMeta = isCreator
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
          <span>{member.profile?.username ?? (isRu ? 'Неизвестно' : 'Unknown')}</span>
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
            disabled={!canEditRoleMeta || saving}
          />
        ) : (
          member.role
        )}
      </td>
      <td>
        {isCreator ? (
          <select
            className="table-input"
            value={rolePreset}
            disabled={!canEditRoleMeta || saving}
            onChange={(event) => {
              const nextPreset = event.target.value as TeamRolePreset | ''
              setRolePreset(nextPreset)
              void saveRolePreset(nextPreset)
            }}
          >
            <option value="">{t('common.none')}</option>
            {TEAM_ROLE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {getRolePresetLabel(locale, preset.value)}
              </option>
            ))}
          </select>
        ) : (
          <RolePresetBadge rolePreset={member.role_preset} />
        )}
      </td>
      <td>
        <div className="permission-icons">
          <button
            type="button"
            className={`permission-toggle ${member.can_add_lineups ? 'active' : ''}`}
            title={isRu ? 'Может добавлять лайнапы' : 'Can add lineups'}
            disabled={!canManagePermissions || saving}
            onClick={() => void togglePermission('can_add_lineups', !member.can_add_lineups)}
          >
            <img src="/assets/utilities/vector/smoke.svg" alt="" />
          </button>
          <button
            type="button"
            className={`permission-toggle ${member.can_add_strats ? 'active' : ''}`}
            title={isRu ? 'Может добавлять стратегии' : 'Can add strats'}
            disabled={!canManagePermissions || saving}
            onClick={() => void togglePermission('can_add_strats', !member.can_add_strats)}
          >
            <img src="/assets/editor/system/book.svg" alt="" />
          </button>
        </div>
      </td>
      <td>
        {canManagePermissions ? (
          <button type="button" className="danger-link" onClick={() => onConfirmKick(member)}>
            {isRu ? 'Кикнуть' : 'Kick'}
          </button>
        ) : !isCreator && isSelf ? (
          <button type="button" className="danger-link" onClick={() => onConfirmLeave(member)}>
            {isRu ? 'Покинуть команду' : 'Leave team'}
          </button>
        ) : (
          <span className="muted-label">{member.user_id === team.creator_id ? (isRu ? 'Создатель' : 'Creator') : isRu ? 'Участник' : 'Member'}</span>
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
  const { locale } = useLocale()
  const isRu = locale === 'ru'

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
          <span className="sr-only">{isRu ? `Выбрать карту ${map.name}` : `Select map ${map.name}`}</span>
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
  const { locale } = useLocale()
  const isRu = locale === 'ru'

  const activeSection = ['roster', 'lineups', 'strats'].includes(section ?? '')
    ? (section as DashboardSection)
    : 'roster'

  const [team, setTeam] = useState<Team | null>(null)
  const [membership, setMembership] = useState<TeamMember | null>(null)
  const [roster, setRoster] = useState<TeamMember[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [strats, setStrats] = useState<Strat[]>([])
  const [favoriteLineupIds, setFavoriteLineupIds] = useState<string[]>([])
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
  const [previewStrat, setPreviewStrat] = useState<Strat | null>(null)
  const [versionHistoryStrat, setVersionHistoryStrat] = useState<Strat | null>(null)
  const [presentationStrat, setPresentationStrat] = useState<Strat | null>(null)
  const [trainingStrat, setTrainingStrat] = useState<Strat | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null)
  const [confirmationLoading, setConfirmationLoading] = useState(false)
  const [lineupSearch, setLineupSearch] = useState('')
  const [lineupFavoriteFilter, setLineupFavoriteFilter] = useState<'all' | 'favorites'>('all')
  const [lineupSideFilter, setLineupSideFilter] = useState<'All' | 'T' | 'CT'>('All')
  const [lineupUtilityFilter, setLineupUtilityFilter] = useState<'all' | Lineup['grenade_type']>('all')
  const [lineupAnchorFilter, setLineupAnchorFilter] = useState<'all' | string>('all')
  const [lineupAuthorFilter, setLineupAuthorFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'All' | 'T' | 'CT'>('All')
  const [utilityFilter, setUtilityFilter] = useState<'all' | Lineup['grenade_type']>('all')
  const [anchorFilter, setAnchorFilter] = useState<'all' | string>('all')
  const [authorFilter, setAuthorFilter] = useState<'all' | string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'buyround' | 'force' | 'pistol'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const selectedMapMeta = MAPS.find((map) => map.id === selectedMap) ?? MAPS[0]
  const selectedMapAnchors = getMapAnchors(selectedMapMeta.id)

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
        title: isRu ? 'Не удалось загрузить команду' : 'Could not load team',
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
      const nextLineups = await fetchLineups(teamId, selectedMapMeta.name)
      setLineups(nextLineups)

      if (profile?.id) {
        setFavoriteLineupIds(await fetchFavoriteLineupIds(profile.id, nextLineups.map((lineup) => lineup.id)))
      } else {
        setFavoriteLineupIds([])
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось загрузить лайнапы' : 'Could not load lineups',
        message: getErrorMessage(error),
      })
    } finally {
      setLineupsLoading(false)
    }
  }, [profile?.id, pushToast, selectedMapMeta.name, teamId])

  const refreshStrats = useCallback(async () => {
    if (!teamId) return
    setStratsLoading(true)
    try {
      setStrats(await fetchStrats(teamId, selectedMapMeta.name))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось загрузить стратегии' : 'Could not load strats',
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
      void refreshLineups()
      void refreshStrats()
    }
  }, [activeSection, refreshLineups, refreshStrats])

  useEffect(() => {
    setLineupAnchorFilter('all')
    setAnchorFilter('all')
  }, [selectedMap])

  const creator = isTeamCreator(team, profile?.id)
  const canContributeLineups = canAddLineups(membership, creator)
  const canContributeStrats = canAddStrats(membership, creator)

  const lineupAuthors = useMemo(
    () =>
      Array.from(
        new Map(
          lineups
            .filter((lineup) => lineup.author)
            .map((lineup) => [lineup.author!.id, lineup.author!]),
        ).values(),
      ),
    [lineups],
  )

  const stratAuthors = useMemo(
    () =>
      Array.from(
        new Map(
          strats
            .filter((strat) => strat.author)
            .map((strat) => [strat.author!.id, strat.author!]),
        ).values(),
      ),
    [strats],
  )

  const filteredLineups = useMemo(() => {
    return lineups.filter((lineup) => {
      const matchesSearch = lineup.name.toLowerCase().includes(lineupSearch.toLowerCase())
      const matchesFavorite = lineupFavoriteFilter === 'favorites' ? favoriteLineupIds.includes(lineup.id) : true
      const matchesSide = lineupSideFilter === 'All' ? true : lineup.side === lineupSideFilter
      const matchesUtility = lineupUtilityFilter === 'all' ? true : lineup.grenade_type === lineupUtilityFilter
      const matchesAnchor = lineupAnchorFilter === 'all' ? true : lineup.anchor_ids.includes(lineupAnchorFilter)
      const matchesAuthor = lineupAuthorFilter === 'all' ? true : lineup.author_id === lineupAuthorFilter

      return matchesSearch && matchesFavorite && matchesSide && matchesUtility && matchesAnchor && matchesAuthor
    })
  }, [favoriteLineupIds, lineupFavoriteFilter, lineups, lineupAnchorFilter, lineupAuthorFilter, lineupSearch, lineupSideFilter, lineupUtilityFilter])

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
      const matchesUtility =
        utilityFilter === 'all'
          ? true
          : (strat.linked_lineups ?? []).some((lineup) => lineup.grenade_type === utilityFilter)
      const matchesAnchor = anchorFilter === 'all' ? true : strat.anchor_ids.includes(anchorFilter)
      const matchesAuthor = authorFilter === 'all' ? true : strat.author_id === authorFilter
      const matchesType = typeFilter === 'all' ? true : strat.types.includes(typeFilter)
      return matchesSearch && matchesSide && matchesUtility && matchesAnchor && matchesAuthor && matchesType
    })
  }, [anchorFilter, authorFilter, search, sideFilter, sortOrder, strats, typeFilter, utilityFilter])

  if (!teamId || !profile) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return <section className="page-shell">{isRu ? 'Загружаем панель команды...' : 'Loading team dashboard...'}</section>
  }

  if (!team || !membership) {
    return <section className="page-shell">{isRu ? 'Команда не найдена или доступ запрещен.' : 'Team not found or access denied.'}</section>
  }

  const submitInvite = async (userCode: string) => {
    if (!team) return
    setInviteLoading(true)

    try {
      await createInvite(team.id, userCode)
      pushToast({ tone: 'success', title: isRu ? 'Приглашение отправлено' : 'Invite sent' })
      setInviteOpen(false)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось отправить приглашение' : 'Could not send invite',
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
        anchor_ids: form.anchor_ids,
        screenshots,
      }

      if (editingLineup) {
        await updateLineup(editingLineup.id, payload)
        pushToast({ tone: 'success', title: isRu ? 'Лайнап обновлен' : 'Lineup updated' })
      } else {
        await createLineup(payload)
        pushToast({ tone: 'success', title: isRu ? 'Лайнап создан' : 'Lineup created' })
      }

      setLineupModalOpen(false)
      setEditingLineup(null)
      await refreshLineups()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось сохранить лайнап' : 'Could not save lineup',
        message: getErrorMessage(error),
      })
    } finally {
      setLineupSaving(false)
    }
  }

  const toggleFavorite = async (lineup: Lineup) => {
    if (!profile) return

    const nextIsFavorite = !favoriteLineupIds.includes(lineup.id)

    try {
      if (nextIsFavorite) {
        await addLineupFavorite(lineup.id, profile.id)
      } else {
        await removeLineupFavorite(lineup.id, profile.id)
      }

      setFavoriteLineupIds((current) =>
        nextIsFavorite
          ? Array.from(new Set([...current, lineup.id]))
          : current.filter((id) => id !== lineup.id),
      )

      pushToast({
        tone: 'success',
        title: nextIsFavorite ? (isRu ? 'Сохранено в избранное' : 'Saved to favorites') : isRu ? 'Удалено из избранного' : 'Removed from favorites',
        message: nextIsFavorite
          ? isRu ? `"${lineup.name}" теперь будет легче найти во время подготовки.` : `"${lineup.name}" is now easier to find during prep.`
          : isRu ? `"${lineup.name}" удален из вашего списка избранного.` : `"${lineup.name}" was removed from your saved list.`,
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось обновить избранное' : 'Could not update favorites',
        message: getErrorMessage(error),
      })
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
        anchor_ids: form.anchor_ids,
        replay_steps: form.replay_steps,
        training_checklist: form.training_checklist,
      }

      let savedStratId = editingStrat?.id ?? null
      let versionError: unknown = null

      if (editingStrat) {
        await updateStrat(editingStrat.id, payload)
        await replaceStratLinkedLineups(editingStrat.id, form.linked_lineup_ids)
        try {
          await recordStratVersion(editingStrat.id, profile.id)
        } catch (error) {
          versionError = error
        }
        pushToast({ tone: 'success', title: isRu ? 'Стратегия обновлена' : 'Strat updated' })
      } else {
        const stratId = await createStrat(payload)
        await replaceStratLinkedLineups(stratId, form.linked_lineup_ids)
        savedStratId = stratId
        try {
          await recordStratVersion(stratId, profile.id)
        } catch (error) {
          versionError = error
        }
        pushToast({ tone: 'success', title: isRu ? 'Стратегия создана' : 'Strat created' })
      }

      if (versionError && savedStratId) {
        pushToast({
          tone: 'info',
          title: isRu ? 'Стратегия сохранена без снапшота' : 'Strat saved without snapshot',
          message: isRu
            ? 'Стратегия сохранена, но истории версий нужна последняя миграция Supabase, чтобы снапшоты начали записываться.'
            : 'The strat is safe, but version history needs the latest Supabase migration before snapshots can be stored.',
        })
      }

      setStratModalOpen(false)
      setEditingStrat(null)
      await refreshStrats()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Не удалось сохранить стратегию' : 'Could not save strat',
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
          title: confirmation.kind === 'kick' ? (isRu ? 'Участник удален' : 'Member removed') : isRu ? 'Вы покинули команду' : 'You left the team',
        })
        setConfirmation(null)
        await refreshDashboard()
        if (confirmation.kind === 'leave') {
          navigate('/')
        }
      }

      if (confirmation.kind === 'disband-team') {
        await disbandTeam(team.id, profile.id)
        pushToast({ tone: 'success', title: isRu ? 'Команда расформирована' : 'Team disbanded' })
        setConfirmation(null)
        await refreshProfile()
        await refreshDashboard()
      }

      if (confirmation.kind === 'delete-team') {
        await deleteTeam(team.id)
        pushToast({ tone: 'success', title: isRu ? 'Команда удалена' : 'Team deleted' })
        setConfirmation(null)
        await refreshProfile()
        navigate('/')
      }

      if (confirmation.kind === 'delete-lineup') {
        await deleteLineup(confirmation.lineup.id)
        pushToast({ tone: 'success', title: isRu ? 'Лайнап удален' : 'Lineup deleted' })
        setConfirmation(null)
        await refreshLineups()
      }

      if (confirmation.kind === 'delete-strat') {
        await deleteStrat(confirmation.strat.id)
        pushToast({ tone: 'success', title: isRu ? 'Стратегия удалена' : 'Strat deleted' })
        setConfirmation(null)
        await refreshStrats()
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: isRu ? 'Действие не выполнено' : 'Action failed',
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
            <p className="eyebrow">{isRu ? 'Панель команды' : 'Team Dashboard'}</p>
            <h1>{team.name}</h1>
            <span className="hero-text">
              {creator ? (isRu ? 'Доступ создателя' : 'Creator access') : isRu ? 'Доступ участника' : 'Member access'} · {isRu ? 'роль' : 'role'}: {membership.role}
            </span>
          </div>
        </div>

        <div className="dashboard-tabs">
          {(['roster', 'lineups', 'strats'] as DashboardSection[]).map((tab) => (
            <Link key={tab} to={`/team/${team.id}/${tab}`} className={`dashboard-tab ${activeSection === tab ? 'active' : ''}`}>
              {tab === 'roster'
                ? (isRu ? 'ростер' : 'roster')
                : tab === 'lineups'
                  ? (isRu ? 'лайнапы' : 'lineups')
                  : isRu ? 'страты' : 'strats'}
            </Link>
          ))}
        </div>
      </div>

      {activeSection === 'roster' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">{isRu ? 'Ростер' : 'Roster'}</p>
              <h3>{isRu ? 'Участники команды' : 'Team members'}</h3>
            </div>
            {creator ? (
              <div className="inline-actions">
                <button type="button" className="ghost-action" onClick={() => setConfirmation({ kind: 'disband-team' })}>
                  {isRu ? 'Расформировать команду' : 'Disband team'}
                </button>
                <button type="button" className="danger-action" onClick={() => setConfirmation({ kind: 'delete-team' })}>
                  {isRu ? 'Удалить команду' : 'Delete team'}
                </button>
                <button type="button" className="primary-action" onClick={() => setInviteOpen(true)}>
                  {isRu ? 'Пригласить по user code' : 'Invite by user code'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>{isRu ? 'Игрок' : 'Player'}</th>
                  <th>{isRu ? 'User Code' : 'User Code'}</th>
                  <th>{isRu ? 'Custom name' : 'Custom name'}</th>
                  <th>{isRu ? 'Role' : 'Role'}</th>
                  <th>{isRu ? 'Права' : 'Permissions'}</th>
                  <th>{isRu ? 'Действия' : 'Actions'}</th>
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
              <p className="eyebrow">{isRu ? 'Лайнапы' : 'Lineups'}</p>
              <h3>{isRu ? 'Лайнапы утилити по картам' : 'Utility lineups by map'}</h3>
            </div>
          </div>

          <MapSelector activeMap={selectedMap} onSelect={setSelectedMap} />

          <div className="filter-bar">
            <input
              className="table-input"
              value={lineupSearch}
              onChange={(event) => setLineupSearch(event.target.value)}
              placeholder={isRu ? 'Поиск по названию лайнапа' : 'Search by lineup name'}
            />
            <div className="chip-row">
              {[
                { value: 'all', label: isRu ? 'Все лайнапы' : 'All lineups' },
                { value: 'favorites', label: isRu ? 'Только избранное' : 'Favorites only' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`filter-chip ${lineupFavoriteFilter === item.value ? 'active' : ''}`}
                  onClick={() => setLineupFavoriteFilter(item.value as 'all' | 'favorites')}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <select className="table-input filter-select" value={lineupUtilityFilter} onChange={(event) => setLineupUtilityFilter(event.target.value as 'all' | Lineup['grenade_type'])}>
              <option value="all">{isRu ? 'Все гранаты' : 'All utility'}</option>
              {(Object.keys(GRENADE_BADGES) as Array<Lineup['grenade_type']>).map((type) => (
                <option key={type} value={type}>
                  {getGrenadeTypeLabel(locale, type)}
                </option>
              ))}
            </select>
            <select className="table-input filter-select" value={lineupAuthorFilter} onChange={(event) => setLineupAuthorFilter(event.target.value)}>
              <option value="all">{isRu ? 'Все авторы' : 'All authors'}</option>
              {lineupAuthors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.username}
                </option>
              ))}
            </select>
            <select className="table-input filter-select" value={lineupAnchorFilter} onChange={(event) => setLineupAnchorFilter(event.target.value)}>
              <option value="all">{isRu ? 'Все зоны' : 'All areas'}</option>
              {selectedMapAnchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id}>
                  {anchor.label}
                </option>
              ))}
            </select>
            <div className="chip-row">
              {['All', 'T', 'CT'].map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`filter-chip ${lineupSideFilter === side ? 'active' : ''}`}
                  onClick={() => setLineupSideFilter(side as 'All' | 'T' | 'CT')}
                >
                  {side === 'All' ? (isRu ? 'Все' : 'All') : side}
                </button>
              ))}
            </div>
          </div>

          {lineupsLoading ? (
            <div className="empty-panel">
              <strong>{isRu ? 'Загружаем лайнапы...' : 'Loading lineups...'}</strong>
            </div>
          ) : filteredLineups.length ? (
            <div className="content-grid">
              {filteredLineups.map((lineup) => {
                const canEdit = canEditOwnContent(membership, creator, lineup.author_id, profile.id, 'lineups')
                const isFavorite = favoriteLineupIds.includes(lineup.id)
                return (
                  <article key={lineup.id} className="content-card">
                    <div className="content-card-body">
                      <div className="content-card-head">
                        <div className="content-badge-row">
                          <GrenadeBadge type={lineup.grenade_type} />
                          <SideBadge side={lineup.side} />
                        </div>
                        <FavoriteButton active={isFavorite} onClick={() => void toggleFavorite(lineup)} />
                      </div>
                      <AnchorPills mapId={selectedMapMeta.id} anchorIds={lineup.anchor_ids} />
                      <h4>{lineup.name}</h4>
                      <p>{lineup.description || (isRu ? 'Описание не добавлено.' : 'No description provided.')}</p>
                      <div className="lineup-throw-icons">
                        <img src={THROW_STANCE_OPTIONS.find((item) => item.value === lineup.throw_stance)?.icon ?? ''} alt="" />
                        <img src={THROW_MOVEMENT_OPTIONS.find((item) => item.value === lineup.throw_movement)?.icon ?? ''} alt="" />
                        <img src={lineup.throw_jump ? '/assets/editor/system/pose_jump.svg' : '/assets/editor/system/pose_still.svg'} alt="" />
                      </div>
                      <div className="content-meta-row">
                        <span>{lineup.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}</span>
                        <span>{new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(new Date(lineup.created_at))}</span>
                      </div>
                      {(canEdit || creator) ? (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => setPreviewLineup(lineup)}
                          >
                            {isRu ? 'Открыть' : 'View'}
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
                              {isRu ? 'Редактировать' : 'Edit'}
                            </button>
                          ) : null}
                          {creator ? (
                            <button
                              type="button"
                              className="danger-link"
                              onClick={() => setConfirmation({ kind: 'delete-lineup', lineup })}
                            >
                              {isRu ? 'Удалить' : 'Delete'}
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
                            {isRu ? 'Открыть' : 'View'}
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
              <strong>
                {lineups.length
                  ? lineupFavoriteFilter === 'favorites'
                    ? isRu ? `Нет избранных лайнапов для ${selectedMapMeta.name}` : `No favorite lineups for ${selectedMapMeta.name}`
                    : isRu ? 'Нет лайнапов под текущие фильтры' : 'No lineups match the current filters'
                  : isRu ? `Для ${selectedMapMeta.name} пока нет лайнапов` : `No lineups for ${selectedMapMeta.name}`}
              </strong>
              <span>
                {lineups.length
                  ? lineupFavoriteFilter === 'favorites'
                    ? isRu ? 'Сохраняйте самые важные раскидки в избранное, и они появятся здесь.' : 'Save the most important utility setups to favorites and they will appear here.'
                    : isRu ? 'Измените фильтры по утилите, стороне, зоне или автору, либо создайте новый лайнап для этой карты.' : 'Change utility, side, area or author filters, or create a new lineup for this map.'
                  : isRu ? 'Создайте первый лайнап для этой карты, когда права это позволяют.' : 'Create the first lineup for this map when permissions allow it.'}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {activeSection === 'strats' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">{isRu ? 'Стратегии' : 'Strats'}</p>
              <h3>{isRu ? 'Доска стратегий команды' : 'Team strategy board'}</h3>
            </div>
          </div>

          <MapSelector activeMap={selectedMap} onSelect={setSelectedMap} />

          <div className="filter-bar">
            <input
              className="table-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRu ? 'Поиск по названию стратегии' : 'Search by strat name'}
            />
            <select className="table-input filter-select" value={utilityFilter} onChange={(event) => setUtilityFilter(event.target.value as 'all' | Lineup['grenade_type'])}>
              <option value="all">{isRu ? 'Все гранаты' : 'All utility'}</option>
              {(Object.keys(GRENADE_BADGES) as Array<Lineup['grenade_type']>).map((type) => (
                <option key={type} value={type}>
                  {getGrenadeTypeLabel(locale, type)}
                </option>
              ))}
            </select>
            <select className="table-input filter-select" value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
              <option value="all">{isRu ? 'Все авторы' : 'All authors'}</option>
              {stratAuthors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.username}
                </option>
              ))}
            </select>
            <select className="table-input filter-select" value={anchorFilter} onChange={(event) => setAnchorFilter(event.target.value)}>
              <option value="all">{isRu ? 'Все зоны' : 'All areas'}</option>
              {selectedMapAnchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id}>
                  {anchor.label}
                </option>
              ))}
            </select>
            <div className="chip-row">
              {['All', 'T', 'CT'].map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`filter-chip ${sideFilter === side ? 'active' : ''}`}
                  onClick={() => setSideFilter(side as 'All' | 'T' | 'CT')}
                >
                  {side === 'All' ? (isRu ? 'Все' : 'All') : side}
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
                  {type === 'all' ? (isRu ? 'Все' : 'all') : getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() => setSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))}
            >
              {sortOrder === 'newest' ? (isRu ? 'Сначала новые' : 'Newest first') : isRu ? 'Сначала старые' : 'Oldest first'}
            </button>
          </div>

          {stratsLoading ? (
            <div className="empty-panel">
              <strong>{isRu ? 'Загружаем стратегии...' : 'Loading strats...'}</strong>
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
                          <span key={type} className="filter-chip active small">{getStratTypeLabel(locale, type as 'buyround' | 'force' | 'pistol')}</span>
                        ))}
                      </div>
                      <AnchorPills mapId={selectedMapMeta.id} anchorIds={strat.anchor_ids} />
                      <h4>{strat.name}</h4>
                      <p>{strat.note || (isRu ? 'Заметка не добавлена.' : 'No note provided.')}</p>
                      <div className="content-meta-row">
                        <span>{strat.linked_lineups?.length ?? 0} {isRu ? 'связанных лайнапов' : 'linked lineups'}</span>
                        <span>{strat.replay_steps.length} {isRu ? 'replay-шагов' : 'replay steps'}</span>
                        <span>{strat.training_checklist.length} {isRu ? 'тренировочных задач' : 'training tasks'}</span>
                      </div>
                      <div className="content-meta-row">
                        <span>{strat.author?.username ?? (isRu ? 'Неизвестный автор' : 'Unknown author')}</span>
                        <span>{new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(new Date(strat.created_at))}</span>
                      </div>
                      {(canEdit || creator) ? (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => setPreviewStrat(strat)}
                          >
                            {isRu ? 'Открыть' : 'View'}
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className="ghost-action"
                              onClick={() => {
                                setEditingStrat(strat)
                                setStratModalOpen(true)
                              }}
                            >
                              {isRu ? 'Редактировать' : 'Edit'}
                            </button>
                          ) : null}
                          {creator ? (
                            <button
                              type="button"
                              className="danger-link"
                              onClick={() => setConfirmation({ kind: 'delete-strat', strat })}
                            >
                              {isRu ? 'Удалить' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => setPreviewStrat(strat)}
                          >
                            {isRu ? 'Открыть' : 'View'}
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
              <strong>{strats.length ? (isRu ? 'Нет стратегий под текущие фильтры' : 'No strats match the current filters') : isRu ? `Для ${selectedMapMeta.name} пока нет стратегий` : `No strats for ${selectedMapMeta.name}`}</strong>
              <span>
                {strats.length
                  ? isRu ? 'Измените фильтры по утилите, стороне, зоне, автору или типу, либо создайте первую стратегию для этой карты.' : 'Change utility, side, area, author or type filters, or create the first strategy for this map.'
                  : isRu ? 'Создайте первую стратегию для этой карты, когда права это позволяют.' : 'Create the first strategy for this map when permissions allow it.'}
              </span>
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
          {isRu ? 'Добавить лайнап' : 'Add line-up'}
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
          {isRu ? 'Добавить стратегию' : 'Add Strat'}
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
        map={selectedMapMeta}
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
        mapId={selectedMapMeta.id}
        currentUserId={profile.id}
        canModerate={creator}
        isFavorite={previewLineup ? favoriteLineupIds.includes(previewLineup.id) : false}
        onToggleFavorite={toggleFavorite}
      />

      <StratModal
        key={`strat-${editingStrat?.id ?? 'new'}-${String(stratModalOpen)}`}
        open={stratModalOpen}
        loading={stratSaving}
        initial={editingStrat}
        availableLineups={lineups}
        map={selectedMapMeta}
        onClose={() => {
          setStratModalOpen(false)
          setEditingStrat(null)
        }}
        onSubmit={submitStrat}
      />

      <StratPreviewModal
        strat={previewStrat}
        open={Boolean(previewStrat)}
        onClose={() => setPreviewStrat(null)}
        map={selectedMapMeta}
        currentUserId={profile.id}
        canModerate={creator}
        onOpenVersionHistory={(strat) => {
          setPreviewStrat(null)
          setVersionHistoryStrat(strat)
        }}
        onOpenPresentation={(strat) => {
          setPreviewStrat(null)
          setPresentationStrat(strat)
        }}
        onOpenTraining={(strat) => {
          setPreviewStrat(null)
          setTrainingStrat(strat)
        }}
        onOpenLineup={(lineup) => {
          setPreviewStrat(null)
          setPreviewLineup(lineup)
        }}
      />

      <StratVersionHistoryModal
        strat={versionHistoryStrat}
        open={Boolean(versionHistoryStrat)}
        onClose={() => setVersionHistoryStrat(null)}
        currentUserId={profile.id}
        canRestore={Boolean(
          versionHistoryStrat
            && canEditOwnContent(membership, creator, versionHistoryStrat.author_id, profile.id, 'strats'),
        )}
        onRestored={refreshStrats}
      />

      <StratPresentationModeModal
        key={`presentation-${presentationStrat?.id ?? 'closed'}`}
        strat={presentationStrat}
        map={selectedMapMeta}
        open={Boolean(presentationStrat)}
        onClose={() => setPresentationStrat(null)}
      />

      <StratTrainingModeModal
        key={`training-${trainingStrat?.id ?? 'closed'}`}
        strat={trainingStrat}
        map={selectedMapMeta}
        open={Boolean(trainingStrat)}
        onClose={() => setTrainingStrat(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.kind === 'kick'
            ? isRu ? 'Кикнуть игрока' : 'Kick player'
            : confirmation?.kind === 'leave'
              ? isRu ? 'Покинуть команду' : 'Leave team'
              : confirmation?.kind === 'disband-team'
                ? isRu ? 'Расформировать команду' : 'Disband team'
                : confirmation?.kind === 'delete-team'
                  ? isRu ? 'Удалить команду' : 'Delete team'
              : confirmation?.kind === 'delete-lineup'
                ? isRu ? 'Удалить лайнап' : 'Delete lineup'
                : isRu ? 'Удалить стратегию' : 'Delete strat'
        }
        description={
          confirmation?.kind === 'kick'
            ? isRu ? `Удалить ${confirmation.member.profile?.username ?? 'этого участника'} из ростера?` : `Remove ${confirmation.member.profile?.username ?? 'this member'} from the roster?`
            : confirmation?.kind === 'leave'
              ? isRu ? 'Вы уверены, что хотите покинуть эту команду?' : 'Are you sure you want to leave this team?'
              : confirmation?.kind === 'disband-team'
                ? isRu ? 'Удалить из команды всех участников, кроме создателя?' : 'Remove every member except the creator from this team?'
                : confirmation?.kind === 'delete-team'
                  ? isRu ? 'Удалить эту команду навсегда? Это удалит ростер, лайнапы и стратегии.' : 'Delete this team permanently? This removes the roster, line-ups and strats.'
              : confirmation?.kind === 'delete-lineup'
                ? isRu ? `Удалить лайнап "${confirmation.lineup.name}"?` : `Delete lineup "${confirmation.lineup.name}"?`
                : confirmation?.kind === 'delete-strat'
                  ? isRu ? `Удалить стратегию "${confirmation.strat.name}"?` : `Delete strat "${confirmation.strat.name}"?`
                  : ''
        }
        danger
        loading={confirmationLoading}
        confirmLabel={
          confirmation?.kind === 'delete-team'
            ? isRu ? 'Удалить команду' : 'Delete team'
            : confirmation?.kind === 'disband-team'
              ? isRu ? 'Расформировать команду' : 'Disband team'
              : isRu ? 'Подтвердить' : 'Confirm'
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmAction()}
      />
    </section>
  )
}
