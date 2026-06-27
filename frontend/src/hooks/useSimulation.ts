import { useEffect, useRef, useCallback } from 'react'
import { useSimStore, DEFAULT_SCENARIO } from '../store/simulationStore'
import { createInitialTracks, createInitialInterceptors, stepSimulation, INITIAL_RADAR_SITES, resetMockState } from '../data/mockSimulation'

const WS_URL = 'ws://127.0.0.1:8000/ws/sim'
const MAX_DT = 0.5

export function useSimulation() {
  const applySnapshot = useSimStore(s => s.applySnapshot)
  const setMode = useSimStore(s => s.setMode)
  const storeState = useSimStore(s => s.simulationState)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)
  const mockModeRef = useRef(false)
  const lastTimeRef = useRef(0)
  const frameRef = useRef(0)
  const runningRef = useRef(true)

  runningRef.current = storeState === 'running'

  const mockStateRef = useRef<{
    tracks: any[]; interceptors: any[]; explosions: any[]; missMarkers: any[]; radarSites: any[]; threats: any[]; events: any[]; destroyedGhosts: any[]; simTime: number; stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
  }>({
    tracks: createInitialTracks().tracks,
    interceptors: createInitialInterceptors(),
    explosions: [], missMarkers: [], radarSites: INITIAL_RADAR_SITES, threats: [], events: [], destroyedGhosts: [], simTime: 0, stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: DEFAULT_SCENARIO.inventorySize },
  })
  const appliedSeedRef = useRef<number | null>(null)
  const appliedHostilesRef = useRef<number | null>(null)
  const appliedFriendliesRef = useRef<number | null>(null)
  const snapTimerRef = useRef(0)

  const pushSnapshot = useCallback((state: typeof mockStateRef.current) => {
    function compactTrack(t: any) {
      return {
        id: t.id, x: t.x, y: t.y, vx: t.vx, vy: t.vy,
        heading: t.heading, speed: t.speed, altitude: t.altitude,
        classification: t.classification, trackType: t.trackType,
        visible: t.visible, displayX: t.displayX, displayY: t.displayY,
        history: t.history ? t.history.slice(-10) : [],
        targetId: t.targetId,
        jammed: t.jammed, groupId: t.groupId,
        offset_x: t.offset_x, offset_y: t.offset_y,
        assetRole: t.assetRole,
        engagementRange: t.engagementRange,
        defendedRadius: t.defendedRadius,
      }
    }
    function compactGhost(g: any) {
      return {
        id: g.id, trackId: g.trackId, interceptorId: g.interceptorId,
        x: g.x, y: g.y, displayX: g.displayX, displayY: g.displayY,
        vx: g.vx, vy: g.vy,
        history: g.history ? g.history.slice(-10) : [],
        interceptorX: g.interceptorX, interceptorY: g.interceptorY,
        life: g.life, maxLife: g.maxLife,
      }
    }
    useSimStore.getState().pushTimelineSnapshot({
      simTime: state.simTime,
      tracks: (state.tracks as any[]).map(compactTrack) as any,
      interceptors: (state.interceptors as any[]).map(compactTrack) as any,
      explosions: [],
      missMarkers: [],
      radarSites: (state.radarSites as any[]).map((s: any) => ({ id: s.id, x: s.x, y: s.y, sweepAngle: s.sweepAngle })),
      threats: (state.threats as any[]).map((t: any) => ({
        trackId: t.trackId, eta: t.eta, firstSeen: t.firstSeen,
        threatScore: t.threatScore, approachingHva: t.approachingHva,
      })),
      events: (state.events as any[]).slice(-30),
      destroyedGhosts: (state.destroyedGhosts as any[]).map(compactGhost),
      stats: { ...state.stats },
    })
  }, [])

  const syncMockToStore = useCallback((state: typeof mockStateRef.current) => {
    if (useSimStore.getState().timelineReplay) return
    applySnapshot({
      simTime: state.simTime,
      tracks: state.tracks as any,
      interceptors: state.interceptors as any,
      explosions: state.explosions as any,
      missMarkers: state.missMarkers as any,
      radarSites: state.radarSites as any,
      threats: state.threats as any,
      events: state.events as any,
      destroyedGhosts: state.destroyedGhosts as any,
      simulationState: runningRef.current ? 'running' : (state.simTime > 0 ? 'paused' : 'idle'),
      stats: state.stats,
    })
    snapTimerRef.current += 1
    if (snapTimerRef.current >= 30) {
      snapTimerRef.current = 0
      pushSnapshot(state)
    }
  }, [applySnapshot, pushSnapshot])

  const sendControl = useCallback((action: string, payload: any = {}) => {
    console.log('[useSimulation] sendControl:', action, 'payload:', JSON.stringify(payload))

    // Fire-and-forget to WebSocket (if connected). Always handle locally.
    const wsConnected = wsRef.current?.readyState === WebSocket.OPEN
    if (wsConnected) {
      const scenario = useSimStore.getState().scenario
      const effectivePayload = (action === 'reset' || action === 'run' || action === 'resume' || action === 'configure')
        ? { ...payload, scenario }
        : payload
      wsRef.current!.send(JSON.stringify({ action, payload: effectivePayload }))
    }

    // === LOCAL (STANDALONE) HANDLING ===
    // In live mode, backend is the single authority for simulation state.
    if (!wsConnected) {
      if (action === 'speed') {
        useSimStore.getState().setSpeed(payload.speed ?? 1)
      } else if (action === 'run') {
        const scenario = useSimStore.getState().scenario
        resetMockState()
        useSimStore.getState().clearTimeline()
        mockStateRef.current = {
          tracks: createInitialTracks(scenario).tracks,
          interceptors: createInitialInterceptors(scenario),
          explosions: [], missMarkers: [], radarSites: INITIAL_RADAR_SITES, threats: [], events: [], destroyedGhosts: [], simTime: 0, stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: scenario.inventorySize ?? 30 },
        }
        appliedSeedRef.current = scenario.randomSeed
        appliedHostilesRef.current = scenario.numHostiles
        appliedFriendliesRef.current = scenario.numFriendlies
        useSimStore.getState().setSimulationState('running')
        runningRef.current = true
        syncMockToStore(mockStateRef.current)
      } else if (action === 'pause') {
        useSimStore.getState().setSimulationState('paused')
        runningRef.current = false
        syncMockToStore(mockStateRef.current)
      } else if (action === 'resume' || action === 'play') {
        useSimStore.getState().setTimelineReplay(false)
        const scenario = useSimStore.getState().scenario
        const seedChanged = appliedSeedRef.current !== null && appliedSeedRef.current !== scenario.randomSeed
        const hostilesChanged = appliedHostilesRef.current !== null && appliedHostilesRef.current !== scenario.numHostiles
        const friendliesChanged = appliedFriendliesRef.current !== null && appliedFriendliesRef.current !== scenario.numFriendlies
        if (seedChanged || hostilesChanged || friendliesChanged) {
          mockStateRef.current = {
            tracks: createInitialTracks(scenario).tracks,
            interceptors: createInitialInterceptors(scenario),
            explosions: [], missMarkers: [], radarSites: INITIAL_RADAR_SITES, threats: [], events: [], destroyedGhosts: [], simTime: 0, stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: scenario.inventorySize ?? 30 },
          }
        }
        appliedSeedRef.current = scenario.randomSeed
        appliedHostilesRef.current = scenario.numHostiles
        appliedFriendliesRef.current = scenario.numFriendlies
        useSimStore.getState().setSimulationState('running')
        runningRef.current = true
        syncMockToStore(mockStateRef.current)
      } else if (action === 'step') {
        const scenario = useSimStore.getState().scenario
        const state = mockStateRef.current
        const result = stepSimulation(state.tracks, state.interceptors, state.explosions, state.missMarkers, state.radarSites, state.threats, state.events, state.destroyedGhosts, 0.05, scenario)
        mockStateRef.current = {
          tracks: result.tracks, interceptors: result.interceptors, explosions: result.explosions,
          missMarkers: result.missMarkers, radarSites: result.radarSites, threats: result.threats,
          destroyedGhosts: result.destroyedGhosts,
          events: result.events, simTime: state.simTime + 0.05, stats: result.stats,
        }
        syncMockToStore(mockStateRef.current)
      } else if (action === 'reset') {
        const scenario = useSimStore.getState().scenario
        resetMockState()
        useSimStore.getState().clearTimeline()
        mockStateRef.current = {
          tracks: createInitialTracks(scenario).tracks,
          interceptors: createInitialInterceptors(scenario),
          explosions: [], missMarkers: [], radarSites: INITIAL_RADAR_SITES, threats: [], events: [], destroyedGhosts: [], simTime: 0, stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: scenario.inventorySize ?? 30 },
        }
        appliedSeedRef.current = scenario.randomSeed
        appliedHostilesRef.current = scenario.numHostiles
        appliedFriendliesRef.current = scenario.numFriendlies
        useSimStore.getState().setSimulationState('idle')
        runningRef.current = false
        syncMockToStore(mockStateRef.current)
      }
    }
  }, [syncMockToStore])

  const runLoop = useCallback((time: number) => {
    const wsOpen = wsRef.current?.readyState === WebSocket.OPEN
    const liveMode = !mockModeRef.current && wsOpen

    if (!liveMode) {
      if (runningRef.current) {
        if (lastTimeRef.current === 0) lastTimeRef.current = time
        const rawDt = Math.min((time - lastTimeRef.current) / 1000, 0.05)
        const dt = Math.min(rawDt * useSimStore.getState().speed, MAX_DT)
        lastTimeRef.current = time
        const state = mockStateRef.current
        const scenario = useSimStore.getState().scenario
        const result = stepSimulation(state.tracks, state.interceptors, state.explosions, state.missMarkers, state.radarSites, state.threats, state.events, state.destroyedGhosts, dt, scenario)
        mockStateRef.current = {
          tracks: result.tracks, interceptors: result.interceptors, explosions: result.explosions,
          missMarkers: result.missMarkers, radarSites: result.radarSites, threats: result.threats,
          destroyedGhosts: result.destroyedGhosts,
          events: result.events, simTime: state.simTime + dt, stats: result.stats,
        }
      }
      syncMockToStore(mockStateRef.current)
    }
    // Always schedule next frame — keeps loop alive so it resumes when live mode ends
    frameRef.current = requestAnimationFrame(runLoop)
  }, [syncMockToStore])

  const startMock = useCallback(() => {
    if (mockModeRef.current) return
    mockModeRef.current = true
    setMode('standalone')

    const scenario = useSimStore.getState().scenario
    mockStateRef.current = {
      tracks: createInitialTracks(scenario).tracks,
      interceptors: createInitialInterceptors(scenario),
      explosions: [], missMarkers: [], radarSites: INITIAL_RADAR_SITES, threats: [], events: [], destroyedGhosts: [], simTime: 0, stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: scenario.inventorySize ?? 30 },
    }
    appliedSeedRef.current = scenario.randomSeed
    appliedHostilesRef.current = scenario.numHostiles
    appliedFriendliesRef.current = scenario.numFriendlies
  }, [setMode])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    performance.mark('ws:connect')
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        performance.mark('ws:open')
        mockModeRef.current = false
        reconnectRef.current = 0
      }
      ws.onmessage = (event) => {
        performance.mark('ws:first_message')
        try {
          const data = JSON.parse(event.data)
          if (!mockModeRef.current) {
              applySnapshot({
                simTime: data.simTime ?? 0,
                tracks: data.tracks ?? [],
                interceptors: data.interceptors ?? [],
                explosions: data.explosions ?? [],
                missMarkers: data.missMarkers ?? [],
                radarSites: data.radarSites ?? [],
                threats: (data.threats ?? []).map((t: any) => ({
                  trackId: t.track_id,
                  eta: t.eta,
                  firstSeen: t.firstSeen ?? t.first_seen ?? Date.now(),
                })),
                events: data.events ?? [],
                simulationState: data.running ? 'running' : 'paused',
                speed: data.speed ?? useSimStore.getState().speed,
                stats: data.stats ?? { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: DEFAULT_SCENARIO.inventorySize },
              })
            setMode('live')
          }
        } catch { }
      }
      ws.onclose = () => {
        wsRef.current = null
        if (!mockModeRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 10000)
          reconnectRef.current++
          setTimeout(connect, delay)
        }
      }
      ws.onerror = () => { ws.close() }
    } catch { startMock() }
  }, [applySnapshot, setMode, startMock])

  useEffect(() => {
    setMode('connecting')
    connect()
    // Start the local animation loop immediately (safe; guard checks WS)
    lastTimeRef.current = 0
    frameRef.current = requestAnimationFrame(runLoop)
    const fallbackTimer = setTimeout(() => {
      if (!mockModeRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        performance.mark('ws:fallback_mock')
        startMock()
      }
    }, 3000)
    return () => {
      clearTimeout(fallbackTimer)
      mockModeRef.current = false
      cancelAnimationFrame(frameRef.current)
      wsRef.current?.close()
    }
  }, [connect, startMock, setMode, runLoop])

  return { sendControl, isMock: mockModeRef.current }
}
