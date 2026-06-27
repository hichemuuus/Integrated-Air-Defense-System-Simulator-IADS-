/* TrajectoryManager
 * Responsibility: Compute and render predicted flight paths for
 *   hostile aircraft and interceptors. Uses current velocity to
 *   project forward in time.
 * Data flow:
 *   EntityManager calls updateTrajectories() in useFrame with
 *   current entity data. When velocity changes significantly,
 *   trajectory points are recomputed and the Line geometry updated.
 *   Trajectories are rendered as THREE.Line objects with dashed
 *   (hostile) or solid (interceptor) materials.
 * Performance:
 *   - Trajectories only recompute when velocity delta exceeds
 *     a threshold (1 unit/s). This avoids per-frame geometry updates.
 *   - Fixed number of trajectory lines per entity type.
 *   - Lines use shared materials.
 */

import {
  BufferGeometry, Line, LineBasicMaterial, LineDashedMaterial,
  Float32BufferAttribute,
} from 'three'

const MAX_TRAJECTORIES = 100
const PREDICTION_STEPS = 40
const PREDICTION_DT = 0.4

interface TrajectoryState {
  entityId: number
  lastVx: number
  lastVy: number
  geometry: BufferGeometry
  mesh: Line
  active: boolean
}

const _pool: TrajectoryState[] = []
const _active: TrajectoryState[] = []

const SOLID_MAT = new LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.4 })
const DASHED_MAT = new LineDashedMaterial({
  color: 0xef4444,
  dashSize: 2,
  gapSize: 1.5,
  transparent: true,
  opacity: 0.5,
})

function createTrajectory(): TrajectoryState {
  const positions = new Float32Array(PREDICTION_STEPS * 3)
  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const mesh = new Line(geom, SOLID_MAT.clone())
  mesh.frustumCulled = false
  mesh.visible = false
  return { entityId: -1, lastVx: 0, lastVy: 0, geometry: geom, mesh, active: false }
}

export function initTrajectories(): void {
  for (let i = 0; i < MAX_TRAJECTORIES; i++) {
    _pool.push(createTrajectory())
  }
}

export function getTrajectoryMeshes(): Line[] {
  return _active.map(t => t.mesh)
}

function computeTrajectory(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  isHostile: boolean,
  positions: Float32Array,
): void {
  let px = x, py = y, pz = z
  const steps = isHostile ? 25 : PREDICTION_STEPS
  const dt = isHostile ? 0.5 : PREDICTION_DT

  for (let i = 0; i < steps; i++) {
    positions[i * 3] = px
    positions[i * 3 + 1] = py
    positions[i * 3 + 2] = pz
    px += vx * dt
    py += vy * dt
    pz += vz * dt
  }
}

interface EntityData {
  id: number
  x: number; y: number; z: number
  vx: number; vy: number
  isHostile: boolean
}

const VELOCITY_THRESHOLD = 1

export function updateTrajectories(entities: EntityData[]): void {
  const activeIds = new Set<number>()

  for (const ent of entities) {
    activeIds.add(ent.id)
    let tr = _active.find(t => t.entityId === ent.id)

    if (!tr) {
      tr = _pool.pop()
      if (!tr) continue
      tr.entityId = ent.id
      tr.active = true
      tr.lastVx = ent.vx
      tr.lastVy = ent.vy
      tr.mesh.material = ent.isHostile ? DASHED_MAT : SOLID_MAT
      _active.push(tr)
    }

    const dvx = Math.abs(ent.vx - tr.lastVx)
    const dvy = Math.abs(ent.vy - tr.lastVy)

    if (dvx > VELOCITY_THRESHOLD || dvy > VELOCITY_THRESHOLD || !tr.mesh.visible) {
      tr.lastVx = ent.vx
      tr.lastVy = ent.vy

      const posAttr = tr.geometry.attributes.position
      const arr = posAttr.array as Float32Array
      computeTrajectory(ent.x, ent.y, ent.z, ent.vx, 0, ent.vy, ent.isHostile, arr)
      posAttr.needsUpdate = true
      tr.geometry.setDrawRange(0, ent.isHostile ? 25 : PREDICTION_STEPS)
      tr.mesh.visible = true

      if (ent.isHostile) {
        tr.mesh.computeLineDistances()
      }
    }
  }

  for (let i = _active.length - 1; i >= 0; i--) {
    const tr = _active[i]
    if (!activeIds.has(tr.entityId)) {
      tr.active = false
      tr.entityId = -1
      tr.mesh.visible = false
      _active.splice(i, 1)
      _pool.push(tr)
    }
  }
}
