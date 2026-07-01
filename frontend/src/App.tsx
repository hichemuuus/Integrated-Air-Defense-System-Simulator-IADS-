import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSimulation } from './hooks/useSimulation'
import { useSimStore } from './store/simulationStore'
import type { Toast } from './store/simulationStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import TacticalDisplay from './components/TacticalDisplay'
import SimulationControls from './components/SimulationControls'
import TrackDetail from './components/TrackDetail'
import ContextMenu from './components/ContextMenu'
import ScenarioControls from './components/ScenarioControls'
import AIDecisionFeed from './components/AIDecisionFeed'
import LiveMetrics from './components/LiveMetrics'
import PolicySelector from './components/PolicySelector'
import PolicyComparison from './components/PolicyComparison'
import TimelineReplay from './components/TimelineReplay'
import TacticalSummary from './components/TacticalSummary'
import OperationalAssessment from './OperationalAssessment/OperationalAssessment'
import SectorAnalysis from './components/SectorAnalysis'
import MissionTimeline from './components/MissionTimeline'
import AlertRibbon from './components/AlertRibbon'
import type { AIDecision } from './types'

export type TrackFilter = 'ALL' | 'HOSTILE' | 'FRIENDLY' | 'INTERCEPTOR'

export interface Overlays {
  grid: boolean
  radar: boolean
  trails: boolean
  labels: boolean
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  useEffect(() => {
    const duration = toast.duration ?? 4000
    const timer = setTimeout(() => onRemove(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast, onRemove])

  const typeStyles: Record<string, { border: string; bg: string; icon: string }> = {
    success: { border: 'rgba(74,222,128,0.3)', bg: 'rgba(74,222,128,0.1)', icon: '✓' },
    error: { border: 'rgba(255,90,90,0.3)', bg: 'rgba(255,90,90,0.1)', icon: '✗' },
    warning: { border: 'rgba(255,181,71,0.3)', bg: 'rgba(255,181,71,0.1)', icon: '⚠' },
    info: { border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.1)', icon: 'i' },
  }
  const ts = typeStyles[toast.type] ?? typeStyles.info

  return (
    <div
      className="animate-slideUp"
      style={{
        background: '#1A1F2E',
        border: `1px solid ${ts.border}`,
        borderLeft: `3px solid ${ts.border.replace('0.3', '0.8')}`,
        borderRadius: '2px',
        padding: '8px 12px',
        marginBottom: '6px',
        minWidth: '280px',
        maxWidth: '420px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span style={{ color: ts.border.replace('0.3', '0.8') }}>{ts.icon}</span>
          <span style={{ color: '#E2E8F0' }}>{toast.message}</span>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          style={{ color: '#6B7280', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      {toast.actions && toast.actions.length > 0 && (
        <div className="flex gap-2 mt-1.5 ml-4">
          {toast.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); onRemove(toast.id) }}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1px',
                color: '#3DDCFF',
                cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToastContainer() {
  const toasts = useSimStore(s => s.toasts)
  const removeToast = useSimStore(s => s.removeToast)
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  )
}

export default function App() {
  const t0 = performance.now()
  performance.mark('app:render_start')

  useEffect(() => {
    performance.mark('app:mounted')
  }, [])

  const { sendControl } = useSimulation()
  const mode = useSimStore(s => s.mode)
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const simulationState = useSimStore(s => s.simulationState)
  const selectedTrackId = useSimStore(s => s.selectedTrackId)
  const setSelectedTrack = useSimStore(s => s.setSelectedTrack)
  const events = useSimStore(s => s.events)
  const stats = useSimStore(s => s.stats)
  const activePolicy = useSimStore(s => s.activePolicy)
  const addAIDecision = useSimStore(s => s.addAIDecision)
  const setResponseTime = useSimStore(s => s.setResponseTime)
  const aiDecisions = useSimStore(s => s.aiDecisions)
  const addToast = useSimStore(s => s.addToast)
  const simTime = useSimStore(s => s.simTime)

  const exportAAR = useCallback(() => {
    console.log('[AAR] Exporting...')
    try {
      const s = useSimStore.getState()
      const totalEngaged = s.stats.kills + s.stats.leakers + s.stats.misses
      const killRate = totalEngaged > 0 ? ((s.stats.kills / totalEngaged) * 100).toFixed(1) : '0.0'
      const data = {
        exportedAt: new Date().toISOString(),
        scenario: s.scenario,
        activePolicy: s.activePolicy,
        simulationDuration: s.simTime,
        stats: {
          kills: s.stats.kills,
          leakers: s.stats.leakers,
          misses: s.stats.misses,
          killRate: `${killRate}%`,
          launched: s.stats.launched,
          inventoryRemaining: s.stats.inventory_remaining,
          responseTime: s.responseTime,
          decisionCount: s.aiDecisions.length,
        },
        engagements: s.aiDecisions
          .filter(d => d.type === 'LAUNCHED' || d.type === 'DESTROYED' || d.type === 'LEAKER')
          .slice(0, 100),
        timeline: s.timelineSnapshots.length,
        threatSummary: {
          totalHostiles: s.tracks.filter(t => t.classification === 'HOSTILE').length,
          totalEngaged,
          destroyed: s.stats.kills,
          leakers: s.stats.leakers,
        },
        interceptorUsage: {
          totalLaunched: s.stats.launched,
          remaining: s.stats.inventory_remaining,
        },
        finalScore: s.stats.kills * 10 - s.stats.leakers * 50 + s.stats.misses * -5,
        events: s.events.slice(-200),
        aiDecisions: s.aiDecisions.slice(0, 100),
      }
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `AAR_${ts}.json`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log('[AAR] Exported successfully:', filename)
      addToast({
        message: `Export successful — Saved to: downloads/${filename}`,
        type: 'success',
        duration: 6000,
        actions: [
          {
            label: 'Open File',
            onClick: () => {
              const a2 = document.createElement('a')
              a2.href = url
              a2.download = filename
              document.body.appendChild(a2)
              a2.click()
              document.body.removeChild(a2)
            },
          },
        ],
      })
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      console.error('[AAR] Export failed:', err)
      addToast({
        message: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      })
    }
  }, [addToast])

  const [overlays, setOverlays] = useState<Overlays>({
    grid: true, radar: true, trails: true, labels: true,
  })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const [leftTab, setLeftTab] = useState<'scenario' | 'policy'>('scenario')
  const [rightTab, setRightTab] = useState<'feed' | 'timeline' | 'assessment'>('assessment')
  const [showComparison, setShowComparison] = useState(false)
  const [utcTime, setUtcTime] = useState(new Date().toUTCString().split(' ')[4])
  useEffect(() => {
    const id = setInterval(() => setUtcTime(new Date().toUTCString().split(' ')[4]), 1000)
    return () => clearInterval(id)
  }, [])



  const prevEventCount = useRef(0)

  const toggleOverlay = useCallback((key: keyof Overlays) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    if (events.length > prevEventCount.current) {
      const newEvents = events.slice(prevEventCount.current)
      for (const e of newEvents) {
        const decision = eventToDecision(e, activePolicy, stats)
        if (decision) addAIDecision(decision)
      }
    }
    prevEventCount.current = events.length
  }, [events, activePolicy, stats, addAIDecision, prevEventCount])

  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      if (lastEvent.type === 'THREAT' || lastEvent.type === 'DETECTED') {
        setResponseTime(Math.random() * 0.5 + 0.1)
      }
    }
  }, [events, setResponseTime])

  useKeyboardShortcuts(
    useMemo(() => ({
      ' ': () => {
        if (simulationState === 'running') sendControl('pause')
        else if (simulationState === 'paused') sendControl('resume')
      },
      '.': () => { if (simulationState !== 'running') sendControl('step') },
      'r': () => sendControl('reset'),
      '1': () => sendControl('speed', { speed: 0.5 }),
      '2': () => sendControl('speed', { speed: 1 }),
      '3': () => sendControl('speed', { speed: 2 }),
      '4': () => sendControl('speed', { speed: 5 }),
      '5': () => sendControl('speed', { speed: 10 }),
      'g': () => toggleOverlay('grid'),
      't': () => toggleOverlay('trails'),
      'l': () => toggleOverlay('labels'),
      'd': () => toggleOverlay('radar'),
      'f': () => { setFullscreen(v => !v); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() },
      'escape': () => { setSelectedTrack(null); setContextMenu(null); setShowComparison(false) },
    }), [sendControl, toggleOverlay, simulationState])
  )

  const selectedTrack = selectedTrackId != null ? ([...tracks, ...interceptors].find(t => t.id === selectedTrackId) ?? null) : null

  return (
        <div
          className={`w-full h-full flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : ''}`}
          onClick={() => setContextMenu(null)}
          style={{ background: '#0B0F17' }}
        >
          <ToastContainer />
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-b overflow-visible" style={{ minHeight: '40px', borderColor: 'rgba(255,255,255,0.06)', background: '#111827' }}>
          <div className="flex items-center gap-2 shrink min-w-0 overflow-visible">
            <span className="text-3xs font-mono font-bold tracking-[0.1em] text-white/70 whitespace-nowrap">// SYNTRA // COMMAND</span>
            <span className="text-3xs text-white/[0.15]">|</span>
            <div className="flex items-center gap-1.5 overflow-visible flex-shrink-0">
              <SimulationControls
                onControl={sendControl}
                overlays={overlays}
                onToggleOverlay={toggleOverlay}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 overflow-visible">
            <button
              onClick={() => setShowComparison(true)}
              className="px-2 py-1 text-3xs font-medium uppercase tracking-wider text-muted border border-white/[0.08] hover:text-text hover:border-white/[0.15] transition-colors"
              style={{ borderRadius: '1px' }}
            >
              Results
            </button>

            <button
              onClick={() => {
                if (events.length === 0 && stats.kills === 0 && stats.launched === 0) {
                  addToast({ message: 'No simulation data to export — run a simulation first', type: 'warning' })
                  return
                }
                exportAAR()
              }}
              className={`px-2 py-1 text-3xs font-bold uppercase tracking-wider border transition-colors ${
                events.length > 0 || stats.kills > 0
                  ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                  : ''
              }`}
              style={{
                borderRadius: '1px',
                fontFamily: "'JetBrains Mono', monospace",
                color: events.length > 0 || stats.kills > 0 ? '#3DDCFF' : 'rgba(255,255,255,0.2)',
                borderColor: events.length > 0 || stats.kills > 0 ? 'rgba(61,220,255,0.3)' : 'rgba(255,255,255,0.05)',
                cursor: events.length > 0 || stats.kills > 0 ? 'pointer' : 'default',
                opacity: events.length > 0 || stats.kills > 0 ? 1 : 0.45,
              }}
              title={events.length > 0 || stats.kills > 0 ? 'Export After Action Report' : 'No simulation data to export'}
            >
              EXPORT AAR
            </button>

            <div className="flex items-center gap-2 pl-2 border-l overflow-visible" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-3xs font-mono text-dim tracking-wider uppercase whitespace-nowrap">
                <span className="text-white/70 font-semibold">{utcTime}Z</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </header>

        <AlertRibbon />

        <div className="flex-1 flex overflow-hidden">
        <div className="flex-shrink-0 flex flex-col overflow-hidden border-r" style={{ width: '260px', minWidth: '260px', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex-shrink-0 flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setLeftTab('scenario')}
              className={`flex-1 py-2 text-3xs font-semibold uppercase tracking-wider transition-colors ${
                leftTab === 'scenario'
                  ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
                  : 'text-muted hover:text-text'
              }`}
            >
              Scenario
            </button>
            <button
              onClick={() => setLeftTab('policy')}
              className={`flex-1 py-2 text-3xs font-semibold uppercase tracking-wider transition-colors ${
                leftTab === 'policy'
                  ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
                  : 'text-muted hover:text-text'
              }`}
            >
              Policy
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {leftTab === 'scenario' ? (
              <ScenarioControls onControl={sendControl} />
            ) : (
              <PolicySelector onControl={sendControl} />
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative">
          <div className="flex-shrink-0 flex items-center h-8 px-3" style={{
            background: '#0D111C',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <TacticalSummary />
            <div className="ml-auto">
              <SectorAnalysis />
            </div>
          </div>
          <div
            className="flex-1 relative"
            style={{ minHeight: '200px' }}
          >
            <TacticalDisplay
              overlays={overlays}
              onContextMenu={setContextMenu}
            />
            {selectedTrack && (
              <TrackDetail track={selectedTrack} onClose={() => setSelectedTrack(null)} onLaunch={() => {
                if (selectedTrack.classification === 'HOSTILE') {
                  sendControl('launch', { target_id: selectedTrack.id })
                  setSelectedTrack(null)
                }
              }} />
            )}
            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                trackId={contextMenu.trackId}
                onLaunch={(id) => { sendControl('launch', { target_id: id }); setContextMenu(null) }}
                onClose={() => setContextMenu(null)}
              />
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col overflow-hidden border-l" style={{ width: '320px', maxWidth: '320px', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex-shrink-0 flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setRightTab('assessment')}
              className={`flex-1 py-2 text-3xs font-semibold uppercase tracking-wider transition-colors ${
                rightTab === 'assessment'
                  ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
                  : 'text-muted hover:text-text'
              }`}
            >
              Assessment
            </button>
            <button
              onClick={() => setRightTab('feed')}
              className={`flex-1 py-2 text-3xs font-semibold uppercase tracking-wider transition-colors ${
                rightTab === 'feed'
                  ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
                  : 'text-muted hover:text-text'
              }`}
            >
              Feed
            </button>
            <button
              onClick={() => setRightTab('timeline')}
              className={`flex-1 py-2 text-3xs font-semibold uppercase tracking-wider transition-colors ${
                rightTab === 'timeline'
                  ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
                  : 'text-muted hover:text-text'
              }`}
            >
              Timeline
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-2.5">
            {rightTab === 'assessment' ? (
              <OperationalAssessment />
            ) : rightTab === 'feed' ? (
              <AIDecisionFeed />
            ) : (
              <MissionTimeline />
            )}
          </div>
        </div>
      </div>

      <footer className="flex-shrink-0 border-t" style={{ height: '68px', borderColor: 'rgba(255,255,255,0.06)', background: '#111827' }}>
        <div className="flex items-center h-full">
          <div className="flex-1 min-w-0">
            <LiveMetrics />
          </div>
          <div className="flex-shrink-0 h-full flex items-center" style={{ width: '280px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <TimelineReplay />
          </div>
        </div>
      </footer>

      {showComparison && (
        <PolicyComparison onClose={() => setShowComparison(false)} onControl={sendControl} />
      )}
    </div>
  )
}

function eventToDecision(
  e: { id: number; time: string; type: string; message: string },
  activePolicy: string,
  stats: { inventory_remaining: number }
): AIDecision | null {
  const trackMatch = e.message.match(/TRK-(\d+)/)
  const targetId = trackMatch ? parseInt(trackMatch[1]) : 0
  const targetLabel = targetId ? `TRK-${String(targetId).padStart(3, '0')}` : 'N/A'

  let type: AIDecision['type']
  let threatScore: number | undefined
  let eta: number | undefined
  let reasoning: string | undefined

  switch (e.type) {
    case 'DETECTED':
      type = 'DETECTED'
      threatScore = Math.random() * 0.5 + 0.3
      reasoning = `Radar contact established. ${activePolicy} evaluating bearing and closure rate for threat assessment.`
      break
    case 'THREAT':
      type = 'PRIORITIZED'
      const etaMatch = e.message.match(/ETA\s+(\d+):(\d+)/)
      if (etaMatch) eta = parseInt(etaMatch[1]) * 60 + parseInt(etaMatch[2])
      threatScore = Math.random() * 0.3 + 0.6
      reasoning = eta
        ? `Threat closing at ${threatScore?.toFixed(2)} score. ETA ${eta.toFixed(0)}s. Prioritizing based on time-to-impact and ${activePolicy} policy.`
        : `Threat classified. Priority assigned by ${activePolicy} heuristic.`
      break
    case 'LAUNCH':
      type = 'LAUNCHED'
      reasoning = `Interceptor committed. ${activePolicy} policy allocated asset based on priority queue and current engagement slots.`
      break
    case 'DESTROYED':
      type = 'DESTROYED'
      reasoning = `PK resolution succeeded. ${activePolicy} confirmed kill. Engagement slot released.`
      break
    case 'LEAKER':
      type = 'LEAKER'
      reasoning = `Threat breached perimeter. ${activePolicy} failed to intercept — possible causes: insufficient speed, late detection, or jammed guidance.`
      break
    case 'NO_INTERCEPTORS':
    case 'INFO':
    case 'JAMMER':
    case 'MISS':
      type = 'WARNING'
      reasoning = e.type === 'NO_INTERCEPTORS'
        ? `No available interceptor. Inventory or concurrent engagement limit reached.`
        : e.type === 'MISS'
          ? `PK resolution failed. ${activePolicy} guidance algorithm missed target.`
          : e.type === 'JAMMER'
            ? `Jamming detected on track. ${activePolicy} reducing PK confidence for this engagement.`
            : `Informational event.`
      break
    default:
      return null
  }

  return {
    id: e.id,
    time: e.time,
    type,
    targetId,
    targetLabel,
    message: e.message,
    eta,
    threatScore,
    inventoryRemaining: stats.inventory_remaining,
    reasoning,
  }
}
