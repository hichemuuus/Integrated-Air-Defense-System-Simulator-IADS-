import { useRef, useEffect, useCallback, useState, type ReactNode } from 'react'
import { useSimStore } from '../store/simulationStore'
import { renderFrame, type TrackStyle, type ViewTransform } from '../renderer/canvasRenderer'
import PPIDisplay from './PPIDisplay'
import { COLORS } from '../theme'
import type { Overlays } from '../App'

interface Props {
  overlays: Overlays
  onContextMenu: (menu: { x: number; y: number; trackId: number } | null) => void
}

interface CursorState {
  sx: number
  sy: number
  worldX: number
  worldY: number
  inCanvas: boolean
}

function CornerBrackets() {
  const style: React.CSSProperties = {
    position: 'absolute',
    width: '20px',
    height: '20px',
    borderColor: 'rgba(61,220,255,0.25)',
    borderStyle: 'solid',
    pointerEvents: 'none',
    zIndex: 5,
  }
  return (
    <>
      <div style={{ ...style, top: '4px', left: '4px', borderWidth: '2px 0 0 2px' }} />
      <div style={{ ...style, top: '4px', right: '4px', borderWidth: '2px 2px 0 0', left: 'auto' }} />
      <div style={{ ...style, bottom: '4px', left: '4px', top: 'auto', borderWidth: '0 0 2px 2px' }} />
      <div style={{ ...style, bottom: '4px', right: '4px', top: 'auto', left: 'auto', borderWidth: '0 2px 2px 0' }} />
    </>
  )
}

function CursorReadout({ cursor, dims }: { cursor: CursorState; dims: { w: number; h: number } }) {
  const worldDx = cursor.worldX
  const worldDy = cursor.worldY
  const rng = Math.sqrt(worldDx * worldDx + worldDy * worldDy) / 1000
  const brg = (Math.atan2(worldDy, worldDx) * 180 / Math.PI + 360 + 90) % 360
  const brgStr = String(Math.round(brg)).padStart(3, '0')

  const tooltipX = cursor.sx + 18
  const tooltipY = cursor.sy - 20
  const flipX = tooltipX + 140 > dims.w
  const flipY = tooltipY < 0

  return (
    <div
      className="pointer-events-none font-mono"
      style={{
        position: 'absolute',
        left: flipX ? cursor.sx - 158 : `${tooltipX}px`,
        top: flipY ? cursor.sy + 18 : `${tooltipY}px`,
        background: 'rgba(11,15,23,0.85)',
        border: '1px solid rgba(61,220,255,0.2)',
        borderRadius: '1px',
        padding: '3px 7px',
        fontSize: '11px',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        zIndex: 10,
      }}
    >
      <span style={{ color: '#3DDCFF' }}>BRG: </span>
      <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{brgStr}°</span>
      <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 4px' }}>|</span>
      <span style={{ color: '#3DDCFF' }}>RNG: </span>
      <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{rng.toFixed(1)}</span>
      <span style={{ color: '#8892A6', fontSize: '9px' }}> km</span>
    </div>
  )
}

export default function TacticalDisplay({ overlays, onContextMenu }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ tracks: any[]; interceptors: any[]; explosions: any[]; missMarkers: any[]; radarSites: any[]; threats: any[]; destroyedGhosts: any[] }>({
    tracks: [], interceptors: [], explosions: [], missMarkers: [], radarSites: [], threats: [], destroyedGhosts: [],
  })
  const viewRef = useRef<ViewTransform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const stylesRef = useRef<Map<number, TrackStyle>>(new Map())
  const rafRef = useRef(0)
  const dimsRef = useRef({ w: 0, h: 0 })
  const overlaysRef = useRef(overlays)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragOffset = useRef({ x: 0, y: 0 })
  const cursorRef = useRef<CursorState>({ sx: 0, sy: 0, worldX: 0, worldY: 0, inCanvas: false })
  const [cursor, setCursor] = useState<CursorState>({ sx: 0, sy: 0, worldX: 0, worldY: 0, inCanvas: false })

  overlaysRef.current = overlays

  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const explosions = useSimStore(s => s.explosions)
  const missMarkers = useSimStore(s => s.missMarkers)
  const radarSites = useSimStore(s => s.radarSites)
  const threats = useSimStore(s => s.threats)
  const destroyedGhosts = useSimStore(s => s.destroyedGhosts)
  const selectedTrackId = useSimStore(s => s.selectedTrackId)
  const setSelectedTrack = useSimStore(s => s.setSelectedTrack)

  stateRef.current = { tracks, interceptors, explosions, missMarkers, radarSites, threats, destroyedGhosts }
  const allTracks = [...tracks, ...interceptors]

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { w, h } = dimsRef.current
    const v = viewRef.current
    return {
      x: (sx - w / 2) / v.scale - v.offsetX,
      y: (sy - h / 2) / v.scale - v.offsetY,
    }
  }, [])

  const updateCursor = useCallback((clientX: number, clientY: number, inCanvas: boolean) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const world = screenToWorld(sx, sy)
    const next: CursorState = { sx, sy, worldX: world.x, worldY: world.y, inCanvas }
    cursorRef.current = next
    setCursor(next)
  }, [screenToWorld])

  useEffect(() => {
    stylesRef.current.clear()
    for (const t of tracks) stylesRef.current.set(t.id, { rotation: t.heading })
    for (const t of interceptors) stylesRef.current.set(t.id, { rotation: t.heading })
  }, [tracks, interceptors])

  const calcScale = useCallback((w: number, h: number) => {
    if (viewRef.current.scale === 1) {
      viewRef.current.scale = Math.min(w, h) / 12000 * 0.72
    }
  }, [])

  const resize = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const rect = container.getBoundingClientRect()
    const w = rect.width, h = rect.height
    const dpr = window.devicePixelRatio || 1
    dimsRef.current = { w, h }
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    calcScale(w, h)
  }, [calcScale])

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      if (!canvas) { rafRef.current = requestAnimationFrame(loop); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return }
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.scale(dpr, dpr)
      const { w, h } = dimsRef.current
      renderFrame(ctx, w, h, stateRef.current, viewRef.current, stylesRef.current, overlaysRef.current, selectedTrackId, cursorRef.current)
      ctx.restore()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const findTrackAt = useCallback((sx: number, sy: number) => {
    const world = screenToWorld(sx, sy)
    const all = [...stateRef.current.tracks, ...stateRef.current.interceptors]
    const threshold = 15 / (viewRef.current.scale || 1)
    let best: any = null
    let bestDist = threshold
    for (const t of all) {
      if (!t.visible) continue
      const dx = t.displayX - world.x
      const dy = t.displayY - world.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) {
        bestDist = d
        best = t
      }
    }
    return best
  }, [screenToWorld])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isDragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY }
      dragOffset.current = { x: viewRef.current.offsetX, y: viewRef.current.offsetY }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateCursor(e.clientX, e.clientY, true)
    if (isDragging.current) {
      const dx = (e.clientX - dragStart.current.x) / (viewRef.current.scale || 1)
      const dy = (e.clientY - dragStart.current.y) / (viewRef.current.scale || 1)
      viewRef.current.offsetX = dragOffset.current.x + dx
      viewRef.current.offsetY = dragOffset.current.y + dy
    }
  }, [updateCursor])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      isDragging.current = false
      const totalDx = Math.abs(e.clientX - dragStart.current.x)
      const totalDy = Math.abs(e.clientY - dragStart.current.y)
      if (totalDx < 5 && totalDy < 5) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const track = findTrackAt(e.clientX - rect.left, e.clientY - rect.top)
          setSelectedTrack(track ? track.id : null)
        }
      }
    }
  }, [findTrackAt, setSelectedTrack])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    cursorRef.current = { ...cursorRef.current, inCanvas: false }
    setCursor(prev => ({ ...prev, inCanvas: false }))
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const v = viewRef.current
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.05, Math.min(10, v.scale * factor))

    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const { w, h } = dimsRef.current
      const worldX = (mx - w / 2) / v.scale - v.offsetX
      const worldY = (my - h / 2) / v.scale - v.offsetY
      v.offsetX = (mx - w / 2) / newScale - worldX
      v.offsetY = (my - h / 2) / newScale - worldY
    }
    v.scale = newScale
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const track = findTrackAt(e.clientX - rect.left, e.clientY - rect.top)
    if (track && track.classification === 'HOSTILE') {
      onContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id })
    }
  }, [findTrackAt, onContextMenu])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      style={{ cursor: isDragging.current ? 'grabbing' : 'crosshair' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={{ display: 'block' }} />
      <CornerBrackets />
      {cursor.inCanvas && (
        <CursorReadout cursor={cursor} dims={dimsRef.current} />
      )}
      <div className="absolute top-2 right-2">
        <PPIDisplay selectedTrack={allTracks.find(t => t.id === selectedTrackId) ?? null} />
      </div>
      <div className="absolute bottom-2 right-2">
        <PPIDisplay selectedTrack={allTracks.find(t => t.id === selectedTrackId) ?? null} />
      </div>
      <LegendPanel />
    </div>
  )
}

const SW = 14

function Swatch({ children }: { children: React.ReactNode }) {
  return (
    <svg width={SW} height={SW} viewBox={`0 0 ${SW} ${SW}`} className="flex-shrink-0">
      <rect x={0.5} y={0.5} width={SW - 1} height={SW - 1} fill="rgba(255,255,255,0.02)" rx={1} />
      {children}
    </svg>
  )
}

function LegendPanel() {
  const [open, setOpen] = useState(false)

  const items = [
    {
      label: 'HST', desc: 'Hostile track',
      swatch: <Swatch><rect x={3} y={3} width={8} height={8} fill={COLORS.hostile} rx={0.5} /></Swatch>,
    },
    {
      label: 'FRD', desc: 'Friendly (standard)',
      swatch: <Swatch><circle cx={SW / 2} cy={SW / 2} r={4} fill={COLORS.friendly} /></Swatch>,
    },
    {
      label: 'HVA', desc: 'High-Value Asset',
      swatch: (
        <Swatch>
          <rect x={2.5} y={2.5} width={9} height={9} fill="none" stroke={COLORS.friendly} strokeWidth={1.2} />
          <line x1={5} y1={7} x2={9} y2={7} stroke={COLORS.friendly} strokeWidth={1} />
          <line x1={7} y1={5} x2={7} y2={9} stroke={COLORS.friendly} strokeWidth={1} />
        </Swatch>
      ),
    },
    {
      label: 'SAM', desc: 'Surface-to-Air site',
      swatch: (
        <Swatch>
          <polygon points={`${SW / 2},2 3,${SW - 2} ${SW - 3},${SW - 2}`} fill={COLORS.friendly} />
        </Swatch>
      ),
    },
    {
      label: 'NAV', desc: 'Naval defense asset',
      swatch: (
        <Swatch>
          <polygon points={`${SW / 2},2 ${SW - 2},${SW / 2} ${SW / 2},${SW - 2} 2,${SW / 2}`} fill={COLORS.friendly} />
        </Swatch>
      ),
    },
    {
      label: 'INT', desc: 'Interceptor (right chevron)',
      swatch: (
        <Swatch>
          <polygon points={`${SW - 2},${SW / 2} 3,3 3,${SW - 3}`} fill={COLORS.interceptor} />
        </Swatch>
      ),
    },
    {
      label: 'JAM', desc: 'Jammer + effect radius',
      swatch: (
        <Swatch>
          <polygon points={`${SW / 2},1.5 ${SW - 1.5},${SW / 2} ${SW / 2},${SW - 1.5} 1.5,${SW / 2}`} fill={COLORS.jammer} />
        </Swatch>
      ),
    },
    {
      label: 'SWM', desc: 'Swarm member',
      swatch: <Swatch><rect x={4} y={4} width={6} height={6} fill={COLORS.swarm} rx={0.5} /></Swatch>,
    },
    {
      label: 'PRI', desc: 'Threat priority ring (pulsing)',
      swatch: (
        <Swatch>
          <circle cx={SW / 2} cy={SW / 2} r={5.5} fill="none" stroke={COLORS.hostile} strokeWidth={1} opacity={0.5} />
          <circle cx={SW / 2} cy={SW / 2} r={3.5} fill="none" stroke={COLORS.hostile} strokeWidth={0.5} opacity={0.3} strokeDasharray="2 2" />
        </Swatch>
      ),
    },
    {
      label: 'SCT', desc: 'Sector threat overlay',
      swatch: (
        <Swatch>
          <polygon points={`${SW / 2},${SW / 2} ${SW - 1},2 ${SW - 1},${SW / 2}`} fill={COLORS.hostile} opacity={0.15} />
        </Swatch>
      ),
    },
    {
      label: 'KIL', desc: 'Kill event (explosion)',
      swatch: (
        <Swatch>
          <circle cx={SW / 2} cy={SW / 2} r={4.5} fill="none" stroke={COLORS.interceptor} strokeWidth={1} />
          <circle cx={SW / 2} cy={SW / 2} r={2} fill={COLORS.interceptor} opacity={0.3} />
        </Swatch>
      ),
    },
    {
      label: 'RTE', desc: 'Intercept route / HVA threat line',
      swatch: (
        <Swatch>
          <line x1={2} y1={SW - 2} x2={SW - 2} y2={2} stroke={COLORS.interceptor} strokeWidth={0.8} strokeDasharray="2 2" />
        </Swatch>
      ),
    },
    {
      label: 'CVG', desc: 'SAM engagement envelope / HVA protection zone',
      swatch: (
        <Swatch>
          <circle cx={SW / 2} cy={SW / 2} r={5.5} fill="none" stroke={COLORS.interceptor} strokeWidth={0.6} opacity={0.25} strokeDasharray="2 3" />
        </Swatch>
      ),
    },
  ]

  return (
    <div className="absolute bottom-2 left-2 z-10">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-3xs text-muted hover:text-text"
          style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1px',
            padding: '3px 7px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
          }}
        >
          Legend
        </button>
      ) : (
        <div style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '1px',
          padding: '8px',
          minWidth: '170px',
        }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-3xs font-semibold tracking-wider text-muted uppercase">Legend</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text text-xs leading-none px-1"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {items.map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.swatch}
                <span className="text-3xs leading-snug">
                  <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ color: '#4A5568', marginLeft: '0.2rem', fontWeight: 400 }}>— {item.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
