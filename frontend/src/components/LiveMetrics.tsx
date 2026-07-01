import { useEffect, useState } from 'react'
import { useSimStore } from '../store/simulationStore'

interface MiniSparklineProps {
  values: number[]
  color: string
}

function MiniSparkline({ values, color }: MiniSparklineProps) {
  const w = 48
  const h = 20
  if (values.length < 2) return <svg width={w} height={h} className="flex-shrink-0" />
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="flex-shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} opacity={0.6} />
    </svg>
  )
}

function SegmentedBar({ used, total }: { used: number; total: number }) {
  const segs = 10
  const filled = Math.min(segs, Math.round((used / Math.max(total, 1)) * segs))
  const bar = []
  for (let i = 0; i < segs; i++) {
    bar.push(i < filled ? '█' : '░')
  }
  const pct = total > 0 ? ((total - used) / total) * 100 : 0
  const color = pct <= 20 ? '#FF5A5A' : pct <= 40 ? '#FFB547' : '#3DDCFF'

  return (
    <div className="flex items-center gap-1.5 font-mono" style={{ fontSize: '11px' }}>
      <span style={{ color, letterSpacing: '1px' }}>{bar.join('')}</span>
      <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{total - used}</span>
      <span style={{ color: '#6B7280' }}>/ {total}</span>
    </div>
  )
}

export default function LiveMetrics() {
  const stats = useSimStore(s => s.stats)
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const simTime = useSimStore(s => s.simTime)
  const responseTime = useSimStore(s => s.responseTime)
  const [history, setHistory] = useState<{ kills: number[]; leakers: number[]; efficiency: number[]; survival: number[] }>({
    kills: [], leakers: [], efficiency: [], survival: [],
  })

  const hostileCount = tracks.filter(t => t.classification === 'HOSTILE').length
  const totalEngaged = stats.kills + stats.leakers + stats.misses
  const killRate = totalEngaged > 0 ? (stats.kills / totalEngaged) * 100 : 0
  const survivalScore = Math.max(0, 100 - (stats.leakers * 10)) + (stats.kills * 2)
  const inventoryUsed = stats.launched
  const efficiency = inventoryUsed > 0 ? ((stats.kills / inventoryUsed) * 100) : 0
  const totalInventory = stats.launched + stats.inventory_remaining

  useEffect(() => {
    const id = setInterval(() => {
      setHistory(prev => {
        const maxLen = 30
        return {
          kills: [...prev.kills, stats.kills].slice(-maxLen),
          leakers: [...prev.leakers, stats.leakers].slice(-maxLen),
          efficiency: [...prev.efficiency, Math.round(efficiency)].slice(-maxLen),
          survival: [...prev.survival, Math.round(survivalScore)].slice(-maxLen),
        }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [stats.kills, stats.leakers, efficiency, survivalScore])

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const hasLeakers = stats.leakers > 0

  return (
    <div className="flex items-stretch h-full overflow-x-auto custom-scroll">
      {/* Elapsed + Active count */}
      <div className="flex-shrink-0 flex items-center gap-4 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-center">
          <div className="font-mono font-bold text-sm tracking-wider leading-none" style={{ color: '#3B82F6' }}>
            {formatTime(simTime)}
          </div>
          <div className="text-3xs text-muted tracking-wider uppercase mt-0.5">Elapsed</div>
        </div>
        <div className="text-center pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-mono font-bold text-sm tracking-wider leading-none" style={{ color: '#FF5A5A' }}>
            {hostileCount}
          </div>
          <div className="text-3xs text-muted tracking-wider uppercase mt-0.5">Active</div>
        </div>
      </div>

      {/* Kills — cyan text, normal bg */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-right min-w-[2.5rem]">
          <div className="kpi-value" style={{ color: '#3DDCFF' }}>{stats.kills}</div>
          <div className="kpi-label mt-0.5">Kills</div>
        </div>
        {history.kills.length >= 2 && <MiniSparkline values={history.kills} color="#3DDCFF" />}
      </div>

      {/* Survival — green text, normal bg */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-right min-w-[3rem]">
          <div className="kpi-value" style={{ color: survivalScore > 50 ? '#4ADE80' : '#FF5A5A' }}>{survivalScore.toFixed(0)}</div>
          <div className="kpi-label mt-0.5">Survival</div>
        </div>
        {history.survival.length >= 2 && <MiniSparkline values={history.survival} color="#4ADE80" />}
      </div>

      {/* Kill Rate — green/amber/red text */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-right min-w-[3rem]">
          <div className="kpi-value" style={{
            color: killRate > 70 ? '#4ADE80' : killRate > 40 ? '#FFB547' : '#FF5A5A'
          }}>
            {killRate.toFixed(0)}%
          </div>
          <div className="kpi-label mt-0.5">Kill Rate</div>
        </div>
      </div>

      {/* Efficiency — green/amber/red */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-right min-w-[3rem]">
          <div className="kpi-value" style={{
            color: efficiency > 60 ? '#4ADE80' : efficiency > 30 ? '#FFB547' : '#FF5A5A'
          }}>
            {efficiency.toFixed(0)}%
          </div>
          <div className="kpi-label mt-0.5">Eff.</div>
        </div>
      </div>

      {/* Response time */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-right min-w-[3rem]">
          <div className="kpi-value" style={{ color: '#3B82F6' }}>{responseTime.toFixed(1)}s</div>
          <div className="kpi-label mt-0.5">Response</div>
        </div>
      </div>

      {/* Leakers — RED BACKGROUND BLOCK, white text, pulsing if > 0 */}
      <div
        className="flex items-center px-3 mx-1"
        style={{
          background: hasLeakers
            ? 'rgba(255,90,90,0.2)'
            : 'rgba(255,90,90,0.05)',
          border: '1px solid',
          borderColor: hasLeakers ? 'rgba(255,90,90,0.4)' : 'rgba(255,90,90,0.1)',
          borderRadius: '2px',
          animation: hasLeakers ? 'leakerPulse 1s ease-in-out infinite' : undefined,
        }}
      >
        <div className="text-right min-w-[2.5rem]">
          <div className="font-mono font-bold text-sm leading-none" style={{ color: '#FFFFFF' }}>{stats.leakers}</div>
          <div className="text-3xs font-semibold tracking-wider uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Leakers</div>
        </div>
        {history.leakers.length >= 2 && <MiniSparkline values={history.leakers} color="#FFFFFF" />}
      </div>

      {/* Misses — similar red block, but no pulse */}
      <div
        className="flex items-center px-3 mx-1"
        style={{
          background: 'rgba(255,90,90,0.08)',
          border: '1px solid rgba(255,90,90,0.15)',
          borderRadius: '2px',
        }}
      >
        <div className="text-right min-w-[2.5rem]">
          <div className="font-mono font-bold text-sm leading-none" style={{ color: '#FFFFFF' }}>{stats.misses}</div>
          <div className="text-3xs font-semibold tracking-wider uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Misses</div>
        </div>
      </div>

      {/* Inventory — segmented bar */}
      <div className="flex items-center px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="kpi-label mb-1">Inventory</div>
          <SegmentedBar used={inventoryUsed} total={totalInventory} />
        </div>
      </div>

      {/* Multi-line chart */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 min-w-[180px]">
        <svg width="88" height="40" className="flex-shrink-0" viewBox="0 0 88 40">
          {history.survival.length >= 2 && (
            <polyline
              points={history.survival.map((v, i) => `${(i / (history.survival.length - 1)) * 88},${40 - (v / 120) * 36}`).join(' ')}
              fill="none" stroke="#4ADE80" strokeWidth={1} opacity={0.5}
            />
          )}
          {history.efficiency.length >= 2 && (
            <polyline
              points={history.efficiency.map((v, i) => `${(i / (history.efficiency.length - 1)) * 88},${40 - (v / 100) * 36}`).join(' ')}
              fill="none" stroke="#3DDCFF" strokeWidth={1} opacity={0.4}
            />
          )}
          {history.kills.length >= 2 && (
            <polyline
              points={history.kills.map((v, i) => `${(i / (history.kills.length - 1)) * 88},${40 - (v / Math.max(...history.kills, 1)) * 36}`).join(' ')}
              fill="none" stroke="#3B82F6" strokeWidth={1} opacity={0.4}
            />
          )}
          {history.leakers.length >= 2 && (
            <polyline
              points={history.leakers.map((v, i) => `${(i / (history.leakers.length - 1)) * 88},${40 - (v / Math.max(...history.leakers, 1)) * 36}`).join(' ')}
              fill="none" stroke={hasLeakers ? '#FF5A5A' : '#6B7280'} strokeWidth={1} opacity={0.4}
            />
          )}
        </svg>
        <div className="text-3xs text-dim leading-snug">
          <div style={{ color: '#4ADE80' }}>● Surv</div>
          <div style={{ color: '#3DDCFF' }}>● Eff</div>
          <div style={{ color: '#3B82F6' }}>● Kills</div>
          <div style={{ color: hasLeakers ? '#FF5A5A' : '#6B7280' }}>● Leak</div>
        </div>
      </div>
    </div>
  )
}
