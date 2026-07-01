import { useEffect, useRef, useState } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { SimulationState } from '../store/simulationStore'
import type { EventEntry } from '../types'
import type { OperationalEvent, OperationalEventType, EventSeverity } from './types'

function convertEvent(
  entry: EventEntry,
  simTime: number,
): OperationalEvent | null {
  const lowerMsg = entry.message.toLowerCase()
  const trackMatch = entry.message.match(/TRK-(\d+)/i)
  const targetId = trackMatch ? `TRK-${trackMatch[1].padStart(3, '0')}` : null

  let type: OperationalEventType
  let severity: EventSeverity
  let source: string

  switch (entry.type) {
    case 'DETECTED':
      type = 'threat_detected'
      severity = 'medium'
      source = lowerMsg.includes('jam') ? 'Radar (Jamming detected)' : 'Radar'
      break
    case 'THREAT':
      type = 'threat_classified'
      severity = 'high'
      source = 'Classification System'
      break
    case 'LAUNCH':
      type = 'missile_launched'
      severity = 'high'
      source = lowerMsg.includes('battery') || lowerMsg.includes('assign') ? 'Battery Control' : 'Launcher'
      break
    case 'DESTROYED':
      type = 'missile_intercepted_target'
      severity = 'info'
      source = 'Weapon System'
      break
    case 'LEAKER':
      type = 'threat_escaped'
      severity = 'critical'
      source = 'Perimeter Monitor'
      break
    case 'MISS':
      type = 'intercept_failed'
      severity = 'high'
      source = 'Guidance System'
      break
    case 'NO_INTERCEPTORS':
      type = 'inventory_warning'
      severity = 'critical'
      source = 'Inventory Manager'
      break
    case 'JAMMER':
      type = 'threat_detected'
      severity = 'high'
      source = 'Radar (Jamming)'
      break
    case 'INFO':
      if (lowerMsg.includes('radar') || lowerMsg.includes('sweep')) {
        type = 'radar_activated'
        severity = 'low'
        source = 'Radar'
      } else if (lowerMsg.includes('battery') || lowerMsg.includes('assign')) {
        type = 'battery_assigned'
        severity = 'medium'
        source = 'Battery Control'
      } else {
        return null
      }
      break
    default:
      return null
  }

  return {
    id: entry.id,
    timestamp: Date.now(),
    simulationTime: simTime,
    type,
    severity,
    source,
    target: targetId,
    description: entry.message,
  }
}

function createStateEvent(
  state: SimulationState,
  simTime: number,
  eventId: number,
): OperationalEvent | null {
  switch (state) {
    case 'running':
      return {
        id: eventId,
        timestamp: Date.now(),
        simulationTime: simTime,
        type: 'simulation_resumed',
        severity: 'info',
        source: 'Simulation Engine',
        target: null,
        description: 'Simulation resumed.',
      }
    case 'paused':
      return {
        id: eventId,
        timestamp: Date.now(),
        simulationTime: simTime,
        type: 'simulation_paused',
        severity: 'info',
        source: 'Simulation Engine',
        target: null,
        description: 'Simulation paused.',
      }
    default:
      return null
  }
}

export function useOperationalEvents(): OperationalEvent[] {
  const events = useSimStore(s => s.events)
  const simTime = useSimStore(s => s.simTime)
  const simulationState = useSimStore(s => s.simulationState)

  const eventsRef = useRef<OperationalEvent[]>([])
  const processedCountRef = useRef(0)
  const prevSimStateRef = useRef<SimulationState>('idle')
  const initialRunRecordedRef = useRef(false)
  const [version, setVersion] = useState(0)
  const idCounterRef = useRef(0)

  useEffect(() => {
    let changed = false

    if (simulationState === 'idle' && events.length === 0 && eventsRef.current.length > 0) {
      eventsRef.current = []
      processedCountRef.current = 0
      prevSimStateRef.current = 'idle'
      initialRunRecordedRef.current = false
      idCounterRef.current = 0
      setVersion(v => v + 1)
      return
    }

    if (simulationState === 'running' && !initialRunRecordedRef.current) {
      initialRunRecordedRef.current = true
      idCounterRef.current += 1
      const startedEvent: OperationalEvent = {
        id: idCounterRef.current,
        timestamp: Date.now(),
        simulationTime: simTime,
        type: 'simulation_started',
        severity: 'info',
        source: 'Simulation Engine',
        target: null,
        description: 'Simulation started.',
      }
      eventsRef.current = [...eventsRef.current, startedEvent]
      changed = true
    }

    if (prevSimStateRef.current !== simulationState) {
      if (prevSimStateRef.current !== 'idle' || simulationState !== 'running') {
        if (simulationState === 'finished') {
          idCounterRef.current += 1
          const endedEvent: OperationalEvent = {
            id: idCounterRef.current,
            timestamp: Date.now(),
            simulationTime: simTime,
            type: 'simulation_ended',
            severity: 'info',
            source: 'Simulation Engine',
            target: null,
            description: 'Simulation ended.',
          }
          eventsRef.current = [...eventsRef.current, endedEvent]
          changed = true
        } else {
          idCounterRef.current += 1
          const stateEvent = createStateEvent(simulationState, simTime, idCounterRef.current)
          if (stateEvent) {
            eventsRef.current = [...eventsRef.current, stateEvent]
            changed = true
          }
        }
      }
      prevSimStateRef.current = simulationState
    }

    if (events.length > processedCountRef.current) {
      for (let i = processedCountRef.current; i < events.length; i++) {
        idCounterRef.current += 1
        const converted = convertEvent(events[i], simTime)
        if (converted) {
          eventsRef.current = [...eventsRef.current, converted]
          changed = true
        }
      }
      processedCountRef.current = events.length
    }

    if (changed) {
      setVersion(v => v + 1)
    }
  }, [events, simulationState, simTime])

  return eventsRef.current
}
