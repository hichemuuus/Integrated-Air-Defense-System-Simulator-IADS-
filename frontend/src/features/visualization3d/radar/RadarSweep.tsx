/* RadarSweep
 * Responsibility: Render animated rotating radar sweeps at each
 *   radar site position. Each sweep is a flat triangular cone
 *   that rotates continuously. A transparent hemisphere shows
 *   the detection volume.
 * Data flow:
 *   Reads radarSites from the Zustand store. Creates a group
 *   per site containing the sweep cone and detection volume.
 *   EntityManager rotates each sweep cone in useFrame via a
 *   shared ref array.
 * Performance:
 *   - Pre-allocated meshes per site — no per-frame geometry.
 *   - Rotation updated imperatively via refs — no React state.
 *   - ROTATION_SPEED controls sweep RPM.
 */

import { useRef, useEffect, useMemo } from 'react'
import { useSimStore } from '../../../store/simulationStore'

export const sweepRefs: { current: THREE.Group }[] = []

const ROTATION_SPEED = 1.8

function SweepSite({ x, z, index }: { x: number; z: number; index: number }) {
  const groupRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (groupRef.current) {
      sweepRefs[index] = groupRef as { current: THREE.Group }
    }
    return () => {
      sweepRefs[index] = { current: null! }
    }
  }, [index])

  return (
    <group ref={groupRef} position={[x, 1, z]}>
      <mesh>
        <coneGeometry args={[25, 0.5, 3]} />
        <meshBasicMaterial
          color={0x4ade80}
          transparent
          opacity={0.2}
          depthWrite={false}
          side={2}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[30, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color={0x4ade80}
          transparent
          opacity={0.04}
          depthWrite={false}
          wireframe
        />
      </mesh>
    </group>
  )
}

export function updateSweeps(delta: number): void {
  for (const ref of sweepRefs) {
    if (ref.current) {
      ref.current.rotation.y += delta * ROTATION_SPEED
      const opacity = 0.15 + Math.sin(ref.current.rotation.y * 4) * 0.05
      const cone = ref.current.children[0] as THREE.Mesh
      if (cone.material) {
        ;(cone.material as THREE.MeshBasicMaterial).opacity = opacity
      }
    }
  }
}

function RadarSweep() {
  const radarSites = useSimStore(s => s.radarSites)

  const sites = useMemo(() => radarSites || [], [radarSites])

  return (
    <>
      {sites.map((site, i) => (
        <SweepSite key={site.id} x={site.x} z={site.y} index={i} />
      ))}
    </>
  )
}

export default RadarSweep
