export type OperationalEventType =
  | 'threat_detected'
  | 'threat_classified'
  | 'threat_enters_coverage'
  | 'threat_leaves_coverage'
  | 'battery_assigned'
  | 'missile_launched'
  | 'missile_intercepted_target'
  | 'intercept_failed'
  | 'threat_escaped'
  | 'radar_activated'
  | 'radar_lost_contact'
  | 'inventory_warning'
  | 'simulation_started'
  | 'simulation_paused'
  | 'simulation_resumed'
  | 'simulation_ended'

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface OperationalEvent {
  id: number
  timestamp: number
  simulationTime: number
  type: OperationalEventType
  severity: EventSeverity
  source: string
  target: string | null
  description: string
}

export interface MissionMetrics {
  missionStatus: 'idle' | 'running' | 'paused' | 'finished'
  missionDuration: number
  missionScore: number
  threatsDetected: number
  threatsNeutralized: number
  threatsEscaped: number
  missilesFired: number
  missilesRemaining: number
  interceptionRate: number
  averageReactionTime: number
  batteryUtilization: number
  radarAvailability: number
  totalEventsRecorded: number
}

export type EventFilterCategory = 'all' | 'threats' | 'radar' | 'missiles' | 'batteries' | 'warnings' | 'system'
