import type { Track } from '../types'
import { COLORS } from '../theme'

export function drawCoverageEnvelopes(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  simTime: number
) {
  const defensive = tracks.filter(
    t => t.visible && t.engagementRange != null && t.engagementRange > 0
  )

  ctx.save()

  for (const d of defensive) {
    const sx = toScreenX(d.displayX)
    const sy = toScreenY(d.displayY)
    const sr = d.engagementRange * scale

    if (sr < 2) continue

    // dashed outline ring
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.interceptor
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 0.6
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // interior fill
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    grad.addColorStop(0, `${COLORS.interceptor}08`)
    grad.addColorStop(0.7, `${COLORS.interceptor}06`)
    grad.addColorStop(1, `${COLORS.interceptor}00`)
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.05
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function drawProtectionZones(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number,
  simTime: number
) {
  const hvas = tracks.filter(
    t => t.visible && t.assetRole === 'HighValueAsset' && t.defendedRadius != null && t.defendedRadius > 0
  )

  ctx.save()

  const phase = ((simTime * 1000) % 3000) / 3000
  const pulse = 0.4 + 0.6 * Math.sin(phase * Math.PI * 2)

  for (const hva of hvas) {
    const sx = toScreenX(hva.displayX)
    const sy = toScreenY(hva.displayY)
    const sr = hva.defendedRadius * scale

    if (sr < 2) continue

    // pulsing dashed ring
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.friendly
    ctx.globalAlpha = 0.08 + 0.04 * pulse
    ctx.lineWidth = 0.6
    ctx.setLineDash([3, 5])
    ctx.stroke()
    ctx.setLineDash([])

    // faint fill
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    grad.addColorStop(0, `${COLORS.friendly}06`)
    grad.addColorStop(0.5, `${COLORS.friendly}04`)
    grad.addColorStop(1, `${COLORS.friendly}00`)
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.03 + 0.02 * pulse
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function drawEngagementLinesToHva(
  ctx: CanvasRenderingContext2D,
  hostiles: Track[],
  hvaTracks: Track[],
  threatAlerts: { trackId: number; approachingHva?: boolean }[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  ctx.save()

  for (const h of hostiles) {
    if (!h.visible) continue
    const threat = threatAlerts.find(th => th.trackId === h.id)
    if (!threat?.approachingHva) continue

    for (const hva of hvaTracks) {
      if (!hva.visible || hva.assetRole !== 'HighValueAsset') continue
      const radius = hva.defendedRadius ?? 4000
      const d = Math.sqrt((h.x - hva.x) ** 2 + (h.y - hva.y) ** 2)
      if (d > radius) continue

      const sx = toScreenX(h.displayX)
      const sy = toScreenY(h.displayY)
      const ex = toScreenX(hva.displayX)
      const ey = toScreenY(hva.displayY)

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.strokeStyle = COLORS.hostile
      ctx.globalAlpha = 0.08
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  ctx.restore()
}
