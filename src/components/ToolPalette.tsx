import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
import { useLocale } from '../hooks/useLocale'
import type { ToolSelection } from '../types/editor'

type ToolPaletteProps = {
  activeTool: ToolSelection
  pathDraftActive: boolean
  onSelectTool: (tool: ToolSelection) => void
  onCancelPathDraft: () => void
}

export function ToolPalette({
  activeTool,
  pathDraftActive,
  onSelectTool,
  onCancelPathDraft,
}: ToolPaletteProps) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'
  const topTools = [
    {
      key: 'cursor',
      active: activeTool.kind === 'cursor',
      label: isRu ? 'Курсор' : 'Cursor',
      caption: isRu ? 'Двигать и крутить' : 'Move and rotate',
      icon: '/assets/editor/system/cursor.svg',
      onClick: () => onSelectTool({ kind: 'cursor' }),
      swatchClassName: 'tool-swatch-cursor',
    },
    {
      key: 'player',
      active: activeTool.kind === 'player',
      label: PLAYER_MARKER.name,
      caption: isRu ? 'Поставить игрока' : 'Place player',
      icon: PLAYER_MARKER.iconSrc,
      onClick: () => onSelectTool({ kind: 'player' }),
      swatchClassName: 'tool-swatch-player',
    },
    {
      key: 'path',
      active: activeTool.kind === 'path',
      label: isRu ? 'Маршрут' : 'Route',
      caption: isRu ? 'Нарисовать стрелку' : 'Draw arrow',
      icon: '/assets/editor/system/crosshair.svg',
      onClick: () => onSelectTool({ kind: 'path' }),
      swatchClassName: 'tool-swatch-route',
    },
  ] as const

  return (
    <section className="tool-panel">
      <p className="eyebrow">{isRu ? 'Палитра' : 'Palette'}</p>
      <h3>{isRu ? 'Добавляйте игроков, гранаты и маршруты' : 'Drop players, utilities and routes'}</h3>
      <p className="hero-text">
        {isRu
          ? 'Выберите инструмент, затем нажмите по радару, чтобы разместить его. Уже добавленные элементы можно перетаскивать прямо на карте.'
          : 'Choose a tool, then tap the radar to place it. Existing elements can be dragged directly on the board.'}
      </p>

      <div className="tool-grid tool-grid-top">
        {topTools.map((toolItem) => (
          <button
            key={toolItem.key}
            type="button"
            className={`tool-button tool-button-compact ${toolItem.active ? 'active' : ''}`}
            onClick={toolItem.onClick}
          >
            <span className={`tool-swatch ${toolItem.swatchClassName}`}>
              <img src={toolItem.icon} alt="" />
            </span>
            <span className="tool-copy">
              <strong>{toolItem.label}</strong>
              <small>{toolItem.caption}</small>
            </span>
          </button>
        ))}
      </div>

      {pathDraftActive ? (
        <button type="button" className="mini-action" onClick={onCancelPathDraft}>
          {isRu ? 'Отменить текущий черновик маршрута' : 'Cancel current route draft'}
        </button>
      ) : null}

      <p className="utility-strip-title">{isRu ? 'Панель гранат' : 'Utility tray'}</p>
      <div className="utility-grid">
        {UTILITY_ITEMS.map((utility) => {
          const active = activeTool.kind === 'utility' && activeTool.utilityId === utility.id

          return (
            <button
              key={utility.id}
              type="button"
              className={`utility-button ${active ? 'active' : ''}`}
              onClick={() => onSelectTool({ kind: 'utility', utilityId: utility.id })}
            >
              <span className="utility-icon">
                <img src={utility.paletteSrc} alt="" />
              </span>
              <span className="utility-copy">
                <strong>{utility.name}</strong>
                <small>{utility.group}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
