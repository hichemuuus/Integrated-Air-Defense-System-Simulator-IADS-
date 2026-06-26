import type { Track, Explosion, MissMarker, ThreatAlert, EventEntry, RadarSite, ScenarioConfig, DestroyedGhost, AssetRole, PolicyId } from '../types'
import { DEFAULT_SCENARIO } from '../store/simulationStore'

const TAU = Math.PI * 2

export const INITIAL_RADAR_SITES: RadarSite[] = [
  { id: 0, x: 0, y: 0, sweepAngle: 0 },
  { id: 1, x: 7000, y: 0, sweepAngle: Math.PI },
  { id: 2, x: -7000, y: 0, sweepAngle: Math.PI / 2 },
]

const PK_BASE = 0.85
const PK_JAM_FACTOR = 0.40
const PK_SWARM_FACTOR = 0.70
const MAX_CONCURRENT_ENGAGEMENTS = 6
const JAM_RADIUS = 2500
const JAM_NOISE_MULTIPLIER = 5
const JAM_FLICKER_CHANCE = 0.20
const SWARM_SPAWN_CHANCE = 0.30
const SWARM_MIN_SIZE = 4
const SWARM_MAX_SIZE = 6
const LEAKER_THRESHOLD = 2000
const JAMMER_SPAWN_CHANCE = 0.20

export class SimState {
  nextId = 100
  nextEventId = 1
  simTime = 0
  warnings = new Set<number>()
  launches = new Set<number>()
  engagedInterceptors = new Set<number>()
  interceptorsLaunched = 0
  threatsEngaged = new Set<number>()
  kills = 0
  misses = 0
  leakers = 0
  noInterceptorLogged = new Set<number>()
  lastScenarioSeed: number | null = null
  _rng: () => number = Math.random
  ignoredSince = new Map<number, number>()
}

const GLOBAL = new SimState()

export function resetMockState() {
  GLOBAL.nextId = 100
  GLOBAL.nextEventId = 1
  GLOBAL.simTime = 0
  GLOBAL.warnings = new Set<number>()
  GLOBAL.launches = new Set<number>()
  GLOBAL.engagedInterceptors = new Set<number>()
  GLOBAL.interceptorsLaunched = 0
  GLOBAL.threatsEngaged = new Set<number>()
  GLOBAL.kills = 0
  GLOBAL.misses = 0
  GLOBAL.leakers = 0
  GLOBAL.noInterceptorLogged = new Set<number>()
  GLOBAL.lastScenarioSeed = null
  GLOBAL._rng = Math.random
  GLOBAL.ignoredSince = new Map<number, number>()
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function seedRng(state: SimState, seed: number) {
  state._rng = seededRandom(seed)
}

function resolvePk(state: SimState, target: Track): boolean {
  let pk = PK_BASE
  if (target.jammed) pk *= PK_JAM_FACTOR
  if (target.trackType === 'SWARM') pk *= PK_SWARM_FACTOR
  return state._rng() < pk
}

function cmap(scenario: Partial<ScenarioConfig> | undefined): ScenarioConfig {
  return { ...DEFAULT_SCENARIO, ...(scenario ?? {}) }
}

function selectEngagements(
  threats: { track_id: number; track: Track; eta: number }[],
  inFlight: number,
  inventoryRemaining: number,
  maxConcurrent: number,
  policyId: PolicyId
): number[] {
  const slots = Math.min(maxConcurrent - inFlight, inventoryRemaining)
  if (slots <= 0) return []
  let sorted = [...threats]
  switch (policyId) {
    case 'JamFirst':
      sorted.sort((a, b) => {
        const aJam = a.track.trackType === 'JAMMER' ? 0 : 1
        const bJam = b.track.trackType === 'JAMMER' ? 0 : 1
        if (aJam !== bJam) return aJam - bJam
        return a.eta - b.eta
      })
      break
    case 'UnjamFirst':
      sorted.sort((a, b) => {
        const aJam = a.track.trackType === 'JAMMER' ? 1 : 0
        const bJam = b.track.trackType === 'JAMMER' ? 1 : 0
        if (aJam !== bJam) return aJam - bJam
        return a.eta - b.eta
      })
      break
    case 'NeverLaunch':
      return []
    case 'Baseline':
    default:
      sorted.sort((a, b) => a.eta - b.eta)
      break
  }
  return sorted.slice(0, slots).map(t => t.track_id)
}

function rand(state: SimState, min: number, max: number) {
  return state._rng() * (max - min) + min
}

function angle(x: number, y: number) {
  return Math.atan2(y, x)
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

const SPAWN_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315,
  22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5,
  11.25, 33.75, 56.25, 78.75, 101.25, 123.75, 146.25, 168.75,
  191.25, 213.75, 236.25, 258.75, 281.25, 303.75]

function createInitialTracksWithState(state: SimState, scenario?: Partial<ScenarioConfig>): { tracks: Track[] } {
  const cfg = cmap(scenario)
  console.log('[mockSimulation] createInitialTracks seed=' + cfg.randomSeed + ' numHostiles=' + cfg.numHostiles + ' numFriendlies=' + cfg.numFriendlies + ' threatSpeed=' + cfg.threatSpeed + ' inventorySize=' + cfg.inventorySize + ' jammingIntensity=' + cfg.jammingIntensity + ' swarmMode=' + cfg.swarmMode)
  state.nextId = 100
  state.nextEventId = 1
  state.simTime = 0
  state.warnings = new Set()
  state.launches = new Set()
  state.engagedInterceptors = new Set()
  state.interceptorsLaunched = 0
  state.threatsEngaged = new Set()
  state.kills = 0
  state.misses = 0
  state.leakers = 0
  state.noInterceptorLogged = new Set()
  state.ignoredSince = new Map()
  state.lastScenarioSeed = cfg.randomSeed
  seedRng(state, cfg.randomSeed)
  const rng = seededRandom(cfg.randomSeed)

  const tracks: Track[] = []
  const baseSpeed = 250 * cfg.threatSpeed
  const spawnDist = 11000
  const jamChance = cfg.jammingIntensity

  const numHostiles = cfg.numHostiles
  const degs = [...SPAWN_ANGLES_DEG].slice(0, numHostiles)
  degs.sort(() => rng() - 0.5)

  for (let i = 0; i < numHostiles; i++) {
    const rad = degs[i] * Math.PI / 180
    const sx = spawnDist * Math.cos(rad)
    const sy = spawnDist * Math.sin(rad)
    const tgtAngle = Math.atan2(-sy, -sx)
    const spd = baseSpeed + (rng() - 0.5) * 40
    const id = i + 1
    tracks.push({
      id,
      x: sx, y: sy,
      vx: Math.cos(tgtAngle) * spd,
      vy: Math.sin(tgtAngle) * spd,
      altitude: 5000 + rng() * 5000,
      classification: 'HOSTILE',
      heading: tgtAngle,
      speed: spd,
      visible: true,
      displayX: sx, displayY: sy,
      history: [[sx, sy]],
      trackType: rng() < jamChance ? 'JAMMER' : 'STANDARD',
    })
  }

  const friendlyRoles: { role: AssetRole; x: number; y: number; vx: number; vy: number; alt: number; engagementRange?: number; defendedRadius?: number }[] = [
    { role: 'HighValueAsset', x: 0, y: 0, vx: 0, vy: 0, alt: 0, defendedRadius: 4000 },
    { role: 'SurfaceToAirSite', x: -3500, y: -2500, vx: 0, vy: 0, alt: 200, engagementRange: 6000 },
    { role: 'NavalDefenseAsset', x: 3500, y: 0, vx: 0, vy: 0, alt: 0, engagementRange: 5000 },
  ]

  for (let i = 0; i < Math.min(cfg.numFriendlies, 10); i++) {
    const c = friendlyRoles[i % friendlyRoles.length]
    const h = angle(c.vx, c.vy)
    const spd = Math.sqrt(c.vx ** 2 + c.vy ** 2)
    tracks.push({
      id: i + 100,
      x: c.x, y: c.y,
      vx: c.vx, vy: c.vy,
      altitude: c.alt,
      classification: 'FRIENDLY',
      heading: h,
      speed: spd,
      visible: true,
      displayX: c.x, displayY: c.y,
      history: [[c.x, c.y]],
      trackType: 'STANDARD',
      assetRole: c.role,
      ...(c.engagementRange ? { engagementRange: c.engagementRange } : {}),
      ...(c.defendedRadius ? { defendedRadius: c.defendedRadius } : {}),
    })
  }

  return { tracks }
}

export function createInitialTracks(scenario?: Partial<ScenarioConfig>): { tracks: Track[] } {
  resetMockState()
  return createInitialTracksWithState(GLOBAL, scenario)
}

export function createInitialInterceptors(scenario?: Partial<ScenarioConfig>): Track[] {
  const cfg = cmap(scenario)
  console.log('[mockSimulation] createInitialInterceptors inventorySize=' + cfg.inventorySize + ', scenario=', JSON.stringify(scenario))
  return []
}

function stepSimulationWithState(
  state: SimState,
  tracks: Track[],
  interceptors: Track[],
  explosions: Explosion[],
  missMarkers: MissMarker[],
  radarSites: RadarSite[],
  threats: ThreatAlert[],
  events: EventEntry[],
  destroyedGhosts: DestroyedGhost[],
  dt: number,
  policyId: PolicyId,
  scenario?: Partial<ScenarioConfig>
): {
  tracks: Track[]
  interceptors: Track[]
  explosions: Explosion[]
  missMarkers: MissMarker[]
  radarSites: RadarSite[]
  threats: ThreatAlert[]
  events: EventEntry[]
  destroyedGhosts: DestroyedGhost[]
  stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
} {
  const cfg = cmap(scenario)
  const jamChance = cfg.jammingIntensity
  const threatSpeedMult = cfg.threatSpeed
  const swarmMode = cfg.swarmMode
  const INTERCEPTOR_INVENTORY = cfg.inventorySize
  const baseHostileSpeed = 250 * threatSpeedMult
  if (state.lastScenarioSeed !== cfg.randomSeed) {
    console.log('[mockSimulation] step seed changed from ' + state.lastScenarioSeed + ' to ' + cfg.randomSeed + ', reseeding')
    seedRng(state, cfg.randomSeed)
    state.lastScenarioSeed = cfg.randomSeed
  }
  state.simTime += dt
  const newEvents: EventEntry[] = []

  const ts = () => {
    const m = Math.floor(state.simTime / 60)
    const s = Math.floor(state.simTime % 60)
    const cs = Math.floor((state.simTime * 100) % 100)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }

  const allTracks = [...tracks, ...interceptors]

  const updatedTracks = tracks.map(t => {
    if (t.classification !== 'HOSTILE') return t

    const dx = -t.x
    const dy = -t.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const turnRate = 0.3
    const desiredH = Math.atan2(dy, dx)
    let hDiff = desiredH - t.heading
    if (hDiff > Math.PI) hDiff -= TAU
    if (hDiff < -Math.PI) hDiff += TAU
    const newH = t.heading + Math.sign(hDiff) * Math.min(Math.abs(hDiff), turnRate * dt * 10)
    const spd = t.speed + rand(state, -2, 2)
    const nvx = Math.cos(newH) * spd
    const nvy = Math.sin(newH) * spd
    const nx = t.x + nvx * dt
    const ny = t.y + nvy * dt
    const hist = [...t.history, [nx, ny] as [number, number]]
    if (hist.length > 50) hist.shift()

    return {
      ...t,
      x: nx, y: ny,
      vx: nvx, vy: nvy,
      heading: newH,
      speed: spd,
      displayX: nx, displayY: ny,
      history: hist,
      visible: radarSites.some(site => {
        const sdx = nx - site.x
        const sdy = ny - site.y
        return Math.sqrt(sdx * sdx + sdy * sdy) < 14000
      }),
    }
  })

  const formationGroups = new Map<number, typeof updatedTracks[0][]>()
  for (const t of updatedTracks) {
    if (t.groupId != null) {
      const list = formationGroups.get(t.groupId) ?? []
      list.push(t)
      formationGroups.set(t.groupId, list)
    }
  }
  for (const [gid, members] of formationGroups) {
    const sorted = [...members].sort((a, b) => a.id - b.id)
    if (sorted.length < 2) continue
    const lead = sorted[0]
    const hasOriginalLead = members.some(m => m.id === gid)
    if (!hasOriginalLead) {
      for (const m of sorted) {
        m.offset_x = m.x - lead.x
        m.offset_y = m.y - lead.y
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      const f = sorted[i]
      f.x = lead.x + (f.offset_x ?? 0)
      f.y = lead.y + (f.offset_y ?? 0)
      f.vx = lead.vx
      f.vy = lead.vy
      f.heading = lead.heading
      f.speed = lead.speed
    }
  }

  const updatedInterceptors = interceptors.map(inter => {
    const target = updatedTracks.find(t => t.id === inter.targetId)
    if (!target) return inter

    const dx = target.x - inter.x
    const dy = target.y - inter.y
    const range = Math.sqrt(dx * dx + dy * dy) || 1

    const losRate = (dx * (target.vy - inter.vy) - dy * (target.vx - inter.vx)) / (range * range)
    const Vc = -(dx * (target.vx - inter.vx) + dy * (target.vy - inter.vy)) / range
    const aCmd = 3.5 * Math.max(Vc, 0) * losRate
    const maxAccel = 147.15

    let nvx = inter.vx
    let nvy = inter.vy
    const spd = Math.sqrt(inter.vx ** 2 + inter.vy ** 2) || 1
    const perpX = -inter.vy / spd
    const perpY = inter.vx / spd

    let ax = aCmd * perpX * dt
    let ay = aCmd * perpY * dt
    const aMag = Math.sqrt(ax * ax + ay * ay)
    if (aMag > maxAccel * dt) {
      ax *= (maxAccel * dt) / aMag
      ay *= (maxAccel * dt) / aMag
    }

    nvx += ax
    nvy += ay

    const newSpd = Math.sqrt(nvx * nvx + nvy * nvy)
    const maxSpd = 1029
    if (newSpd > maxSpd) {
      nvx *= maxSpd / newSpd
      nvy *= maxSpd / newSpd
    }

    const nx = inter.x + nvx * dt
    const ny = inter.y + nvy * dt
    const hist = [...inter.history, [nx, ny] as [number, number]]
    if (hist.length > 50) hist.shift()

    let pkResult: 'hit' | 'miss' | null = null
    if (range < 500 && !state.engagedInterceptors.has(inter.id)) {
      state.engagedInterceptors.add(inter.id)
      if (resolvePk(state, target)) {
        pkResult = 'hit'
        state.kills++
        newEvents.push({
          id: state.nextEventId++,
          time: ts(),
          type: 'DESTROYED',
          message: `TRK-${String(target.id).padStart(3, '0')} DESTROYED by INT-${String(inter.id).padStart(3, '0')}`,
        })
      } else {
        pkResult = 'miss'
        state.misses++
        newEvents.push({
          id: state.nextEventId++,
          time: ts(),
          type: 'MISS',
          message: `INT-${String(inter.id).padStart(3, '0')} MISSED TRK-${String(target.id).padStart(3, '0')}`,
        })
      }
    }

    return {
      ...inter,
      _pkResult: pkResult,
      x: nx, y: ny,
      vx: nvx, vy: nvy,
      heading: Math.atan2(nvy, nvx),
      speed: newSpd,
      displayX: nx, displayY: ny,
      history: hist,
    }
  })

  const destroyedTargetIds = new Set<number>()
  const destroyedInterceptorIds = new Set<number>()

  for (const inter of updatedInterceptors) {
    const result = (inter as any)._pkResult as 'hit' | 'miss' | null
    if (result === 'hit') {
      destroyedTargetIds.add(inter.targetId!)
      destroyedInterceptorIds.add(inter.id)
      state.kills++
    } else if (result === 'miss') {
      destroyedInterceptorIds.add(inter.id)
      state.launches.delete(inter.targetId!)
      state.warnings.delete(inter.targetId!)
      state.noInterceptorLogged.delete(inter.targetId!)
      missMarkers.push({ x: inter.x, y: inter.y, radius: 0, alpha: 1 })
      state.misses++
    }
  }

  let finalTracks = updatedTracks.filter(t => !destroyedTargetIds.has(t.id))

  const finalInterceptors = updatedInterceptors.filter(
    i => !destroyedInterceptorIds.has(i.id)
  )

  const leakerIds = new Set<number>()
  for (const t of finalTracks) {
    if (t.classification !== 'HOSTILE') continue
    const d = dist(0, 0, t.x, t.y)
    if (d < LEAKER_THRESHOLD) {
      leakerIds.add(t.id)
      state.leakers++
      newEvents.push({
        id: state.nextEventId++,
        time: ts(),
        type: 'LEAKER',
        message: `TRK-${String(t.id).padStart(3, '0')} breached defensive perimeter at ${d.toFixed(0)}m`,
      })
    }
  }
  finalTracks = finalTracks.filter(t => !leakerIds.has(t.id))
  for (const id of leakerIds) {
    state.launches.delete(id)
    state.warnings.delete(id)
    state.noInterceptorLogged.delete(id)
  }

  for (const id of destroyedTargetIds) {
    state.noInterceptorLogged.delete(id)
    const track = updatedTracks.find(t => t.id === id)
    const inter = updatedInterceptors.find(i => i.targetId === id)
    if (track) {
      explosions.push({
        id: state.nextId++,
        x: track.x,
        y: track.y,
        radius: 0,
        maxRadius: 2000,
        alpha: 1,
        alive: true,
      })
      destroyedGhosts.push({
        id: state.nextId++,
        trackId: track.id,
        interceptorId: inter?.id ?? 0,
        x: track.x,
        y: track.y,
        displayX: track.displayX,
        displayY: track.displayY,
        vx: track.vx,
        vy: track.vy,
        history: [...track.history],
        interceptorX: inter?.x ?? track.x,
        interceptorY: inter?.y ?? track.y,
        life: 1800,
        maxLife: 1800,
      })
    }
  }

  const updatedExplosions = explosions
    .map(ex => ({
      ...ex,
      radius: ex.radius + 800 * dt,
      alpha: Math.max(0, 1 - (ex.radius + 800 * dt) / ex.maxRadius),
      alive: (ex.radius + 800 * dt) < ex.maxRadius,
    }))
    .filter(ex => ex.alive)

  const updatedMissMarkers = missMarkers
    .map(m => ({
      ...m,
      radius: m.radius + 1200 * dt,
      alpha: Math.max(0, 1 - (m.radius + 1200 * dt) / 400),
    }))
    .filter(m => m.alpha > 0)

  const updatedRadarSites = radarSites.map(site => ({
    ...site,
    sweepAngle: (site.sweepAngle + (TAU / 4) * dt) % TAU,
  }))

  const newThreats: ThreatAlert[] = []
  const launchCandidates: { track_id: number; track: Track; eta: number }[] = []

  const hvaTracks = finalTracks.filter(t => t.assetRole === 'HighValueAsset' && t.visible)

  for (const t of finalTracks) {
    if (t.classification !== 'HOSTILE' || !t.visible) continue
    const d = dist(0, 0, t.x, t.y)
    const bearing = Math.atan2(-t.y, -t.x)
    let hDiff = Math.abs(t.heading - bearing)
    if (hDiff > Math.PI) hDiff = TAU - hDiff
    if (hDiff >= Math.PI / 2) continue
    const closingSpeed = t.speed * Math.max(Math.cos(hDiff), 0.1)
    const eta = d / closingSpeed
    if (eta < 60) {
      const existing = threats.find(th => th.trackId === t.id)
      let threatScore = Math.max(0, 1 - eta / 60)
      let approachingHva = false
      for (const hva of hvaTracks) {
        const distToHva = dist(t.x, t.y, hva.x, hva.y)
        const radius = hva.defendedRadius ?? 4000
        if (distToHva < radius) {
          approachingHva = true
          threatScore = Math.min(1, threatScore + 0.3)
          if (!state.warnings.has(t.id)) {
            newEvents.push({
              id: state.nextEventId++,
              time: ts(),
              type: 'THREAT',
              message: `TRK-${String(t.id).padStart(3, '0')} APPROACHING HVA ZONE — PRIORITY ESCALATED`,
            })
          }
          break
        }
      }
      newThreats.push({
        trackId: t.id,
        eta,
        firstSeen: existing?.firstSeen ?? state.simTime,
        threatScore,
        approachingHva,
      })

      if (!state.warnings.has(t.id)) {
        state.warnings.add(t.id)
        const m = Math.floor(eta / 60)
        const s = Math.floor(eta % 60)
        newEvents.push({
          id: state.nextEventId++,
          time: ts(),
          type: 'THREAT',
          message: `TRK-${String(t.id).padStart(3, '0')} THREAT ETA ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} SPD ${t.speed.toFixed(0)}`,
        })
      }

      if (!state.launches.has(t.id)) {
        launchCandidates.push({ track_id: t.id, track: t, eta })
      }
    }
  }

  const inFlight = finalInterceptors.length
  const inventoryRemaining = INTERCEPTOR_INVENTORY - state.interceptorsLaunched
  const selected = selectEngagements(launchCandidates, inFlight, inventoryRemaining, MAX_CONCURRENT_ENGAGEMENTS, policyId)

  if (selected.length < launchCandidates.length) {
    for (const c of launchCandidates) {
      if (!selected.includes(c.track_id) && !state.noInterceptorLogged.has(c.track_id)) {
        const firstIgnored = state.ignoredSince.get(c.track_id)
        if (firstIgnored === undefined) {
          state.ignoredSince.set(c.track_id, state.simTime)
        } else if (state.simTime - firstIgnored >= 5) {
          state.noInterceptorLogged.add(c.track_id)
          state.ignoredSince.delete(c.track_id)
          const msg = inventoryRemaining <= 0
            ? `TRK-${String(c.track_id).padStart(3, '0')} cannot engage — inventory exhausted`
            : `TRK-${String(c.track_id).padStart(3, '0')} cannot engage — concurrent limit reached (${MAX_CONCURRENT_ENGAGEMENTS})`
          newEvents.push({
            id: state.nextEventId++,
            time: ts(),
            type: 'NO_INTERCEPTORS',
            message: msg,
          })
        }
      }
    }
  }

  for (const tid of selected) {
    state.noInterceptorLogged.delete(tid)
    state.ignoredSince.delete(tid)
    state.launches.add(tid)
    const track = finalTracks.find(t => t.id === tid)
    if (!track) continue
    const iid = state.nextId++
    const launchAngle = Math.atan2(track.y, track.x)
    const launchSpd = 400
    state.interceptorsLaunched++
    if (!state.threatsEngaged.has(tid)) {
      state.threatsEngaged.add(tid)
    }
    newEvents.push({
      id: state.nextEventId++,
      time: ts(),
      type: 'LAUNCH',
      message: `INT-${String(iid).padStart(3, '0')} LAUNCH → TRK-${String(tid).padStart(3, '0')}`,
    })
    finalInterceptors.push({
      id: iid,
      x: 0, y: 0,
      vx: Math.cos(launchAngle) * launchSpd,
      vy: Math.sin(launchAngle) * launchSpd,
      altitude: 500,
      classification: 'INTERCEPTOR',
      heading: launchAngle,
      speed: launchSpd,
      visible: true,
      displayX: 0, displayY: 0,
      history: [[0, 0]],
      targetId: tid,
    })
  }

  for (const t of finalTracks) {
    if (t.classification === 'HOSTILE' && t.visible) {
      const d = dist(0, 0, t.x, t.y)
      if (d < 12000 && !newThreats.find(th => th.trackId === t.id)) {
        const bearing = Math.atan2(-t.y, -t.x)
        let hDiff = Math.abs(t.heading - bearing)
        if (hDiff > Math.PI) hDiff = TAU - hDiff
        if (hDiff < Math.PI / 2) {
          const closingSpeed = t.speed * Math.max(Math.cos(hDiff), 0.1)
          const eta = d / closingSpeed
          if (eta < 120) {
            newThreats.push({
              trackId: t.id,
              eta,
              firstSeen: state.warnings.has(t.id) ? (threats.find(th => th.trackId === t.id)?.firstSeen ?? state.simTime) : state.simTime,
            })
          }
        }
      }
    }
  }

  for (const t of finalTracks) {
    if (t.visible) {
      let closestDist = Infinity
      let found = false
      for (const site of updatedRadarSites) {
        const sdx = t.x - site.x
        const sdy = t.y - site.y
        const sd = Math.sqrt(sdx * sdx + sdy * sdy)
        if (sd < 14000 && sd < closestDist) {
          closestDist = sd
          found = true
        }
      }
      if (found) {
        t.displayX = t.x + rand(state, -30, 30)
        t.displayY = t.y + rand(state, -30, 30)
      } else {
        t.displayX = t.x
        t.displayY = t.y
      }
    } else {
      t.displayX = t.x
      t.displayY = t.y
    }
  }

  const jammerTracks = finalTracks.filter(t => t.trackType === 'JAMMER')
  for (const t of finalTracks) {
    if (t.trackType === 'JAMMER') continue
    const jamDist = Math.min(...jammerTracks.map(j => dist(t.x, t.y, j.x, j.y)), Infinity)
    if (jamDist <= JAM_RADIUS) {
      t.jammed = true
      if (t.visible) {
        t.displayX = t.x + rand(state, -30, 30) * JAM_NOISE_MULTIPLIER
        t.displayY = t.y + rand(state, -30, 30) * JAM_NOISE_MULTIPLIER
      }
      if (state._rng() < JAM_FLICKER_CHANCE) {
        t.visible = false
      }
    }
  }

  const allEvents = [...events, ...newEvents]
  if (allEvents.length > 200) {
    allEvents.splice(0, allEvents.length - 200)
  }

  const totalEntities = finalTracks.length + finalInterceptors.length + destroyedGhosts.length
  if (totalEntities < 200 && finalTracks.filter(t => t.classification === 'HOSTILE').length < 6) {
    const a = rand(state, 0, TAU)
    const r = 10000 + rand(state, 0, 2000)
    const spd = (200 + rand(state, 0, 80)) * threatSpeedMult
    const sx = Math.cos(a) * r
    const sy = Math.sin(a) * r
    const targetAngle = Math.atan2(-sy, -sx)

    if (state._rng() < SWARM_SPAWN_CHANCE) {
      const swarmSize = Math.floor(rand(state, SWARM_MIN_SIZE, SWARM_MAX_SIZE + 1))
      const memberIds: number[] = []
      for (let i = 0; i < swarmSize; i++) {
        const offX = rand(state, -200, 200)
        const offY = rand(state, -200, 200)
        const mid = state.nextId++
        memberIds.push(mid)
        const swX = sx + offX
        const swY = sy + offY
        finalTracks.push({
          id: mid,
          x: swX, y: swY,
          vx: Math.cos(targetAngle) * spd,
          vy: Math.sin(targetAngle) * spd,
          altitude: rand(state, 4000, 10000),
          classification: 'HOSTILE',
          heading: targetAngle,
          speed: spd,
          visible: radarSites.some(site => {
            const sdx = swX - site.x
            const sdy = swY - site.y
            return Math.sqrt(sdx * sdx + sdy * sdy) < 14000
          }),
          displayX: swX, displayY: swY,
          history: [[swX, swY] as [number, number]],
          trackType: 'SWARM',
          groupId: memberIds[0],
          offset_x: offX,
          offset_y: offY,
        })
      }
      newEvents.push({
        id: state.nextEventId++,
        time: ts(),
        type: 'DETECTED',
        message: `SWARM contact: ${swarmSize} hostiles, group GRP-${String(memberIds[0]).padStart(3, '0')}`,
      })
    } else {
      const id = state.nextId++
      const trackType = state._rng() < JAMMER_SPAWN_CHANCE ? 'JAMMER' : 'STANDARD'
      finalTracks.push({
        id,
        x: sx, y: sy,
        vx: Math.cos(targetAngle) * spd,
        vy: Math.sin(targetAngle) * spd,
        altitude: rand(state, 4000, 10000),
        classification: 'HOSTILE',
        heading: targetAngle,
        speed: spd,
        visible: radarSites.some(site => {
          const sdx = sx - site.x
          const sdy = sy - site.y
          return Math.sqrt(sdx * sdx + sdy * sdy) < 14000
        }),
        displayX: sx, displayY: sy,
        history: [[sx, sy] as [number, number]],
        trackType,
      })
      newEvents.push({
        id: state.nextEventId++,
        time: ts(),
        type: 'DETECTED',
        message: `NEW CONTACT TRK-${String(id).padStart(3, '0')} AZ ${(a * 180 / Math.PI).toFixed(0)}° RNG ${(r / 1000).toFixed(1)}km`,
      })
      if (trackType === 'JAMMER') {
        newEvents.push({
          id: state.nextEventId++,
          time: ts(),
          type: 'JAMMER',
          message: `JAM TRK-${String(id).padStart(3, '0')} jamming active, range ${JAM_RADIUS}m`,
        })
      }
    }
  }

  const decayedGhosts = destroyedGhosts
    .map(g => ({ ...g, life: g.life - 1 }))
    .filter(g => g.life > 0)

  return {
    tracks: finalTracks,
    interceptors: finalInterceptors,
    explosions: updatedExplosions,
    missMarkers: updatedMissMarkers,
    radarSites: updatedRadarSites,
    threats: newThreats,
    events: allEvents,
    destroyedGhosts: decayedGhosts,
    stats: { kills: state.kills, misses: state.misses, launched: state.interceptorsLaunched, leakers: state.leakers, threats_engaged: [...state.threatsEngaged], inventory_remaining: INTERCEPTOR_INVENTORY - state.interceptorsLaunched },
  }
}

export function stepSimulation(
  tracks: Track[],
  interceptors: Track[],
  explosions: Explosion[],
  missMarkers: MissMarker[],
  radarSites: RadarSite[],
  threats: ThreatAlert[],
  events: EventEntry[],
  destroyedGhosts: DestroyedGhost[],
  dt: number,
  scenario?: Partial<ScenarioConfig>
) {
  return stepSimulationWithState(GLOBAL, tracks, interceptors, explosions, missMarkers, radarSites, threats, events, destroyedGhosts, dt, 'Baseline', scenario)
}

export function createSimInstance(scenario: ScenarioConfig, policyId: PolicyId) {
  const state = new SimState()
  const trackResult = createInitialTracksWithState(state, scenario)
  return {
    state,
    tracks: trackResult.tracks,
    interceptors: [] as Track[],
    explosions: [] as Explosion[],
    missMarkers: [] as MissMarker[],
    radarSites: INITIAL_RADAR_SITES.map(s => ({ ...s })),
    threats: [] as ThreatAlert[],
    events: [] as EventEntry[],
    destroyedGhosts: [] as DestroyedGhost[],
    simTime: 0,
    policyId,
    stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [] as number[], inventory_remaining: scenario.inventorySize },
    step(this: any, dt: number, cfg: ScenarioConfig) {
      const result = stepSimulationWithState(
        this.state,
        this.tracks, this.interceptors, this.explosions, this.missMarkers,
        this.radarSites, this.threats, this.events, this.destroyedGhosts,
        dt, this.policyId, cfg
      )
      this.tracks = result.tracks
      this.interceptors = result.interceptors
      this.explosions = result.explosions
      this.missMarkers = result.missMarkers
      this.radarSites = result.radarSites
      this.threats = result.threats
      this.events = result.events
      this.destroyedGhosts = result.destroyedGhosts
      this.simTime = this.state.simTime
      this.stats = result.stats
    },
  }
}
