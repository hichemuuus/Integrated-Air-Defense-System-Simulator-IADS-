import { forwardRef } from 'react'
import type { InstancedMesh } from 'three'
import { CylinderGeometry } from 'three'

export const MAX_INTERCEPTORS = 500

const cylinderGeom = new CylinderGeometry(0.3, 0.3, 1.8, 6)
cylinderGeom.rotateX(-Math.PI / 2)

const Interceptor = forwardRef<InstancedMesh, Record<string, any>>(
  ({ children, ...props }, ref) => (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_INTERCEPTORS]} {...props}>
      <primitive object={cylinderGeom} attach="geometry" />
      <meshPhongMaterial color={0xfbbf24} emissive={0x78350f} emissiveIntensity={0.4} />
    </instancedMesh>
  ),
)
Interceptor.displayName = 'Interceptor'

export default Interceptor
