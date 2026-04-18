import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
import { useLocale } from '../hooks/useLocale'
import type { MapEntity, ScenePath } from '../types/editor'

type SelectionPanelProps = {
  selectedEntity: MapEntity | null
  selectedPath: ScenePath | null
  onDelete: () => void
  onDuplicate?: () => void
  onUpdateEntity: (patch: Partial<MapEntity>) => void
  onUpdatePath: (patch: Partial<ScenePath>) => void
}

export function SelectionPanel({
  selectedEntity,
  selectedPath,
  onDelete,
  onDuplicate,
  onUpdateEntity,
  onUpdatePath,
}: SelectionPanelProps) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'

  if (!selectedEntity && !selectedPath) {
    return (
      <section className="selection-panel">
        <p className="eyebrow">{isRu ? 'Инспектор' : 'Inspector'}</p>
        <h3>{isRu ? 'Ничего не выбрано' : 'Nothing selected'}</h3>
        <div className="selection-empty">
          <strong>{isRu ? 'Нажмите на размещенный объект или маршрут.' : 'Tap a placed item or a route.'}</strong>
          <span>{isRu ? 'Здесь можно переименовывать игроков, менять размер, вращать иконки, дублировать или удалять объекты.' : 'You will be able to rename players, tweak size, rotate icons, duplicate or delete.'}</span>
        </div>
      </section>
    )
  }

  if (selectedPath) {
    return (
      <section className="selection-panel">
        <p className="eyebrow">{isRu ? 'Инспектор' : 'Inspector'}</p>
        <h3>{isRu ? 'Стрелка маршрута' : 'Route Arrow'}</h3>
        <div className="selection-meta">
          <span className="selection-tag">{isRu ? 'Стрелка выбрана' : 'Arrow selected'}</span>
          <span className="selection-tag">{isRu ? 'Нажмите на другой объект, чтобы сменить фокус' : 'Tap another element to switch focus'}</span>
        </div>

        <div className="field-list">
          <label>
            {isRu ? 'Цвет' : 'Color'}
            <input
              type="color"
              value={selectedPath.color}
              onChange={(event) => onUpdatePath({ color: event.target.value })}
            />
          </label>
        </div>

        <div className="danger-row">
          <button type="button" className="ghost-action" onClick={onDelete}>
            {isRu ? 'Удалить' : 'Delete'}
          </button>
        </div>
      </section>
    )
  }

  const entity = selectedEntity

  if (!entity) {
    return null
  }

  const entityTitle =
    entity.kind === 'player'
      ? PLAYER_MARKER.name
      : entity.kind === 'utility'
        ? UTILITY_ITEMS.find((utility) => utility.id === entity.utilityId)?.name ?? (isRu ? 'Граната' : 'Utility')
        : isRu ? 'Элемент' : 'Element'

  return (
    <section className="selection-panel">
      <p className="eyebrow">{isRu ? 'Инспектор' : 'Inspector'}</p>
      <h3>{entityTitle}</h3>
      <div className="selection-meta">
        <span className="selection-tag">{isRu ? 'Перетаскивайте прямо на карте' : 'Drag directly on map'}</span>
        <span className="selection-tag">{isRu ? 'Меняйте масштаб и поворот здесь' : 'Scale and rotate here'}</span>
      </div>

      <div className="field-list">
        {entity.kind === 'player' ? (
          <label>
            {isRu ? 'Имя игрока' : 'Player name'}
            <input
              type="text"
              value={entity.label}
              onChange={(event) => onUpdateEntity({ label: event.target.value })}
            />
          </label>
        ) : null}

        <label>
          {isRu ? 'Масштаб' : 'Scale'}
          <input
            type="range"
            min="0.2"
            max="2.4"
            step="0.05"
            value={entity.scale}
            onChange={(event) => onUpdateEntity({ scale: Number(event.target.value) })}
          />
        </label>

        <label>
          {isRu ? 'Поворот' : 'Rotation'}
          <input
            type="range"
            min="-180"
            max="180"
            step="5"
            value={entity.rotation}
            onChange={(event) => onUpdateEntity({ rotation: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="danger-row">
        {onDuplicate ? (
          <button type="button" className="ghost-action" onClick={onDuplicate}>
            {isRu ? 'Дублировать' : 'Duplicate'}
          </button>
        ) : null}
        <button type="button" className="primary-action" onClick={onDelete}>
          {isRu ? 'Удалить' : 'Delete'}
        </button>
      </div>
    </section>
  )
}
