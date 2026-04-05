import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
import { clampNormalized, translateScenePath } from '../utils/editorMath'
import type {
  EditorSelection,
  MapDefinition,
  MapEntity,
  MapPoint,
  PathDraft,
  ScenePath,
  SceneState,
  ToolSelection,
} from '../types/editor'

type MapCanvasProps = {
  map: MapDefinition
  scene: SceneState
  zoom: number
  tool: ToolSelection
  selection: EditorSelection
  pathDraft: PathDraft | null
  onPlacePoint: (point: MapPoint) => void
  onMoveEntity: (id: string, point: MapPoint) => void
  onMovePath: (id: string, nextPath: ScenePath) => void
  onSelectEntity: (id: string) => void
  onSelectPath: (id: string) => void
  onClearSelection: () => void
  onStartPathDraft: (point: MapPoint) => void
  onUpdatePathDraft: (point: MapPoint) => void
  onCommitPathDraft: (point: MapPoint) => void
}

function getPointFromEvent(
  event: ReactPointerEvent<HTMLElement>,
  element: HTMLDivElement,
): MapPoint {
  const rect = element.getBoundingClientRect()

  return {
    x: clampNormalized((event.clientX - rect.left) / rect.width),
    y: clampNormalized((event.clientY - rect.top) / rect.height),
  }
}

export function MapCanvas({
  map,
  scene,
  zoom,
  tool,
  selection,
  pathDraft,
  onPlacePoint,
  onMoveEntity,
  onMovePath,
  onSelectEntity,
  onSelectPath,
  onClearSelection,
  onStartPathDraft,
  onUpdatePathDraft,
  onCommitPathDraft,
}: MapCanvasProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)

  const arrowId = useMemo(() => `board-arrow-${map.id}`, [map.id])

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!boardRef.current) return

    if (tool.kind === 'path') {
      event.preventDefault()
      event.stopPropagation()
      onClearSelection()

      const board = boardRef.current
      const startPoint = getPointFromEvent(event, board)
      onStartPathDraft(startPoint)

      const handleMove = (moveEvent: PointerEvent) => {
        const rect = board.getBoundingClientRect()
        onUpdatePathDraft({
          x: clampNormalized((moveEvent.clientX - rect.left) / rect.width),
          y: clampNormalized((moveEvent.clientY - rect.top) / rect.height),
        })
      }

      const handleUp = (upEvent: PointerEvent) => {
        const rect = board.getBoundingClientRect()
        onCommitPathDraft({
          x: clampNormalized((upEvent.clientX - rect.left) / rect.width),
          y: clampNormalized((upEvent.clientY - rect.top) / rect.height),
        })
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      return
    }

    onClearSelection()
    const point = getPointFromEvent(event, boardRef.current)
    onPlacePoint(point)
  }

  const beginEntityDrag = (event: ReactPointerEvent<HTMLButtonElement>, entity: MapEntity) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectEntity(entity.id)

    const board = boardRef.current
    if (!board) return

    const origin = { x: entity.x, y: entity.y }

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = board.getBoundingClientRect()
      onMoveEntity(entity.id, {
        x: clampNormalized(origin.x + (moveEvent.clientX - event.clientX) / rect.width),
        y: clampNormalized(origin.y + (moveEvent.clientY - event.clientY) / rect.height),
      })
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const beginPathDrag = (event: ReactPointerEvent<SVGLineElement>, path: ScenePath) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectPath(path.id)

    const board = boardRef.current
    if (!board) return

    const originPath = path

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = board.getBoundingClientRect()
      const deltaX = (moveEvent.clientX - event.clientX) / rect.width
      const deltaY = (moveEvent.clientY - event.clientY) / rect.height

      onMovePath(path.id, translateScenePath(originPath, deltaX, deltaY))
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div className="board-shell">
      <div
        ref={boardRef}
        className="board"
        style={{ transform: `scale(${zoom})` }}
        onPointerDown={handleBoardPointerDown}
      >
        <img className="board-radar" src={map.radarSrc} alt={`${map.name} radar map`} />

        <svg className="board-path-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker
              id={arrowId}
              markerWidth="3.2"
              markerHeight="3.2"
              refX="2.9"
              refY="1.6"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 3.2 1.6 L 0 3.2 z" fill="#6fffe9" />
            </marker>
          </defs>

          {scene.paths.map((path) => (
            <g key={path.id}>
              <line
                className={`board-path-hit ${
                  selection?.kind === 'path' && selection.id === path.id ? 'selected' : ''
                }`}
                x1={path.startX * 100}
                y1={path.startY * 100}
                x2={path.endX * 100}
                y2={path.endY * 100}
                tabIndex={0}
                role="button"
                aria-label="Route arrow"
                onFocus={() => onSelectPath(path.id)}
                onPointerDown={(event) => beginPathDrag(event, path)}
              />
              <line
                className={`board-path ${
                  selection?.kind === 'path' && selection.id === path.id ? 'selected' : ''
                }`}
                x1={path.startX * 100}
                y1={path.startY * 100}
                x2={path.endX * 100}
                y2={path.endY * 100}
                stroke={path.color}
                markerEnd={`url(#${arrowId})`}
              />
              <circle className="path-anchor" cx={path.startX * 100} cy={path.startY * 100} r="0.42" />
              <circle className="path-anchor" cx={path.endX * 100} cy={path.endY * 100} r="0.42" />
            </g>
          ))}

          {pathDraft ? (
            <>
              <line
                className="board-path board-path-draft"
                x1={pathDraft.start.x * 100}
                y1={pathDraft.start.y * 100}
                x2={pathDraft.end.x * 100}
                y2={pathDraft.end.y * 100}
                stroke="#6fffe9"
                markerEnd={`url(#${arrowId})`}
              />
              <circle className="path-anchor" cx={pathDraft.start.x * 100} cy={pathDraft.start.y * 100} r="0.42" />
            </>
          ) : null}
        </svg>

        <div className="board-overlay">
          {scene.entities.map((entity) => {
            const utility = entity.kind === 'utility'
              ? UTILITY_ITEMS.find((item) => item.id === entity.utilityId)
              : null

            return (
              <button
                key={entity.id}
                type="button"
                className={`entity-chip ${
                  selection?.kind === 'entity' && selection.id === entity.id ? 'selected' : ''
                } ${
                  entity.kind === 'player'
                    ? 'entity-player'
                    : 'entity-utility'
                }`}
                style={{
                  left: `${entity.x * 100}%`,
                  top: `${entity.y * 100}%`,
                  width: `${24 * entity.scale}px`,
                  height: `${24 * entity.scale}px`,
                  transform: `translate(-50%, -50%) rotate(${entity.rotation}deg)`,
                }}
                onPointerDown={(event) => beginEntityDrag(event, entity)}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onSelectEntity(entity.id)
                }}
                onFocus={() => onSelectEntity(entity.id)}
                aria-label={entity.kind === 'player' ? `Player ${entity.label}` : entity.label}
              >
                {entity.kind === 'player' ? (
                  <>
                    <img className="entity-player-icon" src={PLAYER_MARKER.iconSrc} alt="" />
                    <span className="entity-player-name">{entity.label}</span>
                  </>
                ) : null}
                {entity.kind === 'utility' && utility ? <img src={utility.placedSrc} alt={utility.name} /> : null}
              </button>
            )
          })}
        </div>

        <div className="board-hint">
          {tool.kind === 'path'
            ? pathDraft
              ? 'Route mode: drag to adjust the endpoint, then release.'
              : 'Route mode: press and drag on the radar.'
            : 'Placement mode: tap anywhere on the radar to drop the selected tool.'}
        </div>
      </div>
    </div>
  )
}
