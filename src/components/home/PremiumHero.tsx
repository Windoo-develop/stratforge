import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './PremiumHero.css'

gsap.registerPlugin(ScrollTrigger)

const HERO_WEAPON_SOURCE = '/Adobe Express - file.png'
const SANDSTONE_RADAR_SOURCE = '/assets/maps/sandstone/radar.webp'
const SANDSTONE_BACKGROUND_SOURCE = '/assets/maps/sandstone/background.webp'

type HotspotId = 'barrel' | 'scope' | 'grip'

type HeroHotspot = {
  id: HotspotId
  label: string
  line: string
  dotStyle: CSSProperties
  tooltipStyle: CSSProperties
}

type PremiumHeroProps = {
  isAuthenticated: boolean
  signedInLabel?: string
  onMakeTeam: () => void
  onMasterMap: () => void
}

const hotspots: HeroHotspot[] = [
  {
    id: 'barrel',
    label: 'Smoke lineup',
    line: 'M 220 214 C 174 180, 126 158, 84 144',
    dotStyle: { left: '18%', top: '33%' },
    tooltipStyle: { left: '2%', top: '12%' },
  },
  {
    id: 'scope',
    label: 'Entry route',
    line: 'M 610 218 C 674 178, 740 170, 824 170',
    dotStyle: { left: '60.5%', top: '31.5%' },
    tooltipStyle: { left: '73%', top: '16%' },
  },
  {
    id: 'grip',
    label: 'Flash timing',
    line: 'M 646 420 C 732 452, 778 496, 834 520',
    dotStyle: { left: '63.5%', top: '64%' },
    tooltipStyle: { left: '73%', top: '73%' },
  },
]

const shardClipPaths = [
  'polygon(0 18%, 35% 8%, 43% 28%, 2% 42%)',
  'polygon(33% 8%, 64% 4%, 70% 26%, 42% 30%)',
  'polygon(63% 6%, 100% 10%, 100% 38%, 71% 28%)',
  'polygon(44% 30%, 66% 24%, 70% 68%, 52% 82%, 36% 72%)',
  'polygon(66% 28%, 100% 38%, 100% 100%, 76% 94%, 70% 68%)',
  'polygon(0 42%, 44% 30%, 38% 74%, 10% 100%, 0 100%)',
]

const shardTransforms = [
  { x: -180, y: -90, rotation: -18, scale: 0.94 },
  { x: -24, y: -126, rotation: -10, scale: 0.92 },
  { x: 180, y: -116, rotation: 12, scale: 0.98 },
  { x: 54, y: 120, rotation: 16, scale: 0.95 },
  { x: 220, y: 56, rotation: 22, scale: 0.88 },
  { x: -150, y: 148, rotation: -20, scale: 0.9 },
]

const heroSignals = [
  {
    icon: '/assets/editor/system/crosshair.svg',
    title: 'Sandstone blueprint',
    body: 'Grid-locked radar overlays tuned for a clean callout-first read.',
  },
  {
    icon: '/assets/editor/system/cursor.svg',
    title: 'Inspect-driven reveal',
    body: 'Scroll rotates the weapon like an in-game inspect before the map takes over.',
  },
  {
    icon: '/assets/editor/system/clock.svg',
    title: 'Tactical timings',
    body: 'Surface smoke lineup, entry route and flash timing cues without clutter.',
  },
]

export function PremiumHero({
  isAuthenticated,
  signedInLabel,
  onMakeTeam,
  onMasterMap,
}: PremiumHeroProps) {
  const [activeHotspot, setActiveHotspot] = useState<HotspotId | null>(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
      ? 'barrel'
      : null,
  )
  const [weaponTexture, setWeaponTexture] = useState(HERO_WEAPON_SOURCE)
  const heroRef = useRef<HTMLElement | null>(null)
  const copyRef = useRef<HTMLDivElement | null>(null)
  const hudRef = useRef<HTMLDivElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const radarZoomRef = useRef<HTMLDivElement | null>(null)
  const radarParallaxRef = useRef<HTMLDivElement | null>(null)
  const weaponOrbitRef = useRef<HTMLDivElement | null>(null)
  const weaponTiltRef = useRef<HTMLDivElement | null>(null)
  const weaponBaseRef = useRef<HTMLDivElement | null>(null)
  const shardRefs = useRef<Array<HTMLDivElement | null>>([])

  const coarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  )

  useEffect(() => {
    let active = true

    void (async () => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image()
        nextImage.onload = () => resolve(nextImage)
        nextImage.onerror = () => reject(new Error('Could not load weapon art.'))
        nextImage.src = HERO_WEAPON_SOURCE
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')
      if (!context) return HERO_WEAPON_SOURCE

      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const { data, width, height } = imageData
      const queue: number[] = []
      const visited = new Uint8Array(width * height)
      const isBackgroundPixel = (index: number) => {
        const red = data[index]
        const green = data[index + 1]
        const blue = data[index + 2]
        const alpha = data[index + 3]
        const luminance = (red + green + blue) / 3
        const maxDiff = Math.max(
          Math.abs(red - green),
          Math.abs(red - blue),
          Math.abs(green - blue),
        )

        const darkEdge = luminance <= 28
        const lightChecker = luminance >= 180 && maxDiff <= 26

        return alpha > 0 && (darkEdge || lightChecker)
      }

      const enqueue = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return
        const pixelIndex = y * width + x
        if (visited[pixelIndex]) return
        visited[pixelIndex] = 1
        queue.push(pixelIndex)
      }

      for (let x = 0; x < width; x += 1) {
        enqueue(x, 0)
        enqueue(x, height - 1)
      }

      for (let y = 0; y < height; y += 1) {
        enqueue(0, y)
        enqueue(width - 1, y)
      }

      while (queue.length) {
        const pixelIndex = queue.shift()
        if (pixelIndex === undefined) continue

        const x = pixelIndex % width
        const y = Math.floor(pixelIndex / width)
        const dataIndex = pixelIndex * 4

        if (!isBackgroundPixel(dataIndex)) {
          continue
        }

        data[dataIndex + 3] = 0

        enqueue(x + 1, y)
        enqueue(x - 1, y)
        enqueue(x, y + 1)
        enqueue(x, y - 1)
      }

      context.putImageData(imageData, 0, 0)
      return canvas.toDataURL('image/png')
    })()
      .then((nextTexture) => {
        if (active) {
          setWeaponTexture(nextTexture)
        }
      })
      .catch(() => {
        if (active) {
          setWeaponTexture(HERO_WEAPON_SOURCE)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const heroElement = heroRef.current
    const weaponTiltElement = weaponTiltRef.current
    const radarParallaxElement = radarParallaxRef.current
    const backdropElement = backdropRef.current

    if (!heroElement || !weaponTiltElement || !radarParallaxElement || !backdropElement) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rotateXTo = gsap.quickTo(weaponTiltElement, 'rotationX', {
      duration: 0.55,
      ease: 'power3.out',
    })
    const rotateYTo = gsap.quickTo(weaponTiltElement, 'rotationY', {
      duration: 0.55,
      ease: 'power3.out',
    })
    const weaponXTo = gsap.quickTo(weaponTiltElement, 'x', {
      duration: 0.6,
      ease: 'power3.out',
    })
    const weaponYTo = gsap.quickTo(weaponTiltElement, 'y', {
      duration: 0.6,
      ease: 'power3.out',
    })
    const radarXTo = gsap.quickTo(radarParallaxElement, 'x', {
      duration: 0.75,
      ease: 'power3.out',
    })
    const radarYTo = gsap.quickTo(radarParallaxElement, 'y', {
      duration: 0.75,
      ease: 'power3.out',
    })
    const backdropXTo = gsap.quickTo(backdropElement, 'x', {
      duration: 0.9,
      ease: 'power3.out',
    })
    const backdropYTo = gsap.quickTo(backdropElement, 'y', {
      duration: 0.9,
      ease: 'power3.out',
    })

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = heroElement.getBoundingClientRect()
      const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

      rotateXTo(normalizedY * -7)
      rotateYTo(normalizedX * 10)
      weaponXTo(normalizedX * 18)
      weaponYTo(normalizedY * 16)

      radarXTo(normalizedX * -14)
      radarYTo(normalizedY * -12)
      backdropXTo(normalizedX * -28)
      backdropYTo(normalizedY * -22)
    }

    const handlePointerLeave = () => {
      rotateXTo(0)
      rotateYTo(0)
      weaponXTo(0)
      weaponYTo(0)
      radarXTo(0)
      radarYTo(0)
      backdropXTo(0)
      backdropYTo(0)
    }

    heroElement.addEventListener('pointermove', handlePointerMove)
    heroElement.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      heroElement.removeEventListener('pointermove', handlePointerMove)
      heroElement.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [weaponTexture])

  useEffect(() => {
    const heroElement = heroRef.current
    const copyElement = copyRef.current
    const hudElement = hudRef.current
    const radarZoomElement = radarZoomRef.current
    const weaponOrbitElement = weaponOrbitRef.current
    const weaponBaseElement = weaponBaseRef.current
    const shardElements = shardRefs.current.filter(
      (shardElement): shardElement is HTMLDivElement => shardElement !== null,
    )

    if (!heroElement || !copyElement || !hudElement || !radarZoomElement || !weaponOrbitElement || !weaponBaseElement) {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const context = gsap.context(() => {
      if (prefersReducedMotion) return

      gsap.set(shardElements, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 1 })

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: heroElement,
          start: 'top top',
          end: '+=190%',
          scrub: 1.1,
          pin: true,
          anticipatePin: 1,
        },
      })

      timeline
        .to(
          weaponOrbitElement,
          {
            rotationY: 32,
            rotationZ: -8,
            yPercent: -4,
            scale: 1.08,
          },
          0,
        )
        .to(
          radarZoomElement,
          {
            scale: 1.12,
            yPercent: -3,
            filter: 'brightness(1.08) saturate(1.12)',
          },
          0.12,
        )
        .to(
          copyElement,
          {
            y: 14,
          },
          0.08,
        )
        .to(
          [copyElement, hudElement],
          {
            opacity: 0.18,
            y: 48,
          },
          0.95,
        )
        .to(
          weaponBaseElement,
          {
            opacity: 0,
            scale: 0.78,
            filter: 'blur(10px)',
          },
          0.96,
        )
        .to(
          radarZoomElement,
          {
            scale: 1.48,
            yPercent: -8,
            filter: 'brightness(1.18) saturate(1.2)',
          },
          0.98,
        )

      shardElements.forEach((shardElement, index) => {
        timeline.to(
          shardElement,
          {
            opacity: 1,
            x: shardTransforms[index]?.x ?? 0,
            y: shardTransforms[index]?.y ?? 0,
            rotation: shardTransforms[index]?.rotation ?? 0,
            scale: shardTransforms[index]?.scale ?? 1,
            filter: 'blur(2px)',
          },
          0.94,
        )

        timeline.to(
          shardElement,
          {
            opacity: 0,
          },
          1.2,
        )
      })
    }, heroElement)

    return () => {
      context.revert()
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="relative isolate mb-8 overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/75 shadow-[0_35px_120px_rgba(2,6,23,0.58)]"
      style={{ fontFamily: 'var(--hero-font)' }}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.52) 40%, rgba(2,6,23,0.16) 100%), url(${SANDSTONE_BACKGROUND_SOURCE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="premium-hero-noise absolute inset-0" />
      <div className="premium-hero-grid absolute inset-0 opacity-50" />
      <div className="premium-hero-scanlines absolute inset-0 opacity-25" />
      <div className="premium-hero-vignette absolute inset-0" />

      <div className="relative grid min-h-[90svh] gap-10 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:px-10 lg:py-10">
        <div ref={copyRef} className="flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-100/85 backdrop-blur-xl">
                Sandstone Blueprint
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                Premium Tactical OS
              </span>

              {signedInLabel ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200/90 backdrop-blur-xl">
                  {signedInLabel}
                </span>
              ) : null}
            </div>

            <div className="max-w-xl space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.36em] text-cyan-200/70">
                Sandstone tactics engine
              </p>
              <h1 className="max-w-[12ch] text-5xl font-semibold leading-[0.94] text-white sm:text-6xl xl:text-7xl">
                Build Winning Tactics Like a Pro
              </h1>
              <p className="max-w-[60ch] text-base leading-7 text-slate-300 sm:text-lg">
                Visualize, plan and execute strategies with precision. Inspect the playbook,
                surface the right cue, then let Sandstone become the tactical canvas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onMakeTeam}
                className="rounded-full border border-cyan-300/30 bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(0,242,255,0.45)] transition hover:shadow-[0_0_34px_rgba(0,242,255,0.65)]"
              >
                Make a team
              </button>
              <button
                type="button"
                onClick={onMasterMap}
                className="rounded-full border border-cyan-300/40 bg-white/5 px-6 py-3 text-sm font-semibold text-cyan-50 backdrop-blur-xl transition hover:border-cyan-200/60 hover:bg-cyan-300/10"
              >
                Master the Map
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroSignals.map((signal) => (
                <article
                  key={signal.title}
                  className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-[18px]"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                    <img src={signal.icon} alt="" className="h-5 w-5" />
                  </div>
                  <h2 className="mb-2 text-base font-semibold text-white">{signal.title}</h2>
                  <p className="text-sm leading-6 text-slate-300/88">{signal.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.28em] text-slate-400/85">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(0,242,255,0.9)]" />
              Live route inspect
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.85)]" />
              Sandstone tactical board
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_14px_rgba(217,70,239,0.78)]" />
              Team-ready lineups
            </span>
          </div>
        </div>

        <div
          ref={hudRef}
          className="flex items-center"
          onMouseLeave={() => {
            if (!coarsePointer) {
              setActiveHotspot(null)
            }
          }}
        >
          <div className="relative w-full">
            <div className="absolute right-4 top-0 z-10 flex flex-wrap justify-end gap-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/48 px-4 py-3 text-right backdrop-blur-[20px]">
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Active map</p>
                <p className="mt-1 text-lg font-semibold text-white">Sandstone</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/48 px-4 py-3 text-right backdrop-blur-[20px]">
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Mode</p>
                <p className="mt-1 text-lg font-semibold text-white">Defuse</p>
              </div>
            </div>

            <div className="premium-hero-perspective relative mx-auto aspect-[1000/650] max-w-[840px]">
              <div
                ref={radarZoomRef}
                className="premium-hero-preserve-3d absolute inset-0 overflow-hidden rounded-[30px] border border-cyan-300/12 bg-slate-950/45 shadow-[0_0_0_1px_rgba(148,163,184,0.06)_inset]"
              >
                <div ref={radarParallaxRef} className="premium-hero-crt premium-hero-preserve-3d absolute inset-0">
                  <img
                    src={SANDSTONE_RADAR_SOURCE}
                    alt="Sandstone radar map"
                    className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-screen"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle at center, rgba(0, 242, 255, 0.22), transparent 58%)',
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(120deg, rgba(0, 242, 255, 0.12), transparent 35%, rgba(188, 19, 254, 0.12) 78%, transparent)',
                    }}
                  />
                </div>
              </div>

              <div
                ref={weaponOrbitRef}
                className="premium-hero-preserve-3d absolute inset-[7%_0_3%_6%] origin-center"
              >
                <div ref={weaponTiltRef} className="premium-hero-preserve-3d absolute inset-0">
                  <div
                    ref={weaponBaseRef}
                    className="premium-hero-base premium-hero-chromatic absolute inset-0"
                  >
                    <img
                      src={weaponTexture}
                      alt="AK blueprint render"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  {shardClipPaths.map((clipPath, index) => (
                    <div
                      key={clipPath}
                      ref={(node) => {
                        shardRefs.current[index] = node
                      }}
                      className="premium-hero-shard premium-hero-chromatic absolute inset-0"
                      style={{ clipPath }}
                    >
                      <img
                        src={weaponTexture}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <svg
                viewBox="0 0 1000 650"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {hotspots.map((hotspot) => (
                  <path
                    key={hotspot.id}
                    d={hotspot.line}
                    className={`premium-hero-hotspot-path ${
                      activeHotspot === hotspot.id ? 'active' : ''
                    }`}
                    fill="none"
                    stroke="rgba(114, 244, 255, 0.95)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    filter="drop-shadow(0 0 8px rgba(0,242,255,0.45))"
                  />
                ))}
              </svg>

              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  onMouseEnter={() => setActiveHotspot(hotspot.id)}
                  onFocus={() => setActiveHotspot(hotspot.id)}
                  onClick={() => setActiveHotspot((current) => (current === hotspot.id ? current : hotspot.id))}
                  onBlur={() => {
                    if (!coarsePointer) {
                      setActiveHotspot(null)
                    }
                  }}
                  className="absolute z-20"
                  style={hotspot.dotStyle}
                  aria-label={hotspot.label}
                >
                  <span className="premium-hero-dot relative block h-4 w-4 rounded-full border border-white/20 bg-slate-950/70" />
                </button>
              ))}

              {hotspots.map((hotspot) => (
                <div
                  key={`${hotspot.id}-tooltip`}
                  className={`premium-hero-tooltip absolute z-20 ${
                    activeHotspot === hotspot.id ? 'active' : ''
                  }`}
                  style={hotspot.tooltipStyle}
                >
                  <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/72 px-4 py-3 text-sm font-medium text-cyan-50 shadow-[0_14px_48px_rgba(2,6,23,0.45)] backdrop-blur-[18px]">
                    {hotspot.label}
                  </div>
                </div>
              ))}

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-slate-950/42 px-4 py-3 text-xs uppercase tracking-[0.26em] text-slate-300/80 backdrop-blur-[16px]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  Scroll to inspect
                </span>
                <span className="hidden items-center gap-2 sm:inline-flex">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                  Hover hotspots for tactical hints
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Map sync enabled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="pointer-events-none absolute inset-x-5 bottom-5 z-20 sm:inset-x-7 lg:inset-x-10">
          <div className="ml-auto max-w-md rounded-[24px] border border-white/10 bg-slate-950/52 px-4 py-3 text-sm text-slate-300 backdrop-blur-[20px]">
            Create an account to turn the Sandstone board into a shared team blueprint with roster,
            lineups and strat libraries.
          </div>
        </div>
      ) : null}
    </section>
  )
}
