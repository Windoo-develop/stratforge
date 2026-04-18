import { useEffect, useRef } from 'react'
import { useLocale } from '../../hooks/useLocale'
import './PremiumHero.css'

const SANDSTONE_RADAR_SOURCE = '/assets/maps/sandstone/radar.webp'
const SANDSTONE_BACKGROUND_SOURCE = '/assets/maps/sandstone/background.webp'

type PremiumHeroProps = {
  isAuthenticated: boolean
  signedInLabel?: string
  onMakeTeam: () => void
  onMasterMap: () => void
}

const toolbarIcons = [
  '/assets/editor/system/cursor.svg',
  '/assets/editor/system/crosshair.svg',
  '/assets/editor/system/clock.svg',
  '/assets/editor/system/book.svg',
]

const tickerItems = [
  'CORE_TEMP: 42°C',
  'NETWORK_STABILITY: 99.98%',
  'ACTIVE_NODES: 1,242',
  'ENCRYPTION: AES-256-GCM',
  'LAST_SYNC: 0.2ms AGO',
  'UPLINK_STATUS: NOMINAL',
  '# READY_FOR_DEPLOYMENT',
]

export function PremiumHero({
  isAuthenticated,
  signedInLabel,
  onMakeTeam,
  onMasterMap,
}: PremiumHeroProps) {
  const { t } = useLocale()
  const heroRef = useRef<HTMLElement | null>(null)

  const tacticalSignals = [
    {
      icon: '/assets/editor/system/crosshair.svg',
      eyebrow: '[ CAP_01 ]',
      title: t('hero.signal1Title'),
      body: t('hero.signal1Body'),
    },
    {
      icon: '/assets/editor/system/book.svg',
      eyebrow: '[ CAP_02 ]',
      title: t('hero.signal2Title'),
      body: t('hero.signal2Body'),
    },
    {
      icon: '/assets/editor/system/clock.svg',
      eyebrow: '[ CAP_03 ]',
      title: t('hero.signal3Title'),
      body: t('hero.signal3Body'),
    },
  ]

  useEffect(() => {
    const heroElement = heroRef.current
    if (!heroElement) return

    heroElement.style.setProperty('--hero-parallax-x', '0')
    heroElement.style.setProperty('--hero-parallax-y', '0')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let frame = 0

    const setParallax = (x: number, y: number) => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        heroElement.style.setProperty('--hero-parallax-x', `${x}`)
        heroElement.style.setProperty('--hero-parallax-y', `${y}`)
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = heroElement.getBoundingClientRect()
      const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      setParallax(Number(normalizedX.toFixed(3)), Number(normalizedY.toFixed(3)))
    }

    const resetParallax = () => {
      setParallax(0, 0)
    }

    heroElement.addEventListener('pointermove', handlePointerMove)
    heroElement.addEventListener('pointerleave', resetParallax)

    return () => {
      cancelAnimationFrame(frame)
      heroElement.removeEventListener('pointermove', handlePointerMove)
      heroElement.removeEventListener('pointerleave', resetParallax)
    }
  }, [])

  const primaryLabel = isAuthenticated ? t('hero.primaryAuthed') : t('hero.primary')
  const statusLabel = isAuthenticated ? t('hero.statusAuthed') : t('hero.statusOnline')

  return (
    <section ref={heroRef} className="premium-hero-upgrade" aria-label="StratForge tactical hero">
      <div
        className="premium-hero-upgrade__backdrop premium-hero-shift-soft"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(5,10,22,0.2) 0%, rgba(5,10,22,0.82) 100%), linear-gradient(90deg, rgba(5,10,22,0.94) 0%, rgba(5,10,22,0.48) 46%, rgba(5,10,22,0.82) 100%), url(${SANDSTONE_BACKGROUND_SOURCE})`,
        }}
      />
      <div className="premium-hero-upgrade__ambient premium-hero-shift-strong" aria-hidden="true" />
      <div className="premium-hero-upgrade__grid" aria-hidden="true" />
      <div className="premium-hero-upgrade__scanlines" aria-hidden="true" />

      <div className="premium-hero-upgrade__layout">
        <div className="premium-hero-upgrade__copy premium-hero-shift-soft">
          <div className="premium-hero-upgrade__status-row">
            <span className="premium-hero-upgrade__status-chip">
              <span className="premium-hero-upgrade__status-dot" />
              {statusLabel}: ver 2.4.0
            </span>

            {signedInLabel ? (
              <span className="premium-hero-upgrade__identity-chip">{signedInLabel}</span>
            ) : null}
          </div>

          <div className="premium-hero-upgrade__headline-block">
            <p className="premium-hero-upgrade__eyebrow">{t('hero.commandCenter')}</p>
            <h1 className="premium-hero-upgrade__headline">
              {t('hero.headlineLineOne')} <span>{t('hero.headlineLineTwo')}</span>
            </h1>
            <p className="premium-hero-upgrade__subtitle">{t('hero.subtitle')}</p>
          </div>

          <div className="premium-hero-upgrade__actions">
            <button
              type="button"
              className="premium-hero-upgrade__cta premium-hero-upgrade__cta--primary"
              onClick={onMakeTeam}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              className="premium-hero-upgrade__cta premium-hero-upgrade__cta--ghost"
              onClick={onMasterMap}
            >
              {t('hero.secondary')}
            </button>
          </div>

          <div className="premium-hero-upgrade__signal-grid">
            {tacticalSignals.map((signal) => (
              <article key={signal.title} className="premium-hero-upgrade__signal-card">
                <div className="premium-hero-upgrade__signal-icon">
                  <img src={signal.icon} alt="" />
                </div>
                <p className="premium-hero-upgrade__signal-eyebrow">{signal.eyebrow}</p>
                <h2>{signal.title}</h2>
                <p>{signal.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="premium-hero-upgrade__stage premium-hero-shift-strong">
          <div className="premium-hero-upgrade__float premium-hero-upgrade__float--left">
            <div className="premium-hero-upgrade__float-title">
              <span />
              Satellite_Link
            </div>
            <p>MAP: Sandstone</p>
            <p>REGION: Tactical Node 04</p>
          </div>

          <div className="premium-hero-upgrade__float premium-hero-upgrade__float--right">
            <div className="premium-hero-upgrade__float-title premium-hero-upgrade__float-title--cyan">
              <span />
              Encrypted_Feed
            </div>
            <p>PACKET_LOSS: 0.00%</p>
            <div className="premium-hero-upgrade__meter">
              <span />
            </div>
          </div>

          <div className="premium-hero-upgrade__workspace">
            <div className="premium-hero-upgrade__workspace-bar">
              <div className="premium-hero-upgrade__window-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>Workspace_Beta.vfx</p>
              <span className="premium-hero-upgrade__workspace-live">{t('hero.liveConnection')}</span>
            </div>

            <div className="premium-hero-upgrade__workspace-body">
              <aside className="premium-hero-upgrade__toolbar" aria-label="Workspace tools">
                {toolbarIcons.map((icon, index) => (
                  <button
                    key={icon}
                    type="button"
                    className={`premium-hero-upgrade__tool ${index === 0 ? 'is-active' : ''}`}
                    tabIndex={-1}
                  >
                    <img src={icon} alt="" />
                  </button>
                ))}
              </aside>

              <div className="premium-hero-upgrade__canvas">
                <img
                  src={SANDSTONE_RADAR_SOURCE}
                  alt="Sandstone tactical board preview"
                  className="premium-hero-upgrade__canvas-map"
                />
                <div className="premium-hero-upgrade__canvas-overlay" aria-hidden="true" />

                <div className="premium-hero-upgrade__canvas-chip premium-hero-upgrade__canvas-chip--top">
                  <span>A-Site Execute</span>
                  <strong>Sync timing: 00:42</strong>
                </div>

                <div className="premium-hero-upgrade__canvas-chip premium-hero-upgrade__canvas-chip--bottom">
                  <span>Utility Path</span>
                  <strong>Trajectory: Optimized</strong>
                </div>

                <div className="premium-hero-upgrade__reticle" aria-hidden="true">
                  <span />
                  <span />
                </div>

                <svg
                  className="premium-hero-upgrade__route premium-hero-upgrade__route--amber"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <path d="M 18 76 C 30 64, 36 58, 46 50 S 66 34, 82 24" />
                </svg>

                <svg
                  className="premium-hero-upgrade__route premium-hero-upgrade__route--cyan"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <path d="M 22 20 C 34 28, 46 38, 52 50 S 66 72, 82 80" />
                </svg>

                <div className="premium-hero-upgrade__scan-frame premium-hero-upgrade__scan-frame--alpha" aria-hidden="true" />
                <div className="premium-hero-upgrade__scan-frame premium-hero-upgrade__scan-frame--beta" aria-hidden="true" />

                <div className="premium-hero-upgrade__pulse premium-hero-upgrade__pulse--one" aria-hidden="true" />
                <div className="premium-hero-upgrade__pulse premium-hero-upgrade__pulse--two" aria-hidden="true" />
              </div>

              <aside className="premium-hero-upgrade__inspector">
                <h2>{t('hero.utilityInspector')}</h2>
                <div className="premium-hero-upgrade__inspector-block">
                  <span>{t('hero.objectName')}</span>
                  <strong>SMK_WINDOW_01</strong>
                </div>
                <div className="premium-hero-upgrade__inspector-block">
                  <span>{t('hero.coordinates')}</span>
                  <div className="premium-hero-upgrade__coordinate-grid">
                    <strong>X: 142.4</strong>
                    <strong>Y: 89.1</strong>
                  </div>
                </div>
                <div className="premium-hero-upgrade__toggles">
                  <div>
                    <span>{t('hero.visibleToTeam')}</span>
                    <b />
                  </div>
                  <div>
                    <span>{t('hero.collisionSync')}</span>
                    <b />
                  </div>
                </div>
                <button type="button" className="premium-hero-upgrade__inspector-action" tabIndex={-1}>
                  {t('hero.applyChanges')}
                </button>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-hero-upgrade__ticker" aria-hidden="true">
        <div className="premium-hero-upgrade__ticker-track">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <div className="premium-hero-upgrade__footer">
        <span>{t('hero.lowLatency')}</span>
        <span>{t('hero.multiUser')}</span>
        <span>{t('hero.blueprintExport')}</span>
      </div>
    </section>
  )
}
