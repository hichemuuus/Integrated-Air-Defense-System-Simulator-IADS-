import { useState, useMemo, useRef } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { Track } from '../types'
import type { TrackFilter } from '../App'

function trackColor(track: Track): string {
  if (track.trackType === 'JAMMER') return '#C744FF'
  const colors: Record<string, string> = {
    HOSTILE: '#FF4444',
    FRIENDLY: '#6E7B8A',
    INTERCEPTOR: '#FF8C00',
  }
  return colors[track.classification] ?? '#6E7B8A'
}

function trackBadge(track: Track): string {
  if (track.trackType === 'JAMMER') return 'JAM'
  const badges: Record<string, string> = {
    HOSTILE: 'HST',
    FRIENDLY: 'FRN',
    INTERCEPTOR: 'INT',
  }
  return badges[track.classification] ?? '???'
}

const FILTER_OPTIONS: { key: TrackFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOSTILE', label: 'Hst' },
  { key: 'FRIENDLY', label: 'Frn' },
  { key: 'INTERCEPTOR', label: 'Int' },
]

interface Props {
  filter: TrackFilter
  onFilterChange: (f: TrackFilter) => void
}

function TrackRow({ track }: { track: Track }) {
  const isInter = track.classification === 'INTERCEPTOR'
  const prefix = isInter ? 'INT' : 'TRK'
  const color = trackColor(track)
  const badge = trackBadge(track)
  const selectedTrackId = useSimStore(s => s.selectedTrackId)
  const setSelectedTrack = useSimStore(s => s.setSelectedTrack)
  const isSelected = selectedTrackId === track.id

  return (
    <div
      className="track-row group cursor-pointer hover:bg-white/[0.02]"
      style={{ borderLeft: isSelected ? '2px solid #00FFAA' : '2px solid transparent', paddingLeft: isSelected ? 'calc(0.25rem - 2px)' : '0.25rem' }}
      onClick={() => setSelectedTrack(track.id)}
    >
      <span
        className="inline-flex items-center justify-center w-5 h-3.5 text-2xs font-bold rounded-sm flex-shrink-0"
        style={{ background: `${color}15`, color }}
      >
        {badge}
      </span>
      <span className="text-text font-medium text-2xs flex-shrink-0" style={{ minWidth: '4.5rem' }}>
        {prefix}-{String(track.id).padStart(3, '0')}
      </span>
      <span className="text-muted text-2xs flex-shrink-0 tabular-nums text-right" style={{ minWidth: '2.5rem' }}>
        {track.altitude.toFixed(0)}
      </span>
      <span className="text-muted text-2xs flex-shrink-0 tabular-nums text-right" style={{ minWidth: '2rem' }}>
        {track.speed.toFixed(0)}
      </span>
      {isInter && track.targetId != null && (
        <span className="text-dim text-2xs ml-auto truncate">T{String(track.targetId).padStart(3, '0')}</span>
      )}
      {!track.visible && (
        <span className="text-dim text-2xs ml-auto">LOST</span>
      )}
      {track.jammed && (
        <span className="text-2xs font-bold ml-1" style={{ color: '#C744FF' }}>JAM</span>
      )}
    </div>
  )
}

function FilterBar({ filter, onChange, altMin, altMax, onAltChange }: {
  filter: TrackFilter
  onChange: (f: TrackFilter) => void
  altMin: string
  altMax: string
  onAltChange: (min: string, max: string) => void
}) {
  return (
    <div className="space-y-1 mb-1">
      <div className="flex gap-0.5">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`px-1.5 py-0.5 text-2xs rounded-sm transition-colors tracking-wider uppercase ${
              filter === opt.key
                ? 'bg-white/[0.06] text-text border border-borderLight'
                : 'text-dim border border-transparent hover:text-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-2xs text-muted">
        <span>ALT</span>
        <input
          type="number"
          value={altMin}
          onChange={e => onAltChange(e.target.value, altMax)}
          placeholder="min"
          className="w-10 bg-transparent border border-border rounded-sm px-1 py-0.5 text-2xs text-text tabular-nums"
        />
        <span className="text-dim">—</span>
        <input
          type="number"
          value={altMax}
          onChange={e => onAltChange(altMin, e.target.value)}
          placeholder="max"
          className="w-10 bg-transparent border border-border rounded-sm px-1 py-0.5 text-2xs text-text tabular-nums"
        />
        <span className="text-dim">m</span>
      </div>
    </div>
  )
}

export default function TrackList({ filter, onFilterChange }: Props) {
  const tracks = useSimStore(s => s.tracks)
  const interceptors = useSimStore(s => s.interceptors)
  const listRef = useRef<HTMLDivElement>(null)
  const [altMin, setAltMin] = useState('')
  const [altMax, setAltMax] = useState('')

  const filtered = useMemo(() => {
    let result = filter === 'ALL'
      ? [...tracks, ...interceptors]
      : filter === 'INTERCEPTOR'
      ? [...interceptors]
      : [...tracks.filter(t => t.classification === filter)]

    const min = altMin ? parseFloat(altMin) : -Infinity
    const max = altMax ? parseFloat(altMax) : Infinity
    if (isFinite(min) || isFinite(max)) {
      result = result.filter(t => t.altitude >= min && t.altitude <= max)
    }
    return result
  }, [tracks, interceptors, filter, altMin, altMax])

  return (
    <div className="panel rounded-sm p-2.5 flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between mb-1">
        <div className="panel-header border-none pb-0">Active Tracks</div>
        <span className="text-2xs text-dim">{filtered.length}</span>
      </div>

      <FilterBar
        filter={filter}
        onChange={onFilterChange}
        altMin={altMin}
        altMax={altMax}
        onAltChange={(min, max) => { setAltMin(min); setAltMax(max) }}
      />

      <div className="flex text-2xs text-dim tracking-wider pb-1 px-1 border-b border-border flex-shrink-0" style={{ letterSpacing: '0.05em' }}>
        <span className="flex-shrink-0" style={{ width: '1.25rem' }} />
        <span className="flex-shrink-0" style={{ width: '4.5rem' }}>ID</span>
        <span className="flex-shrink-0 text-right" style={{ width: '2.5rem' }}>ALT</span>
        <span className="flex-shrink-0 text-right" style={{ width: '2rem' }}>SPD</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto -mx-1">
        {filtered.length === 0 ? (
          <div className="text-muted text-2xs text-center py-6">— NO TRACKS —</div>
        ) : (
          filtered.map(t => <TrackRow key={t.id} track={t} />)
        )}
      </div>
    </div>
  )
}
