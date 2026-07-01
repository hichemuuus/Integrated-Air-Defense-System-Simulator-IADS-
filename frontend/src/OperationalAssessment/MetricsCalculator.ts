import { useSimStore } from '../store/simulationStore'
import type { OperationalEvent, MissionMetrics } from './types'

export function calculateMetrics(
  events: OperationalEvent[],
): MissionMetrics {
  const store = useSimStore.getState()
  const stats = store.stats
  const simTime = store.simTime
  const simulationState = store.simulationState

  const threatsDetected = events.filter(e => e.type === 'threat_detected').length
  const threatsNeutralized = events.filter(e => e.type === 'missile_intercepted_target').length
  const threatsEscaped = events.filter(e => e.type === 'threat_escaped').length
  const missilesFired = events.filter(e => e.type === 'missile_launched').length

  const totalEngaged = threatsNeutralized + threatsEscaped + stats.misses
  const interceptionRate = totalEngaged > 0
    ? (threatsNeutralized / totalEngaged) * 100
    : stats.kills > 0 ? 100 : 0

  const reactionTimes: number[] = []
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === 'missile_launched' && events[i].target) {
      const targetId = events[i].target
      const detectionEvent = events.slice(0, i).reverse().find(
        e => (e.type === 'threat_detected' || e.type === 'threat_classified') && e.target === targetId
      )
      if (detectionEvent) {
        reactionTimes.push(events[i].simulationTime - detectionEvent.simulationTime)
      }
    }
  }
  const averageReactionTime = reactionTimes.length > 0
    ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
    : store.responseTime

  const missionStatus = simulationState === 'idle'
    ? 'idle' as const
    : simulationState === 'running'
      ? 'running' as const
      : simulationState === 'paused'
        ? 'paused' as const
        : 'finished' as const

  const missionScore = threatsNeutralized * 10 - threatsEscaped * 50 - stats.misses * 5

  const startEvent = events.find(e => e.type === 'simulation_started')
  const missionDuration = startEvent
    ? simTime - startEvent.simulationTime
    : simTime

  const fired = missilesFired || stats.launched
  const totalInventory = fired + stats.inventory_remaining
  const batteryUtilization = totalInventory > 0
    ? (fired / totalInventory) * 100
    : 0

  const radarAvailability = threatsDetected > 0 || events.filter(e => e.type === 'radar_activated').length > 0
    ? Math.min(100, 85 + events.filter(e => e.type === 'radar_activated').length * 5)
    : 0

  return {
    missionStatus,
    missionDuration,
    missionScore,
    threatsDetected,
    threatsNeutralized,
    threatsEscaped,
    missilesFired: fired,
    missilesRemaining: stats.inventory_remaining,
    interceptionRate,
    averageReactionTime,
    batteryUtilization,
    radarAvailability,
    totalEventsRecorded: events.length,
  }
}
