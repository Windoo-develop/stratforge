import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
import { useLocale } from '../hooks/useLocale'
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
  onRotateEntity: (id: string, rotation: number) => void
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

function getRotationFromPointer(clientX: number, clientY: number, board: HTMLDivElement, entity: MapEntity) {
  const rect = board.getBoundingClientRect()
  const centerX = rect.left + entity.x * rect.width
  const centerY = rect.top + entity.y * rect.height
  const angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90

  if (angle > 180) return angle - 360
  if (angle <= -180) return angle + 360
  return angle
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
  onRotateEntity,
  onSelectEntity,
  onSelectPath,
  onClearSelection,
  onStartPathDraft,
  onUpdatePathDraft,
  onCommitPathDraft,
}: MapCanvasProps) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const boardRef = useRef<HTMLDivElement | null>(null)

  const arrowId = useMemo(() => `board-arrow-${map.id}`, [map.id])

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!boardRef.current) return

    if (tool.kind === 'cursor') {
      onClearSelection()
      return
    }

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

    if (tool.kind !== 'cursor') {
      return
    }

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

    if (tool.kind !== 'cursor') {
      return
    }

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

  const beginPathEndpointDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    path: ScenePath,
    endpoint: 'start' | 'end',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectPath(path.id)

    if (tool.kind !== 'cursor') {
      return
    }

    const board = boardRef.current
    if (!board) return

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = board.getBoundingClientRect()
      const nextX = clampNormalized((moveEvent.clientX - rect.left) / rect.width)
      const nextY = clampNormalized((moveEvent.clientY - rect.top) / rect.height)

      onMovePath(path.id, {
        ...path,
        startX: endpoint === 'start' ? nextX : path.startX,
        startY: endpoint === 'start' ? nextY : path.startY,
        endX: endpoint === 'end' ? nextX : path.endX,
        endY: endpoint === 'end' ? nextY : path.endY,
      })
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const beginEntityRotate = (event: ReactPointerEvent<HTMLButtonElement>, entity: MapEntity) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectEntity(entity.id)

    if (tool.kind !== 'cursor') {
      return
    }

    const board = boardRef.current
    if (!board) return

    onRotateEntity(entity.id, getRotationFromPointer(event.clientX, event.clientY, board, entity))

    const handleMove = (moveEvent: PointerEvent) => {
      onRotateEntity(entity.id, getRotationFromPointer(moveEvent.clientX, moveEvent.clientY, board, entity))
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
                } ${tool.kind === 'cursor' ? 'cursor-enabled' : ''}`}
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
                } ${tool.kind === 'cursor' ? 'cursor-enabled' : ''}`}
                x1={path.startX * 100}
                y1={path.startY * 100}
                x2={path.endX * 100}
                y2={path.endY * 100}
                stroke={path.color}
                markerEnd={`url(#${arrowId})`}
                onPointerDown={(event) => beginPathDrag(event, path)}
              />
              <circle className="path-anchor" cx={path.startX * 100} cy={path.startY * 100} r="0.42" />
              <circle className="path-anchor" cx={path.endX * 100} cy={path.endY * 100} r="0.42" />
              {tool.kind === 'cursor' && selection?.kind === 'path' && selection.id === path.id ? (
                <>
                  <circle
                    className="path-anchor-handle"
                    cx={path.startX * 100}
                    cy={path.startY * 100}
                    r="1.18"
                    onPointerDown={(event) => beginPathEndpointDrag(event, path, 'start')}
                  />
                  <circle
                    className="path-anchor-handle"
                    cx={path.endX * 100}
                    cy={path.endY * 100}
                    r="1.18"
                    onPointerDown={(event) => beginPathEndpointDrag(event, path, 'end')}
                  />
                </>
              ) : null}
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
                } ${tool.kind === 'cursor' ? 'cursor-enabled' : ''}`}
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

          {tool.kind === 'cursor' && selection?.kind === 'entity'
            ? scene.entities
              .filter((entity) => entity.id === selection.id)
              .map((entity) => (
                <button
                  key={`${entity.id}-rotate-handle`}
                  type="button"
                  className="entity-rotate-handle"
                  style={{
                    left: `${entity.x * 100}%`,
                    top: `${entity.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${entity.rotation}deg) translateY(-26px)`,
                  }}
                  onPointerDown={(event) => beginEntityRotate(event, entity)}
                  aria-label={isRu ? 'Повернуть объект' : 'Rotate object'}
                >
                  ↻
                </button>
              ))
            : null}
        </div>

        <div className="board-hint">
          {tool.kind === 'cursor'
            ? isRu
              ? 'Режим курсора: перетаскивайте объекты и тяните ручку поворота, чтобы крутить их мышкой.'
              : 'Cursor mode: drag placed items and use the rotate handle to turn them with the mouse.'
            : tool.kind === 'path'
              ? pathDraft
                ? isRu
                  ? 'Режим маршрута: потяните, чтобы настроить конец стрелки, затем отпустите.'
                  : 'Route mode: drag to adjust the endpoint, then release.'
                : isRu
                  ? 'Режим маршрута: нажмите и тяните по радару.'
                  : 'Route mode: press and drag on the radar.'
              : isRu
                ? 'Режим размещения: нажмите в любую точку радара, чтобы поставить выбранный инструмент.'
                : 'Placement mode: tap anywhere on the radar to drop the selected tool.'}
        </div>
      </div>
    </div>
  )
}
