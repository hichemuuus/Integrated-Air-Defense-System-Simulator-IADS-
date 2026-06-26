import { useRef, useEffect } from 'react'
import { useSimStore } from '../store/simulationStore'

const EVENT_STYLES: Record<string, { color: string; label: string }> = {
  THREAT: { color: '#FF4444', label: 'THRT' },
  LAUNCH: { color: '#6E7B8A', label: 'LNCH' },
  DESTROYED: { color: '#FF4444', label: 'DSTR' },
  DETECTED: { color: '#3D4A5A', label: 'DET' },
  JAMMER: { color: '#C744FF', label: 'JAM' },
  MISS: { color: '#CCCCCC', label: 'MISS' },
  NO_INTERCEPTORS: { color: '#FF8800', label: 'NOINT' },
  LEAKER: { color: '#FF2222', label: 'LEAK' },
  INFO: { color: '#3D4A5A', label: 'INFO' },
}

export default function EventFeed() {
  const events = useSimStore(s => s.events)
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    if (events.length > prevLen.current && listRef.current) {
      listRef.current.scrollTop = 0
    }
    prevLen.current = events.length
  }, [events.length])

  const recent = [...events].reverse().slice(0, 80)

  return (
    <div className="panel rounded-sm p-2.5 flex flex-col h-full">
      <div className="panel-header mb-1 flex-shrink-0">Event Feed</div>

      <div ref={listRef} className="flex-1 overflow-y-auto -mx-1 flex flex-col-reverse">
        <div>
          {recent.length === 0 ? (
            <div className="text-muted text-2xs text-center py-6">— NO EVENTS —</div>
          ) : (
            recent.map(e => {
              const style = EVENT_STYLES[e.type] || EVENT_STYLES.INFO
              return (
                <div key={e.id} className="event-entry flex items-start gap-1.5">
                  <span className="text-dim flex-shrink-0 text-2xs mt-0.5 tabular-nums">{e.time}</span>
                  <span
                    className="flex-shrink-0 text-2xs font-bold uppercase tracking-wider rounded-sm px-0.5"
                    style={{ color: style.color, background: `${style.color}10` }}
                  >
                    {style.label}
                  </span>
                  <span className="text-text text-2xs leading-tight">{e.message}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
