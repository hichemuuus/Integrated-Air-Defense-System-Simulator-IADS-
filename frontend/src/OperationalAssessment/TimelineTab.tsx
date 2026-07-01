import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { OperationalEvent, EventFilterCategory, EventSeverity } from './types'
import { useOperationalEvents } from './EventRecorder'

const FILTERS: { key: EventFilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'threats', label: 'Threats' },
  { key: 'radar', label: 'Radar' },
  { key: 'missiles', label: 'Missiles' },
  { key: 'batteries', label: 'Batteries' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'system', label: 'System' },
]

const EVENT_TYPE_FILTER: Record<EventFilterCategory, string[]> = {
  all: [],
  threats: ['threat_detected', 'threat_classified', 'threat_enters_coverage', 'threat_leaves_coverage', 'threat_escaped'],
  radar: ['radar_activated', 'radar_lost_contact'],
  missiles: ['missile_launched', 'missile_intercepted_target', 'intercept_failed'],
  batteries: ['battery_assigned'],
  warnings: ['inventory_warning', 'intercept_failed'],
  system: ['simulation_started', 'simulation_paused', 'simulation_resumed', 'simulation_ended'],
}

const SEVERITY_CONFIG: Record<EventSeverity, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)', label: 'CRIT' },
  high: { color: '#FFB547', bg: 'rgba(255,181,71,0.1)', label: 'HIGH' },
  medium: { color: '#3DDCFF', bg: 'rgba(61,220,255,0.08)', label: 'MED' },
  low: { color: '#6B7280', bg: 'rgba(107,114,128,0.06)', label: 'LOW' },
  info: { color: '#4A5568', bg: 'transparent', label: 'INFO' },
}

const TYPE_LABELS: Record<string, string> = {
  threat_detected: 'DETECTED',
  threat_classified: 'CLASSIFIED',
  threat_enters_coverage: 'IN RANGE',
  threat_leaves_coverage: 'OUT RANGE',
  battery_assigned: 'ASSIGNED',
  missile_launched: 'LAUNCHED',
  missile_intercepted_target: 'DESTROYED',
  intercept_failed: 'MISS',
  threat_escaped: 'ESCAPED',
  radar_activated: 'RADAR ON',
  radar_lost_contact: 'RADAR LOST',
  inventory_warning: 'WARNING',
  simulation_started: 'START',
  simulation_paused: 'PAUSE',
  simulation_resumed: 'RESUME',
  simulation_ended: 'END',
}

function formatSimTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface EventRowProps {
  event: OperationalEvent
}

const EventRow = ({ event }: EventRowProps) => {
  const sev = SEVERITY_CONFIG[event.severity]
  const typeLabel = TYPE_LABELS[event.type] ?? event.type

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '3.5rem 4.5rem 1fr',
        gap: '4px',
        padding: '3px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.025)',
        background: event.severity === 'critical' ? 'rgba(255,90,90,0.04)' : undefined,
        alignItems: 'start',
      }}
    >
      <span
        className="font-mono text-3xs tabular-nums"
        style={{ color: '#6B7280', paddingTop: '1px' }}
      >
        {formatSimTime(event.simulationTime)}
      </span>
      <span
        className="font-mono text-3xs font-bold uppercase tracking-wider px-1 py-[1px] rounded-sm"
        style={{
          color: sev.color,
          background: sev.bg,
          textAlign: 'center',
          fontSize: '9px',
          lineHeight: '1.4',
        }}
      >
        {sev.label}
      </span>
      <div style={{ minWidth: 0 }}>
        <span
          className="font-mono text-3xs"
          style={{
            color: event.severity === 'critical' || event.severity === 'high' ? '#E2E8F0' : '#8892A6',
            lineHeight: '1.4',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.severity === 'critical' && (
            <span style={{ color: '#FF5A5A', marginRight: '2px' }}>!! </span>
          )}
          {typeLabel}
          {event.target && (
            <span style={{ color: '#3DDCFF' }}> {event.target}</span>
          )}
          <span style={{ color: '#4A5568' }}> — {event.source}</span>
        </span>
      </div>
    </div>
  )
}

const ROW_HEIGHT = 22
const OVERSCAN = 10

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center" style={{ padding: '40px 20px' }}>
    <div
      className="text-3xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: '#6B7280' }}
    >
      No mission data available
    </div>
    <div className="text-3xs text-center" style={{ color: '#4A5568', maxWidth: '220px' }}>
      Start a simulation to begin collecting operational events.
    </div>
  </div>
)

export default function TimelineTab() {
  const operationalEvents = useOperationalEvents()
  const [filter, setFilter] = useState<EventFilterCategory>('all')
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  const filteredEvents = useMemo(() => {
    let result = operationalEvents

    const types = EVENT_TYPE_FILTER[filter]
    if (types.length > 0) {
      result = result.filter(e => types.includes(e.type))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        e =>
          e.description.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q) ||
          (e.target && e.target.toLowerCase().includes(q)) ||
          e.type.toLowerCase().includes(q)
      )
    }

    return result.slice().reverse()
  }, [operationalEvents, filter, search])

  const totalHeight = filteredEvents.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    filteredEvents.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  )
  const visibleEvents = filteredEvents.slice(startIndex, endIndex)

  const hasData = operationalEvents.length > 0

  if (!hasData) {
    return (
      <div className="flex flex-col h-full">
        <FilterBar filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} />
        <div className="flex-1 overflow-hidden">
          <EmptyState />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <FilterBar filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scroll"
        style={{ position: 'relative' }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: startIndex * ROW_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            {visibleEvents.map((event) => (
              <div key={event.id} style={{ height: ROW_HEIGHT }}>
                <EventRow event={event} />
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex-shrink-0 mt-1 pt-1 text-3xs font-mono text-right px-2"
          style={{ color: '#4A5568', borderTop: '1px solid rgba(255,255,255,0.03)' }}
        >
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` (filtered)`}
        </div>
      </div>
    </div>
  )
}

interface FilterBarProps {
  filter: EventFilterCategory
  onFilterChange: (f: EventFilterCategory) => void
  search: string
  onSearchChange: (s: string) => void
}

function FilterBar({ filter, onFilterChange, search, onSearchChange }: FilterBarProps) {
  return (
    <div className="flex-shrink-0" style={{ paddingBottom: '4px' }}>
      {/* Filter chips */}
      <div
        className="flex gap-1 overflow-x-auto custom-scroll"
        style={{
          paddingBottom: '4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className="text-3xs font-semibold uppercase tracking-wider"
            style={{
              padding: '2px 6px',
              border: '1px solid',
              borderColor: filter === f.key ? 'rgba(61,220,255,0.3)' : 'rgba(255,255,255,0.06)',
              borderRadius: '1px',
              background: filter === f.key ? 'rgba(61,220,255,0.08)' : 'transparent',
              color: filter === f.key ? '#3DDCFF' : '#6B7280',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: "'JetBrains Mono', monospace",
              flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search events..."
          className="font-mono text-3xs"
          style={{
            width: '100%',
            padding: '3px 6px',
            background: '#0D111C',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '1px',
            color: '#E2E8F0',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '2px',
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
