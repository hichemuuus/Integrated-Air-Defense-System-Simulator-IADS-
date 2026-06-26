import { COLORS } from '../theme'
import type { Track } from '../types'

export function drawPrediction(
  ctx: CanvasRenderingContext2D,
  track: Track,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  scale: number
) {
  const sx = toScreenX(track.displayX)
  const sy = toScreenY(track.displayY)

  let color: string
  switch (track.classification) {
    case 'HOSTILE': color = COLORS.hostile; break
    case 'INTERCEPTOR': color = COLORS.interceptor; break
    case 'FRIENDLY': color = COLORS.friendly; break
    default: color = COLORS.text
  }

  const steps = 45
  const dt = 0.5

  ctx.save()

  let lastPx = sx
  let lastPy = sy

  for (let i = 1; i <= steps; i++) {
    const t = i * dt
    const px = track.displayX + track.vx * t
    const py = track.displayY + track.vy * t
    const alpha = Math.max(0, (1 - i / steps) * 0.25)

    const spx = toScreenX(px)
    const spy = toScreenY(py)

    ctx.beginPath()
    ctx.moveTo(lastPx, lastPy)
    ctx.lineTo(spx, spy)
    ctx.strokeStyle = color
    ctx.globalAlpha = alpha
    ctx.lineWidth = (1 - i / steps) * 1 + 0.3
    ctx.setLineDash([2, 3])
    ctx.stroke()

    lastPx = spx
    lastPy = spy
  }

  ctx.setLineDash([])

  const finalX = toScreenX(track.displayX + track.vx * steps * dt)
  const finalY = toScreenY(track.displayY + track.vy * steps * dt)

  ctx.beginPath()
  ctx.arc(finalX, finalY, 2, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 0.5
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.restore()
}
