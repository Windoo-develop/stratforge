import { PLAYER_MARKER } from '../data/player'
import { UTILITY_ITEMS } from '../data/utilities'
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
  return (
    <section className="tool-panel">
      <p className="eyebrow">Palette</p>
      <h3>Drop players, utilities and routes</h3>
      <p className="hero-text">
        Choose a tool, then tap the radar to place it. Existing elements can be dragged directly on
        the board.
      </p>

      <div className="tool-grid">
        <button
          type="button"
          className={`tool-button ${activeTool.kind === 'player' ? 'active' : ''}`}
          onClick={() => onSelectTool({ kind: 'player' })}
        >
          <span className="tool-swatch tool-swatch-player">
            <img src={PLAYER_MARKER.iconSrc} alt="" />
          </span>
          <span className="tool-copy">
            <strong>{PLAYER_MARKER.name}</strong>
            <small>{PLAYER_MARKER.caption}</small>
          </span>
        </button>

        <button
          type="button"
          className={`tool-button ${activeTool.kind === 'path' ? 'active' : ''}`}
          onClick={() => onSelectTool({ kind: 'path' })}
        >
          <span className="tool-swatch" style={{ background: 'linear-gradient(135deg, #6fffe9, #0ea5e9)' }}>
            →
          </span>
          <span className="tool-copy">
            <strong>Route Arrow</strong>
            <small>Press, drag and release to draw a route</small>
          </span>
        </button>
      </div>

      {pathDraftActive ? (
        <button type="button" className="mini-action" onClick={onCancelPathDraft}>
          Cancel current route draft
        </button>
      ) : null}

      <p className="utility-strip-title">Utility tray</p>
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
