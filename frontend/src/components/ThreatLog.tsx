import { useSimStore } from '../store/simulationStore'

export default function ThreatLog() {
  const threats = useSimStore(s => s.threats)
  const tracks = useSimStore(s => s.tracks)
  const selectedTrackId = useSimStore(s => s.selectedTrackId)
  const setSelectedTrack = useSimStore(s => s.setSelectedTrack)

  return (
    <div className="panel rounded-sm p-2.5 flex flex-col h-full">
      <div className="panel-header mb-1 flex-shrink-0 flex items-center justify-between">
        <span>Threat Analysis</span>
        {threats.length > 0 && (
          <span className="text-2xs text-hostile font-bold pulse">{threats.length} ACTIVE</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1">
        {threats.length === 0 ? (
          <div className="text-muted text-2xs text-center py-6">— NO THREATS —</div>
        ) : (
          [...threats]
            .sort((a, b) => a.eta - b.eta)
            .map(th => {
              const track = tracks.find(t => t.id === th.trackId)
              const m = Math.floor(th.eta / 60)
              const s = Math.floor(th.eta % 60)
              const etaStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
              const severity = th.eta < 15 ? 'critical' : th.eta < 35 ? 'warning' : 'advisory'
              const sevColor = severity === 'critical' ? '#FF4444' : severity === 'warning' ? '#FF8C00' : '#FFD700'

              const isSelected = selectedTrackId === th.trackId
              return (
                <div
                  key={th.trackId}
                  className="event-entry flex items-center gap-1.5 cursor-pointer"
                  style={{ borderLeft: isSelected ? '2px solid #00FFAA' : '2px solid transparent', paddingLeft: isSelected ? 'calc(0.5rem - 2px)' : '0.5rem' }}
                  onClick={() => setSelectedTrack(th.trackId)}
                >
                  <span className="relative flex-shrink-0">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: sevColor,
                        boxShadow: severity === 'critical' ? `0 0 6px ${sevColor}80` : 'none',
                        animation: severity === 'critical' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                    {severity === 'critical' && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-30"
                        style={{ background: sevColor }}
                      />
                    )}
                  </span>
                  <span className="text-2xs font-medium" style={{ color: sevColor }}>
                    TRK-{String(th.trackId).padStart(3, '0')}
                  </span>
                  <span className="text-muted text-2xs ml-auto tabular-nums text-right">ETA {etaStr}</span>
                  {track && (
                    <span className="text-dim text-2xs hidden 2xl:inline tabular-nums">SPD {track.speed.toFixed(0)}</span>
                  )}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
