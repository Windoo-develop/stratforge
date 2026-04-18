import { useMemo, useState } from 'react'
import { MapCanvas } from '../MapCanvas'
import { SelectionPanel } from '../SelectionPanel'
import { ToolPalette } from '../ToolPalette'
import { Modal } from '../ui/Modal'
import { clampNormalized } from '../../utils/editorMath'
import type {
  EditorSelection,
  MapDefinition,
  MapEntity,
  MapPoint,
  PathDraft,
  PlayerEntity,
  ScenePath,
  SceneState,
  ToolSelection,
  UtilityEntity,
} from '../../types/editor'
import { UTILITY_ITEMS } from '../../data/utilities'

type ReplayStepBoardModalProps = {
  open: boolean
  map: MapDefinition
  scene: SceneState
  onClose: () => void
  onSave: (scene: SceneState) => void
}

function cloneScene(scene: SceneState): SceneState {
  return {
    entities: scene.entities.map((entity) => ({ ...entity })),
    paths: scene.paths.map((path) => ({ ...path })),
  }
}

function buildEntityFromTool(tool: ToolSelection, point: MapPoint): MapEntity | null {
  if (tool.kind === 'utility') {
    const utility = UTILITY_ITEMS.find((item) => item.id === tool.utilityId)
    if (!utility) return null

    return {
      id: crypto.randomUUID(),
      kind: 'utility',
      utilityId: utility.id,
      label: utility.name,
      x: point.x,
      y: point.y,
      scale: 1,
      rotation: 0,
    }
  }

  if (tool.kind === 'player') {
    return {
      id: crypto.randomUUID(),
      kind: 'player',
      label: 'P1',
      x: point.x,
      y: point.y,
      scale: 1,
      rotation: 0,
    }
  }

  return null
}

export function ReplayStepBoardModal({
  open,
  map,
  scene,
  onClose,
  onSave,
}: ReplayStepBoardModalProps) {
  const [draftScene, setDraftScene] = useState<SceneState>(() => cloneScene(scene))
  const [tool, setTool] = useState<ToolSelection>({ kind: 'player' })
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [pathDraft, setPathDraft] = useState<PathDraft | null>(null)

  const selectedEntity =
    selection?.kind === 'entity'
      ? draftScene.entities.find((entity) => entity.id === selection.id) ?? null
      : null

  const selectedPath =
    selection?.kind === 'path'
      ? draftScene.paths.find((path) => path.id === selection.id) ?? null
      : null

  const patchScene = (updater: (current: SceneState) => SceneState) => {
    setDraftScene((current) => updater(current))
  }

  const updateEntity = (id: string, updater: (entity: MapEntity) => MapEntity) => {
    patchScene((current) => ({
      ...current,
      entities: current.entities.map((entity) => (entity.id === id ? updater(entity) : entity)),
    }))
  }

  const updatePath = (id: string, updater: (path: ScenePath) => ScenePath) => {
    patchScene((current) => ({
      ...current,
      paths: current.paths.map((path) => (path.id === id ? updater(path) : path)),
    }))
  }

  const handleDeleteSelection = () => {
    if (!selection) return

    if (selection.kind === 'entity') {
      patchScene((current) => ({
        ...current,
        entities: current.entities.filter((entity) => entity.id !== selection.id),
      }))
    }

    if (selection.kind === 'path') {
      patchScene((current) => ({
        ...current,
        paths: current.paths.filter((path) => path.id !== selection.id),
      }))
    }

    setSelection(null)
  }

  const handleDuplicateEntity = (entity: MapEntity) => {
    const duplicate: MapEntity = {
      ...entity,
      id: crypto.randomUUID(),
      x: Math.min(entity.x + 0.05, 0.96),
      y: Math.min(entity.y + 0.05, 0.96),
    }

    patchScene((current) => ({
      ...current,
      entities: [...current.entities, duplicate],
    }))
    setSelection({ kind: 'entity', id: duplicate.id })
  }

  const footer = useMemo(
    () => (
      <>
        <button type="button" className="ghost-action" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary-action" onClick={() => onSave(cloneScene(draftScene))}>
          Save board step
        </button>
      </>
    ),
    [draftScene, onClose, onSave],
  )

  return (
    <Modal
      open={open}
      title="Edit replay board"
      description={`Compose this replay frame on ${map.name}.`}
      onClose={onClose}
      footer={footer}
    >
      <div className="replay-editor-layout">
        <div className="replay-editor-main">
          <MapCanvas
            map={map}
            scene={draftScene}
            zoom={1}
            tool={tool}
            selection={selection}
            pathDraft={pathDraft}
            onPlacePoint={(point) => {
              const entity = buildEntityFromTool(tool, point)
              if (!entity) return

              patchScene((current) => ({
                ...current,
                entities: [...current.entities, entity],
              }))

              setSelection({ kind: 'entity', id: entity.id })
            }}
            onMoveEntity={(id, point) => {
              updateEntity(id, (entity) => ({
                ...entity,
                x: clampNormalized(point.x),
                y: clampNormalized(point.y),
              }))
            }}
            onMovePath={(id, nextPath) => {
              updatePath(id, () => nextPath)
            }}
            onRotateEntity={(id, rotation) => {
              updateEntity(id, (entity) => ({
                ...entity,
                rotation,
              }))
            }}
            onSelectEntity={(id) => setSelection({ kind: 'entity', id })}
            onSelectPath={(id) => setSelection({ kind: 'path', id })}
            onClearSelection={() => setSelection(null)}
            onStartPathDraft={(point) => {
              setSelection(null)
              setPathDraft({ start: point, end: point })
            }}
            onUpdatePathDraft={(point) => {
              setPathDraft((current) => (current ? { ...current, end: point } : current))
            }}
            onCommitPathDraft={(point) => {
              setPathDraft((current) => {
                if (!current) return null

                const dx = point.x - current.start.x
                const dy = point.y - current.start.y
                const distance = Math.hypot(dx, dy)

                if (distance < 0.02) {
                  return null
                }

                const path: ScenePath = {
                  id: crypto.randomUUID(),
                  startX: current.start.x,
                  startY: current.start.y,
                  endX: point.x,
                  endY: point.y,
                  color: '#6fffe9',
                }

                patchScene((sceneState) => ({
                  ...sceneState,
                  paths: [...sceneState.paths, path],
                }))
                setSelection({ kind: 'path', id: path.id })
                return null
              })
            }}
          />
        </div>

        <aside className="replay-editor-sidebar">
          <ToolPalette
            activeTool={tool}
            onSelectTool={setTool}
            pathDraftActive={Boolean(pathDraft)}
            onCancelPathDraft={() => setPathDraft(null)}
          />

          <SelectionPanel
            selectedEntity={selectedEntity}
            selectedPath={selectedPath}
            onDelete={handleDeleteSelection}
            onDuplicate={selectedEntity ? () => handleDuplicateEntity(selectedEntity) : undefined}
            onUpdateEntity={(patch) => {
              if (!selectedEntity) return

              updateEntity(selectedEntity.id, (entity) => {
                if (entity.kind === 'player') {
                  return { ...entity, ...(patch as Partial<PlayerEntity>) }
                }

                return { ...entity, ...(patch as Partial<UtilityEntity>) }
              })
            }}
            onUpdatePath={(patch) => {
              if (!selectedPath) return
              updatePath(selectedPath.id, (path) => ({ ...path, ...patch }))
            }}
          />
        </aside>
      </div>
    </Modal>
  )
}
