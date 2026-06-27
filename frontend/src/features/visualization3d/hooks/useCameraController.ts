import { useCallback, useState } from 'react'
import type { CameraMode } from '../utils/types'

export interface CameraState {
  mode: CameraMode
  setMode: (mode: CameraMode) => void
  cycleMode: () => void
}

const MODES: CameraMode[] = ['orbit', 'topdown', 'chase']

export function useCameraController(initial: CameraMode = 'orbit'): CameraState {
  const [mode, setMode] = useState<CameraMode>(initial)

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const idx = MODES.indexOf(prev)
      return MODES[(idx + 1) % MODES.length]
    })
  }, [])

  return { mode, setMode, cycleMode }
}
