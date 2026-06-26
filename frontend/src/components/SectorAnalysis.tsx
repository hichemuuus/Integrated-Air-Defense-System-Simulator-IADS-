import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useSimStore } from '../store/simulationStore'

const SECTOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const SECTOR_ANGLE = 360 / SECTOR_LABELS.length

function getSector(bearingDeg: number): number {
  const idx = Math.floor(((bearingDeg + SECTOR_ANGLE / 2) % 360) / SECTOR_ANGLE)
  return idx
}

function getRiskLevel(count: number, hasJammers: boolean): { label: string; color: string; priority: number } {
  if (count === 0) return { label: 'CLEAR', color: '#4ADE80', priority: 0 }
  if (hasJammers) return { label: 'HIGH RISK', color: '#FF5A5A', priority: 3 }
  if (count >= 3) return { label: 'HIGH RISK', color: '#FF5A5A', priority: 3 }
  if (count >= 2) return { label: 'ELEVATED', color: '#FFB547', priority: 2 }
  return { label: 'LOW RISK', color: '#FFC857', priority: 1 }
}

interface SectorData {
  label: string
  count: number
  color: string
  priority: number
  displayLabel: string
}

const BADGE_BASE_WIDTH = 80
const BADGE_GAP = 4

export default function SectorAnalysis() {
  const tracks = useSimStore(s => s.tracks)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(8)

  const sectors = useMemo(() => {
    const hostileTracks = tracks.filter(t => t.classification === 'HOSTILE' && t.visible)
    const counts = new Array(SECTOR_LABELS.length).fill(0)
    const hasJammer = new Array(SECTOR_LABELS.length).fill(false)

    for (const t of hostileTracks) {
      const bearing = (Math.atan2(t.y, t.x) * 180 / Math.PI + 360) % 360
      const idx = getSector(bearing)
      counts[idx]++
      if (t.trackType === 'JAMMER') hasJammer[idx] = true
    }

    return SECTOR_LABELS.map((label, i) => ({
      label,
      count: counts[i],
      color: getRiskLevel(counts[i], hasJammer[i]).color,
      priority: getRiskLevel(counts[i], hasJammer[i]).priority,
      displayLabel: getRiskLevel(counts[i], hasJammer[i]).label,
    })).filter(s => s.count > 0)
      .sort((a, b) => b.priority - a.priority || b.count - a.count)
  }, [tracks])

  const measureWidth = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth - 16
    const available = Math.max(1, Math.floor(containerWidth / (BADGE_BASE_WIDTH + BADGE_GAP)))
    setVisibleCount(available)
  }, [])

  useEffect(() => {
    measureWidth()
    const observer = new ResizeObserver(measureWidth)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('resize', measureWidth)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureWidth)
    }
  }, [measureWidth, sectors.length])

  if (sectors.length === 0) return null

  const visible = sectors.slice(0, visibleCount)
  const remaining = sectors.length - visible.length

  return (
    <div ref={containerRef} className="overflow-hidden">
      <div className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1.5">Sector Analysis</div>
      <div className="flex flex-nowrap gap-1 overflow-hidden" style={{ minHeight: 0 }}>
        {visible.map(s => (
          <div
            key={s.label}
            className="flex-shrink-0"
            style={{
              border: `1px solid ${s.color}20`,
              background: `${s.color}06`,
              borderRadius: '2px',
              padding: '3px 5px',
              minWidth: '72px',
            }}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-3xs font-semibold text-text tracking-wider">
                SECTOR {s.label}
              </span>
              <span className="text-3xs font-bold font-mono tabular-nums" style={{ color: s.color }}>
                {s.count}
              </span>
            </div>
            <div className="text-3xs font-medium mt-0.5" style={{ color: s.color, letterSpacing: '0.02em' }}>
              {s.displayLabel}
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '2px',
              padding: '3px 6px',
              minWidth: '56px',
            }}
          >
            <span className="text-3xs font-bold text-muted font-mono whitespace-nowrap">
              +{remaining} more
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
