import { forwardRef } from 'react'
import type { InstancedMesh } from 'three'
import { ConeGeometry } from 'three'

export const MAX_AIRCRAFT_PER_MESH = 250

const coneGeom = new ConeGeometry(1, 2.5, 6)
coneGeom.rotateX(-Math.PI / 2)

export const HostileAircraftMesh = forwardRef<InstancedMesh, Record<string, any>>(
  ({ children, ...props }, ref) => (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_AIRCRAFT_PER_MESH]} {...props}>
      <primitive object={coneGeom} attach="geometry" />
      <meshPhongMaterial color={0xef4444} emissive={0x7f1d1d} emissiveIntensity={0.3} />
    </instancedMesh>
  ),
)
HostileAircraftMesh.displayName = 'HostileAircraftMesh'

export const FriendlyAircraftMesh = forwardRef<InstancedMesh, Record<string, any>>(
  ({ children, ...props }, ref) => (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_AIRCRAFT_PER_MESH]} {...props}>
      <primitive object={coneGeom} attach="geometry" />
      <meshPhongMaterial color={0x22d3ee} emissive={0x164e63} emissiveIntensity={0.2} />
    </instancedMesh>
  ),
)
FriendlyAircraftMesh.displayName = 'FriendlyAircraftMesh'
