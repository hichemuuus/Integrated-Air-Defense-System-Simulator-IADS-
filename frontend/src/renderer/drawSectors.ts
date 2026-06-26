import type { Track, ThreatAlert } from '../types'

const OCTANT_COUNT = 8
const OCTANT_ANGLE = (Math.PI * 2) / OCTANT_COUNT

const PRIORITY_WEIGHTS = { 1: 1.0, 2: 0.6, 3: 0.3 } as const

function getThreatLevel(eta: number): 1 | 2 | 3 {
  if (eta < 15) return 1
  if (eta < 35) return 2
  return 3
}

function getOctantIndex(bearingDeg: number): number {
  const normalized = ((bearingDeg % 360) + 360) % 360
  return Math.floor(normalized / 45) % OCTANT_COUNT
}

export interface OctantThreatData {
  index: number
  hostileCount: number
  cumulativeScore: number
  averagePriority: number
  opacity: number
}

export function computeOctantThreats(
  hostiles: Track[],
  threats: ThreatAlert[]
): OctantThreatData[] {
  const octants = new Array(OCTANT_COUNT).fill(null).map((_, i) => ({
    index: i,
    hostileCount: 0,
    cumulativeScore: 0,
    averagePriority: 0,
    opacity: 0,
  }))

  for (const t of hostiles) {
    if (!t.visible || t.classification !== 'HOSTILE') continue
    const bearing = (Math.atan2(t.y, t.x) * 180 / Math.PI + 360) % 360
    const idx = getOctantIndex(bearing)
    octants[idx].hostileCount++

    const threat = threats.find(th => th.trackId === t.id)
    if (threat) {
      const level = getThreatLevel(threat.eta)
      const weight = PRIORITY_WEIGHTS[level]
      octants[idx].cumulativeScore += weight
      if (threat.approachingHva) octants[idx].cumulativeScore += 0.5
    }
  }

  const maxScore = Math.max(...octants.map(o => o.cumulativeScore), 1)
  for (const o of octants) {
    if (o.hostileCount === 0) {
      o.opacity = 0
      continue
    }
    const density = o.cumulativeScore / maxScore
    o.opacity = Math.min(0.15, density * 0.12)
    o.averagePriority = o.cumulativeScore / Math.max(o.hostileCount, 1)
  }

  return octants
}

export function drawSectorOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  octants: OctantThreatData[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  const cx = toScreenX(0)
  const cy = toScreenY(0)
  const maxR = Math.sqrt(width * width + height * height)

  ctx.save()

  for (const oct of octants) {
    if (oct.opacity <= 0.01 || oct.hostileCount === 0) continue

    const startAngle = (oct.index * 45 - 22.5) * Math.PI / 180
    const endAngle = ((oct.index + 1) * 45 - 22.5) * Math.PI / 180

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, maxR, startAngle, endAngle)
    ctx.closePath()

    const intensity = oct.opacity
    ctx.fillStyle = `rgba(255, 90, 90, ${intensity})`
    ctx.fill()
  }

  ctx.restore()
}
