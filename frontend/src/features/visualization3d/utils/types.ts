import type { Classification } from '../../../types'

export type CameraMode = 'orbit' | 'topdown' | 'chase'

export interface EntitySnapshot {
  id: number
  x: number
  z: number
  altitude: number
  heading: number
  classification: Classification
  active: boolean
  targetId?: number
}
