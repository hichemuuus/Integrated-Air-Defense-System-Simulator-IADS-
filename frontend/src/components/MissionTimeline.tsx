import { useRef, useEffect } from 'react'
import { useSimStore } from '../store/simulationStore'

const EVENT_COLORS: Record<string, string> = {
  DETECTED: '#FFB547',
  PRIORITIZED: '#3B82F6',
  LAUNCHED: '#4ADE80',
  DESTROYED: '#FF5A5A',
  LEAKER: '#FFC857',
  WARNING: '#FFC857',
  THREAT: '#FF5A5A',
  LAUNCH: '#4ADE80',
  INFO: '#6B7280',
  JAMMER: '#A855F7',
  MISS: '#FFC857',
  NO_INTERCEPTORS: '#FFC857',
}

const EVENT_LABELS: Record<string, string> = {
  DETECTED: 'DETECT',
  PRIORITIZED: 'PRIORITIZE',
  LAUNCHED: 'LAUNCH',
  DESTROYED: 'DESTROY',
  LEAKER: 'LEAKER',
  WARNING: 'WARNING',
  THREAT: 'ALERT',
  LAUNCH: 'LAUNCH',
  INFO: 'INFO',
  JAMMER: 'JAMMER',
  MISS: 'MISS',
  NO_INTERCEPTORS: 'NO INT',
}

export default function MissionTimeline() {
  const events = useSimStore(s => s.events)
  const aiDecisions = useSimStore(s => s.aiDecisions)
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    if (events.length > prevLen.current && listRef.current) {
      listRef.current.scrollTop = 0
    }
    prevLen.current = events.length
  }, [events.length])

  const combined = [
    ...aiDecisions.slice(0, 80).map(d => ({
      time: d.time,
      type: d.type,
      label: EVENT_LABELS[d.type] || d.type,
      color: EVENT_COLORS[d.type] || '#6B7280',
      message: d.message,
      isDecision: true,
    })),
    ...events.slice(0, 40).map(e => ({
      time: e.time,
      type: e.type,
      label: EVENT_LABELS[e.type] || e.type,
      color: EVENT_COLORS[e.type] || '#6B7280',
      message: e.message,
      isDecision: false,
    })),
  ].sort((a, b) => {
    const timeA = a.time.replace(':', '')
    const timeB = b.time.replace(':', '')
    return timeB.localeCompare(timeA)
  }).slice(0, 100)

  if (combined.length === 0) return null

  return (
    <div className="flex flex-col h-full">
      <div className="text-3xs font-semibold uppercase tracking-wider text-muted mb-2 flex-shrink-0">Mission Timeline</div>
      <div ref={listRef} className="flex-1 overflow-y-auto custom-scroll">
        <div className="relative">
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '0',
            bottom: '0',
            width: '1px',
            background: 'rgba(255,255,255,0.04)',
          }} />
          {combined.map((item, i) => (
            <div
              key={`${item.time}-${item.type}-${i}`}
              className="flex items-start gap-2 py-[3px]"
            >
              <span className="text-3xs text-dim font-mono tabular-nums" style={{
                minWidth: '3.5rem',
                textAlign: 'right',
                paddingTop: '2px',
              }}>
                {item.time}
              </span>
              <div style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: item.color,
                marginTop: '4px',
                flexShrink: 0,
              }} />
              <div className="flex-1 min-w-0">
                <span className="text-3xs font-semibold tracking-wider" style={{ color: item.color }}>
                  {item.label}
                </span>
                <span className="text-3xs text-muted ml-1 opacity-70">
                  {item.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
