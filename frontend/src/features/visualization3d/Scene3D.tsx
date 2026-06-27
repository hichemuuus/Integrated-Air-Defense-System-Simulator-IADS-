/* Scene3D
 * Responsibility: Root 3D visualization component. Creates the
 *   R3F Canvas, camera mode UI, HUD overlay, and radar sweeps.
 *   Handles keyboard shortcuts for focus (F) and reset (R).
 * Data flow:
 *   Camera mode state is React state that re-renders the Canvas
 *   content. On mode switch, CameraRig runs a smooth transition.
 *   HUD polls frame stats every 500ms. Radar sweeps are rendered
 *   as a child of Canvas.
 * Performance:
 *   - Camera mode state is outside the Canvas — only the mode
 *     prop changes on mode switch.
 *   - HUD updates every 500ms, not every frame.
 *   - Radar sweeps use imperative rotation in useFrame.
 */

import { useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import EntityManager from './EntityManager'
import CameraRig, { cameraCommands } from './CameraRig'
import Lighting from './Lighting'
import Terrain from './Terrain'
import RadarSweep from './radar/RadarSweep'
import HudOverlay from './hud/HudOverlay'
import { clearSelection } from './selection/SelectionManager'
import { sampleFps } from './utils/stats'
import type { CameraMode } from './utils/types'

const MODE_LABELS: Record<CameraMode, string> = {
  orbit: 'ORBIT',
  topdown: 'TOP DOWN',
  chase: 'CHASE',
}

const MODES: CameraMode[] = ['orbit', 'topdown', 'chase']

function Scene3D() {
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')

  useEffect(() => {
    performance.mark('scene3d:mounted')
    const fpsTimer = setInterval(() => sampleFps(), 1000)
    return () => clearInterval(fpsTimer)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        cameraCommands.focusEntityId = 1
      }
      if (e.key === 'r' || e.key === 'R') {
        cameraCommands.resetRequested = true
        setCameraMode('orbit')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [200, 150, 200], fov: 60, near: 0.5, far: 2000 }}
        onCreated={({ gl }) => {
          performance.mark('scene3d:canvas_created')
          gl.setClearColor(0x0b0f17)
        }}
        onPointerMissed={() => clearSelection()}
      >
        <Lighting />
        <Terrain />
        <CameraRig mode={cameraMode} />
        <RadarSweep />
        <EntityManager />
      </Canvas>

      <HudOverlay />

      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
        }}
      >
        {MODES.map(mode => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            style={{
              background: cameraMode === mode
                ? 'rgba(61, 220, 255, 0.15)'
                : 'rgba(11, 15, 23, 0.7)',
              border: cameraMode === mode
                ? '1px solid rgba(61, 220, 255, 0.4)'
                : '1px solid rgba(255,255,255,0.1)',
              color: cameraMode === mode ? '#3DDCFF' : 'rgba(255,255,255,0.4)',
              padding: '5px 12px',
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              letterSpacing: '0.1em',
              borderRadius: '2px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          background: 'rgba(11, 15, 23, 0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '2px',
          padding: '4px 8px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.25)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.05em',
        }}
      >
        3D CINEMATIC
      </div>
    </div>
  )
}

export default Scene3D
