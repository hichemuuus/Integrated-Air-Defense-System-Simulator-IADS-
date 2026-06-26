import { useRef, useEffect, useMemo } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { AIDecision } from '../types'

function getEntryStyle(d: AIDecision): { color: string; bg: string; prefix: string; isCritical: boolean } {
  switch (d.type) {
    case 'LEAKER':
    case 'WARNING':
      return { color: '#FF5A5A', bg: 'rgba(255,90,90,0.08)', prefix: 'WARN', isCritical: true }
    case 'DESTROYED':
      return { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', prefix: 'KILL', isCritical: false }
    case 'LAUNCHED':
      return { color: '#FFB547', bg: 'rgba(255,181,71,0.04)', prefix: 'ASGN', isCritical: false }
    default:
      return { color: '#8892A6', bg: 'transparent', prefix: 'INFO', isCritical: false }
  }
}

function DecisionRow({ d, sub }: { d: AIDecision; sub?: boolean }) {
  const s = getEntryStyle(d)
  const isWarn = s.prefix === 'WARN'

  return (
    <div
      className="font-mono"
      style={{
        display: 'grid',
        gridTemplateColumns: '4.5rem 4rem 1fr',
        gap: '0.25rem',
        alignItems: 'start',
        padding: '0.35rem 0.5rem',
        paddingLeft: sub ? '1rem' : '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        background: s.bg,
        animation: isWarn ? 'threatPulse 1.5s ease-in-out infinite' : undefined,
      }}
    >
      <span className="text-dim text-3xs tabular-nums leading-snug">{d.time}</span>
      <span
        className="text-3xs font-bold uppercase tracking-wider leading-snug"
        style={{ color: s.color }}
      >
        [{s.prefix}]
      </span>
      <span className="text-xs leading-snug" style={{ color: s.color }}>
        {d.message}
      </span>
    </div>
  )
}

export default function AIDecisionFeed() {
  const aiDecisions = useSimStore(s => s.aiDecisions)
  const events = useSimStore(s => s.events)
  const stats = useSimStore(s => s.stats)
  const activePolicy = useSimStore(s => s.activePolicy)
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    if (aiDecisions.length > prevLen.current && listRef.current) {
      listRef.current.scrollTop = 0
    }
    prevLen.current = aiDecisions.length
  }, [aiDecisions.length])

  const recent = aiDecisions.slice(0, 80)
  const fallbackEvents = [...events].reverse().slice(0, 20)
  const hasDecisions = recent.length > 0

  // split into critical alerts and everything else
  const criticalAlerts = useMemo(() =>
    recent.filter(d => d.type === 'LEAKER' || d.type === 'WARNING'),
    [recent]
  )

  const otherDecisions = useMemo(() =>
    recent.filter(d => d.type !== 'LEAKER' && d.type !== 'WARNING'),
    [recent]
  )

  // group non-critical decisions by track
  const trackGroups = useMemo(() => {
    const map = new Map<number, AIDecision[]>()
    for (const d of otherDecisions) {
      if (d.targetId === 0) continue
      const list = map.get(d.targetId) ?? []
      list.push(d)
      map.set(d.targetId, list)
    }
    // sort groups by most recent decision
    return [...map.entries()]
      .sort((a, b) => (b[1][0]?.id ?? 0) - (a[1][0]?.id ?? 0))
      .map(([trackId, decisions]) => ({
        trackId,
        label: `T-${trackId}`,
        decisions,
      }))
  }, [otherDecisions])

  const ungrouped = otherDecisions.filter(d => d.targetId === 0)

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0 flex items-center justify-between mb-1 pb-1.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-3xs font-semibold tracking-wider text-muted uppercase">AI Decision Feed</span>
        <span className="text-3xs text-white/40 font-mono">{activePolicy}</span>
      </div>

      {stats.inventory_remaining <= 0 && (
        <div
          className="flex-shrink-0 mb-1 px-2.5 py-1 text-3xs font-bold uppercase tracking-wider font-mono"
          style={{
            background: 'rgba(255,90,90,0.12)',
            color: '#FF5A5A',
            border: '1px solid rgba(255,90,90,0.25)',
          }}
        >
          [WARN] INVENTORY EXHAUSTED
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto custom-scroll">
        {!hasDecisions && fallbackEvents.length === 0 ? (
          <div className="text-muted text-3xs text-center py-8">— AWAITING CONTACT —</div>
        ) : hasDecisions ? (
          <div>
            {/* Critical Alerts section */}
            {criticalAlerts.length > 0 && (
              <div className="mb-2">
                <div className="text-3xs text-dim uppercase tracking-wider font-semibold mb-0.5 px-1.5">
                  CRITICAL ALERTS
                </div>
                {criticalAlerts.map(d => (
                  <DecisionRow key={d.id} d={d} />
                ))}
              </div>
            )}

            {/* Kill Confirmations section */}
            {otherDecisions.filter(d => d.type === 'DESTROYED').length > 0 && (
              <div className="mb-2">
                <div className="text-3xs text-dim uppercase tracking-wider font-semibold mb-0.5 px-1.5">
                  KILL CONFIRMATIONS
                </div>
                {otherDecisions
                  .filter(d => d.type === 'DESTROYED')
                  .map(d => (
                    <DecisionRow key={d.id} d={d} />
                  ))}
              </div>
            )}

            {/* Track-grouped engagements */}
            {trackGroups.length > 0 && (
              <div className="mb-0.5 px-1.5 text-3xs text-dim uppercase tracking-wider font-semibold">
                ENGAGEMENTS
              </div>
            )}
            {trackGroups.map(g => (
              <div key={g.trackId}>
                <div
                  className="flex items-center gap-2 px-2 py-1"
                  style={{
                    background: 'rgba(61,220,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-3xs font-bold font-mono" style={{ color: '#3DDCFF' }}>
                    {g.label}
                  </span>
                  <span className="text-3xs text-dim">({g.decisions.length})</span>
                </div>
                {g.decisions.map(d => (
                  <DecisionRow key={d.id} d={d} sub />
                ))}
              </div>
            ))}

            {/* Ungrouped */}
            {ungrouped.length > 0 && (
              <>
                <div className="mt-1 mb-0.5 px-1.5 text-3xs text-dim uppercase tracking-wider font-semibold">
                  OTHER
                </div>
                {ungrouped.map(d => (
                  <DecisionRow key={d.id} d={d} />
                ))}
              </>
            )}
          </div>
        ) : (
          fallbackEvents.map(e => {
            const typeLower = e.type.toLowerCase()
            let mappedPrefix = 'INFO'
            let mappedColor = '#8892A6'
            let mappedBg = 'transparent'
            let isCritical = false
            if (typeLower === 'leaker') {
              mappedPrefix = 'WARN'; mappedColor = '#FF5A5A'; mappedBg = 'rgba(255,90,90,0.08)'; isCritical = true
            } else if (typeLower === 'destroyed') {
              mappedPrefix = 'KILL'; mappedColor = '#4ADE80'; mappedBg = 'rgba(74,222,128,0.08)'
            } else if (typeLower === 'launch') {
              mappedPrefix = 'ASGN'; mappedColor = '#FFB547'; mappedBg = 'rgba(255,181,71,0.04)'
            } else if (typeLower === 'threat') {
              mappedPrefix = 'WARN'; mappedColor = '#FF5A5A'; mappedBg = 'rgba(255,90,90,0.08)'; isCritical = true
            } else if (typeLower === 'miss' || typeLower === 'no_interceptors') {
              mappedPrefix = 'WARN'; mappedColor = '#FF5A5A'; mappedBg = 'rgba(255,90,90,0.08)'; isCritical = true
            }

            return (
              <div
                key={e.id}
                className="font-mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '4.5rem 4rem 1fr',
                  gap: '0.25rem',
                  alignItems: 'start',
                  padding: '0.35rem 0.5rem',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: mappedBg,
                  animation: isCritical ? 'threatPulse 1.5s ease-in-out infinite' : undefined,
                }}
              >
                <span className="text-dim text-3xs tabular-nums">{e.time}</span>
                <span className="text-3xs font-bold uppercase tracking-wider" style={{ color: mappedColor }}>
                  [{mappedPrefix}]
                </span>
                <span className="text-xs" style={{ color: mappedColor }}>
                  {e.message}
                </span>
              </div>
            )
          })
        )}
      </div>

      <div
        className="flex-shrink-0 mt-1.5 pt-1.5 flex items-center justify-between text-3xs text-dim font-mono"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span>Policy: <span className="text-blue font-semibold">{activePolicy}</span></span>
        <span>Kills: {stats.kills} | Inv: {stats.inventory_remaining}</span>
      </div>
    </div>
  )
}
