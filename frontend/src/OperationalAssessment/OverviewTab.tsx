import { useMemo } from 'react'
import type { MissionMetrics } from './types'
import { calculateMetrics } from './MetricsCalculator'
import { useOperationalEvents } from './EventRecorder'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface MetricCardProps {
  label: string
  value: string
  color?: string
  sublabel?: string
}

function MetricCard({ label, value, color, sublabel }: MetricCardProps) {
  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '1px',
        padding: '8px 10px',
      }}
    >
      <div
        className="text-3xs font-semibold tracking-wider uppercase"
        style={{ color: '#8892A6', marginBottom: '4px' }}
      >
        {label}
      </div>
      <div
        className="font-mono text-sm font-bold tabular-nums leading-tight"
        style={{ color: color ?? '#E2E8F0' }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-3xs" style={{ color: '#6B7280', marginTop: '2px' }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: MissionMetrics['missionStatus'] }) {
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    idle: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'IDLE' },
    running: { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', label: 'RUNNING' },
    paused: { color: '#FFB547', bg: 'rgba(255,181,71,0.12)', label: 'PAUSED' },
    finished: { color: '#3DDCFF', bg: 'rgba(61,220,255,0.12)', label: 'FINISHED' },
  }
  const cfg = statusConfig[status]
  return (
    <span
      className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}30`,
        borderRadius: '1px',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {cfg.label}
    </span>
  )
}

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

export default function OverviewTab() {
  const operationalEvents = useOperationalEvents()

  const metrics = useMemo(() => calculateMetrics(operationalEvents), [operationalEvents])

  const scoreColor = metrics.missionScore >= 0 ? '#4ADE80' : '#FF5A5A'
  const rateColor = metrics.interceptionRate > 70 ? '#4ADE80' : metrics.interceptionRate > 40 ? '#FFB547' : '#FF5A5A'

  if (metrics.missionStatus === 'idle' && metrics.totalEventsRecorded === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col h-full" style={{ gap: '6px' }}>
      {/* Mission header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: '#0D111C',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '1px',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-3xs font-semibold uppercase tracking-wider" style={{ color: '#8892A6' }}>
            Mission
          </span>
          <StatusBadge status={metrics.missionStatus} />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-sm font-bold tabular-nums" style={{ color: '#3B82F6' }}>
              {formatTime(metrics.missionDuration)}
            </div>
            <div className="text-3xs uppercase tracking-wider" style={{ color: '#6B7280' }}>
              Duration
            </div>
          </div>
        </div>
      </div>

      {/* Score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'rgba(17,24,39,0.6)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '1px',
        }}
      >
        <span className="text-3xs font-semibold uppercase tracking-wider" style={{ color: '#8892A6' }}>
          Mission Score
        </span>
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color: scoreColor }}
        >
          {metrics.missionScore.toFixed(0)}
        </span>
      </div>

      {/* Metric grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          flex: 1,
          alignContent: 'start',
        }}
      >
        <MetricCard label="Detected" value={String(metrics.threatsDetected)} color="#3DDCFF" />
        <MetricCard
          label="Neutralized"
          value={String(metrics.threatsNeutralized)}
          color="#4ADE80"
        />
        {metrics.threatsEscaped > 0 ? (
          <MetricCard
            label="Escaped"
            value={String(metrics.threatsEscaped)}
            color="#FF5A5A"
            sublabel="CRITICAL"
          />
        ) : (
          <MetricCard label="Escaped" value="0" color="#6B7280" />
        )}
        <MetricCard
          label="Interception Rate"
          value={`${metrics.interceptionRate.toFixed(0)}%`}
          color={rateColor}
        />

        <MetricCard label="Missiles Fired" value={String(metrics.missilesFired)} color="#FFB547" />
        <MetricCard
          label="Remaining"
          value={String(metrics.missilesRemaining)}
          color={metrics.missilesRemaining <= 5 ? '#FF5A5A' : '#FFB547'}
        />
        <MetricCard
          label="Avg Reaction"
          value={`${metrics.averageReactionTime.toFixed(1)}s`}
          color="#3B82F6"
        />
        <MetricCard
          label="Battery Util"
          value={`${metrics.batteryUtilization.toFixed(0)}%`}
          color={metrics.batteryUtilization > 80 ? '#FFB547' : '#8892A6'}
        />
        <MetricCard
          label="Radar Availability"
          value={`${metrics.radarAvailability.toFixed(0)}%`}
          color={metrics.radarAvailability > 80 ? '#4ADE80' : '#FFB547'}
        />
        <MetricCard
          label="Events Recorded"
          value={String(metrics.totalEventsRecorded)}
          color="#6B7280"
        />
      </div>
    </div>
  )
}
