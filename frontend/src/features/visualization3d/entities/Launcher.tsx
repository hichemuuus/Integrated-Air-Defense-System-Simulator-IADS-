import { forwardRef } from 'react'
import type { InstancedMesh } from 'three'

export const MAX_LAUNCHERS = 100

const Launcher = forwardRef<InstancedMesh, Record<string, any>>(
  ({ children, ...props }, ref) => (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_LAUNCHERS]} {...props}>
      <boxGeometry args={[1.5, 0.8, 1.5]} />
      <meshPhongMaterial color={0x888888} emissive={0x333333} emissiveIntensity={0.1} />
    </instancedMesh>
  ),
)
Launcher.displayName = 'Launcher'

export default Launcher
