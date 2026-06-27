import { useMemo } from 'react'

const TERRAIN_SIZE = 2000

function Terrain() {
  const gridConfig = useMemo(() => ({
    args: [TERRAIN_SIZE, TERRAIN_SIZE, 1, 1] as [number, number, number, number],
    position: [0, -0.5, 0] as [number, number, number],
    rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
  }), [])

  return (
    <>
      <mesh position={gridConfig.position} rotation={gridConfig.rotation}>
        <planeGeometry args={gridConfig.args} />
        <meshPhongMaterial color={0x1a1a2e} />
      </mesh>
      <gridHelper args={[TERRAIN_SIZE, 40, 0x222244, 0x111833]} position={[0, 0.01, 0]} />
    </>
  )
}

export default Terrain
