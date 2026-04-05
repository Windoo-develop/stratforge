import type { MapDefinition } from '../types/editor'

type MapLibraryProps = {
  maps: MapDefinition[]
  activeMapId: string
  onSelectMap: (mapId: string) => void
}

export function MapLibrary({ maps, activeMapId, onSelectMap }: MapLibraryProps) {
  return (
    <section className="map-library">
      <div className="map-library-header">
        <div>
          <p className="eyebrow">Map Library</p>
          <h3>Pick with the preview background</h3>
        </div>
        <p className="hero-text">Cards use the scene image. The editor swaps in the radar automatically.</p>
      </div>

      <div className="map-list" role="list" aria-label="Available maps">
        {maps.map((map) => (
          <button
            key={map.id}
            type="button"
            className={`map-card ${map.id === activeMapId ? 'active' : ''}`}
            style={{ backgroundImage: `url(${map.backgroundSrc})` }}
            onClick={() => onSelectMap(map.id)}
          >
            <div className="map-card-content">
              <span>{map.name}</span>
              <small>
                {map.location} • {map.mode}
              </small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
