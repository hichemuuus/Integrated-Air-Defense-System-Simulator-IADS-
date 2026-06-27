/* EntityManager
 * Responsibility: Central animation and rendering orchestrator.
 *   Contains the SINGLE useFrame() in the entire 3D system.
 *   Coordinates entity matrix updates, trails, explosions,
 *   trajectories, radar sweeps, selection outline, and FPS tracking.
 * Data flow (per frame):
 *   1. tick(delta) → interpolated entity positions per category
 *   2. updateTrails(interceptors, delta) → trail geometry
 *   3. updateExplosions(delta) → particle + ring updates
 *   4. updateTrajectories(all entities) → prediction lines
 *   5. updateSweeps(delta) → radar rotation
 *   6. updateMesh(5x) → InstancedMesh matrix writes
 *   7. update selection outline position
 *   8. incrementFrameCount() for HUD
 * Performance:
 *   - Exactly one useFrame() — no other R3F animation hooks.
 *   - All mutable state lives in refs or module-level pools.
 *   - Subsystem updates are plain function calls — no React overhead.
 */

import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D } from 'three'
import { HostileAircraftMesh, FriendlyAircraftMesh } from './entities/Aircraft'
import InterceptorEntity from './entities/Interceptor'
import RadarEntity from './entities/Radar'
import LauncherEntity from './entities/Launcher'
import {
  useInterpolatedEntities,
  CAT_HOSTILE, CAT_FRIENDLY, CAT_INTERCEPTOR,
  CAT_RADAR, CAT_LAUNCHER,
} from './hooks/useInterpolatedEntities'
import { headingToQuaternion } from './utils/math'
import { updateTrails, initTrails } from './trails/TrailManager'
import { updateExplosions, initExplosions } from './explosions/ExplosionManager'
import { updateTrajectories, initTrajectories } from './trajectories/TrajectoryManager'
import { updateSweeps } from './radar/RadarSweep'
import { incrementFrameCount, setEntityStats } from './utils/stats'
import {
  registerSlotMapping, entityIdFromSlot,
  getSelectedId, setSelected, clearSelection,
} from './selection/SelectionManager'
import EntityLabel from './selection/EntityLabel'
import TrailRenderer from './trails/TrailRenderer'
import ExplosionRenderer from './explosions/ExplosionRenderer'
import TrajectoryRenderer from './trajectories/TrajectoryRenderer'
import { useSimStore } from '../../store/simulationStore'
import type { ActiveEntity } from './hooks/useInterpolatedEntities'

let _initDone = false
if (!_initDone) {
  initTrails()
  initExplosions()
  initTrajectories()
  _initDone = true
}

function updateMesh(
  mesh: THREE.InstancedMesh | null,
  entities: ActiveEntity[],
  dummy: Object3D,
  category: number,
): void {
  if (!mesh) return
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    registerSlotMapping(category, e.slot, e.entityId)
    if (e.active) {
      dummy.position.set(e.px, e.py, e.pz)
      headingToQuaternion(e.heading, dummy.quaternion)
      dummy.scale.set(1, 1, 1)
    } else {
      dummy.scale.set(0, 0, 0)
    }
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

function handleClick(category: number) {
  return (e: any) => {
    e.stopPropagation()
    const slot = e.instanceId as number
    if (slot === undefined) return
    const entityId = entityIdFromSlot(category, slot)
    if (entityId !== undefined && entityId >= 0) {
      if (getSelectedId() === entityId) {
        clearSelection()
      } else {
        setSelected(entityId)
      }
    }
  }
}

let _firstFrameReported = false

function EntityManager() {
  const hostileRef = useRef<THREE.InstancedMesh>(null!)
  const friendlyRef = useRef<THREE.InstancedMesh>(null!)
  const interceptorRef = useRef<THREE.InstancedMesh>(null!)
  const radarRef = useRef<THREE.InstancedMesh>(null!)
  const launcherRef = useRef<THREE.InstancedMesh>(null!)
  const outlineRef = useRef<THREE.Mesh>(null!)
  const dummy = useRef(new Object3D())

  const tick = useInterpolatedEntities()

  useFrame((_, delta) => {
    if (!_firstFrameReported) {
      _firstFrameReported = true
      performance.mark('scene3d:first_frame')
    }

    const d = dummy.current
    const entities = tick(delta)

    updateTrails(
      entities.interceptors.map(e => ({
        id: e.entityId, px: e.px, py: e.py, pz: e.pz,
      })),
      delta,
    )
    updateExplosions(delta)

    const store = useSimStore.getState()
    const trajEntities: {
      id: number; x: number; y: number; z: number
      vx: number; vy: number; isHostile: boolean
    }[] = []

    for (const t of store.tracks) {
      if (!t.visible) continue
      trajEntities.push({
        id: t.id, x: t.x, y: t.altitude || 5, z: t.y,
        vx: t.vx, vy: t.vy, isHostile: t.classification === 'HOSTILE',
      })
    }
    for (const t of store.interceptors) {
      trajEntities.push({
        id: t.id, x: t.x, y: t.altitude || 5, z: t.y,
        vx: t.vx, vy: t.vy, isHostile: false,
      })
    }
    updateTrajectories(trajEntities)
    updateSweeps(delta)

    updateMesh(hostileRef.current, entities.hostileAircraft, d, CAT_HOSTILE)
    updateMesh(friendlyRef.current, entities.friendlyAircraft, d, CAT_FRIENDLY)
    updateMesh(interceptorRef.current, entities.interceptors, d, CAT_INTERCEPTOR)
    updateMesh(radarRef.current, entities.radars, d, CAT_RADAR)
    updateMesh(launcherRef.current, entities.launchers, d, CAT_LAUNCHER)

    const selectedId = getSelectedId()
    if (selectedId >= 0 && outlineRef.current) {
      const st = useSimStore.getState()
      const target = st.tracks.find(t => t.id === selectedId) ||
                     st.interceptors.find(t => t.id === selectedId)
      if (target) {
        outlineRef.current.position.set(target.x, (target.altitude || 5), target.y)
        outlineRef.current.visible = true
      } else {
        outlineRef.current.visible = false
      }
    } else if (outlineRef.current) {
      outlineRef.current.visible = false
    }

    const aCount = entities.hostileAircraft.filter(e => e.active).length +
                   entities.friendlyAircraft.filter(e => e.active).length
    const iCount = entities.interceptors.filter(e => e.active).length
    setEntityStats(aCount, iCount)
    incrementFrameCount()
  })

  return (
    <>
      <HostileAircraftMesh ref={hostileRef} onPointerDown={handleClick(CAT_HOSTILE)} />
      <FriendlyAircraftMesh ref={friendlyRef} onPointerDown={handleClick(CAT_FRIENDLY)} />
      <InterceptorEntity ref={interceptorRef} onPointerDown={handleClick(CAT_INTERCEPTOR)} />
      <RadarEntity ref={radarRef} />
      <LauncherEntity ref={launcherRef} />

      <mesh ref={outlineRef} visible={false}>
        <torusGeometry args={[2.5, 0.15, 8, 24]} />
        <meshBasicMaterial color={0x3ddcff} transparent opacity={0.8} />
      </mesh>

      <EntityLabel />
      <TrailRenderer />
      <ExplosionRenderer />
      <TrajectoryRenderer />
    </>
  )
}

export default EntityManager
