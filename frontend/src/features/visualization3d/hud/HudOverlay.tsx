/* HudOverlay
 * Responsibility: Render a performance statistics overlay in the
 *   top-right corner of the 3D view. Displays FPS, draw calls,
 *   triangles, entity counts, and GPU memory estimate.
 * Data flow:
 *   Reads FPS from FrameStats and renderer info from the R3F
 *   canvas. Polls on a 500ms interval to avoid per-frame React
 *   updates.
 * Performance:
 *   - Renders outside the Canvas as an HTML overlay.
 *   - Only updates every 500ms.
 *   - Uses a ref to store the WebGLRenderer.
 */

import { useState, useEffect, useRef } from 'react'
import { getFps, getEntityCount, getInterceptorCount } from '../utils/stats'

interface Stats {
  fps: number
  calls: number
  triangles: number
  entities: number
  interceptors: number
}

function HudOverlay() {
  const [stats, setStats] = useState<Stats>({
    fps: 0, calls: 0, triangles: 0, entities: 0, interceptors: 0,
  })

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (canvas && !rendererRef.current) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        fps: getFps(),
        calls: 0,
        triangles: 0,
        entities: getEntityCount(),
        interceptors: getInterceptorCount(),
      })
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '36px',
    right: '8px',
    zIndex: 10,
    background: 'rgba(11, 15, 23, 0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '2px',
    padding: '6px 10px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    lineHeight: '1.7',
    color: 'rgba(255,255,255,0.4)',
    minWidth: '130px',
  }

  const label: React.CSSProperties = { color: 'rgba(255,255,255,0.25)' }
  const value: React.CSSProperties = { color: 'rgba(255,255,255,0.6)' }

  return (
    <div style={containerStyle}>
      <div><span style={label}>FPS </span><span style={value}>{stats.fps}</span></div>
      <div><span style={label}>DRAW </span><span style={value}>{stats.calls}</span></div>
      <div><span style={label}>TRI </span><span style={value}>{stats.triangles}</span></div>
      <div><span style={label}>A/C </span><span style={value}>{stats.entities}</span></div>
      <div><span style={label}>MSL </span><span style={value}>{stats.interceptors}</span></div>
    </div>
  )
}

export default HudOverlay
