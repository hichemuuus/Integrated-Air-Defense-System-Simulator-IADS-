/* CameraRig
 * Responsibility: Manages all camera behavior — orbit, top-down,
 *   and chase modes. Handles smooth transitions between modes,
 *   double-click entity follow, focus-selected, and reset.
 * Data flow:
 *   mode prop selects the active camera behavior. useFrame runs
 *   every frame to lerp the camera during transitions and chase.
 *   Camera commands (focus, reset, double-click) are read from
 *   a module-level command object and cleared after execution.
 * Performance:
 *   - All temporary vectors are module-level (no per-frame alloc).
 *   - Transition lerp uses delta-scaled smoothing.
 *   - OrbitControls always mounted — no remount cost.
 */

import { useRef, useEffect } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import type { Camera } from 'three'
import { useSimStore } from '../../store/simulationStore'
import { getSelectedId, setSelected, clearSelection } from './selection/SelectionManager'
import type { CameraMode } from './utils/types'

const _pos = new Vector3()
const _target = new Vector3()
const _behind = new Vector3()
const _smoothPos = new Vector3()
const _smoothTarget = new Vector3()
const MODE_TARGETS: Record<string, { pos: Vector3; target: Vector3 }> = {
  orbit: { pos: new Vector3(200, 150, 200), target: new Vector3(0, 0, 0) },
  topdown: { pos: new Vector3(0, 500, 0.01), target: new Vector3(0, 0, 0) },
}

export const cameraCommands = {
  focusEntityId: -1,
  resetRequested: false,
  doubleClickEntityId: -1,
}

let _transitionProgress = 1

function useChaseCamera(camera: Camera, delta: number): void {
  const store = useSimStore.getState()
  const id = getSelectedId()
  if (id < 0) return

  const interceptor = store.interceptors.find(t => t.id === id) || store.tracks.find(t => t.id === id)
  if (!interceptor) return

  const headingRad = MathUtils.degToRad(interceptor.heading || 0)
  const dist = 45
  const height = (interceptor.altitude || 5) + 20

  _behind.set(
    -Math.sin(headingRad) * dist,
    0,
    -Math.cos(headingRad) * dist,
  )

  _pos.set(
    interceptor.x + _behind.x,
    height,
    interceptor.y + _behind.z,
  )
  _target.set(interceptor.x, interceptor.altitude || 5, interceptor.y)

  const smooth = 1 - Math.exp(-3 * delta)
  camera.position.lerp(_pos, smooth)
  camera.lookAt(_target)
}

function focusOnEntity(camera: Camera, entity: { x: number; y: number; altitude: number }, delta: number): boolean {
  _pos.set(entity.x, (entity.altitude || 5) + 15, entity.y + 25)
  _target.set(entity.x, entity.altitude || 5, entity.y)
  const smooth = 1 - Math.exp(-2.5 * delta)
  camera.position.lerp(_pos, smooth)
  camera.lookAt(_target)
  return camera.position.distanceTo(_pos) < 1
}

interface Props {
  mode: CameraMode
}

function CameraRig({ mode }: Props) {
  const controlsRef = useRef<any>(null!)
  const camera = useThree(s => s.camera)

  useEffect(() => {
    _transitionProgress = 0
    const c = controlsRef.current
    if (!c) return
    if (mode === 'topdown') {
      _smoothPos.copy(camera.position)
      _smoothTarget.copy(c.target)
    } else if (mode === 'orbit') {
      _smoothPos.copy(camera.position)
      _smoothTarget.copy(c.target)
    }
  }, [mode, camera])

  useFrame((_, delta) => {
    const cmd = cameraCommands

    if (cmd.doubleClickEntityId >= 0) {
      setSelected(cmd.doubleClickEntityId)
      cmd.doubleClickEntityId = -1
      return
    }

    if (cmd.focusEntityId >= 0) {
      const store = useSimStore.getState()
      const entity = store.tracks.find(t => t.id === cmd.focusEntityId) ||
                     store.interceptors.find(t => t.id === cmd.focusEntityId)
      if (entity) {
        const done = focusOnEntity(camera, entity, delta)
        if (done) cmd.focusEntityId = -1
      } else {
        cmd.focusEntityId = -1
      }
      return
    }

    if (cmd.resetRequested) {
      cmd.resetRequested = false
      _smoothPos.copy(MODE_TARGETS.orbit.pos)
      _smoothTarget.copy(MODE_TARGETS.orbit.target)
      _transitionProgress = 0
    }

    if (mode === 'chase') {
      useChaseCamera(camera, delta)
    } else {
      if (_transitionProgress < 1) {
        const target = MODE_TARGETS[mode]
        _transitionProgress = Math.min(1, _transitionProgress + delta * 1.5)
        const t = 1 - Math.pow(1 - _transitionProgress, 3)
        camera.position.lerpVectors(_smoothPos, target.pos, t)
        if (controlsRef.current) {
          controlsRef.current.target.lerpVectors(_smoothTarget, target.target, t)
          controlsRef.current.update()
        }
      } else {
        if (controlsRef.current && controlsRef.current.enabled === false) {
          controlsRef.current.enabled = true
        }
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={mode !== 'chase'}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={10}
      maxDistance={800}
      target={[0, 0, 0]}
    />
  )
}

export default CameraRig
