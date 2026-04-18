import type { MapDefinition } from '../types/editor'
import { useLocale } from '../hooks/useLocale'

type MapLibraryProps = {
  maps: MapDefinition[]
  activeMapId: string
  onSelectMap: (mapId: string) => void
}

export function MapLibrary({ maps, activeMapId, onSelectMap }: MapLibraryProps) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'

  return (
    <section className="map-library">
      <div className="map-library-header">
        <div>
          <p className="eyebrow">{isRu ? 'Библиотека карт' : 'Map Library'}</p>
          <h3>{isRu ? 'Выбирай карту по превью-фону' : 'Pick with the preview background'}</h3>
        </div>
        <p className="hero-text">
          {isRu
            ? 'Карточки используют сцену-превью, а в самом редакторе карта автоматически переключается на радар.'
            : 'Cards use the scene image. The editor swaps in the radar automatically.'}
        </p>
      </div>

      <div className="map-list" role="list" aria-label={isRu ? 'Доступные карты' : 'Available maps'}>
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
