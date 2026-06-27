/* FrameStats
 * Responsibility: Provide lightweight FPS tracking for the HUD
 *   overlay. EntityManager increments the counter each frame.
 *   A timer reads and resets it once per second.
 * Performance: Minimal — single integer increment per frame.
 */

let _frameCount = 0
let _fps = 0
let _entityCount = 0
let _interceptorCount = 0

export function incrementFrameCount(): void {
  _frameCount++
}

export function sampleFps(): void {
  _fps = _frameCount
  _frameCount = 0
}

export function getFps(): number {
  return _fps
}

export function setEntityStats(aircraft: number, interceptors: number): void {
  _entityCount = aircraft
  _interceptorCount = interceptors
}

export function getEntityCount(): number {
  return _entityCount
}

export function getInterceptorCount(): number {
  return _interceptorCount
}
