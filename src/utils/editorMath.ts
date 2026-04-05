import type { ScenePath } from '../types/editor'

const MIN_COORD = 0.02
const MAX_COORD = 0.98

export function clampNormalized(value: number) {
  return Math.min(MAX_COORD, Math.max(MIN_COORD, value))
}

export function translateScenePath(path: ScenePath, deltaX: number, deltaY: number): ScenePath {
  const minX = Math.min(path.startX, path.endX)
  const maxX = Math.max(path.startX, path.endX)
  const minY = Math.min(path.startY, path.endY)
  const maxY = Math.max(path.startY, path.endY)

  const safeDeltaX = Math.min(Math.max(deltaX, MIN_COORD - minX), MAX_COORD - maxX)
  const safeDeltaY = Math.min(Math.max(deltaY, MIN_COORD - minY), MAX_COORD - maxY)

  return {
    ...path,
    startX: clampNormalized(path.startX + safeDeltaX),
    startY: clampNormalized(path.startY + safeDeltaY),
    endX: clampNormalized(path.endX + safeDeltaX),
    endY: clampNormalized(path.endY + safeDeltaY),
  }
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}
