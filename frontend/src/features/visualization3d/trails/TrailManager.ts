/* TrailManager
 * Responsibility: Maintain ring-buffer trail data for interceptors.
 *   Each trail stores past positions as a Float32Array ring buffer.
 *   The geometry position attribute is updated each frame.
 * Data flow:
 *   EntityManager calls updateTrails() in useFrame with current
 *   interceptor positions. New positions are pushed into each
 *   entity's ring buffer. The corresponding Line geometry is
 *   updated via position attribute.
 * Performance:
 *   - Fixed-size pool: no allocations after init.
 *   - Geometry position attribute uses .set() + needsUpdate.
 *   - Only active interceptors get trails (max 500).
 *   - MAX_TRAIL_POINTS limits per-trail vertex count.
 */

import { BufferGeometry, Line, LineBasicMaterial, Float32BufferAttribute } from 'three'
import { RingBuffer } from '../utils/pools'

const MAX_TRAIL_POINTS = 120
const MAX_TRAILS = 100

export interface TrailInstance {
  entityId: number
  buffer: RingBuffer
  geometry: BufferGeometry
  mesh: Line
  active: boolean
}

const _instances: TrailInstance[] = []
const _pool: TrailInstance[] = []

function createTrailInstance(): TrailInstance {
  const buffer = new RingBuffer(MAX_TRAIL_POINTS, 3)
  const positions = new Float32Array(MAX_TRAIL_POINTS * 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setDrawRange(0, 0)

  const material = new LineBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.5,
  })

  const mesh = new Line(geometry, material)
  mesh.frustumCulled = false

  return { entityId: -1, buffer, geometry, mesh, active: false }
}

export function initTrails(): void {
  for (let i = 0; i < MAX_TRAILS; i++) {
    _pool.push(createTrailInstance())
  }
}

export function getTrailMeshes(): Line[] {
  const meshes: Line[] = []
  for (const inst of _instances) {
    if (inst.active) meshes.push(inst.mesh)
  }
  return meshes
}

export function updateTrails(
  interceptors: { id: number; px: number; py: number; pz: number }[],
  delta: number,
): void {
  const activeIds = new Set<number>()

  for (const ent of interceptors) {
    activeIds.add(ent.id)
    let inst = _instances.find(i => i.entityId === ent.id)

    if (!inst) {
      inst = _pool.pop()
      if (!inst) continue
      inst.entityId = ent.id
      inst.active = true
      _instances.push(inst)
    }

    inst.buffer.push(ent.px, ent.py, ent.pz)

    const count = inst.buffer.count
    const posAttr = inst.geometry.attributes.position

    inst.buffer.fillOrdered(posAttr.array as Float32Array, 0)
    posAttr.needsUpdate = true
    inst.geometry.setDrawRange(0, count)
  }

  for (let i = _instances.length - 1; i >= 0; i--) {
    const inst = _instances[i]
    if (!activeIds.has(inst.entityId)) {
      inst.active = false
      inst.entityId = -1
      inst.buffer.clear()
      inst.geometry.setDrawRange(0, 0)
      _instances.splice(i, 1)
      _pool.push(inst)
    }
  }
}
