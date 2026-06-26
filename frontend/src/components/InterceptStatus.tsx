import { useSimStore } from '../store/simulationStore'

export default function InterceptStatus() {
  const interceptors = useSimStore(s => s.interceptors)
  const tracks = useSimStore(s => s.tracks)
  const selectedTrackId = useSimStore(s => s.selectedTrackId)
  const setSelectedTrack = useSimStore(s => s.setSelectedTrack)

  const statuses = interceptors.map(inter => {
    const target = tracks.find(t => t.id === inter.targetId)
    let dist: number | null = null
    let status: 'pursuing' | 'lost' | 'collision' = 'pursuing'
    if (target) {
      const dx = inter.x - target.x
      const dy = inter.y - target.y
      dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 500) status = 'collision'
    } else {
      status = 'lost'
    }
    return { inter, target, dist, status }
  })

  return (
    <div className="panel rounded-sm p-2.5 flex flex-col h-full">
      <div className="panel-header mb-1 flex-shrink-0 flex items-center justify-between">
        <span>Intercept Status</span>
        {statuses.length > 0 && (
          <span className="text-2xs text-interceptor font-bold">{statuses.length} ACTIVE</span>
        )}
      </div>

      <div className="flex text-2xs text-dim tracking-wider pb-1 px-1 border-b border-border flex-shrink-0">
        <span style={{ width: '4.5rem' }}>UNIT</span>
        <span style={{ width: '4.5rem' }}>TARGET</span>
        <span style={{ textAlign: 'right', width: '3.5rem' }}>DIST</span>
        <span style={{ marginLeft: 'auto', width: '3rem', textAlign: 'center' }}>STATUS</span>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1">
        {statuses.length === 0 ? (
          <div className="text-muted text-2xs text-center py-6">— NO INTERCEPTORS —</div>
        ) : (
          statuses.map(({ inter, target, dist, status: st }) => {
            const isSelected = selectedTrackId === inter.id
            return (
            <div
              key={inter.id}
              className="event-entry flex items-center gap-1 cursor-pointer"
              style={{ borderLeft: isSelected ? '2px solid #00FFAA' : '2px solid transparent', paddingLeft: isSelected ? 'calc(0.25rem - 2px)' : '0.25rem' }}
              onClick={() => setSelectedTrack(inter.id)}
            >
              <span className="text-muted font-medium text-2xs" style={{ minWidth: '4.5rem' }}>
                INT-{String(inter.id).padStart(3, '0')}
              </span>
              <span className="text-muted text-2xs" style={{ minWidth: '4.5rem' }}>
                {target ? `TRK-${String(target.id).padStart(3, '0')}` : '—'}
              </span>
              <span className="text-text text-2xs tabular-nums text-right" style={{ minWidth: '3.5rem' }}>
                {dist !== null ? `${dist.toFixed(0)}m` : '—'}
              </span>
              <span
                className="text-2xs font-bold uppercase tracking-wider ml-auto"
                style={{
                  color: st === 'collision' ? '#FF4444' : st === 'lost' ? '#6E7B8A' : '#FF8C00',
                }}
              >
                {st === 'pursuing' ? 'TRACKING' : st === 'collision' ? 'IMPACT' : 'LOST'}
              </span>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
