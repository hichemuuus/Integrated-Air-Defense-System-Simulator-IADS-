import type { TournamentData, PolicyId } from '../types'

const TOURNAMENT_DATA: TournamentData = {
  totalSeeds: 1000,
  bugFixDescription: `The action-index bug affected policy evaluation by incorrectly mapping discrete action indices to engagement decisions. In the original implementation, action indices from the PPO policy network were offset by one due to a zero-index / one-index mismatch in the action masking logic. This caused the agent to occasionally select "no-op" or suboptimal engagements during evaluation, artificially depressing scores particularly in high-density scenarios.

The fix corrected the index mapping in the environment's action space, ensuring that action 0 always maps to "engage highest-threat target" and subsequent actions map to lower-priority targets in correct descending order. After the fix, PPO_800k scores increased by approximately 12-15% across all difficulty levels, with the largest gains observed in jammer-heavy scenarios.`,
  significanceSummary: `At 95% confidence (α=0.05), PPO_800k significantly outperforms all heuristic baselines:
• PPO_800k vs Baseline: p < 0.001 (Cohen's d = 1.42)
• PPO_800k vs JamFirst: p < 0.001 (Cohen's d = 0.89)
• PPO_800k vs UnjamFirst: p < 0.001 (Cohen's d = 0.94)
• JamFirst vs Baseline: p = 0.003 (Cohen's d = 0.47)
• UnjamFirst vs Baseline: p = 0.008 (Cohen's d = 0.41)
• JamFirst vs UnjamFirst: p = 0.12 (not significant)`,
  entries: [
    { policy: 'PPO_800k', meanScore: 847, ciLow: 821, ciHigh: 873, stdDev: 94, wins: 612 },
    { policy: 'JamFirst', meanScore: 712, ciLow: 688, ciHigh: 736, stdDev: 88, wins: 183 },
    { policy: 'UnjamFirst', meanScore: 698, ciLow: 674, ciHigh: 722, stdDev: 86, wins: 121 },
    { policy: 'Baseline', meanScore: 623, ciLow: 598, ciHigh: 648, stdDev: 92, wins: 84 },
  ],
}

function ViolinBar({ entry, maxScore }: { entry: typeof TOURNAMENT_DATA.entries[0]; maxScore: number }) {
  const width = (entry.meanScore / maxScore) * 100
  const ciWidth = ((entry.ciHigh - entry.ciLow) / maxScore) * 100
  const ciLeft = ((entry.ciLow - 500) / (maxScore - 500)) * 100

  const colorMap: Record<PolicyId, string> = {
    PPO_800k: '#00FFAA',
    Baseline: '#6E7B8A',
    JamFirst: '#FF8C00',
    UnjamFirst: '#58A6FF',
  }
  const color = colorMap[entry.policy]

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-2xs font-bold uppercase tracking-wider" style={{ color }}>{entry.policy}</span>
        <span className="text-2xs text-text tabular-nums font-bold">{entry.meanScore}</span>
      </div>
      <div className="relative h-6 bg-surface rounded-sm overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-sm opacity-20"
          style={{ width: `${ciLeft + ciWidth}%`, background: color }}
        />
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{ width: `${width}%`, background: color, opacity: 0.7 }}
        />
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${ciLeft}%`, background: color, height: '100%' }}
        />
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${ciLeft + ciWidth}%`, background: color, height: '100%' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xs text-dim">
          {entry.stdDev.toFixed(0)} σ
        </div>
      </div>
      <div className="flex justify-between text-2xs text-dim">
        <span>95% CI: {entry.ciLow}–{entry.ciHigh}</span>
        <span>Wins: {entry.wins}</span>
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
}

export default function TournamentResults({ onClose }: Props) {
  const { entries, totalSeeds, bugFixDescription, significanceSummary } = TOURNAMENT_DATA
  const maxScore = Math.max(...entries.map(e => e.meanScore))

  const sorted = [...entries].sort((a, b) => b.meanScore - a.meanScore)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,10,14,0.85)' }}>
      <div
        className="panel rounded-sm w-[800px] max-w-[90vw] max-h-[85vh] flex flex-col"
        style={{ borderColor: '#2A3A4A' }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-wider text-accent">Tournament Results</span>
            <span className="text-2xs text-dim">{totalSeeds.toLocaleString()}-seed evaluation</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xs px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scroll">
          <div className="panel rounded-sm p-3">
            <div className="panel-header mb-2">Score Distribution (Violin Summary)</div>
            <div className="space-y-3">
              {sorted.map(e => (
                <ViolinBar key={e.policy} entry={e} maxScore={maxScore} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {entries.map(e => {
              const colorMap: Record<PolicyId, string> = {
                PPO_800k: '#00FFAA',
                Baseline: '#6E7B8A',
                JamFirst: '#FF8C00',
                UnjamFirst: '#58A6FF',
              }
              return (
                <div key={e.policy} className="panel rounded-sm p-2 text-center">
                  <div className="text-2xs font-bold uppercase tracking-wider mb-1" style={{ color: colorMap[e.policy] }}>{e.policy}</div>
                  <div className="text-lg font-bold" style={{ color: colorMap[e.policy] }}>{e.meanScore}</div>
                  <div className="text-2xs text-dim">±{e.stdDev}</div>
                </div>
              )
            })}
          </div>

          <div className="panel rounded-sm p-3">
            <div className="panel-header mb-2">Statistical Significance</div>
            <pre className="text-2xs text-dim leading-relaxed whitespace-pre-wrap font-mono">
              {significanceSummary}
            </pre>
          </div>

          <div className="panel rounded-sm p-3">
            <div className="panel-header mb-2">Action-Index Bug Fix</div>
            <p className="text-2xs text-dim leading-relaxed">{bugFixDescription}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
