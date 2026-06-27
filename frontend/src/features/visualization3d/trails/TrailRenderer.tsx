/* TrailRenderer
 * Responsibility: Render trail Line objects inside the Canvas.
 *   TrailManager manages the geometry and mesh lifecycle.
 *   This component simply inserts those meshes into the R3F scene graph.
 * Data flow:
 *   TrailRenderer reads the current trail meshes from TrailManager
 *   and renders each one as a <primitive>. The geometry is updated
 *   imperatively by TrailManager.updateTrails() each frame.
 * Performance:
 *   - Primitive objects are not re-created, only re-rendered.
 *   - The component re-renders only when the mesh list changes
 *     (entity added/removed), not every frame.
 */

import { useState, useEffect } from 'react'
import { getTrailMeshes } from './TrailManager'

function TrailRenderer() {
  const [meshes, setMeshes] = useState(getTrailMeshes())

  useEffect(() => {
    const interval = setInterval(() => {
      setMeshes(getTrailMeshes())
    }, 200)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={`trail-${i}`} object={m} />
      ))}
    </>
  )
}

export default TrailRenderer
