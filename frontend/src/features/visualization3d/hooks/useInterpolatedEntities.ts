import { useRef, useCallback } from 'react'
import { useSimStore } from '../../../store/simulationStore'
import { lerp, lerpAngle } from '../utils/interpolation'

export const CAT_HOSTILE = 0
export const CAT_FRIENDLY = 1
export const CAT_INTERCEPTOR = 2
export const CAT_RADAR = 3
export const CAT_LAUNCHER = 4

export const CATEGORY_MAX = [250, 250, 500, 100, 100]

export interface ActiveEntity {
  slot: number
  entityId: number
  px: number
  py: number
  pz: number
  heading: number
  active: boolean
}

export interface TickResult {
  hostileAircraft: ActiveEntity[]
  friendlyAircraft: ActiveEntity[]
  interceptors: ActiveEntity[]
  radars: ActiveEntity[]
  launchers: ActiveEntity[]
}

interface EntityState {
  id: number
  slot: number
  px: number
  py: number
  pz: number
  tx: number
  ty: number
  tz: number
  heading: number
  targetHeading: number
  version: number
}

class SlotPool {
  private idToSlot = new Map<number, number>()
  private freeSlots: number[] = []
  private nextSlot = 0

  constructor(private max: number) {}

  acquire(id: number): number {
    const existing = this.idToSlot.get(id)
    if (existing !== undefined) return existing
    let slot: number
    if (this.freeSlots.length > 0) {
      slot = this.freeSlots.pop()!
    } else if (this.nextSlot < this.max) {
      slot = this.nextSlot++
    } else {
      return -1
    }
    this.idToSlot.set(id, slot)
    return slot
  }

  release(id: number): void {
    const slot = this.idToSlot.get(id)
    if (slot !== undefined) {
      this.freeSlots.push(slot)
      this.idToSlot.delete(id)
    }
  }
}

interface EntitySource {
  id: number
  x: number
  y: number
  z: number
  heading: number
}

function makeState(id: number, slot: number, src: EntitySource): EntityState {
  return {
    id, slot,
    px: src.x, py: src.y, pz: src.z,
    tx: src.x, ty: src.y, tz: src.z,
    heading: src.heading, targetHeading: src.heading,
    version: 0,
  }
}

function processCategory(
  map: Map<number, EntityState>,
  pool: SlotPool,
  max: number,
  sources: EntitySource[],
  version: number,
  lerpFactor: number,
): ActiveEntity[] {
  for (const src of sources) {
    let es = map.get(src.id)
    if (!es) {
      const slot = pool.acquire(src.id)
      if (slot < 0) continue
      es = makeState(src.id, slot, src)
      map.set(src.id, es)
    }
    es.tx = src.x
    es.ty = src.y
    es.tz = src.z
    es.targetHeading = src.heading
    es.version = version
  }

  for (const [id, es] of map) {
    if (es.version !== version) {
      pool.release(id)
      map.delete(id)
    }
  }

  const result: ActiveEntity[] = new Array(max)
  for (let i = 0; i < max; i++) {
    result[i] = { slot: i, entityId: -1, px: 0, py: 0, pz: 0, heading: 0, active: false }
  }

  for (const es of map.values()) {
    es.px = lerp(es.px, es.tx, lerpFactor)
    es.py = lerp(es.py, es.ty, lerpFactor)
    es.pz = lerp(es.pz, es.tz, lerpFactor)
    es.heading = lerpAngle(es.heading, es.targetHeading, lerpFactor)

    result[es.slot] = {
      slot: es.slot,
      entityId: es.id,
      px: es.px,
      py: es.py,
      pz: es.pz,
      heading: es.heading,
      active: true,
    }
  }

  return result
}

const LERP_SPEED = 4

export function useInterpolatedEntities() {
  const frameVersion = useRef(0)
  const pools = useRef<SlotPool[]>([])
  const hostileMap = useRef(new Map<number, EntityState>())
  const friendlyMap = useRef(new Map<number, EntityState>())
  const interceptorMap = useRef(new Map<number, EntityState>())
  const radarMap = useRef(new Map<number, EntityState>())
  const launcherMap = useRef(new Map<number, EntityState>())

  if (pools.current.length === 0) {
    pools.current = [
      new SlotPool(CATEGORY_MAX[CAT_HOSTILE]),
      new SlotPool(CATEGORY_MAX[CAT_FRIENDLY]),
      new SlotPool(CATEGORY_MAX[CAT_INTERCEPTOR]),
      new SlotPool(CATEGORY_MAX[CAT_RADAR]),
      new SlotPool(CATEGORY_MAX[CAT_LAUNCHER]),
    ]
  }

  const tick = useCallback((delta: number): TickResult => {
    const store = useSimStore.getState()
    const version = ++frameVersion.current
    const lerpFactor = 1 - Math.exp(-LERP_SPEED * delta)
    const p = pools.current

    const hostile: EntitySource[] = []
    const friendly: EntitySource[] = []

    for (const t of store.tracks) {
      if (!t.visible) continue
      if (t.classification === 'HOSTILE') {
        hostile.push({ id: t.id, x: t.x, y: t.altitude || 5, z: t.y, heading: t.heading })
      } else if (t.classification === 'FRIENDLY') {
        friendly.push({ id: t.id, x: t.x, y: t.altitude || 5, z: t.y, heading: t.heading })
      }
    }

    const interceptor: EntitySource[] = []
    for (const t of store.interceptors) {
      interceptor.push({ id: t.id, x: t.x, y: t.altitude || 3, z: t.y, heading: t.heading })
    }

    const radar: EntitySource[] = []
    const launcher: EntitySource[] = []
    for (const r of store.radarSites) {
      radar.push({ id: r.id, x: r.x, y: 2, z: r.y, heading: r.sweepAngle })
      launcher.push({ id: 10000 + r.id, x: r.x + 3, y: 0.5, z: r.y + 3, heading: 0 })
    }

    return {
      hostileAircraft: processCategory(hostileMap.current, p[CAT_HOSTILE], CATEGORY_MAX[CAT_HOSTILE], hostile, version, lerpFactor),
      friendlyAircraft: processCategory(friendlyMap.current, p[CAT_FRIENDLY], CATEGORY_MAX[CAT_FRIENDLY], friendly, version, lerpFactor),
      interceptors: processCategory(interceptorMap.current, p[CAT_INTERCEPTOR], CATEGORY_MAX[CAT_INTERCEPTOR], interceptor, version, lerpFactor),
      radars: processCategory(radarMap.current, p[CAT_RADAR], CATEGORY_MAX[CAT_RADAR], radar, version, lerpFactor),
      launchers: processCategory(launcherMap.current, p[CAT_LAUNCHER], CATEGORY_MAX[CAT_LAUNCHER], launcher, version, lerpFactor),
    }
  }, [])

  return tick
}
