import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import '../../App.css'
import { MapCanvas } from '../../components/MapCanvas'
import { MapLibrary } from '../../components/MapLibrary'
import { SelectionPanel } from '../../components/SelectionPanel'
import { ToolPalette } from '../../components/ToolPalette'
import { MAPS } from '../../data/maps'
import { UTILITY_ITEMS } from '../../data/utilities'
import { useLocale } from '../../hooks/useLocale'
import { clampNormalized, isEditableTarget, translateScenePath } from '../../utils/editorMath'
import type {
  EditorSelection,
  MapEntity,
  MapPoint,
  PathDraft,
  PlayerEntity,
  ScenePath,
  SceneState,
  SceneStore,
  ToolSelection,
  UtilityEntity,
} from '../../types/editor'

const STORAGE_KEY = 'stratforge-editor-v1'

function createEmptyScene(): SceneState {
  return { entities: [], paths: [] }
}

function readStoredScenes(): SceneStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SceneState>
    if (!parsed || typeof parsed !== 'object') return {}

    return Object.fromEntries(
      Object.entries(parsed).map(([mapId, scene]) => [
        mapId,
        {
          entities: Array.isArray(scene?.entities)
            ? scene.entities.filter(
                (entity): entity is MapEntity =>
                  entity?.kind === 'player' || entity?.kind === 'utility',
              )
            : [],
          paths: Array.isArray(scene?.paths) ? scene.paths : [],
        },
      ]),
    )
  } catch {
    return {}
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

export function MapEditorWorkspace() {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const [activeMapId, setActiveMapId] = useState(MAPS[0].id)
  const [tool, setTool] = useState<ToolSelection>({
    kind: 'player',
  })
  const [scenes, setScenes] = useState<SceneStore>(() => readStoredScenes())
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [zoom, setZoom] = useState(1)
  const [pathDraft, setPathDraft] = useState<PathDraft | null>(null)
  const [statusMessage, setStatusMessage] = useState(
    isRu ? 'Автосохранение активно на этом устройстве.' : 'Auto-save is active on this device.',
  )
  const importRef = useRef<HTMLInputElement | null>(null)

  const activeMap = useMemo(
    () => MAPS.find((map) => map.id === activeMapId) ?? MAPS[0],
    [activeMapId],
  )

  const activeScene = scenes[activeMap.id] ?? createEmptyScene()

  const selectedEntity =
    selection?.kind === 'entity'
      ? activeScene.entities.find((entity) => entity.id === selection.id) ?? null
      : null

  const selectedPath =
    selection?.kind === 'path'
      ? activeScene.paths.find((path) => path.id === selection.id) ?? null
      : null

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
  }, [scenes])

  useEffect(() => {
    if (tool.kind !== 'path') {
      setPathDraft(null)
    }
  }, [tool])

  useEffect(() => {
    setStatusMessage(isRu ? 'Автосохранение активно на этом устройстве.' : 'Auto-save is active on this device.')
  }, [isRu])

  useEffect(() => {
    setSelection(null)
    setPathDraft(null)
  }, [activeMapId])

  const patchActiveScene = useCallback((updater: (scene: SceneState) => SceneState) => {
    setScenes((current) => {
      const nextScene = updater(current[activeMap.id] ?? createEmptyScene())
      return {
        ...current,
        [activeMap.id]: nextScene,
      }
    })
  }, [activeMap.id])

  const handlePlacePoint = (point: MapPoint) => {
    const entity = buildEntityFromTool(tool, point)
    if (!entity) return

    patchActiveScene((scene) => ({
      ...scene,
      entities: [...scene.entities, entity],
    }))
    setSelection({ kind: 'entity', id: entity.id })
    setStatusMessage(
      isRu
        ? `${entity.kind === 'player' ? 'Маркер игрока' : 'Утилита'} добавлен${entity.kind === 'player' ? '' : 'а'} на ${activeMap.name}.`
        : `${entity.kind === 'player' ? 'Player marker' : 'Utility'} added to ${activeMap.name}.`,
    )
  }

  const updateEntity = useCallback((id: string, updater: (entity: MapEntity) => MapEntity) => {
    patchActiveScene((scene) => ({
      ...scene,
      entities: scene.entities.map((entity) => (entity.id === id ? updater(entity) : entity)),
    }))
  }, [patchActiveScene])

  const updatePath = useCallback((id: string, updater: (path: ScenePath) => ScenePath) => {
    patchActiveScene((scene) => ({
      ...scene,
      paths: scene.paths.map((path) => (path.id === id ? updater(path) : path)),
    }))
  }, [patchActiveScene])

  const handleMoveEntity = useCallback((id: string, point: MapPoint) => {
    updateEntity(id, (entity) => ({
      ...entity,
      x: clampNormalized(point.x),
      y: clampNormalized(point.y),
    }))
  }, [updateEntity])

  const handleMovePath = useCallback((id: string, nextPath: ScenePath) => {
    updatePath(id, () => nextPath)
  }, [updatePath])

  const handleDuplicateEntity = (entity: MapEntity) => {
    const duplicate: MapEntity = {
      ...entity,
      id: crypto.randomUUID(),
      x: Math.min(entity.x + 0.05, 0.96),
      y: Math.min(entity.y + 0.05, 0.96),
    }

    patchActiveScene((scene) => ({
      ...scene,
      entities: [...scene.entities, duplicate],
    }))
    setSelection({ kind: 'entity', id: duplicate.id })
    setStatusMessage(isRu ? 'Выбранный объект дублирован.' : 'Selected element duplicated.')
  }

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return

    if (selection.kind === 'entity') {
      patchActiveScene((scene) => ({
        ...scene,
        entities: scene.entities.filter((entity) => entity.id !== selection.id),
      }))
    }

    if (selection.kind === 'path') {
      patchActiveScene((scene) => ({
        ...scene,
        paths: scene.paths.filter((path) => path.id !== selection.id),
      }))
    }

    setSelection(null)
    setStatusMessage(isRu ? 'Выделение удалено.' : 'Selection removed.')
  }, [patchActiveScene, selection])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (event.key === 'Escape') {
        if (pathDraft) {
          event.preventDefault()
          setPathDraft(null)
          setStatusMessage(isRu ? 'Черновик маршрута отменен.' : 'Route draft cancelled.')
          return
        }

        if (selection) {
          event.preventDefault()
          setSelection(null)
          setStatusMessage(isRu ? 'Выделение снято.' : 'Selection cleared.')
        }

        return
      }

      if (!selection) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDeleteSelection()
        return
      }

      const step = event.shiftKey ? 0.025 : 0.01

      let deltaX = 0
      let deltaY = 0

      if (event.key === 'ArrowLeft') deltaX = -step
      if (event.key === 'ArrowRight') deltaX = step
      if (event.key === 'ArrowUp') deltaY = -step
      if (event.key === 'ArrowDown') deltaY = step

      if (!deltaX && !deltaY) return

      event.preventDefault()

      if (selection.kind === 'entity') {
        const entity = activeScene.entities.find((item) => item.id === selection.id)
        if (!entity) return

        handleMoveEntity(entity.id, {
          x: entity.x + deltaX,
          y: entity.y + deltaY,
        })
        setStatusMessage(isRu ? 'Выбранный объект перемещен клавиатурой.' : 'Selected object moved with keyboard.')
        return
      }

      const path = activeScene.paths.find((item) => item.id === selection.id)
      if (!path) return

      handleMovePath(path.id, translateScenePath(path, deltaX, deltaY))
      setStatusMessage(isRu ? 'Выбранный маршрут перемещен клавиатурой.' : 'Selected route moved with keyboard.')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeScene.entities,
    activeScene.paths,
    handleDeleteSelection,
    handleMoveEntity,
    handleMovePath,
    pathDraft,
    selection,
  ])

  const handleClearScene = () => {
    patchActiveScene(() => createEmptyScene())
    setSelection(null)
    setPathDraft(null)
    setStatusMessage(isRu ? `Сцена ${activeMap.name} очищена.` : `${activeMap.name} scene cleared.`)
  }

  const handleExport = () => {
    const payload = {
      mapId: activeMap.id,
      exportedAt: new Date().toISOString(),
      scene: activeScene,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stratforge-${activeMap.id}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatusMessage(isRu ? `JSON-экспорт создан для ${activeMap.name}.` : `JSON export created for ${activeMap.name}.`)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const parsed = JSON.parse(content) as { mapId?: string; scene?: SceneState }
      if (!parsed.mapId || !parsed.scene) {
        throw new Error(isRu ? 'Некорректные данные сцены' : 'Invalid scene payload')
      }

      setScenes((current) => ({
        ...current,
        [parsed.mapId!]: parsed.scene!,
      }))

      const importedMap = MAPS.find((map) => map.id === parsed.mapId)
      if (importedMap) {
        startTransition(() => {
          setActiveMapId(importedMap.id)
        })
      }

      setSelection(null)
      setPathDraft(null)
      setStatusMessage(
        isRu
          ? `Сцена импортирована${importedMap ? ` для ${importedMap.name}` : ''}.`
          : `Scene imported${importedMap ? ` for ${importedMap.name}` : ''}.`,
      )
    } catch {
      setStatusMessage(
        isRu
          ? 'Импорт не удался. Используйте JSON, экспортированный этим приложением.'
          : 'Import failed. Use a JSON exported by this app.',
      )
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <div className="app-glow app-glow-left" />
      <div className="app-glow app-glow-right" />

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{isRu ? 'Тактическая доска' : 'CS2 Tactical Board'}</p>
          <h2>{isRu ? 'Выбирай карту по фону, а собирай тактику на радаре.' : 'Choose a map by background, build on the radar.'}</h2>
          <p className="hero-text">
            {isRu
              ? 'Ниже библиотека карт с превью-фонами, а сам редактор работает уже на радаре. Утилиты и маркеры игроков живут отдельными слоями, поэтому архитектура готова к новым картам и более богатой игровой логике. Выбирай любой объект и используй Delete или стрелки для быстрого редактирования.'
              : 'The library below uses preview backgrounds, while the editor itself works on the radar image. Utilities and player markers live as separate layers, so the architecture is ready for more maps and richer game logic. Select any object and use Delete or arrow keys for fast editing.'}
          </p>
        </div>

        <div className="hero-meta">
          <div className="stat-card">
            <span>{MAPS.length}</span>
            <p>{isRu ? 'карт подключено к системе ассетов' : 'maps wired into the asset system'}</p>
          </div>
          <div className="stat-card">
            <span>{UTILITY_ITEMS.length}</span>
            <p>{isRu ? 'иконок утилит готовы для редактора' : 'utility icons ready for the editor'}</p>
          </div>
          <div className="stat-card">
            <span>{activeScene.entities.length + activeScene.paths.length}</span>
            <p>{isRu ? `объектов сейчас размещено на ${activeMap.name}` : `objects currently placed on ${activeMap.name}`}</p>
          </div>
        </div>
      </section>

      <MapLibrary activeMapId={activeMap.id} maps={MAPS} onSelectMap={setActiveMapId} />

      <main className="workspace">
        <section className="board-panel">
          <div className="board-panel-header">
            <div>
              <p className="eyebrow">{isRu ? 'Радар-воркспейс' : 'Radar Workspace'}</p>
              <h3>{activeMap.name}</h3>
            </div>

            <div className="topbar-actions">
              <button type="button" className="ghost-action" onClick={handleClearScene}>
                {isRu ? 'Очистить карту' : 'Clear map'}
              </button>
              <button type="button" className="ghost-action" onClick={handleExport}>
                {isRu ? 'Экспорт JSON' : 'Export JSON'}
              </button>
              <button type="button" className="primary-action" onClick={() => importRef.current?.click()}>
                {isRu ? 'Импорт JSON' : 'Import JSON'}
              </button>
              <input
                ref={importRef}
                hidden
                type="file"
                accept="application/json"
                onChange={handleImport}
              />
            </div>

            <div className="zoom-panel">
              <button type="button" className="zoom-button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}>
                -
              </button>
              <div className="zoom-readout">
                <span>{Math.round(zoom * 100)}%</span>
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
              <button type="button" className="zoom-button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}>
                +
              </button>
            </div>
          </div>

          <MapCanvas
            map={activeMap}
            scene={activeScene}
            zoom={zoom}
            tool={tool}
            selection={selection}
            pathDraft={pathDraft}
            onPlacePoint={handlePlacePoint}
            onMoveEntity={handleMoveEntity}
            onMovePath={handleMovePath}
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
              setStatusMessage(isRu ? 'Рисуем маршрут...' : 'Drawing route...')
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
                  setStatusMessage(
                    isRu
                      ? 'Маршрут отменен: протяни дальше, чтобы создать стрелку.'
                      : 'Route cancelled: drag farther to create an arrow.',
                  )
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

                patchActiveScene((scene) => ({
                  ...scene,
                  paths: [...scene.paths, path],
                }))
                setSelection({ kind: 'path', id: path.id })
                setStatusMessage(isRu ? 'Маршрут создан.' : 'Route created.')
                return null
              })
            }}
          />

          <p className="status-line">{statusMessage}</p>
        </section>

        <aside className="side-panel">
          <ToolPalette
            activeTool={tool}
            onSelectTool={setTool}
            pathDraftActive={Boolean(pathDraft)}
            onCancelPathDraft={() => {
              setPathDraft(null)
              setStatusMessage(isRu ? 'Черновик маршрута отменен.' : 'Route draft cancelled.')
            }}
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
      </main>
    </div>
  )
}
