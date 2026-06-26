import { COLORS, WORLD } from '../theme'

const SECTOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const SECTOR_COUNT = SECTOR_LABELS.length
const SECTOR_ANGLE = 360 / SECTOR_COUNT

// threat zone radii in world units
const INNER_ZONE = 4000
const MEDIUM_ZONE = 8000
const OUTER_ZONE = WORLD.range

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  ctx.save()

  // ── threat zone fills (bottom layer, very subtle) ──
  drawThreatZone(ctx, toScreenX, toScreenY, scale)

  ctx.globalAlpha = 0.4

  // ── minor grid lines ──
  const minorSpacing = 1000
  for (let x = Math.ceil(WORLD.min / minorSpacing) * minorSpacing; x <= WORLD.max; x += minorSpacing) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(x), 0)
    ctx.lineTo(toScreenX(x), height)
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'
    ctx.lineWidth = 0.3
    ctx.stroke()
  }
  for (let y = Math.ceil(WORLD.min / minorSpacing) * minorSpacing; y <= WORLD.max; y += minorSpacing) {
    ctx.beginPath()
    ctx.moveTo(0, toScreenY(y))
    ctx.lineTo(width, toScreenY(y))
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'
    ctx.lineWidth = 0.3
    ctx.stroke()
  }

  // ── dot grid ──
  const dotSpacing = 200
  for (let x = Math.ceil(WORLD.min / dotSpacing) * dotSpacing; x <= WORLD.max; x += dotSpacing) {
    for (let y = Math.ceil(WORLD.min / dotSpacing) * dotSpacing; y <= WORLD.max; y += dotSpacing) {
      ctx.fillStyle = 'rgba(255,255,255,0.015)'
      ctx.fillRect(toScreenX(x) - 0.4, toScreenY(y) - 0.4, 0.8, 0.8)
    }
  }

  // ── major grid lines ──
  const majorSpacing = 2000
  for (let x = Math.ceil(WORLD.min / majorSpacing) * majorSpacing; x <= WORLD.max; x += majorSpacing) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(x), 0)
    ctx.lineTo(toScreenX(x), height)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
  for (let y = Math.ceil(WORLD.min / majorSpacing) * majorSpacing; y <= WORLD.max; y += majorSpacing) {
    ctx.beginPath()
    ctx.moveTo(0, toScreenY(y))
    ctx.lineTo(width, toScreenY(y))
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  // ── concentric rings ──
  ctx.globalAlpha = 0.6
  for (const radius of WORLD.rings) {
    const sr = radius * scale
    if (sr < 5) continue
    ctx.beginPath()
    ctx.arc(toScreenX(0), toScreenY(0), sr, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // range label
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${radius / 1000}km`, toScreenX(0) + 4, toScreenY(0) - sr + 2)
  }

  // ── threat zone ring boundaries (emphasized) ──
  ctx.globalAlpha = 0.35
  for (const radius of [INNER_ZONE, MEDIUM_ZONE]) {
    const sr = radius * scale
    if (sr < 5) continue
    ctx.beginPath()
    ctx.arc(toScreenX(0), toScreenY(0), sr, 0, Math.PI * 2)
    const zoneColor = radius === INNER_ZONE ? 'rgba(255,90,90,0.12)' : 'rgba(255,181,71,0.08)'
    ctx.strokeStyle = zoneColor
    ctx.lineWidth = radius === INNER_ZONE ? 1 : 0.6
    ctx.setLineDash([6, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // zone label
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.fillStyle = zoneColor.replace('0.12', '0.3').replace('0.08', '0.2')
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    const label = radius === INNER_ZONE ? 'CRITICAL THREAT ZONE' : 'WARNING ZONE'
    ctx.fillText(label, toScreenX(0) - 6, toScreenY(0) + sr - 4)
  }

  // ── bearing lines (radial) ──
  ctx.globalAlpha = 0.3
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(toScreenX(0), toScreenY(0))
    ctx.lineTo(toScreenX(Math.cos(rad) * WORLD.max), toScreenY(Math.sin(rad) * WORLD.max))
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.3
    ctx.stroke()

    // bearing label
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelDist = WORLD.range * 0.85
    const lx = toScreenX(Math.cos(rad) * labelDist)
    const ly = toScreenY(Math.sin(rad) * labelDist)
    ctx.fillText(`${deg.toString().padStart(3, '0')}°`, lx, ly)
  }

  // ── sector boundary lines (45°, dashed, very subtle) ──
  ctx.globalAlpha = 0.15
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const deg = i * SECTOR_ANGLE
    const rad = (deg * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(toScreenX(0), toScreenY(0))
    ctx.lineTo(toScreenX(Math.cos(rad) * WORLD.max), toScreenY(Math.sin(rad) * WORLD.max))
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // sector label at outer edge
    const midRad = ((deg + SECTOR_ANGLE / 2) * Math.PI) / 180
    const labelDist = WORLD.range * 0.92
    const sx = toScreenX(Math.cos(midRad) * labelDist)
    const sy = toScreenY(Math.sin(midRad) * labelDist)
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(SECTOR_LABELS[i], sx, sy)
  }

  // ── center point ──
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(toScreenX(0), toScreenY(0), 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()

  ctx.restore()
}

function drawThreatZone(
  ctx: CanvasRenderingContext2D,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  const cx = toScreenX(0)
  const cy = toScreenY(0)

  // inner zone fill (red tint)
  const innerSr = INNER_ZONE * scale
  if (innerSr > 5) {
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerSr)
    g1.addColorStop(0, 'rgba(255,90,90,0.02)')
    g1.addColorStop(0.7, 'rgba(255,90,90,0.015)')
    g1.addColorStop(1, 'rgba(255,90,90,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, innerSr, 0, Math.PI * 2)
    ctx.fillStyle = g1
    ctx.globalAlpha = 0.3
    ctx.fill()

    // thin ring
    ctx.beginPath()
    ctx.arc(cx, cy, innerSr, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,90,90,0.08)'
    ctx.lineWidth = 0.6
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // medium zone fill (amber tint)
  const medSr = MEDIUM_ZONE * scale
  if (medSr > 5) {
    const g2 = ctx.createRadialGradient(cx, cy, innerSr, cx, cy, medSr)
    g2.addColorStop(0, 'rgba(255,181,71,0)')
    g2.addColorStop(0.5, 'rgba(255,181,71,0.01)')
    g2.addColorStop(1, 'rgba(255,181,71,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, medSr, 0, Math.PI * 2)
    ctx.fillStyle = g2
    ctx.globalAlpha = 0.25
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, medSr, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,181,71,0.05)'
    ctx.lineWidth = 0.4
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])
  }
}
