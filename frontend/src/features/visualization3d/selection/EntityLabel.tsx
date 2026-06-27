/* EntityLabel
 * Responsibility: Render a floating information label above the
 *   selected entity inside the 3D Canvas.
 * Data flow:
 *   Reads selected entity ID from SelectionManager and entity data
 *   from the Zustand store. Renders an Html overlay from @react-three/drei
 *   positioned at the entity's interpolated position.
 * Performance: The label content only re-renders when selectedId
 *   changes (rare). Updates simTime subscription efficiently via Zustand.
 */

import { Html } from '@react-three/drei'
import { useSimStore } from '../../../store/simulationStore'
import { getSelectedId } from './SelectionManager'
import type { Track } from '../../../types'

function findEntity(id: number, tracks: Track[], interceptors: Track[]): Track | undefined {
  if (id < 0) return undefined
  return tracks.find(t => t.id === id) || interceptors.find(t => t.id === id)
}

const labelStyle: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(11, 15, 23, 0.88)',
    border: '1px solid rgba(61, 220, 255, 0.35)',
    borderRadius: '2px',
    padding: '6px 10px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    lineHeight: '1.5',
    color: '#E2E8F0',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    transform: 'translateY(-10px)',
  },
  id: {
    color: '#3DDCFF',
    fontWeight: 600,
    letterSpacing: '0.05em',
    fontSize: '11px',
    marginBottom: '2px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    color: 'rgba(255,255,255,0.55)',
  },
  value: {
    color: '#E2E8F0',
  },
}

export function findEntityPositionLabel(id: number): [number, number, number] | null {
  if (id < 0) return null
  const state = useSimStore.getState()
  const entity = findEntity(id, state.tracks, state.interceptors)
  if (!entity) return null
  return [entity.x, (entity.altitude || 5) + 7, entity.y]
}

function EntityLabel() {
  const selectedId = getSelectedId()
  useSimStore(s => s.simTime)

  if (selectedId < 0) return null

  const state = useSimStore.getState()
  const entity = findEntity(selectedId, state.tracks, state.interceptors)
  if (!entity) return null

  const label = entity.classification === 'INTERCEPTOR' ? 'MISSILE' : entity.classification

  return (
    <Html position={[entity.x, (entity.altitude || 5) + 7, entity.y]} center>
      <div style={labelStyle.container}>
        <div style={labelStyle.id}>
          TRK-{String(entity.id).padStart(3, '0')} / {label}
        </div>
        <div style={labelStyle.row}>
          <span>SPD <span style={labelStyle.value}>{Math.round(entity.speed)}</span></span>
          <span>ALT <span style={labelStyle.value}>{Math.round(entity.altitude || 0)}</span></span>
        </div>
        {entity.targetId != null && (
          <div style={labelStyle.row}>
            <span>TGT <span style={labelStyle.value}>TRK-{String(entity.targetId).padStart(3, '0')}</span></span>
          </div>
        )}
      </div>
    </Html>
  )
}

export default EntityLabel
