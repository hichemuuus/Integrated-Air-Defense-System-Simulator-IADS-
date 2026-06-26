import { useEffect, useRef, useCallback } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { PolicyId } from '../types'

const WS_URL = 'ws://127.0.0.1:8000/ws/compare'

export function useComparisonBackend() {
  const wsRef = useRef<WebSocket | null>(null)
  const getState = useSimStore.getState

  const send = useCallback((action: string, payload?: any) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, payload: payload ?? {} }))
    }
  }, [])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      const s = getState()
      ws.send(JSON.stringify({
        action: 'init',
        payload: {
          policyA: s.comparison.policyA,
          policyB: s.comparison.policyB,
          scenario: s.scenario,
        },
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'init_done' || data.type === 'reset_done') {
          ws.send(JSON.stringify({ action: 'resume' }))
          return
        }

        if (data.type === 'snapshot') {
          const s = getState()
          s.setComparisonTimeA(data.snapshotA.simTime)
          s.setComparisonTimeB(data.snapshotB.simTime)
          s.setComparisonStatsA(data.snapshotA.stats)
          s.setComparisonStatsB(data.snapshotB.stats)
          s.setComparisonRunningA(true)
          s.setComparisonRunningB(true)

          const scoreA = data.snapshotA.stats.kills * 10 - data.snapshotA.stats.leakers * 50
          const scoreB = data.snapshotB.stats.kills * 10 - data.snapshotB.stats.leakers * 50
          s.setComparison({ scoreA, scoreB })
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    ws.onerror = () => {
      ws.close()
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'pause' }))
        ws.close()
      }
      wsRef.current = null
    }
  }, [getState])

  const restart = useCallback(() => {
    const s = getState()
    send('reset', {
      policyA: s.comparison.policyA,
      policyB: s.comparison.policyB,
      scenario: s.scenario,
    })
  }, [send, getState])

  const setPolicy = useCallback((which: 'A' | 'B', policyName: PolicyId) => {
    send('set_policy', { which, policy_name: policyName })
  }, [send])

  return { restart, setPolicy }
}
