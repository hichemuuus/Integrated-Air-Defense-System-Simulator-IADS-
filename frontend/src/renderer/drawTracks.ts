import { COLORS, WORLD } from '../theme'
import type { Track, ThreatAlert } from '../types'
import type { TrackStyle } from './canvasRenderer'

const JAM_RADIUS = 2500
const INNER_ZONE = 4000

function getColor(t: Track): string {
  if (t.trackType === 'JAMMER') return COLORS.jammer
  if (t.trackType === 'SWARM') return COLORS.swarm
  switch (t.classification) {
    case 'HOSTILE': return COLORS.hostile
    case 'FRIENDLY': return COLORS.friendly
    case 'INTERCEPTOR': return COLORS.interceptor
    default: return COLORS.text
  }
}

function getThreatLevel(eta: number): 1 | 2 | 3 {
  if (eta < 15) return 1
  if (eta < 35) return 2
  return 3
}

function getThreatColor(level: 1 | 2 | 3): string {
  switch (level) {
    case 1: return '#FF5A5A'
    case 2: return '#FFB547'
    case 3: return '#FFC857'
  }
}

function getThreatLabel(level: 1 | 2 | 3): string {
  switch (level) {
    case 1: return 'CRITICAL'
    case 2: return 'HIGH'
    case 3: return 'ADVISORY'
  }
}

function getEngagementStatus(track: Track, interceptors: Track[]): { status: string; color: string; interceptorId?: number } {
  const assigned = interceptors.find(i => i.targetId === track.id && i.visible)
  if (assigned) return { status: 'ENGAGED', color: '#FFB547', interceptorId: assigned.id }
  return { status: 'UNENGAGED', color: '#FF5A5A' }
}

function estimatePK(track: Track, threat: ThreatAlert | undefined, interceptors: Track[]): { pk: number; color: string } {
  const assigned = interceptors.find(i => i.targetId === track.id && i.visible)
  if (!assigned) return { pk: 0, color: '#FF5A5A' }
  let pk = 70
  if (track.jammed) pk -= 25
  if (threat) {
    if (threat.eta < 15) pk -= 15
    else if (threat.eta < 35) pk -= 5
    else pk += 10
  }
  pk = Math.max(5, Math.min(98, pk))
  const color = pk >= 75 ? '#4ADE80' : pk >= 45 ? '#FFB547' : '#FF5A5A'
  return { pk, color }
}

interface DrawOptions {
  trails: boolean
  labels: boolean
}

export function drawTracks(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  interceptors: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  styles: Map<number, TrackStyle>,
  options: DrawOptions = { trails: true, labels: true },
  selectedTrackId?: number | null,
  threats?: ThreatAlert[]
) {
  const all = [...tracks, ...interceptors]

  drawImpactMarkers(ctx, tracks, threats, toScreenX, toScreenY, scale)
  drawInterceptMarkers(ctx, interceptors, tracks, toScreenX, toScreenY)

  if (options.trails) {
    for (const t of all) {
      if (!t.visible) continue
      drawTrail(ctx, t, toScreenX, toScreenY)
    }
  }

  for (const t of tracks) {
    if (!t.visible) continue
    drawJammerRadius(ctx, t, toScreenX, toScreenY, scale)
  }

  for (const t of tracks) {
    if (!t.visible || t.classification !== 'HOSTILE') continue
    drawVelocityVector(ctx, t, toScreenX, toScreenY, scale, all)
  }

  for (const t of all) {
    if (!t.visible) continue
    drawGlow(ctx, t, toScreenX, toScreenY)
  }

  if (threats) {
    for (const t of tracks) {
      if (!t.visible || t.classification !== 'HOSTILE') continue
      const threat = threats.find(th => th.trackId === t.id)
      if (!threat) continue
      drawThreatPriorityRing(ctx, t, threat, interceptors, toScreenX, toScreenY)
    }
  }

  for (const t of all) {
    if (!t.visible) continue
    drawSymbol(ctx, t, toScreenX, toScreenY, scale, styles)
  }

  if (selectedTrackId != null) {
    for (const t of all) {
      if (t.id === selectedTrackId && t.visible) {
        drawSelectionRing(ctx, t, toScreenX, toScreenY)
        break
      }
    }
  }

  if (options.labels) {
    // determine high-priority hostiles
    const hostiles = tracks.filter(t => t.visible && t.classification === 'HOSTILE')
    const highPriorityIds = new Set<number>()
    const hvaTracks = tracks.filter(t => t.assetRole === 'HighValueAsset' && t.visible)
    if (hostiles.length > 0) {
      const scored = hostiles.map(h => {
        let minDist = hvaTracks.length > 0
          ? Math.min(...hvaTracks.map(hva => Math.sqrt((h.x - hva.x) ** 2 + (h.y - hva.y) ** 2)))
          : Math.sqrt(h.x * h.x + h.y * h.y)
        if (h.defendedRadius) minDist = Math.min(minDist, h.defendedRadius)
        const maxRange = 20000
        const distScore = Math.max(0, 1 - minDist / maxRange)
        const speedScore = h.speed / 600
        const priority = distScore * 0.6 + speedScore * 0.4
        return { id: h.id, priority }
      })
      scored.sort((a, b) => b.priority - a.priority)
      const topN = Math.min(3, Math.ceil(scored.length * 0.3))
      for (let i = 0; i < topN && i < scored.length; i++) {
        highPriorityIds.add(scored[i].id)
      }
    }

    const labelItems: { track: Track; sx: number; sy: number }[] = []
    for (const t of all) {
      if (!t.visible) continue
      // skip low-priority hostiles entirely to reduce clutter
      if (t.classification === 'HOSTILE' && !highPriorityIds.has(t.id)) continue
      labelItems.push({ track: t, sx: toScreenX(t.displayX), sy: toScreenY(t.displayY) })
    }

    const CLUSTER_PX = 40
    const clusterIds = new Int32Array(labelItems.length)
    clusterIds.fill(-1)
    let nextCluster = 0

    for (let i = 0; i < labelItems.length; i++) {
      for (let j = 0; j < i; j++) {
        const dx = labelItems[i].sx - labelItems[j].sx
        const dy = labelItems[i].sy - labelItems[j].sy
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) {
          clusterIds[i] = clusterIds[j]
          break
        }
      }
      if (clusterIds[i] === -1) clusterIds[i] = nextCluster++
    }

    const clusters = new Map<number, typeof labelItems>()
    for (let i = 0; i < labelItems.length; i++) {
      const list = clusters.get(clusterIds[i]) ?? []
      list.push(labelItems[i])
      clusters.set(clusterIds[i], list)
    }

    for (const [, members] of clusters) {
      members.sort((a, b) => {
        const aLead = a.track.trackType === 'SWARM' && a.track.id === a.track.groupId ? 0 : 1
        const bLead = b.track.trackType === 'SWARM' && b.track.id === b.track.groupId ? 0 : 1
        if (aLead !== bLead) return aLead - bLead
        return a.track.id - b.track.id
      })
      const threat = threats?.find(th => th.trackId === members[0].track.id)
      const isSelected = members[0].track.id === selectedTrackId
      const isHighPriority = highPriorityIds.has(members[0].track.id)
      drawLabel(ctx, members[0].track, interceptors, toScreenX, toScreenY, scale, members.length, threat, isSelected, isHighPriority)
    }
  }
}

function drawJammerRadius(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  if (t.trackType !== 'JAMMER') return
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  const sr = Math.max(JAM_RADIUS * scale, 1)

  ctx.save()
  ctx.beginPath()
  ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.strokeStyle = COLORS.jammer
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.2
  ctx.setLineDash([4, 4])
  ctx.stroke()
  ctx.setLineDash([])

  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
  grad.addColorStop(0, COLORS.jammer + '08')
  grad.addColorStop(1, COLORS.jammer + '00')
  ctx.fillStyle = grad
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number
) {
  if (t.history.length < 2) return
  const color = getColor(t)
  for (let i = 1; i < t.history.length; i++) {
    const frac = i / t.history.length
    ctx.beginPath()
    ctx.moveTo(toScreenX(t.history[i - 1][0]), toScreenY(t.history[i - 1][1]))
    ctx.lineTo(toScreenX(t.history[i][0]), toScreenY(t.history[i][1]))
    ctx.strokeStyle = color
    ctx.globalAlpha = frac * 0.18
    ctx.lineWidth = frac * 1.2 + 0.3
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawVelocityVector(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  allTracks: Track[]
) {
  const PREDICTION_SEC = 8
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)

  // predicted intercept point in world coords
  const pipWx = t.x + t.vx * PREDICTION_SEC
  const pipWy = t.y + t.vy * PREDICTION_SEC
  const ex = toScreenX(pipWx)
  const ey = toScreenY(pipWy)

  // leaker check — PIP inside HVA zone or inner ring
  let isLeaker = false
  const pipDist = Math.sqrt(pipWx * pipWx + pipWy * pipWy)
  if (pipDist < INNER_ZONE) {
    isLeaker = true
  } else {
    for (const other of allTracks) {
      if (other.visible && other.assetRole === 'HighValueAsset' && other.defendedRadius) {
        const d = Math.sqrt((pipWx - other.x) ** 2 + (pipWy - other.y) ** 2)
        if (d < other.defendedRadius) { isLeaker = true; break }
      }
    }
  }

  const now = Date.now()
  const phase = ((now % 800) / 800) * Math.PI * 2
  const pulse = isLeaker ? 0.5 + 0.5 * Math.sin(phase) : 1
  const color = isLeaker ? '#FF0000' : getColor(t)
  const alpha = isLeaker ? 0.4 + 0.4 * pulse : 0.25

  // velocity vector line
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = isLeaker ? 1.2 : 0.8
  ctx.setLineDash(isLeaker ? [] : [3, 4])
  ctx.stroke()
  ctx.setLineDash([])

  // PIP — hollow circle
  const pr = isLeaker ? 5 : 3
  ctx.beginPath()
  ctx.arc(ex, ey, pr, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha * 0.9
  ctx.lineWidth = isLeaker ? 1.4 : 1
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number
) {
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  const color = getColor(t)
  const isHva = t.classification === 'FRIENDLY' && t.assetRole === 'HighValueAsset'
  const r = isHva ? 22 : t.classification === 'INTERCEPTOR' ? 14 : 12
  const alpha = isHva ? '18' : '0c'
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r)
  grad.addColorStop(0, color + alpha)
  grad.addColorStop(1, color + '00')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawThreatPriorityRing(
  ctx: CanvasRenderingContext2D,
  t: Track,
  threat: ThreatAlert,
  interceptors: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number
) {
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  const level = getThreatLevel(threat.eta)
  const color = getThreatColor(level)
  const engaged = interceptors.some(i => i.targetId === t.id && i.visible)

  ctx.save()

  const now = Date.now()
  const phase = ((now % 2000) / 2000) * Math.PI * 2
  const pulse = 0.5 + 0.5 * Math.sin(phase)

  const baseRadius = level === 1 ? 10 : level === 2 ? 8 : 6
  const lineWidth = level === 1 ? 1.5 : level === 2 ? 1 : 0.6

  let alphaBase = level === 1 ? 0.35 : level === 2 ? 0.2 : 0.1
  if (!engaged && level <= 2) alphaBase += 0.15
  const alpha = alphaBase + (level === 1 ? 0.2 : 0.1) * pulse

  ctx.beginPath()
  ctx.arc(sx, sy, baseRadius + pulse * 1.5, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = alpha
  ctx.stroke()

  if (level === 1) {
    ctx.beginPath()
    ctx.arc(sx, sy, baseRadius + 5, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 0.5
    ctx.globalAlpha = alpha * 0.4
    ctx.setLineDash([2, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // unengaged critical attention marker
  if (!engaged && level <= 2) {
    const markerPulse = 0.4 + 0.6 * ((Math.sin(phase * 3) + 1) / 2)
    ctx.beginPath()
    ctx.arc(sx, sy, baseRadius + 8 + pulse * 2, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 0.4
    ctx.globalAlpha = alpha * markerPulse * 0.5
    ctx.setLineDash([1, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  styles: Map<number, TrackStyle>
) {
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  const color = getColor(t)
  const style = styles.get(t.id)
  const rot = style?.rotation ?? t.heading
  const sz = t.trackType === 'SWARM' ? 2.5 : t.classification === 'INTERCEPTOR' ? 4 : t.classification === 'HOSTILE' ? 4 : 3.5

  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(rot)
  ctx.globalAlpha = 0.9

  if (t.trackType === 'SWARM') {
    ctx.fillStyle = color
    ctx.fillRect(-sz, -sz, sz * 2, sz * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.4
    ctx.strokeRect(-sz, -sz, sz * 2, sz * 2)
  } else if (t.trackType === 'JAMMER') {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -sz * 1.2)
    ctx.lineTo(sz * 1.2, 0)
    ctx.lineTo(0, sz * 1.2)
    ctx.lineTo(-sz * 1.2, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  } else if (t.classification === 'HOSTILE') {
    ctx.fillStyle = color
    ctx.fillRect(-sz, -sz, sz * 2, sz * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.4
    ctx.strokeRect(-sz, -sz, sz * 2, sz * 2)
  } else if (t.classification === 'INTERCEPTOR') {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(sz * 1.8, 0)
    ctx.lineTo(-sz * 0.8, -sz * 0.7)
    ctx.lineTo(-sz * 0.8, sz * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  } else if (t.classification === 'FRIENDLY' && t.assetRole === 'HighValueAsset') {
    // HVA: hollow cyan square + internal crosshair
    const half = sz * 1.5
    ctx.strokeStyle = COLORS.friendly
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.85
    ctx.strokeRect(-half, -half, half * 2, half * 2)
    ctx.beginPath()
    ctx.moveTo(-half * 0.5, 0)
    ctx.lineTo(half * 0.5, 0)
    ctx.moveTo(0, -half * 0.5)
    ctx.lineTo(0, half * 0.5)
    ctx.stroke()
  } else if (t.classification === 'FRIENDLY' && t.assetRole === 'SurfaceToAirSite') {
    // SAM site: filled upright triangle
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -sz * 1.4)
    ctx.lineTo(-sz, sz)
    ctx.lineTo(sz, sz)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  } else if (t.classification === 'FRIENDLY' && t.assetRole === 'NavalDefenseAsset') {
    // Naval: filled diamond
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -sz * 1.2)
    ctx.lineTo(sz, 0)
    ctx.lineTo(0, sz * 1.2)
    ctx.lineTo(-sz, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(0, 0, sz, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  }

  ctx.restore()
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  t: Track,
  allInterceptors: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  clusterSize: number = 1,
  threat?: ThreatAlert | null,
  isSelected: boolean = false,
  isHighPriority: boolean = false
) {
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  const color = getColor(t)
  const prefix = t.trackType === 'SWARM' ? 'SWM' : t.classification === 'INTERCEPTOR' ? 'INT' : t.classification === 'FRIENDLY' ? 'FRD' : 'TRK'
  const suffix = clusterSize > 1 ? ` (+${clusterSize - 1})` : ''
  const idLabel = `${prefix}-${String(t.id).padStart(3, '0')}${suffix}`

  const typeBadge = t.trackType === 'JAMMER' ? '[JAM]' : t.trackType === 'SWARM' ? '[SWM]' : ''

  const lineHeight = 13
  const baseFontSize = Math.max(10, 11 * scale / 100)
  const smallFontSize = Math.max(9, 10 * scale / 100)

  ctx.save()

  let line1: string = idLabel
  let line1Color: string = color
  let line2: string = ''
  let line2Color: string = COLORS.muted
  let line3: string = ''
  let line3Color: string = COLORS.muted

  if (t.classification === 'HOSTILE' && isHighPriority) {
    // ── high-priority hostile ID block ──
    // [ID] | [TYPE] | [MAH]
    const typeStr = t.trackType === 'JAMMER' ? 'JAMMER' : t.trackType === 'SWARM' ? 'SWARM' : 'HOSTILE'
    const mah = threat ? (threat.eta / 60).toFixed(1) : '--.-'
    line1 = `T-${t.id}`
    line1Color = color
    line2 = `${typeStr}`
    line2Color = color
    line3 = `${mah}min`
    line3Color = COLORS.muted
  } else if (t.classification === 'HOSTILE') {
    // low-priority hostiles: minimal ID only
    line1 = idLabel
    line1Color = COLORS.dim
    line2 = ''
  } else if (t.classification === 'INTERCEPTOR') {
    if (t.targetId != null) {
      line2 = 'INBOUND'
      line2Color = '#FFB547'
      if (isSelected) {
        line3 = `TRK-${String(t.targetId).padStart(3, '0')}`
        line3Color = COLORS.hostile
      }
    } else {
      line2 = 'STANDBY'
      line2Color = '#6B7280'
    }
  } else if (t.classification === 'FRIENDLY') {
    if (t.assetRole === 'HighValueAsset') {
      line2 = 'HVA'
      line2Color = COLORS.friendly
    } else if (t.assetRole === 'SurfaceToAirSite') {
      line2 = 'SAM SITE'
      line2Color = '#F59E0B'
    } else if (t.assetRole === 'NavalDefenseAsset') {
      line2 = 'NAVAL'
      line2Color = '#F59E0B'
    } else {
      line2 = 'MONITORING'
      line2Color = '#6B7280'
    }
  }

  // compute box width
  ctx.font = `${baseFontSize}px 'JetBrains Mono', monospace`
  const idW = ctx.measureText(line1).width
  const badgeWidth = typeBadge ? ctx.measureText(typeBadge).width + 4 : 0
  ctx.font = `${smallFontSize}px 'JetBrains Mono', monospace`
  const l2w = ctx.measureText(line2).width
  const l3w = ctx.measureText(line3).width
  const maxLineW = Math.max(idW + badgeWidth, l2w, l3w)

  const pad = 4
  const numLines = line3 ? 3 : line2 ? 2 : 1
  const boxH = numLines * lineHeight + pad * 2
  const lx = sx + 14
  const ly = sy - 16

  ctx.fillStyle = COLORS.labelBg
  const boxAlpha = isSelected ? 0.9 : 0.75
  ctx.globalAlpha = boxAlpha
  ctx.fillRect(lx - pad, ly - pad, maxLineW + pad * 2 + 2, boxH)
  ctx.globalAlpha = 1

  if (isSelected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(lx - pad, ly - pad, maxLineW + pad * 2 + 2, boxH)
  }

  const line1y = ly + baseFontSize * 0.35
  const line2y = line1y + lineHeight
  const line3y = line2y + lineHeight

  // line 1: ID
  ctx.fillStyle = line1Color
  ctx.globalAlpha = 0.9
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${baseFontSize}px 'JetBrains Mono', monospace`
  ctx.fillText(line1, lx, line1y)

  if (typeBadge && !isHighPriority) {
    ctx.fillStyle = t.trackType === 'JAMMER' ? COLORS.jammer : COLORS.swarm
    ctx.globalAlpha = 0.65
    ctx.font = `${smallFontSize}px 'JetBrains Mono', monospace`
    ctx.fillText(typeBadge, lx + idW + 4, line1y)
  }

  ctx.font = `${smallFontSize}px 'JetBrains Mono', monospace`

  // line 2
  if (line2) {
    ctx.fillStyle = line2Color
    ctx.globalAlpha = 0.8
    ctx.fillText(line2, lx, line2y)

    if (t.classification === 'HOSTILE' && isHighPriority) {
      const eng = getEngagementStatus(t, allInterceptors)
      const statusLabel = eng.status === 'ENGAGED'
        ? `● INT-${String(eng.interceptorId!).padStart(3, '0')}`
        : '○ UNENGAGED'
      ctx.fillStyle = eng.status === 'ENGAGED' ? '#FFB547' : '#FF5A5A'
      ctx.globalAlpha = 0.65
      ctx.fillText(statusLabel, lx + l2w + 8, line2y)
    } else if (t.classification === 'INTERCEPTOR' && t.targetId != null) {
      ctx.fillStyle = '#3DDCFF'
      ctx.globalAlpha = 0.55
      ctx.fillText(`→ TRK-${String(t.targetId).padStart(3, '0')}`, lx + l2w + 8, line2y)
    }
  }

  // line 3
  if (line3) {
    ctx.fillStyle = line3Color
    ctx.globalAlpha = 0.75
    ctx.fillText(line3, lx, line3y)

    if (t.classification === 'HOSTILE' && isHighPriority) {
      const eng = getEngagementStatus(t, allInterceptors)
      if (eng.status === 'ENGAGED' && threat) {
        const pk = estimatePK(t, threat, allInterceptors)
        ctx.fillStyle = pk.color
        ctx.globalAlpha = 0.65
        ctx.fillText(`PK ${pk.pk}%`, lx + ctx.measureText(line3).width + 8, line3y)
      }
    }
  }

  ctx.restore()
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  t: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number
) {
  const sx = toScreenX(t.displayX)
  const sy = toScreenY(t.displayY)
  ctx.save()
  ctx.beginPath()
  ctx.arc(sx, sy, 8, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4
  ctx.stroke()
  ctx.restore()
}

// ── intercept point markers ──

function drawInterceptMarkers(
  ctx: CanvasRenderingContext2D,
  interceptors: Track[],
  tracks: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
) {
  const allTargets = [...tracks, ...interceptors]
  for (const inter of interceptors) {
    if (!inter.visible || inter.targetId == null) continue
    const target = allTargets.find(t => t.id === inter.targetId)
    if (!target || !target.visible) continue

    const rx = target.x - inter.x
    const ry = target.y - inter.y
    const rvx = target.vx - inter.vx
    const rvy = target.vy - inter.vy
    const dot = rx * rvx + ry * rvy
    const vMagSq = rvx * rvx + rvy * rvy
    if (vMagSq < 0.01) continue
    const tca = -dot / vMagSq
    if (tca < 0 || tca > 60) continue

    const ipx = inter.x + inter.vx * tca
    const ipy = inter.y + inter.vy * tca
    const tpx = target.x + target.vx * tca
    const tpy = target.y + target.vy * tca
    const missD = Math.sqrt((ipx - tpx) ** 2 + (ipy - tpy) ** 2)
    if (missD > 1500) continue

    const sx = toScreenX(ipx)
    const sy = toScreenY(ipy)

    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.strokeStyle = COLORS.interceptor
    ctx.lineWidth = 0.5

    const sz = 4
    ctx.beginPath()
    ctx.moveTo(sx - sz, sy - sz)
    ctx.lineTo(sx + sz, sy + sz)
    ctx.moveTo(sx + sz, sy - sz)
    ctx.lineTo(sx - sz, sy + sz)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(sx, sy, sz * 1.5, 0, Math.PI * 2)
    ctx.globalAlpha = 0.12
    ctx.stroke()

    // outcome assessment label
    const hitPct = Math.max(0, Math.min(100, 100 - missD / 15))
    ctx.globalAlpha = 0.25
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.fillStyle = hitPct > 70 ? '#4ADE80' : hitPct > 40 ? '#FFB547' : '#FF5A5A'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`INTCP ${hitPct.toFixed(0)}%`, sx, sy + sz * 1.5 + 2)

    ctx.restore()
  }
}

// ── predicted impact markers ──

function drawImpactMarkers(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  threats: ThreatAlert[] | undefined,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  for (const t of tracks) {
    if (!t.visible || t.classification !== 'HOSTILE') continue

    const a = t.vx * t.vx + t.vy * t.vy
    if (a < 0.01) continue
    const b = 2 * (t.x * t.vx + t.y * t.vy)
    const c = t.x * t.x + t.y * t.y - INNER_ZONE * INNER_ZONE
    const disc = b * b - 4 * a * c
    if (disc < 0) continue

    const sqrtD = Math.sqrt(disc)
    const impactT = Math.max((-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a))
    if (impactT < 0 || impactT > 120) continue

    const ipx = t.displayX + t.vx * impactT
    const ipy = t.displayY + t.vy * impactT
    const sx = toScreenX(ipx)
    const sy = toScreenY(ipy)

    const threat = threats?.find(th => th.trackId === t.id)
    const urgency = threat ? Math.min(1, 1 - threat.eta / 60) : 0.5

    ctx.save()

    const angle = Math.atan2(-ipy, -ipx)
    ctx.translate(sx, sy)
    ctx.rotate(angle)
    ctx.strokeStyle = '#FF5A5A'
    ctx.lineWidth = 0.6 + urgency * 0.6
    ctx.globalAlpha = 0.15 + urgency * 0.25
    ctx.beginPath()
    ctx.moveTo(5, 0)
    ctx.lineTo(-3, -4)
    ctx.lineTo(-3, 4)
    ctx.closePath()
    ctx.stroke()

    // breach assessment
    ctx.rotate(-angle)
    ctx.globalAlpha = 0.3
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.fillStyle = '#FF5A5A'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`BREACH ${impactT.toFixed(0)}s`, 0, -7)

    ctx.restore()
  }
}

// ── destroyed ghost markers (battle persistence) ──

export function drawDestroyedGhosts(
  ctx: CanvasRenderingContext2D,
  ghosts: { id: number; trackId: number; interceptorId: number; x: number; y: number; displayX: number; displayY: number; vx: number; vy: number; history: [number, number][]; interceptorX: number; interceptorY: number; life: number; maxLife: number }[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  const now = Date.now()
  for (const g of ghosts) {
    const lifeFrac = Math.max(0, g.life / g.maxLife)
    const alpha = lifeFrac * 0.35

    // faded trail — faint dashed gray line
    if (g.history.length >= 2) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(toScreenX(g.history[0][0]), toScreenY(g.history[0][1]))
      for (let i = 1; i < g.history.length; i++) {
        ctx.lineTo(toScreenX(g.history[i][0]), toScreenY(g.history[i][1]))
      }
      ctx.strokeStyle = '#6B7280'
      ctx.globalAlpha = alpha * 0.4
      ctx.lineWidth = 0.6
      ctx.setLineDash([3, 5])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    // ghost marker — large X
    const sx = toScreenX(g.displayX)
    const sy = toScreenY(g.displayY)
    const xSize = 6 + (1 - lifeFrac) * 2

    ctx.save()
    ctx.globalAlpha = alpha * 0.7
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(sx - xSize, sy - xSize)
    ctx.lineTo(sx + xSize, sy + xSize)
    ctx.moveTo(sx + xSize, sy - xSize)
    ctx.lineTo(sx - xSize, sy + xSize)
    ctx.stroke()

    // faint engagement ghost line
    const isx = toScreenX(g.interceptorX)
    const isy = toScreenY(g.interceptorY)
    ctx.beginPath()
    ctx.moveTo(isx, isy)
    ctx.lineTo(sx, sy)
    ctx.strokeStyle = 'rgba(245,158,11,0.12)'
    ctx.globalAlpha = alpha * 0.3
    ctx.lineWidth = 0.4
    ctx.setLineDash([2, 4])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}

// ── legacy exports ──

const MISS_COLOR = '#6B7280'

export function drawMissMarkers(
  ctx: CanvasRenderingContext2D,
  markers: { x: number; y: number; radius: number; alpha: number }[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  for (const m of markers) {
    const sx = toScreenX(m.x)
    const sy = toScreenY(m.y)
    const sr = Math.max(m.radius * scale, 1)
    const a = Math.max(0, m.alpha)
    ctx.save()
    ctx.globalAlpha = a * 0.3
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.strokeStyle = MISS_COLOR
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }
}

export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: { x: number; y: number; radius: number; alpha: number }[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  for (const ex of explosions) {
    const sx = toScreenX(ex.x)
    const sy = toScreenY(ex.y)
    const sr = Math.max(ex.radius * scale, 1)
    ctx.save()
    ctx.globalAlpha = Math.max(0, ex.alpha) * 0.4
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.interceptor
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sx, sy, sr * 0.4, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 0.4)
    grad.addColorStop(0, COLORS.interceptor + '30')
    grad.addColorStop(1, COLORS.interceptor + '00')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }
}

export function drawEngagementLines(
  ctx: CanvasRenderingContext2D,
  interceptors: Track[],
  tracks: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
) {
  for (const inter of interceptors) {
    if (!inter.visible || inter.targetId == null) continue
    const target = [...tracks, ...interceptors].find(t => t.id === inter.targetId)
    if (!target || !target.visible) continue

    const sx = toScreenX(inter.displayX)
    const sy = toScreenY(inter.displayY)
    const ex = toScreenX(target.displayX)
    const ey = toScreenY(target.displayY)

    // calculate Pk
    const dx = inter.x - target.x
    const dy = inter.y - target.y
    const range = Math.sqrt(dx * dx + dy * dy)
    const rvx = inter.vx - target.vx
    const rvy = inter.vy - target.vy
    const closingSpeed = Math.max(1, -(dx * rvx + dy * rvy) / range)
    const timeToIntercept = Math.max(0, range / closingSpeed)
    let pk = 70
    if (target.jammed) pk -= 25
    if (range < 1000) pk += 15
    else if (range > 5000) pk -= 10
    if (timeToIntercept < 10) pk += 10
    else if (timeToIntercept > 30) pk -= 15
    pk = Math.max(5, Math.min(98, pk))

    const pkHigh = pk > 60
    const alpha = Math.max(0.05, 0.3 - range / 30000)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = pkHigh ? '#FFAA00' : '#FFD700'
    ctx.globalAlpha = pkHigh ? alpha * 1.2 : alpha * 0.8
    ctx.lineWidth = pkHigh ? 1 : 0.8
    ctx.setLineDash(pkHigh ? [] : [4, 5])
    ctx.stroke()
    ctx.setLineDash([])

    const midX = (sx + ex) / 2
    const midY = (sy + ey) / 2
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.fillStyle = pkHigh ? '#FFAA00' : '#FFD700'
    ctx.globalAlpha = pkHigh ? 0.8 : 0.55
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Pk: ${pk.toFixed(0)}%`, midX, midY - 8)

    ctx.restore()
  }
}
