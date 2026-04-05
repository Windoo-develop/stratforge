import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
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
  if (!selectedEntity && !selectedPath) {
    return (
      <section className="selection-panel">
        <p className="eyebrow">Inspector</p>
        <h3>Nothing selected</h3>
        <div className="selection-empty">
          <strong>Tap a placed item or a route.</strong>
          <span>You will be able to rename players, tweak size, rotate icons, duplicate or delete.</span>
        </div>
      </section>
    )
  }

  if (selectedPath) {
    return (
      <section className="selection-panel">
        <p className="eyebrow">Inspector</p>
        <h3>Route Arrow</h3>
        <div className="selection-meta">
          <span className="selection-tag">Arrow selected</span>
          <span className="selection-tag">Tap another element to switch focus</span>
        </div>

        <div className="field-list">
          <label>
            Color
            <input
              type="color"
              value={selectedPath.color}
              onChange={(event) => onUpdatePath({ color: event.target.value })}
            />
          </label>
        </div>

        <div className="danger-row">
          <button type="button" className="ghost-action" onClick={onDelete}>
            Delete
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
        ? UTILITY_ITEMS.find((utility) => utility.id === entity.utilityId)?.name ?? 'Utility'
        : 'Element'

  return (
    <section className="selection-panel">
      <p className="eyebrow">Inspector</p>
      <h3>{entityTitle}</h3>
      <div className="selection-meta">
        <span className="selection-tag">Drag directly on map</span>
        <span className="selection-tag">Scale and rotate here</span>
      </div>

      <div className="field-list">
        {entity.kind === 'player' ? (
          <label>
            Player name
            <input
              type="text"
              value={entity.label}
              onChange={(event) => onUpdateEntity({ label: event.target.value })}
            />
          </label>
        ) : null}

        <label>
          Scale
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
          Rotation
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
            Duplicate
          </button>
        ) : null}
        <button type="button" className="primary-action" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  )
}
