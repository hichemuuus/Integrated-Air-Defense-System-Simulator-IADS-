import { useSimStore } from '../store/simulationStore'

export default function TacticalSummary() {
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const stats = useSimStore(s => s.stats)

  const hostileCount = tracks.filter(t => t.classification === 'HOSTILE' && t.visible).length
  const engagedCount = interceptors.filter(i => i.visible && i.targetId != null).length
  const leakers = stats.leakers
  const destroyed = stats.kills
  const totalEngaged = stats.kills + stats.leakers + stats.misses
  const pk = totalEngaged > 0 ? ((stats.kills / totalEngaged) * 100) : 0

  return (
    <div className="flex items-stretch gap-0 h-full" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <SummaryItem label="Hostiles" value={hostileCount} color="#FF5A5A" />
      <SummaryItem label="Engaged" value={engagedCount} color="#FFB547" />
      <SummaryItem label="Destroyed" value={destroyed} color="#4ADE80" />
      <SummaryItem label="Leakers" value={leakers} color="#FFC857" />
      <SummaryItem label="Pk" value={`${pk.toFixed(0)}%`} color={pk > 70 ? '#4ADE80' : pk > 40 ? '#FFC857' : '#FF5A5A'} />
    </div>
  )
}

function SummaryItem({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-3xs text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}
