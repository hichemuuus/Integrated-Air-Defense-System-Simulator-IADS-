import { useSimStore, POLICIES } from '../store/simulationStore'
import type { PolicyId } from '../types'
import { useComparisonBackend } from '../hooks/useComparisonBackend'

const COLORS = {
  A: '#00FFAA',
  B: '#58A6FF',
}

function ComparisonMetric({ label, valueA, valueB, colorA, colorB, format }: {
  label: string
  valueA: number | string
  valueB: number | string
  colorA?: string
  colorB?: string
  format?: (v: number) => string
}) {
  const aIsBetter = typeof valueA === 'number' && typeof valueB === 'number' && valueA > valueB
  const bIsBetter = typeof valueA === 'number' && typeof valueB === 'number' && valueB > valueA
  return (
    <div className="grid grid-cols-3 gap-2 text-2xs items-center py-1.5 border-b border-border/50">
      <div className="text-right font-bold tabular-nums" style={{ color: colorA || COLORS.A }}>
        {typeof valueA === 'number' ? (format ? format(valueA) : valueA.toFixed(1)) : valueA}
        {aIsBetter && <span className="ml-1 text-accent">✓</span>}
      </div>
      <div className="text-center text-dim uppercase tracking-wider">{label}</div>
      <div className="font-bold tabular-nums" style={{ color: colorB || COLORS.B }}>
        {bIsBetter && <span className="mr-1 text-friendly">✓</span>}
        {typeof valueB === 'number' ? (format ? format(valueB) : valueB.toFixed(1)) : valueB}
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
  onControl: (action: string, payload?: any) => void
}

export default function PolicyComparison({ onClose, onControl }: Props) {
  const comparison = useSimStore(s => s.comparison)
  const setComparison = useSimStore(s => s.setComparison)
  const statsA = useSimStore(s => s.comparisonStatsA)
  const statsB = useSimStore(s => s.comparisonStatsB)
  const timeA = useSimStore(s => s.comparisonTimeA)
  const timeB = useSimStore(s => s.comparisonTimeB)
  const runningA = useSimStore(s => s.comparisonRunningA)
  const runningB = useSimStore(s => s.comparisonRunningB)

  const { restart } = useComparisonBackend()

  const policyA = POLICIES.find(p => p.id === comparison.policyA)!
  const policyB = POLICIES.find(p => p.id === comparison.policyB)!

  const handleSelectA = (id: PolicyId) => {
    setComparison({ policyA: id, winner: null })
    restart()
  }
  const handleSelectB = (id: PolicyId) => {
    setComparison({ policyB: id, winner: null })
    restart()
  }

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const totalA = statsA.kills + statsA.leakers + statsA.misses
  const killRateA = totalA > 0 ? (statsA.kills / totalA) * 100 : 0
  const totalB = statsB.kills + statsB.leakers + statsB.misses
  const killRateB = totalB > 0 ? (statsB.kills / totalB) * 100 : 0

  const hasWinner = comparison.winner !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,10,14,0.85)' }}>
      <div className="panel rounded-sm w-[800px] max-w-[90vw] max-h-[85vh] flex flex-col" style={{ borderColor: '#2A3A4A' }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-wider text-accent">Policy Comparison</span>
            <span className="text-2xs text-dim">Side-by-side evaluation</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xs px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
          <div className="grid grid-cols-2 gap-4">
            <div className="panel rounded-sm p-3" style={{ borderColor: `${COLORS.A}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS.A }} />
                <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: COLORS.A }}>{policyA.name}</span>
                <span className="text-2xs text-dim font-mono ml-auto">{formatTime(timeA)}</span>
              </div>
              <p className="text-2xs text-dim">{policyA.description}</p>
              <div className="mt-2">
                <label className="text-2xs text-muted block mb-1">Switch Policy A:</label>
                <div className="flex flex-wrap gap-1">
                  {POLICIES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectA(p.id)}
                      className={`px-2 py-0.5 text-2xs rounded-sm border transition-all ${
                        comparison.policyA === p.id
                          ? 'border-accent/40 text-accent bg-accent/10'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel rounded-sm p-3" style={{ borderColor: `${COLORS.B}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS.B }} />
                <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: COLORS.B }}>{policyB.name}</span>
                <span className="text-2xs text-dim font-mono ml-auto">{formatTime(timeB)}</span>
              </div>
              <p className="text-2xs text-dim">{policyB.description}</p>
              <div className="mt-2">
                <label className="text-2xs text-muted block mb-1">Switch Policy B:</label>
                <div className="flex flex-wrap gap-1">
                  {POLICIES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectB(p.id)}
                      className={`px-2 py-0.5 text-2xs rounded-sm border transition-all ${
                        comparison.policyB === p.id
                          ? 'border-accent/40 text-accent bg-accent/10'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel rounded-sm p-3">
            <div className="text-2xs text-muted uppercase tracking-wider mb-2 text-center">Live Score Comparison</div>
            <div className="grid grid-cols-3 gap-2 text-2xs font-bold uppercase tracking-wider text-dim pb-1 border-b border-border mb-1">
              <div className="text-right" style={{ color: COLORS.A }}>{policyA.name}</div>
              <div className="text-center">Metric</div>
              <div style={{ color: COLORS.B }}>{policyB.name}</div>
            </div>
            <ComparisonMetric label="Kills" valueA={statsA.kills} valueB={statsB.kills} />
            <ComparisonMetric label="Leakers" valueA={statsA.leakers} valueB={statsB.leakers} />
            <ComparisonMetric label="Misses" valueA={statsA.misses} valueB={statsB.misses} />
            <ComparisonMetric label="Kill Rate" valueA={killRateA} valueB={killRateB} format={v => `${v.toFixed(0)}%`} />
            <ComparisonMetric label="Launched" valueA={statsA.launched} valueB={statsB.launched} />
            <ComparisonMetric label="Inventory" valueA={statsA.inventory_remaining} valueB={statsB.inventory_remaining} />
            <ComparisonMetric label="Elapsed" valueA={formatTime(timeA)} valueB={formatTime(timeB)} />
            <ComparisonMetric
              label="Score"
              valueA={comparison.scoreA}
              valueB={comparison.scoreB}
              format={v => v.toFixed(0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                const w = comparison.scoreA >= comparison.scoreB ? comparison.policyA : comparison.policyB
                setComparison({ winner: w })
                useSimStore.getState().addToast({ message: `Comparison complete: ${POLICIES.find(p => p.id === w)?.name} wins`, type: 'success' })
              }}
              className="py-2 text-3xs font-bold uppercase tracking-widest border transition-all"
              style={{
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: '1px',
                color: '#4ADE80',
                background: 'rgba(74,222,128,0.05)',
              }}
            >
              Declare Winner
            </button>
            <button
              onClick={() => {
                restart()
                setComparison({ winner: null, scoreA: 0, scoreB: 0 })
                useSimStore.getState().addToast({ message: 'Comparison restarted from same seed', type: 'info' })
              }}
              className="py-2 text-3xs font-bold uppercase tracking-widest border transition-all"
              style={{
                border: '1px solid rgba(255,181,71,0.2)',
                borderRadius: '1px',
                color: '#FFB547',
                background: 'rgba(255,181,71,0.05)',
              }}
            >
              Restart
            </button>
          </div>

          {hasWinner && (
            <div
              className="text-center py-3 rounded-sm text-2xs font-bold uppercase tracking-wider animate-fadeIn"
              style={{
                background: comparison.winner === comparison.policyA
                  ? 'rgba(0,255,170,0.1)'
                  : 'rgba(88,166,255,0.1)',
                border: `1px solid ${
                  comparison.winner === comparison.policyA ? 'rgba(0,255,170,0.3)' : 'rgba(88,166,255,0.3)'
                }`,
                color: comparison.winner === comparison.policyA ? '#00FFAA' : '#58A6FF',
              }}
            >
              Winner: {comparison.winner === comparison.policyA ? policyA.name : policyB.name}
              <span className="ml-2 text-dim font-normal">
                (Score: {comparison.winner === comparison.policyA ? comparison.scoreA.toFixed(0) : comparison.scoreB.toFixed(0)})
              </span>
            </div>
          )}

          <div className="text-2xs text-dim text-center italic">
            Both policies run on independent simulation instances initialized from the same scenario seed ({useSimStore.getState().scenario.randomSeed}).
          </div>
        </div>
      </div>
    </div>
  )
}
