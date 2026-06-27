/* ExplosionRenderer
 * Responsibility: Render particle Points and expanding ring meshes
 *   inside the Canvas. Both are pre-allocated — the ring meshes are
 *   always present in the React tree; inactive ones are invisible.
 * Data flow:
 *   ExplosionManager owns all geometry and mesh state.
 *   This component renders them as primitives.
 * Performance:
 *   - Single Points object for all particles (GPU instanced).
 *   - Fixed number of ring primitives (MAX_RINGS = 20).
 *   - No React re-renders during animation — mesh visibility
 *     and transforms are updated imperatively.
 */

import { getParticleGeometry, getParticleMaterial, getRingMeshes } from './ExplosionManager'

const MAX_RINGS = 20

function ExplosionRenderer() {
  return (
    <>
      <points geometry={getParticleGeometry()} material={getParticleMaterial()} />
      {Array.from({ length: MAX_RINGS }).map((_, i) => (
        <primitive key={`ring-${i}`} object={getRingMeshes()[i]} />
      ))}
    </>
  )
}

export default ExplosionRenderer
