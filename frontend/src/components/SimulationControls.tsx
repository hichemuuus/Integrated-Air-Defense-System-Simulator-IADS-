import { useState } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { Overlays } from '../App'

interface Props {
  onControl: (action: string, payload?: any) => void
  overlays: Overlays
  onToggleOverlay: (key: keyof Overlays) => void
}

const OVERLAY_LABELS: Record<keyof Overlays, string> = {
  grid: 'Grid', radar: 'Raid', trails: 'Trails', labels: 'Labels',
}

const SPEEDS = [0.5, 1, 2, 5, 10]

export const PRESETS = [
  {
    label: 'STANDARD THREAT',
    config: { numHostiles: 15, numFriendlies: 3, threatSpeed: 0.5, jammingIntensity: 0, swarmMode: false },
  },
  {
    label: 'SWARM ATTACK',
    config: { numHostiles: 50, numFriendlies: 2, threatSpeed: 0.8, jammingIntensity: 0.2, swarmMode: true },
  },
  {
    label: 'STEALTH INFILTRATION',
    config: { numHostiles: 5, numFriendlies: 4, threatSpeed: 0.3, jammingIntensity: 0, swarmMode: false },
  },
  {
    label: 'HIGH ECM ENVIRONMENT',
    config: { numHostiles: 20, numFriendlies: 3, threatSpeed: 0.6, jammingIntensity: 0.8, swarmMode: false },
  },
]

export default function SimulationControls({ onControl, overlays, onToggleOverlay }: Props) {
  const simulationState = useSimStore(s => s.simulationState)
  const simTime = useSimStore(s => s.simTime)
  const speed = useSimStore(s => s.speed)
  const setScenario = useSimStore(s => s.setScenario)
  const addToast = useSimStore(s => s.addToast)
  const [loadoutOpen, setLoadoutOpen] = useState(false)

  const baseBtn = 'px-1.5 py-1 text-3xs font-medium tracking-wider uppercase text-muted hover:text-text transition-colors'
  const activeBtn = 'px-1.5 py-1 text-3xs font-medium tracking-wider uppercase text-white bg-white/[0.06] transition-colors'
  const inactiveBtn = 'px-1.5 py-1 text-3xs font-medium tracking-wider uppercase text-muted hover:text-text hover:bg-white/[0.03] transition-colors'

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
  const canStep = simulationState === 'idle' || simulationState === 'paused' || simulationState === 'finished'

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setScenario(preset.config)
    setLoadoutOpen(false)
    addToast({ message: `Scenario: ${preset.label}`, type: 'info' })
    onControl('reset')
  }

  const handlePause = () => {
    if (!canPause) return
    onControl('pause')
    addToast({ message: 'Simulation Paused', type: 'info' })
  }

  const handleResume = () => {
    if (!canResume) return
    onControl('resume')
    addToast({ message: 'Simulation Resumed', type: 'success' })
  }

  const handleReset = () => {
    if (!canReset) return
    onControl('reset')
    addToast({ message: 'Simulation Reset', type: 'info' })
  }

  const handleRun = () => {
    if (!canRun) return
    onControl('run')
    addToast({ message: 'Simulation Started', type: 'success' })
  }

  return (
    <div className="flex items-center gap-1">
      {/* LOADOUT dropdown */}
      <div className="relative">
        <button
          onClick={() => setLoadoutOpen(v => !v)}
          onBlur={() => setTimeout(() => setLoadoutOpen(false), 200)}
          className="px-1.5 py-1 text-3xs font-bold uppercase tracking-wider border text-muted hover:text-text transition-colors"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: '1px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          LOADOUT ▾
        </button>
        {loadoutOpen && (
          <div
            className="absolute top-full left-0 mt-0.5 z-50 min-w-[200px]"
            style={{
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {PRESETS.map(p => (
              <button
                key={p.label}
                onMouseDown={() => applyPreset(p)}
                className="w-full text-left px-3 py-1.5 text-3xs uppercase tracking-wider text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <button onClick={handleRun} disabled={!canRun} title="Run Simulation"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            canRun
              ? 'text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] active:bg-white/[0.04] active:border-white/[0.3]'
              : 'text-white/[0.2] border border-white/[0.04]'
          }`}
          style={{
            borderRadius: '1px', padding: '1px 7px', minWidth: '34px', height: '22px',
            opacity: canRun ? 1 : 0.45, cursor: canRun ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >▶</button>
        <button onClick={handlePause} disabled={!canPause} title="Pause (Space)"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            canPause
              ? 'text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] active:bg-white/[0.04] active:border-white/[0.3]'
              : 'text-white/[0.2] border border-white/[0.04]'
          }`}
          style={{
            borderRadius: '1px', padding: '1px 7px', minWidth: '34px', height: '22px',
            opacity: canPause ? 1 : 0.45, cursor: canPause ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >❚❚</button>
        <button onClick={handleResume} disabled={!canResume} title="Resume (Space)"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            canResume
              ? 'text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] active:bg-white/[0.04] active:border-white/[0.3]'
              : 'text-white/[0.2] border border-white/[0.04]'
          }`}
          style={{
            borderRadius: '1px', padding: '1px 7px', minWidth: '34px', height: '22px',
            opacity: canResume ? 1 : 0.45, cursor: canResume ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >▷</button>
        <button onClick={handleReset} disabled={!canReset} title="Reset (R)"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            canReset
              ? 'text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] active:bg-white/[0.04] active:border-white/[0.3]'
              : 'text-white/[0.2] border border-white/[0.04]'
          }`}
          style={{
            borderRadius: '1px', padding: '1px 7px', minWidth: '34px', height: '22px',
            opacity: canReset ? 1 : 0.45, cursor: canReset ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >↺</button>
        <button onClick={() => onControl('step')} disabled={!canStep} title="Step (.)"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            canStep
              ? 'text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] active:bg-white/[0.04] active:border-white/[0.3]'
              : 'text-white/[0.2] border border-white/[0.04]'
          }`}
          style={{
            borderRadius: '1px', padding: '1px 7px', minWidth: '34px', height: '22px',
            opacity: canStep ? 1 : 0.45, cursor: canStep ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >⏭</button>
      </div>

      <div className="flex items-center gap-px border-l border-white/[0.06] pl-1.5">
        {SPEEDS.map(mult => (
          <button
            key={mult}
            onClick={() => onControl('speed', { speed: mult })}
            className={speed === mult ? activeBtn : inactiveBtn}
          >
            {mult}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-px border-l border-white/[0.06] pl-1.5">
        {(Object.keys(OVERLAY_LABELS) as (keyof Overlays)[]).map(key => (
          <button
            key={key}
            onClick={() => onToggleOverlay(key)}
            className={overlays[key] ? activeBtn : inactiveBtn}
          >
            {OVERLAY_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  )
}
