import { forwardRef } from 'react'
import type { InstancedMesh } from 'three'

export const MAX_RADARS = 100

const Radar = forwardRef<InstancedMesh, Record<string, any>>(
  ({ children, ...props }, ref) => (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_RADARS]} {...props}>
      <sphereGeometry args={[1.2, 12, 8]} />
      <meshPhongMaterial color={0x4ade80} emissive={0x14532d} emissiveIntensity={0.3} />
    </instancedMesh>
  ),
)
Radar.displayName = 'Radar'

export default Radar
