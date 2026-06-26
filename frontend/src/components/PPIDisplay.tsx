import { useState, useRef, useEffect } from 'react'
import { useSimStore } from '../store/simulationStore'
import { COLORS } from '../theme'
import type { Track } from '../types'

type RadarMode = 'PPI' | 'A-SCOPE' | 'B-SCOPE'

const SIZE = 160

interface Props {
  selectedTrack?: Track | null
}

export default function PPIDisplay({ selectedTrack = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const radarSites = useSimStore(s => s.radarSites)
  const animRef = useRef(0)
  const [mode, setMode] = useState<RadarMode>('PPI')
  const addToast = useSimStore(s => s.addToast)
  const dataRef = useRef({ tracks, interceptors, radarSites, selectedTrack })
  dataRef.current = { tracks, interceptors, radarSites, selectedTrack }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    canvas.style.width = `${SIZE}px`
    canvas.style.height = `${SIZE}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let running = true

    const primaryAngle = () => (dataRef.current.radarSites[0]?.sweepAngle ?? 0)
    const modeLabel = (m: RadarMode) => {
      switch (m) {
        case 'PPI': return `PPI ${(primaryAngle() * 180 / Math.PI % 360).toFixed(0)}°`
        case 'A-SCOPE': return 'A-SCOPE'
        case 'B-SCOPE': return `B-SCOPE ${(primaryAngle() * 180 / Math.PI % 360).toFixed(0)}°`
      }
    }

    const draw = () => {
      if (!running) return
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = '#0B0F17'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(0, 0, SIZE, SIZE)

      const { tracks: tr, interceptors: intr, radarSites: sites, selectedTrack: sel } = dataRef.current
      const angle = sites[0]?.sweepAngle ?? 0
      const all = [...tr, ...intr].filter(e => e.visible)

      if (mode === 'PPI') drawPPI(ctx, SIZE, all, angle, sel)
      else if (mode === 'A-SCOPE') drawAScope(ctx, SIZE, all, angle)
      else if (mode === 'B-SCOPE') drawBScope(ctx, SIZE, all, angle)

      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(modeLabel(mode), 4, SIZE - 6)

      ctx.restore()
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="block rounded-sm cursor-pointer"
        style={{ width: SIZE, height: SIZE, border: '1px solid rgba(255,255,255,0.08)', background: '#0B0F17' }}
        onClick={() => {
          const next = mode === 'PPI' ? 'A-SCOPE' : mode === 'A-SCOPE' ? 'B-SCOPE' : 'PPI'
          setMode(next)
          addToast({ message: `Radar display: ${next}`, type: 'info' })
        }}
      />
      <div className="absolute -top-1.5 -right-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            const next = mode === 'PPI' ? 'A-SCOPE' : mode === 'A-SCOPE' ? 'B-SCOPE' : 'PPI'
            setMode(next)
            addToast({ message: `Radar display: ${next}`, type: 'info' })
          }}
          className="text-2xs text-muted hover:text-text bg-panel border border-border rounded-sm px-1 py-0.5"
        >
          {mode === 'PPI' ? '→A' : mode === 'A-SCOPE' ? '→B' : '→P'}
        </button>
      </div>
    </div>
  )
}

function drawPPI(ctx: CanvasRenderingContext2D, size: number, entities: any[], angle: number, selectedTrack: any | null) {
  const cx = size / 2, cy = size / 2, range = size * 0.42
  const worldRange = selectedTrack ? 2000 : 3000
  const centerX = selectedTrack?.x ?? 0
  const centerY = selectedTrack?.y ?? 0

  for (let r = 1; r <= 3; r++) {
    ctx.beginPath()
    ctx.arc(cx, cy, range * (r / 3), 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, range, angle - 0.04, angle + 0.04)
  ctx.closePath()
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range)
  grad.addColorStop(0, 'rgba(34,211,238,0.06)')
  grad.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = grad
  ctx.fill()
  const ex = cx + range * Math.cos(angle)
  const ey = cy + range * Math.sin(angle)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = 'rgba(34,211,238,0.15)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  for (const e of entities) {
    const dx = e.x - centerX
    const dy = e.y - centerY
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > worldRange) continue
    ctx.beginPath()
    ctx.arc(cx + (dx / worldRange) * range, cy + (dy / worldRange) * range, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(34,211,238,0.3)'
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (!selectedTrack) return
  const st = selectedTrack

  if (st.history && st.history.length >= 2) {
    for (let i = 1; i < st.history.length; i++) {
      const frac = i / st.history.length
      const px = cx + ((st.history[i][0] - centerX) / worldRange) * range
      const py = cy + ((st.history[i][1] - centerY) / worldRange) * range
      const pxPrev = cx + ((st.history[i - 1][0] - centerX) / worldRange) * range
      const pyPrev = cy + ((st.history[i - 1][1] - centerY) / worldRange) * range
      ctx.beginPath()
      ctx.moveTo(pxPrev, pyPrev)
      ctx.lineTo(px, py)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.globalAlpha = frac * 0.25
      ctx.lineWidth = frac * 0.8 + 0.2
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  const scale = range / worldRange
  const vecLen = st.speed * scale * 4
  const vecEndX = cx + vecLen * Math.cos(st.heading)
  const vecEndY = cy + vecLen * Math.sin(st.heading)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(vecEndX, vecEndY)
  ctx.setLineDash([2, 3])
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(vecEndX, vecEndY, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawAScope(ctx: CanvasRenderingContext2D, size: number, entities: any[], angle: number) {
  const pad = 10
  const w = size - pad * 2
  const h = size - pad * 2

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 0.4
  ctx.beginPath()
  ctx.moveTo(pad, pad)
  ctx.lineTo(pad, pad + h)
  ctx.lineTo(pad + w, pad + h)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '8px JetBrains Mono, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('RNG', pad, pad - 3)

  const maxRange = 10000
  for (const e of entities) {
    const d = Math.sqrt(e.x ** 2 + e.y ** 2)
    if (d > maxRange) continue
    const bx = pad + (d / maxRange) * w
    const by = pad + h
    const amp = 0.3 + 0.7 * (1 - d / maxRange)
    const peakH = amp * h * 0.8

    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, by - peakH)
    ctx.strokeStyle = e.classification === 'HOSTILE' ? COLORS.hostile : e.classification === 'INTERCEPTOR' ? COLORS.interceptor : COLORS.friendly
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(bx, by - peakH, 2, 0, Math.PI * 2)
    ctx.fillStyle = e.classification === 'HOSTILE' ? COLORS.hostile : e.classification === 'INTERCEPTOR' ? COLORS.interceptor : COLORS.friendly
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawBScope(ctx: CanvasRenderingContext2D, size: number, entities: any[], angle: number) {
  const pad = 10
  const w = size - pad * 2
  const h = size - pad * 2

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 0.4
  ctx.beginPath()
  ctx.moveTo(pad, pad)
  ctx.lineTo(pad, pad + h)
  ctx.lineTo(pad + w, pad + h)
  ctx.lineTo(pad + w, pad)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '8px JetBrains Mono, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('AZ→', pad, pad - 3)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('RNG', pad, pad + h + 3)

  const maxRange = 10000
  for (const e of entities) {
    const d = Math.sqrt(e.x ** 2 + e.y ** 2)
    if (d > maxRange) continue
    const bearing = (Math.atan2(e.y, e.x) + Math.PI) / (2 * Math.PI)
    const bx = pad + bearing * w
    const by = pad + (1 - d / maxRange) * h

    ctx.beginPath()
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = e.classification === 'HOSTILE' ? COLORS.hostile : e.classification === 'INTERCEPTOR' ? COLORS.interceptor : COLORS.friendly
    ctx.globalAlpha = 0.7
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.beginPath()
  const sweepX = pad + ((angle % (2 * Math.PI)) / (2 * Math.PI)) * w
  ctx.moveTo(sweepX, pad)
  ctx.lineTo(sweepX, pad + h)
  ctx.strokeStyle = 'rgba(34,211,238,0.15)'
  ctx.lineWidth = 0.5
  ctx.stroke()
}
