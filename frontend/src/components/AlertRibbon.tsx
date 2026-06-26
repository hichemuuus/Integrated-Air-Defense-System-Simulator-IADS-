import { useState, useRef, useEffect, useMemo } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { AIDecision } from '../types'

interface AlertItem {
  id: number
  text: string
  priority: 'high' | 'medium' | 'low' | 'info'
  time: string
  color: string
  bg: string
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 }

function toAlert(d: AIDecision): AlertItem | null {
  if (d.type === 'LEAKER')
    return { id: d.id, text: d.message, priority: 'high', time: d.time, color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)' }
  if (d.type === 'WARNING')
    return { id: d.id, text: d.message, priority: 'high', time: d.time, color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)' }
  if (d.type === 'PRIORITIZED')
    return { id: d.id, text: d.message, priority: 'medium', time: d.time, color: '#FFB547', bg: 'rgba(255,181,71,0.08)' }
  if (d.type === 'DESTROYED')
    return { id: d.id, text: d.message, priority: 'low', time: d.time, color: '#4ADE80', bg: 'rgba(74,222,128,0.08)' }
  if (d.type === 'LAUNCHED')
    return { id: d.id, text: d.message, priority: 'low', time: d.time, color: '#FFB547', bg: 'rgba(255,181,71,0.04)' }
  if (d.type === 'DETECTED')
    return { id: d.id, text: d.message, priority: 'info', time: d.time, color: '#8892A6', bg: 'transparent' }
  return null
}

export default function AlertRibbon() {
  const aiDecisions = useSimStore(s => s.aiDecisions)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(0)

  const alerts = useMemo(() => {
    return aiDecisions
      .map(toAlert)
      .filter((a): a is AlertItem => a !== null)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, 50)
  }, [aiDecisions])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const containerWidth = el.offsetWidth
      let count = 0
      let totalWidth = 0
      for (let i = 0; i < alerts.length; i++) {
        const itemWidth = 180
        totalWidth += itemWidth + 6
        if (totalWidth > containerWidth - 100) break
        count++
      }
      setVisibleCount(count)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [alerts.length])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (alerts.length === 0) return null

  const visible = alerts.slice(0, visibleCount)
  const hidden = alerts.slice(visibleCount)

  if (visibleCount === 0 && alerts.length > 0) {
    return (
      <div
        ref={containerRef}
        className="flex-shrink-0 flex items-center gap-1 px-2"
        style={{
          height: '26px',
          background: 'rgba(255,90,90,0.06)',
          borderBottom: '1px solid rgba(255,90,90,0.1)',
          overflow: 'hidden',
        }}
      >
        <div className="relative" ref={overflowRef}>
          <button
            onClick={() => setOverflowOpen(v => !v)}
            className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 transition-colors"
            style={{
              color: '#FF5A5A',
              border: '1px solid rgba(255,90,90,0.2)',
              borderRadius: '1px',
              background: 'rgba(255,90,90,0.08)',
            }}
          >
            +{alerts.length} more
          </button>
          {overflowOpen && <OverflowDropdown alerts={alerts} onClose={() => setOverflowOpen(false)} />}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 flex items-center gap-1 px-2"
      style={{
        height: '26px',
        background: 'rgba(255,90,90,0.04)',
        borderBottom: '1px solid rgba(255,90,90,0.08)',
        overflow: 'hidden',
      }}
    >
      <span className="text-3xs font-bold uppercase tracking-wider text-dim mr-1">Alerts:</span>
      {visible.map(a => (
        <div
          key={a.id}
          className="flex-shrink-0 flex items-center gap-1 px-1.5"
          style={{
            background: a.bg,
            border: `1px solid ${a.color}33`,
            borderRadius: '1px',
            height: '18px',
            maxWidth: '180px',
            overflow: 'hidden',
          }}
          title={`[${a.priority.toUpperCase()}] ${a.text}`}
        >
          <span
            className="text-4xs font-bold uppercase tracking-wider flex-shrink-0"
            style={{ color: a.color, fontSize: '8px' }}
          >
            [{a.priority === 'high' ? '!' : a.priority === 'medium' ? '>' : '.'}]
          </span>
          <span
            className="text-4xs truncate"
            style={{ color: '#C8D0E0', fontSize: '8px', lineHeight: '18px' }}
          >
            {a.text}
          </span>
        </div>
      ))}
      {hidden.length > 0 && (
        <div className="relative" ref={overflowRef}>
          <button
            onClick={() => setOverflowOpen(v => !v)}
            className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 transition-colors"
            style={{
              color: '#FFB547',
              border: '1px solid rgba(255,181,71,0.2)',
              borderRadius: '1px',
              background: 'rgba(255,181,71,0.06)',
              fontSize: '8px',
            }}
          >
            +{hidden.length} more
          </button>
          {overflowOpen && <OverflowDropdown alerts={hidden} onClose={() => setOverflowOpen(false)} />}
        </div>
      )}
    </div>
  )
}

function OverflowDropdown({ alerts, onClose }: { alerts: AlertItem[]; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        zIndex: 100,
        background: '#1A1F2E',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '2px',
        minWidth: '280px',
        maxHeight: '300px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {alerts.map(a => (
        <div
          key={a.id}
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            background: a.bg,
          }}
        >
          <span
            className="text-3xs font-bold uppercase tracking-wider flex-shrink-0"
            style={{ color: a.color, minWidth: '32px' }}
          >
            [{a.priority === 'high' ? '!' : a.priority === 'medium' ? '>' : '.'}]
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-3xs text-dim">{a.time}</div>
            <div className="text-3xs" style={{ color: '#C8D0E0' }}>{a.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
