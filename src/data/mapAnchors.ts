import type { MapAnchor } from '../types/editor'

const MAP_ANCHORS: MapAnchor[] = [
  { id: 'sandstone-t-spawn', mapId: 'sandstone', label: 'T Spawn', shortLabel: 'T', x: 0.18, y: 0.86, category: 'spawn' },
  { id: 'sandstone-mid', mapId: 'sandstone', label: 'Mid', shortLabel: 'Mid', x: 0.5, y: 0.54, category: 'control' },
  { id: 'sandstone-a-long', mapId: 'sandstone', label: 'A Long', shortLabel: 'A Long', x: 0.21, y: 0.52, category: 'route' },
  { id: 'sandstone-a-site', mapId: 'sandstone', label: 'A Site', shortLabel: 'A', x: 0.2, y: 0.28, category: 'site' },
  { id: 'sandstone-heaven', mapId: 'sandstone', label: 'Heaven', shortLabel: 'Heaven', x: 0.34, y: 0.21, category: 'control' },
  { id: 'sandstone-b-tunnel', mapId: 'sandstone', label: 'B Tunnel', shortLabel: 'Tunnel', x: 0.72, y: 0.56, category: 'route' },
  { id: 'sandstone-b-site', mapId: 'sandstone', label: 'B Site', shortLabel: 'B', x: 0.79, y: 0.28, category: 'site' },
  { id: 'sandstone-ct-spawn', mapId: 'sandstone', label: 'CT Spawn', shortLabel: 'CT', x: 0.5, y: 0.12, category: 'spawn' },

  { id: 'rust-t-spawn', mapId: 'rust', label: 'T Spawn', shortLabel: 'T', x: 0.16, y: 0.87, category: 'spawn' },
  { id: 'rust-yard', mapId: 'rust', label: 'Yard', shortLabel: 'Yard', x: 0.36, y: 0.6, category: 'control' },
  { id: 'rust-mid', mapId: 'rust', label: 'Mid', shortLabel: 'Mid', x: 0.49, y: 0.49, category: 'control' },
  { id: 'rust-a-ramp', mapId: 'rust', label: 'A Ramp', shortLabel: 'Ramp', x: 0.25, y: 0.34, category: 'route' },
  { id: 'rust-a-site', mapId: 'rust', label: 'A Site', shortLabel: 'A', x: 0.18, y: 0.2, category: 'site' },
  { id: 'rust-b-hall', mapId: 'rust', label: 'B Hall', shortLabel: 'Hall', x: 0.76, y: 0.44, category: 'route' },
  { id: 'rust-b-site', mapId: 'rust', label: 'B Site', shortLabel: 'B', x: 0.79, y: 0.23, category: 'site' },
  { id: 'rust-ct-spawn', mapId: 'rust', label: 'CT Spawn', shortLabel: 'CT', x: 0.58, y: 0.11, category: 'spawn' },

  { id: 'breeze-t-spawn', mapId: 'breeze', label: 'T Spawn', shortLabel: 'T', x: 0.15, y: 0.88, category: 'spawn' },
  { id: 'breeze-mid', mapId: 'breeze', label: 'Mid', shortLabel: 'Mid', x: 0.49, y: 0.52, category: 'control' },
  { id: 'breeze-a-main', mapId: 'breeze', label: 'A Main', shortLabel: 'A Main', x: 0.24, y: 0.56, category: 'route' },
  { id: 'breeze-a-site', mapId: 'breeze', label: 'A Site', shortLabel: 'A', x: 0.19, y: 0.24, category: 'site' },
  { id: 'breeze-a-heaven', mapId: 'breeze', label: 'A Heaven', shortLabel: 'Heaven', x: 0.3, y: 0.17, category: 'control' },
  { id: 'breeze-b-main', mapId: 'breeze', label: 'B Main', shortLabel: 'B Main', x: 0.74, y: 0.56, category: 'route' },
  { id: 'breeze-b-site', mapId: 'breeze', label: 'B Site', shortLabel: 'B', x: 0.8, y: 0.27, category: 'site' },
  { id: 'breeze-ct-spawn', mapId: 'breeze', label: 'CT Spawn', shortLabel: 'CT', x: 0.54, y: 0.1, category: 'spawn' },

  { id: 'dune-t-spawn', mapId: 'dune', label: 'T Spawn', shortLabel: 'T', x: 0.15, y: 0.89, category: 'spawn' },
  { id: 'dune-mid', mapId: 'dune', label: 'Mid', shortLabel: 'Mid', x: 0.49, y: 0.51, category: 'control' },
  { id: 'dune-short', mapId: 'dune', label: 'Short', shortLabel: 'Short', x: 0.38, y: 0.38, category: 'route' },
  { id: 'dune-a-site', mapId: 'dune', label: 'A Site', shortLabel: 'A', x: 0.23, y: 0.22, category: 'site' },
  { id: 'dune-market', mapId: 'dune', label: 'Market', shortLabel: 'Market', x: 0.53, y: 0.22, category: 'control' },
  { id: 'dune-long', mapId: 'dune', label: 'Long', shortLabel: 'Long', x: 0.66, y: 0.37, category: 'route' },
  { id: 'dune-b-site', mapId: 'dune', label: 'B Site', shortLabel: 'B', x: 0.79, y: 0.21, category: 'site' },
  { id: 'dune-ct-spawn', mapId: 'dune', label: 'CT Spawn', shortLabel: 'CT', x: 0.54, y: 0.11, category: 'spawn' },

  { id: 'hanami-t-spawn', mapId: 'hanami', label: 'T Spawn', shortLabel: 'T', x: 0.18, y: 0.86, category: 'spawn' },
  { id: 'hanami-garden', mapId: 'hanami', label: 'Garden', shortLabel: 'Garden', x: 0.3, y: 0.53, category: 'route' },
  { id: 'hanami-mid', mapId: 'hanami', label: 'Mid', shortLabel: 'Mid', x: 0.5, y: 0.49, category: 'control' },
  { id: 'hanami-a-site', mapId: 'hanami', label: 'A Site', shortLabel: 'A', x: 0.22, y: 0.22, category: 'site' },
  { id: 'hanami-shrine', mapId: 'hanami', label: 'Shrine', shortLabel: 'Shrine', x: 0.44, y: 0.19, category: 'control' },
  { id: 'hanami-bridge', mapId: 'hanami', label: 'Bridge', shortLabel: 'Bridge', x: 0.68, y: 0.43, category: 'route' },
  { id: 'hanami-b-site', mapId: 'hanami', label: 'B Site', shortLabel: 'B', x: 0.79, y: 0.24, category: 'site' },
  { id: 'hanami-ct-spawn', mapId: 'hanami', label: 'CT Spawn', shortLabel: 'CT', x: 0.55, y: 0.1, category: 'spawn' },

  { id: 'province-t-spawn', mapId: 'province', label: 'T Spawn', shortLabel: 'T', x: 0.16, y: 0.88, category: 'spawn' },
  { id: 'province-long', mapId: 'province', label: 'Long', shortLabel: 'Long', x: 0.22, y: 0.53, category: 'route' },
  { id: 'province-mid', mapId: 'province', label: 'Mid', shortLabel: 'Mid', x: 0.51, y: 0.48, category: 'control' },
  { id: 'province-square', mapId: 'province', label: 'Square', shortLabel: 'Square', x: 0.44, y: 0.27, category: 'control' },
  { id: 'province-a-site', mapId: 'province', label: 'A Site', shortLabel: 'A', x: 0.21, y: 0.21, category: 'site' },
  { id: 'province-apartments', mapId: 'province', label: 'Apartments', shortLabel: 'Apps', x: 0.71, y: 0.42, category: 'route' },
  { id: 'province-b-site', mapId: 'province', label: 'B Site', shortLabel: 'B', x: 0.8, y: 0.24, category: 'site' },
  { id: 'province-ct-spawn', mapId: 'province', label: 'CT Spawn', shortLabel: 'CT', x: 0.55, y: 0.1, category: 'spawn' },

  { id: 'prison-t-spawn', mapId: 'prison', label: 'T Spawn', shortLabel: 'T', x: 0.14, y: 0.87, category: 'spawn' },
  { id: 'prison-yard', mapId: 'prison', label: 'Yard', shortLabel: 'Yard', x: 0.31, y: 0.57, category: 'control' },
  { id: 'prison-mid', mapId: 'prison', label: 'Mid', shortLabel: 'Mid', x: 0.5, y: 0.49, category: 'control' },
  { id: 'prison-cell-block', mapId: 'prison', label: 'Cell Block', shortLabel: 'Cells', x: 0.42, y: 0.28, category: 'route' },
  { id: 'prison-a-site', mapId: 'prison', label: 'A Site', shortLabel: 'A', x: 0.24, y: 0.19, category: 'site' },
  { id: 'prison-tower', mapId: 'prison', label: 'Tower', shortLabel: 'Tower', x: 0.68, y: 0.31, category: 'control' },
  { id: 'prison-b-site', mapId: 'prison', label: 'B Site', shortLabel: 'B', x: 0.81, y: 0.22, category: 'site' },
  { id: 'prison-ct-spawn', mapId: 'prison', label: 'CT Spawn', shortLabel: 'CT', x: 0.57, y: 0.1, category: 'spawn' },
]

export function getMapAnchors(mapId: string) {
  return MAP_ANCHORS.filter((anchor) => anchor.mapId === mapId)
}

export function getMapAnchorLabel(mapId: string, anchorId: string) {
  return MAP_ANCHORS.find((anchor) => anchor.mapId === mapId && anchor.id === anchorId)?.label ?? anchorId
}
