/* TrajectoryRenderer
 * Responsibility: Render trajectory Line objects inside the Canvas.
 * Data flow:
 *   TrajectoryManager owns mesh lifecycle. This component syncs
 *   the active trajectory list into the R3F scene graph on an
 *   interval.
 * Performance:
 *   - Polls every 250ms for added/removed trajectories.
 *   - Mesh geometry is updated imperatively in TrajectoryManager.
 *   - Primitive objects are stable in the React tree.
 */

import { useState, useEffect } from 'react'
import { getTrajectoryMeshes } from './TrajectoryManager'

function TrajectoryRenderer() {
  const [meshes, setMeshes] = useState(getTrajectoryMeshes())

  useEffect(() => {
    const interval = setInterval(() => setMeshes(getTrajectoryMeshes()), 250)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={`traj-${i}`} object={m} />
      ))}
    </>
  )
}

export default TrajectoryRenderer
