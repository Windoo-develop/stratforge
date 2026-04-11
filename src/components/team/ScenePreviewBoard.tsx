import { useMemo } from 'react'
import { PLAYER_MARKER } from '../../data/player'
import { UTILITY_ITEMS } from '../../data/utilities'
import type { MapDefinition, SceneState } from '../../types/editor'

type ScenePreviewBoardProps = {
  map: MapDefinition
  scene: SceneState
  className?: string
}

export function ScenePreviewBoard({ map, scene, className }: ScenePreviewBoardProps) {
  const arrowId = useMemo(() => `scene-preview-arrow-${map.id}-${scene.paths.length}`, [map.id, scene.paths.length])

  return (
    <div className={`board-shell scene-preview-shell ${className ?? ''}`.trim()}>
      <div className="board scene-preview-board">
        <img className="board-radar" src={map.radarSrc} alt={`${map.name} replay preview`} />

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
                className="board-path"
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
        </svg>

        <div className="board-overlay">
          {scene.entities.map((entity) => {
            const utility = entity.kind === 'utility'
              ? UTILITY_ITEMS.find((item) => item.id === entity.utilityId)
              : null

            return (
              <div
                key={entity.id}
                className={`entity-chip ${entity.kind === 'player' ? 'entity-player' : 'entity-utility'} scene-preview-entity`}
                style={{
                  left: `${entity.x * 100}%`,
                  top: `${entity.y * 100}%`,
                  width: `${24 * entity.scale}px`,
                  height: `${24 * entity.scale}px`,
                  transform: `translate(-50%, -50%) rotate(${entity.rotation}deg)`,
                }}
              >
                {entity.kind === 'player' ? (
                  <>
                    <img className="entity-player-icon" src={PLAYER_MARKER.iconSrc} alt="" />
                    <span className="entity-player-name">{entity.label}</span>
                  </>
                ) : null}
                {entity.kind === 'utility' && utility ? <img src={utility.placedSrc} alt={utility.name} /> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
