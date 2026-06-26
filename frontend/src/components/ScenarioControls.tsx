import { useSimStore } from '../store/simulationStore'
import type { ScenarioConfig } from '../types'

interface Props {
  onControl: (action: string, payload?: any) => void
}

function TacticalSlider({ label, value, min, max, step, onChange, format }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = format ? format(value) : String(value)

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-3xs text-muted uppercase tracking-wider font-medium">{label}</span>
        <span className="text-xs text-text font-mono tabular-nums">[{display}]</span>
      </div>
      <div className="relative" style={{ height: '16px' }}>
        {/* track background */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0"
          style={{ height: '2px', width: '100%', background: 'rgba(255,255,255,0.08)' }}
        />
        {/* track fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 transition-all"
          style={{ height: '2px', width: `${pct}%`, background: 'rgba(255,255,255,0.2)' }}
        />
        {/* native range input (invisible, captures interaction) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="tactical-range"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            margin: 0,
            padding: 0,
          }}
        />
        {/* rectangular thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all"
          style={{
            left: `calc(${pct}% - 4px)`,
            width: '8px',
            height: '16px',
            background: '#E2E8F0',
            borderRadius: '1px',
          }}
        />
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-3xs text-muted uppercase tracking-wider font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 transition-colors"
        style={{
          width: '28px',
          height: '14px',
          borderRadius: '2px',
          background: value ? 'rgba(61,220,255,0.25)' : 'rgba(255,255,255,0.08)',
          border: '1px solid',
          borderColor: value ? 'rgba(61,220,255,0.3)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <span
          className="absolute top-[1px] transition-all"
          style={{
            width: '10px',
            height: '10px',
            left: value ? '15px' : '1px',
            background: value ? '#3DDCFF' : '#6B7280',
            borderRadius: '1px',
          }}
        />
      </button>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="text-3xs font-semibold uppercase tracking-widest mb-1.5 pt-1"
      style={{ color: 'rgba(136,146,170,0.5)' }}
    >
      {label}
    </div>
  )
}

function CardRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-3xs text-dim tracking-wider uppercase">{label}</span>
      <span className="text-xs font-bold font-mono tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}

function ThreatSummaryCard() {
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const stats = useSimStore(s => s.stats)

  const hostiles = tracks.filter(t => t.classification === 'HOSTILE' && t.visible).length
  const engaged = interceptors.filter(i => i.visible && i.targetId != null).length
  const destroyed = stats.kills
  const leakers = stats.leakers

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 10px',
    }}>
      <div className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1.5">Threat Summary</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <CardRow label="Hostiles" value={hostiles} color="#FF5A5A" />
        <CardRow label="Engaged" value={engaged} color="#FFB547" />
        <CardRow label="Destroyed" value={destroyed} color="#4ADE80" />
        <CardRow label="Leakers" value={leakers} color="#FFC857" />
      </div>
    </div>
  )
}

function AssetStatusCard() {
  const interceptors = useSimStore(s => s.interceptors)
  const stats = useSimStore(s => s.stats)

  const activeInbound = interceptors.filter(i => i.visible && i.targetId != null).length
  const available = Math.max(0, stats.inventory_remaining)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 10px',
    }}>
      <div className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1.5">Asset Status</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <CardRow label="Available" value={available} color="#3DDCFF" />
        <CardRow label="In Flight" value={activeInbound} color="#FFB547" />
        <CardRow label="Total" value={stats.launched + stats.inventory_remaining} color="#6B7280" />
      </div>
    </div>
  )
}

function PolicyIntelCard() {
  const activePolicy = useSimStore(s => s.activePolicy)
  const aiDecisions = useSimStore(s => s.aiDecisions)
  const responseTime = useSimStore(s => s.responseTime)
  const stats = useSimStore(s => s.stats)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 10px',
    }}>
      <div className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1.5">Policy Intel</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <CardRow label="Policy" value={activePolicy} color="#3B82F6" />
        <CardRow label="Decisions" value={aiDecisions.length} color="#E2E8F0" />
        <CardRow label="Resp Time" value={`${(responseTime || 0).toFixed(2)}s`} color="#FFB547" />
        <CardRow label="Kills" value={stats.kills} color="#4ADE80" />
      </div>
    </div>
  )
}

export default function ScenarioControls({ onControl }: Props) {
  const scenario = useSimStore(s => s.scenario)
  const simulationState = useSimStore(s => s.simulationState)
  const simTime = useSimStore(s => s.simTime)
  const setScenario = useSimStore(s => s.setScenario)
  const addToast = useSimStore(s => s.addToast)

  const update = (partial: Partial<ScenarioConfig>) => setScenario(partial)

  const simState: 'idle' | 'running' | 'paused' | 'completed' =
    simulationState === 'idle' || simulationState === 'finished'
      ? simulationState === 'finished' || simTime > 0
        ? 'completed'
        : 'idle'
      : simulationState

  const canRun = simState === 'idle' || simState === 'completed'
  const canPause = simState === 'running'
  const canResume = simState === 'paused'
  const canReset = simState === 'running' || simState === 'paused' || simState === 'completed'

  const handleRun = () => {
    if (simulationState === 'running') {
      addToast({ message: 'Simulation already running', type: 'warning' })
      return
    }
    onControl('run')
    addToast({ message: 'Simulation Started', type: 'success' })
  }

  const handlePause = () => {
    if (simulationState !== 'running') return
    onControl('pause')
    addToast({ message: 'Simulation Paused', type: 'info' })
  }

  const handleResume = () => {
    if (simulationState !== 'paused') {
      addToast({ message: 'Resume unavailable — simulation not paused', type: 'warning' })
      return
    }
    onControl('resume')
    addToast({ message: 'Simulation Resumed', type: 'success' })
  }

  const handleReset = () => {
    if (!canReset) return
    onControl('reset')
    addToast({ message: 'Simulation Reset', type: 'info' })
  }

  return (
    <div className="flex flex-col h-full" style={{ fontSize: '11px' }}>
      <div className="panel-header mb-2" style={{ fontSize: '0.75rem' }}>Scenario Configuration</div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scroll">
        <SectionHeader label="THREAT PARAMETERS" />
        <TacticalSlider
          label="Hostiles"
          value={scenario.numHostiles}
          min={1} max={30} step={1}
          onChange={v => update({ numHostiles: v })}
          format={v => String(v).padStart(2, '0')}
        />
        <TacticalSlider
          label="Threat Speed"
          value={scenario.threatSpeed}
          min={0.5} max={3} step={0.25}
          onChange={v => update({ threatSpeed: v })}
          format={v => `${v.toFixed(1)}x`}
        />
        <TacticalSlider
          label="Jamming Intensity"
          value={scenario.jammingIntensity}
          min={0} max={1} step={0.1}
          onChange={v => update({ jammingIntensity: v })}
          format={v => `${(v * 100).toFixed(0)}%`}
        />
        <Toggle
          label="Swarm Mode"
          value={scenario.swarmMode}
          onChange={v => update({ swarmMode: v })}
        />

        <SectionHeader label="DEFENSIVE ASSETS" />
        <TacticalSlider
          label="Friendlies"
          value={scenario.numFriendlies}
          min={0} max={10} step={1}
          onChange={v => update({ numFriendlies: v })}
          format={v => String(v).padStart(2, '0')}
        />
        <TacticalSlider
          label="Inventory"
          value={scenario.inventorySize}
          min={5} max={60} step={5}
          onChange={v => update({ inventorySize: v })}
        />

        <SectionHeader label="AI POLICY" />
        <TacticalSlider
          label="Random Seed"
          value={scenario.randomSeed}
          min={0} max={999} step={1}
          onChange={v => update({ randomSeed: v })}
          format={v => String(v).padStart(3, '0')}
        />

        <ThreatSummaryCard />
        <AssetStatusCard />
        <PolicyIntelCard />
      </div>

      <div className="flex-shrink-0 space-y-1.5 pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleRun}
          disabled={!canRun}
          className={`w-full py-2 text-3xs font-bold uppercase tracking-widest transition-all ${
            canRun
              ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
              : ''
          }`}
          style={{
            background: canRun ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
            color: canRun ? '#4ADE80' : 'rgba(255,255,255,0.2)',
            border: canRun ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
            borderRadius: '1px',
            cursor: canRun ? 'pointer' : 'default',
            opacity: canRun ? 1 : 0.45,
          }}
          title={
            simState === 'running' ? 'Simulation running'
            : simState === 'paused' ? 'Simulation paused — resume to continue'
            : simState === 'completed' ? 'Run new simulation'
            : 'Initialize and run simulation'
          }
        >
          {simState === 'running' ? 'SIMULATION RUNNING' : simState === 'paused' ? 'SIMULATION PAUSED' : '▶ RUN SIMULATION'}
        </button>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handlePause}
            disabled={!canPause}
            className={`py-1.5 text-3xs font-medium uppercase tracking-wider border transition-colors ${
              canPause
                ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                : ''
            }`}
            style={{
              border: canPause ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '1px',
              color: canPause ? '#E2E8F0' : 'rgba(255,255,255,0.2)',
              cursor: canPause ? 'pointer' : 'default',
              opacity: canPause ? 1 : 0.45,
            }}
            title="Pause simulation"
          >
            ❚❚ PAUSE
          </button>
          <button
            onClick={handleResume}
            disabled={!canResume}
            className={`py-1.5 text-3xs font-medium uppercase tracking-wider border transition-colors ${
              canResume
                ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                : ''
            }`}
            style={{
              border: canResume ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '1px',
              color: canResume ? '#4ADE80' : 'rgba(255,255,255,0.2)',
              cursor: canResume ? 'pointer' : 'default',
              opacity: canResume ? 1 : 0.45,
            }}
            title={canResume ? 'Resume simulation' : 'Resume disabled — simulation not paused'}
          >
            ▷ RESUME
          </button>
          <button
            onClick={handleReset}
            disabled={!canReset}
            className={`py-1.5 text-3xs font-medium uppercase tracking-wider border transition-colors ${
              canReset
                ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                : ''
            }`}
            style={{
              border: canReset ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '1px',
              color: canReset ? '#FF5A5A' : 'rgba(255,255,255,0.2)',
              cursor: canReset ? 'pointer' : 'default',
              opacity: canReset ? 1 : 0.45,
            }}
            title={canReset ? 'Reset simulation to initial state' : 'No simulation to reset'}
          >
            ↺ RESET
          </button>
        </div>

        <div className="pt-1 text-center">
          <span className="text-3xs text-muted uppercase tracking-wider">
            Policy: <span className="text-blue font-bold">{useSimStore.getState().activePolicy}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
