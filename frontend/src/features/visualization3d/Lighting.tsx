const SHADOW_MAP_SIZE = 1024

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={[0x444466, 0x111122, 0.6]} />
      <directionalLight
        position={[200, 300, 200]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-far={800}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
      />
      <fog attach="fog" args={[0x0b0f17, 400, 1200]} />
    </>
  )
}

export default Lighting
