export type MapPoint = {
  x: number
  y: number
}

export type ToolSelection =
  | { kind: 'player' }
  | { kind: 'utility'; utilityId: string }
  | { kind: 'path' }

export type PlayerEntity = {
  id: string
  kind: 'player'
  label: string
  x: number
  y: number
  scale: number
  rotation: number
}

export type UtilityEntity = {
  id: string
  kind: 'utility'
  utilityId: string
  label: string
  x: number
  y: number
  scale: number
  rotation: number
}

export type MapEntity = PlayerEntity | UtilityEntity

export type ScenePath = {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  color: string
}

export type PathDraft = {
  start: MapPoint
  end: MapPoint
}

export type SceneState = {
  entities: MapEntity[]
  paths: ScenePath[]
}

export type SceneStore = Record<string, SceneState>

export type EditorSelection = { kind: 'entity'; id: string } | { kind: 'path'; id: string } | null

export type MapDefinition = {
  id: string
  name: string
  location: string
  mode: string
  backgroundSrc: string
  radarSrc: string
}

export type MapAnchorCategory = 'spawn' | 'site' | 'route' | 'control' | 'plant'

export type MapAnchor = {
  id: string
  mapId: string
  label: string
  shortLabel?: string
  x: number
  y: number
  category: MapAnchorCategory
}

export type UtilityDefinition = {
  id: string
  name: string
  group: string
  paletteSrc: string
  placedSrc: string
}
