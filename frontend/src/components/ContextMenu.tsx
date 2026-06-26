import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/simulationStore'

interface Props {
  x: number
  y: number
  trackId: number
  onLaunch: (trackId: number) => void
  onClose: () => void
}

export default function ContextMenu({ x, y, trackId, onLaunch, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inventoryRemaining = useSimStore(s => s.stats.inventory_remaining)
  const canLaunch = inventoryRemaining > 0

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const menuX = Math.min(x, window.innerWidth - 180)
  const menuY = Math.min(y, window.innerHeight - 100)

  return (
    <div
      ref={ref}
      className="fixed z-50 animate-fadeIn"
      style={{
        left: menuX, top: menuY, minWidth: '160px',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '2px',
        padding: '4px 0',
      }}
    >
      <div className="text-3xs text-muted uppercase tracking-wider font-mono" style={{
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        TRK-{String(trackId).padStart(3, '0')}
      </div>
      <button
        className="text-3xs font-mono tracking-wider"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          color: canLaunch ? '#FF5A5A' : 'rgba(255,90,90,0.3)',
          background: 'transparent',
          border: 'none',
          cursor: canLaunch ? 'pointer' : 'default',
          opacity: canLaunch ? 1 : 0.45,
        }}
        disabled={!canLaunch}
        title={canLaunch ? `Launch interceptor at TRK-${String(trackId).padStart(3, '0')}` : 'No interceptors available'}
        onClick={(e) => { if (!canLaunch) return; e.stopPropagation(); onLaunch(trackId) }}
        onMouseEnter={e => { if (canLaunch) (e.target as HTMLElement).style.background = 'rgba(255,90,90,0.06)' }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
      >
        {canLaunch ? 'Launch Interceptor' : 'No Interceptors'}
      </button>
    </div>
  )
}
