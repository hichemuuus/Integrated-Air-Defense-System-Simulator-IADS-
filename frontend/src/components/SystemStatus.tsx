import { useSimStore } from '../store/simulationStore'

export default function SystemStatus() {
  const simTime = useSimStore(s => s.simTime)
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const stats = useSimStore(s => s.stats)

  const hostileCount = tracks.filter(t => t.classification === 'HOSTILE' && t.visible).length
  const friendlyCount = tracks.filter(t => t.classification === 'FRIENDLY').length
  const interceptorCount = interceptors.length

  const m = Math.floor(simTime / 60)
  const s = Math.floor(simTime % 60)
  const cs = Math.floor((simTime * 100) % 100)
  const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`

  return (
    <div className="panel rounded-sm p-2.5">
      <div className="panel-header mb-2">System Status</div>

      <div className="text-center mb-2">
        <div className="text-[1.6rem] font-bold tracking-wider leading-none" style={{ color: '#58A6FF' }}>
          {timeStr}
        </div>
        <div className="text-label tracking-[0.15em] text-muted uppercase mt-1">Elapsed</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Threats', value: hostileCount, color: '#FF4444' },
          { label: 'Friendly', value: friendlyCount, color: '#4A9EFF' },
          { label: 'Interceptors', value: `${interceptorCount} / ${stats.inventory_remaining}`, color: '#FF8C00' },
        ].map(item => (
          <div key={item.label} className="text-center panel rounded-sm py-1.5 px-1" style={{ borderColor: 'rgba(26,35,50,0.5)' }}>
            <div className="kpi-value leading-none mb-0.5" style={{ color: item.color }}>{item.value}</div>
            <div className="kpi-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
