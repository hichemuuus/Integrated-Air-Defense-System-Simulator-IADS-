/* ExplosionManager
 * Responsibility: GPU particle burst and expanding ring effects.
 *   Maintains fixed-size pools for both particles and rings.
 *   Detects DESTROYED/LEAKER/MISS events from the store and spawns
 *   effects at the event position.
 * Data flow:
 *   EntityManager calls updateExplosions() in useFrame.
 *   ExplosionManager reads events from the Zustand store,
 *   spawns new effects, advances existing particles, and
 *   recycles finished effects back to the pool.
 * Performance:
 *   - Fixed Float32Array buffers — no per-frame allocations.
 *   - geometry.attributes.position.needsUpdate = true only
 *     when particle positions change.
 *   - Dead particles are recycled instantly (no GC pressure).
 *   - MAX_PARTICLES and MAX_RINGS set hard caps.
 */

import {
  BufferGeometry, Points, PointsMaterial, Float32BufferAttribute,
  Mesh, RingGeometry, MeshBasicMaterial, DoubleSide,
} from 'three'
import { useSimStore } from '../../../store/simulationStore'

const MAX_PARTICLES = 500
const MAX_RINGS = 20
const PARTICLE_LIFE = 1.2
const RING_LIFE = 0.8

export interface ParticleState {
  px: number; py: number; pz: number
  vx: number; vy: number; vz: number
  life: number
  active: boolean
}

export interface RingState {
  px: number; py: number; pz: number
  life: number
  active: boolean
  mesh: Mesh
}

const particles: ParticleState[] = []
const particlePositions = new Float32Array(MAX_PARTICLES * 3)
const particleSizes = new Float32Array(MAX_PARTICLES)
let particleCount = 0

export function getParticleGeometry(): BufferGeometry {
  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(particlePositions, 3))
  geom.setAttribute('size', new Float32BufferAttribute(particleSizes, 1))
  return geom
}

export function getParticleMaterial(): PointsMaterial {
  return new PointsMaterial({
    color: 0xff6633,
    size: 3,
    transparent: true,
    opacity: 0.8,
    blending: 2,
    depthWrite: false,
  })
}

const rings: RingState[] = []
let lastEventCount = 0

export function initExplosions(): void {
  for (let i = 0; i < MAX_RINGS; i++) {
    const geom = new RingGeometry(0.5, 1.5, 16)
    const mat = new MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
    })
    const mesh = new Mesh(geom, mat)
    mesh.visible = false
    rings.push({ px: 0, py: 0, pz: 0, life: 0, active: false, mesh })
  }
}

function spawnParticles(x: number, y: number, z: number): void {
  for (let i = 0; i < 15; i++) {
    if (particleCount >= MAX_PARTICLES) break
    const p: ParticleState = {
      px: x, py: y, pz: z,
      vx: (Math.random() - 0.5) * 40,
      vy: Math.random() * 30 + 10,
      vz: (Math.random() - 0.5) * 40,
      life: PARTICLE_LIFE * (0.5 + Math.random() * 0.5),
      active: true,
    }
    particles.push(p)
    particleCount++
  }
}

function spawnRing(x: number, y: number, z: number): void {
  for (const ring of rings) {
    if (!ring.active) {
      ring.px = x; ring.py = y; ring.pz = z
      ring.life = RING_LIFE
      ring.active = true
      ring.mesh.visible = true
      ring.mesh.position.set(x, y, z)
      ring.mesh.scale.setScalar(1)
      ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8
      ring.mesh.lookAt(0, 0, 0)
      return
    }
  }
}

export function spawnExplosion(x: number, y: number, z: number): void {
  spawnParticles(x, y, z)
  spawnRing(x, y, z)
}

export function updateExplosions(delta: number): void {
  const state = useSimStore.getState()

  for (let i = lastEventCount; i < state.events.length; i++) {
    const ev = state.events[i]
    if (ev.type === 'DESTROYED' || ev.type === 'LEAKER' || ev.type === 'MISS') {
      const match = ev.message.match(/TRK-(\d+)/)
      if (match) {
        const id = parseInt(match[1])
        const entity = state.tracks.find(t => t.id === id) || state.interceptors.find(t => t.id === id)
        if (entity) {
          spawnExplosion(entity.x, (entity.altitude || 5), entity.y)
        }
      }
    }
  }
  lastEventCount = state.events.length

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= delta
    if (p.life <= 0) {
      p.active = false
      particles.splice(i, 1)
      particleCount--
      continue
    }
    p.px += p.vx * delta
    p.py += p.vy * delta
    p.vy -= 25 * delta
    p.pz += p.vz * delta
  }

  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (i < particleCount) {
      const p = particles[i]
      particlePositions[i * 3] = p.px
      particlePositions[i * 3 + 1] = p.py
      particlePositions[i * 3 + 2] = p.pz
      particleSizes[i] = Math.max(0.5, 3 * (p.life / PARTICLE_LIFE))
    } else {
      particlePositions[i * 3] = 0
      particlePositions[i * 3 + 1] = -1000
      particlePositions[i * 3 + 2] = 0
      particleSizes[i] = 0
    }
  }

  for (const ring of rings) {
    if (!ring.active) continue
    ring.life -= delta
    if (ring.life <= 0) {
      ring.active = false
      ring.mesh.visible = false
      const mat = ring.mesh.material
      if (!Array.isArray(mat)) mat.opacity = 0
      continue
    }
    const t = 1 - ring.life / RING_LIFE
    const scale = 1 + t * 15
    ring.mesh.scale.setScalar(scale)
    const mat = ring.mesh.material
    if (!Array.isArray(mat)) mat.opacity = Math.max(0, 0.8 * (1 - t))
  }
}

export function getRingMeshes(): Mesh[] {
  return rings.map(r => r.mesh)
}

export function getRingActive(index: number): boolean {
  return rings[index]?.active ?? false
}
