import { useSimStore } from '../store/simulationStore'
import type { Track } from '../types'

interface Props {
  track: Track
  onClose: () => void
  onLaunch: () => void
}

export default function TrackDetail({ track, onClose, onLaunch }: Props) {
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const threats = useSimStore(s => s.threats)
  const stats = useSimStore(s => s.stats)
  const addToast = useSimStore(s => s.addToast)

  const isInter = track.classification === 'INTERCEPTOR'
  const isHostile = track.classification === 'HOSTILE'
  const isFriendly = track.classification === 'FRIENDLY'
  const canLaunch = isHostile && track.visible && stats.inventory_remaining > 0
  const colorMap = { HOSTILE: '#FF5A5A', FRIENDLY: '#3DDCFF', INTERCEPTOR: '#FFB547' }
  const color = colorMap[track.classification]

  const range = Math.sqrt(track.x ** 2 + track.y ** 2)
  const bearing = (Math.atan2(track.y, track.x) * 180 / Math.PI + 360) % 360

  const threat = threats.find(th => th.trackId === track.id)

  const targetTrack = isInter && track.targetId != null
    ? [...tracks, ...interceptors].find(t => t.id === track.targetId)
    : null

  return (
    <div
      className="absolute bottom-3 left-3 z-10 animate-fadeIn"
      style={{
        width: '270px',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '2px',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ background: color }} />
          <span className="font-mono font-bold text-xs tracking-wider" style={{ color }}>
            {isInter ? 'INT' : isFriendly ? 'FRD' : 'TRK'}-{String(track.id).padStart(3, '0')}
          </span>
          <span className="font-mono text-3xs text-muted uppercase tracking-wider">{track.classification}</span>
          {track.trackType && track.trackType !== 'STANDARD' && (
            <span
              className="font-mono text-3xs font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm"
              style={{
                color: track.trackType === 'JAMMER' ? '#A855F7' : '#FB923C',
                background: track.trackType === 'JAMMER' ? 'rgba(168,85,247,0.1)' : 'rgba(251,146,60,0.1)',
              }}
            >
              {track.trackType}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-muted hover:text-text text-xs leading-none px-1">✕</button>
      </div>

      <div className="p-3 space-y-1.5 font-mono text-3xs">
        <Row label="Position" value={`(${track.x.toFixed(0)}, ${track.y.toFixed(0)})`} />
        <Row label="Velocity" value={`(${track.vx.toFixed(0)}, ${track.vy.toFixed(0)})`} />
        <Row label="Altitude" value={`${track.altitude.toFixed(0)} m`} />
        <Row label="Speed" value={`${track.speed.toFixed(0)} m/s`} />
        <Row label="Heading" value={`${(track.heading * 180 / Math.PI).toFixed(1)}°`} />
        <Row label="Bearing" value={`${bearing.toFixed(1)}°`} />
        <Row label="Range" value={`${(range / 1000).toFixed(2)} km`} />

        {isInter && track.targetId != null && (
          <Row
            label="Target"
            value={targetTrack
              ? `TRK-${String(track.targetId).padStart(3, '0')} (${(range - Math.sqrt(targetTrack.x ** 2 + targetTrack.y ** 2)).toFixed(0)}m)`
              : `TRK-${String(track.targetId).padStart(3, '0')}`}
          />
        )}

        {isHostile && threat && (
          <>
            <Row label="Threat ETA" value={`${threat.eta.toFixed(1)}s`} />
            <Row
              label="Priority"
              value={threat.eta < 15 ? 'CRITICAL' : threat.eta < 35 ? 'HIGH' : 'ADVISORY'}
              valueColor={threat.eta < 15 ? '#FF5A5A' : threat.eta < 35 ? '#FFB547' : '#FFC857'}
            />
          </>
        )}

        {isHostile && !track.visible && (
          <Row label="Status" value="NOT DETECTED" valueColor="#6B7280" />
        )}

        {track.jammed && <Row label="Jamming" value="JAMMED" valueColor="#A855F7" />}

        {track.groupId != null && (
          <Row label="Group" value={`SWM-${String(track.groupId).padStart(3, '0')}${track.id === track.groupId ? ' (LEAD)' : ''}`} />
        )}

        <Row label="History" value={`${track.history.length} pts`} />
      </div>

      {isHostile && track.visible && (
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              if (!canLaunch) {
                addToast({ message: 'No interceptors available', type: 'warning' })
                return
              }
              addToast({ message: `Interceptor launched at TRK-${String(track.id).padStart(3, '0')}`, type: 'info' })
              onLaunch()
            }}
            className="w-full py-2 font-mono text-3xs font-bold uppercase tracking-wider transition-colors rounded-sm"
            style={{
              border: `1px solid ${canLaunch ? 'rgba(255,90,90,0.25)' : 'rgba(255,90,90,0.1)'}`,
              color: canLaunch ? '#FF5A5A' : 'rgba(255,90,90,0.3)',
              background: canLaunch ? 'rgba(255,90,90,0.06)' : 'rgba(255,90,90,0.02)',
              cursor: canLaunch ? 'pointer' : 'default',
              opacity: canLaunch ? 1 : 0.45,
            }}
            disabled={!canLaunch}
            title={canLaunch ? 'Launch interceptor at this track' : 'No interceptors available'}
            onMouseEnter={e => { if (canLaunch) (e.target as HTMLElement).style.background = 'rgba(255,90,90,0.15)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = canLaunch ? 'rgba(255,90,90,0.06)' : 'rgba(255,90,90,0.02)' }}
          >
            {canLaunch ? `Launch Interceptor [${stats.inventory_remaining}]` : 'No Interceptors'}
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted tracking-wider uppercase">{label}</span>
      <span className="font-medium tabular-nums" style={{ color: valueColor ?? '#E2E8F0' }}>{value}</span>
    </div>
  )
}
