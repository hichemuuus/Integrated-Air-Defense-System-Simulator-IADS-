import { useRef, useCallback, useEffect } from 'react'
import { useSimStore } from '../store/simulationStore'

export default function TimelineReplay() {
  const snapshots = useSimStore(s => s.timelineSnapshots)
  const timelineReplay = useSimStore(s => s.timelineReplay)
  const timelinePosition = useSimStore(s => s.timelinePosition)
  const tracks = useSimStore(s => s.tracks)
  const setTimelineReplay = useSimStore(s => s.setTimelineReplay)
  const setTimelinePosition = useSimStore(s => s.setTimelinePosition)
  const restoreTimelineSnapshot = useSimStore(s => s.restoreTimelineSnapshot)
  const barRef = useRef<HTMLDivElement>(null)

  const count = snapshots.length
  const hasHistory = count >= 2

  // auto-reveal scrubber only when ALL hostiles are destroyed/leaked
  const hostilesRemaining = tracks.filter(t => t.classification === 'HOSTILE').length
  const simEnded = hostilesRemaining === 0

  useEffect(() => {
    if (simEnded && hasHistory && !timelineReplay) {
      setTimelineReplay(true)
    }
  }, [simEnded, hasHistory, timelineReplay, setTimelineReplay])

  const totalTime = hasHistory ? snapshots[count - 1].simTime : 0

  const seek = useCallback((clientX: number) => {
    if (!barRef.current || count < 2) return
    const rect = barRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const idx = Math.round(frac * (count - 1))
    restoreTimelineSnapshot(idx)
  }, [count, restoreTimelineSnapshot])

  const handleDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    seek(e.clientX)
  }, [seek])

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return
    seek(e.clientX)
  }, [seek])

  const toggleReplay = () => {
    const next = !timelineReplay
    setTimelineReplay(next)
    if (next && hasHistory) {
      restoreTimelineSnapshot(0)
    }
  }

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const currentTime = hasHistory ? snapshots[Math.min(timelinePosition, count - 1)]?.simTime ?? 0 : 0
  const frac = hasHistory ? timelinePosition / (count - 1) : 0

  const showScrubber = timelineReplay && hasHistory

  return (
    <div className="flex items-center gap-2 w-full px-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* toggle button */}
      <button
        onClick={toggleReplay}
        className="flex-shrink-0 text-3xs font-bold uppercase tracking-wider transition-colors"
        style={{
          color: timelineReplay ? '#3DDCFF' : '#6B7280',
          border: '1px solid',
          borderColor: timelineReplay ? 'rgba(61,220,255,0.25)' : 'rgba(255,255,255,0.08)',
          borderRadius: '1px',
          padding: '2px 6px',
          background: timelineReplay ? 'rgba(61,220,255,0.06)' : 'transparent',
        }}
        title={timelineReplay ? 'Exit Replay' : 'Review Timeline'}
      >
        {timelineReplay ? '◼ LIVE' : 'AAR'}
      </button>

      {showScrubber && (
        <>
          <span className="text-3xs text-dim tabular-nums flex-shrink-0 w-10 text-right">
            {formatTime(currentTime)}
          </span>

          {/* thin tactical bar */}
          <div
            ref={barRef}
            className="flex-1 relative cursor-pointer"
            style={{ height: '16px' }}
            onMouseDown={handleDown}
            onMouseMove={handleDrag}
          >
            {/* track */}
            <div
              className="absolute top-1/2 -translate-y-1/2 left-0 w-full pointer-events-none"
              style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}
            />
            {/* fill */}
            <div
              className="absolute top-1/2 -translate-y-1/2 left-0 pointer-events-none transition-none"
              style={{ height: '4px', width: `${frac * 100}%`, background: 'rgba(61,220,255,0.2)', borderRadius: '1px' }}
            />
            {/* rectangular handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-none"
              style={{
                left: `calc(${frac * 100}% - 5px)`,
                width: '10px',
                height: '14px',
                background: '#3DDCFF',
                borderRadius: '1px',
                boxShadow: '0 0 6px rgba(61,220,255,0.3)',
              }}
            />
          </div>

          <span className="text-3xs text-dim tabular-nums flex-shrink-0 w-10">
            {formatTime(totalTime)}
          </span>

          {/* snapshot counter */}
          <span className="text-3xs text-dim flex-shrink-0" style={{ opacity: 0.4 }}>
            {count}
          </span>
        </>
      )}

      {!showScrubber && hasHistory && (
        <span className="text-3xs text-dim flex-shrink-0">
          {count} snapshots
        </span>
      )}
    </div>
  )
}
