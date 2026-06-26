import type { Track, ThreatAlert, DestroyedGhost } from '../types'
import { WORLD, COLORS } from '../theme'
import { drawGrid } from './drawGrid'
import { drawRadarSweep, drawBackgroundSweep, drawCrosshair } from './drawRadar'
import { drawTracks, drawExplosions, drawMissMarkers, drawEngagementLines, drawDestroyedGhosts } from './drawTracks'
import { drawPrediction } from './drawPrediction'
import { computeOctantThreats, drawSectorOverlays } from './drawSectors'
import { drawCoverageEnvelopes, drawProtectionZones, drawEngagementLinesToHva } from './drawCoverage'

export interface TrackStyle {
  rotation: number
}

export interface RadarSite {
  id: number
  x: number
  y: number
  sweepAngle: number
}

export interface RenderState {
  tracks: Track[]
  interceptors: Track[]
  explosions: { x: number; y: number; radius: number; alpha: number }[]
  missMarkers: { x: number; y: number; radius: number; alpha: number }[]
  radarSites: RadarSite[]
  threats: ThreatAlert[]
  destroyedGhosts: DestroyedGhost[]
}

export interface ViewTransform {
  offsetX: number
  offsetY: number
  scale: number
}

export interface OverlayConfig {
  grid: boolean
  radar: boolean
  trails: boolean
  labels: boolean
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
  view: ViewTransform,
  trackStyles: Map<number, TrackStyle>,
  overlays: OverlayConfig = { grid: true, radar: true, trails: true, labels: true },
  selectedTrackId: number | null = null,
  cursor?: { sx: number; sy: number; worldX: number; worldY: number; inCanvas: boolean }
) {
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

  const toScreenX = (x: number) => width / 2 + (x + view.offsetX) * view.scale
  const toScreenY = (y: number) => height / 2 + (y + view.offsetY) * view.scale

  const allTracks = [...state.tracks, ...state.interceptors]
  const selectedTrack = allTracks.find(t => t.id === selectedTrackId) ?? null
  const hostiles = state.tracks.filter(t => t.classification === 'HOSTILE')
  const friendlies = state.tracks.filter(t => t.classification === 'FRIENDLY')
  const hvaTracks = friendlies.filter(t => t.assetRole === 'HighValueAsset')
  const now = Date.now()

  // 1. Radar background (already done via fillRect above)

  // 2. Grid
  if (overlays.grid) {
    drawGrid(ctx, width, height, toScreenX, toScreenY, view.scale)
  }

  // 3. Radar sweeps
  if (overlays.radar) {
    // central background sweep
    drawBackgroundSweep(ctx, width / 2, height / 2, WORLD.range * view.scale, now)

    for (const site of state.radarSites) {
      const sx = toScreenX(site.x)
      const sy = toScreenY(site.y)
      drawRadarSweep(ctx, sx, sy, site.sweepAngle, WORLD.range * view.scale)
    }

    for (const site of state.radarSites) {
      const sx = toScreenX(site.x)
      const sy = toScreenY(site.y)
      ctx.save()
      ctx.beginPath()
      ctx.arc(sx, sy, 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(61, 220, 255, 0.3)'
      ctx.fill()
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(`R${site.id}`, sx, sy + 4)
      ctx.restore()
    }
  }

  // 4. Sector overlays (threat density wedges)
  const octants = computeOctantThreats(hostiles, state.threats)
  drawSectorOverlays(ctx, width, height, octants, toScreenX, toScreenY, view.scale)

  // 5. Coverage envelopes (SAM engagement rings)
  drawCoverageEnvelopes(ctx, state.tracks, toScreenX, toScreenY, view.scale, now)

  // 6. Protection zones (HVA defended areas)
  drawProtectionZones(ctx, state.tracks, toScreenX, toScreenY, view.scale, now)

  // 7. HVA approach threat lines
  drawEngagementLinesToHva(ctx, hostiles, hvaTracks, state.threats, toScreenX, toScreenY, view.scale)

  // 8. Engagement lines
  drawEngagementLines(ctx, state.interceptors, state.tracks, toScreenX, toScreenY)

  // 9. Destroyed ghosts
  drawDestroyedGhosts(ctx, state.destroyedGhosts, toScreenX, toScreenY, view.scale)

  // 10. Trajectory predictions
  for (const t of allTracks) {
    if (!t.visible) continue
    drawPrediction(ctx, t, toScreenX, toScreenY, view.scale)
  }

  // 11. Tracks (symbols + labels) — friendly, HVA, hostile all drawn here
  drawTracks(ctx, state.tracks, state.interceptors, toScreenX, toScreenY, view.scale, trackStyles, {
    trails: overlays.trails,
    labels: overlays.labels,
  }, selectedTrackId, state.threats)

  // 12. Explosions and miss markers
  drawExplosions(ctx, state.explosions, toScreenX, toScreenY, view.scale)
  drawMissMarkers(ctx, state.missMarkers, toScreenX, toScreenY, view.scale)

  // 13. Cursor crosshair (on top of everything)
  if (cursor?.inCanvas) {
    drawCrosshair(ctx, cursor.sx, cursor.sy, width, height)
  }
}
