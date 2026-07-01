export function drawBackgroundSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  maxRangePx: number,
  now: number
) {
  const angle = ((now % 4000) / 4000) * Math.PI * 2
  ctx.save()

  // ultra-subtle sweep line
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxRangePx * Math.cos(angle), cy + maxRangePx * Math.sin(angle))
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.04)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  // faint arc wedge
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, maxRangePx, angle - 0.02, angle + 0.02)
  ctx.closePath()
  ctx.fillStyle = 'rgba(34, 211, 238, 0.01)'
  ctx.fill()

  ctx.restore()
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  width: number,
  height: number
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(61, 220, 255, 0.06)'
  ctx.lineWidth = 0.5
  ctx.setLineDash([3, 5])

  ctx.beginPath()
  ctx.moveTo(sx, 0)
  ctx.lineTo(sx, height)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, sy)
  ctx.lineTo(width, sy)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.restore()
}

export function drawRadarSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  maxRangePx: number
) {
  const halfBeam = 0.03

  ctx.save()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, maxRangePx, angle - halfBeam, angle + halfBeam)
  ctx.closePath()

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRangePx)
  grad.addColorStop(0, 'rgba(34, 211, 238, 0.05)')
  grad.addColorStop(0.3, 'rgba(34, 211, 238, 0.02)')
  grad.addColorStop(0.7, 'rgba(34, 211, 238, 0.005)')
  grad.addColorStop(1, 'rgba(34, 211, 238, 0)')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxRangePx * Math.cos(angle), cy + maxRangePx * Math.sin(angle))
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxRangePx * 0.95 * Math.cos(angle - halfBeam * 0.5), cy + maxRangePx * 0.95 * Math.sin(angle - halfBeam * 0.5))
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)'
  ctx.lineWidth = 0.3
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxRangePx * 0.95 * Math.cos(angle + halfBeam * 0.5), cy + maxRangePx * 0.95 * Math.sin(angle + halfBeam * 0.5))
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)'
  ctx.lineWidth = 0.3
  ctx.stroke()
  ctx.globalAlpha = 1

  const ex = cx + maxRangePx * Math.cos(angle)
  const ey = cy + maxRangePx * Math.sin(angle)
  ctx.beginPath()
  ctx.arc(ex, ey, 1.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(34, 211, 238, 0.3)'
  ctx.fill()

  ctx.restore()
}
