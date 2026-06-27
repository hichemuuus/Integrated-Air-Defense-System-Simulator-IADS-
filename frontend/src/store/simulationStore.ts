import { create } from 'zustand'
import type { Track, Explosion, MissMarker, ThreatAlert, EventEntry, RadarSite, ScenarioConfig, PolicyId, AIDecision, ComparisonState, DestroyedGhost } from '../types'

export interface TimelineSnapshot {
  simTime: number
  tracks: Track[]
  interceptors: Track[]
  explosions: Explosion[]
  missMarkers: MissMarker[]
  radarSites: RadarSite[]
  threats: ThreatAlert[]
  events: EventEntry[]
  destroyedGhosts: DestroyedGhost[]
  stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  actions?: { label: string; onClick: () => void }[]
  duration?: number
}

export type ConnectionMode = 'connecting' | 'live' | 'standalone'
export type SimulationState = 'idle' | 'running' | 'paused' | 'finished'

export const DEFAULT_SCENARIO: ScenarioConfig = {
  numHostiles: 8,
  numFriendlies: 3,
  inventorySize: 30,
  jammingIntensity: 0.2,
  swarmMode: true,
  threatSpeed: 1.0,
  randomSeed: 42,
}

export const POLICIES = [
  { id: 'PPO_800k' as PolicyId, name: 'PPO_800k', description: 'Proximal Policy Optimization — 800k step trained agent. Learned engagement policy via deep reinforcement learning.', avgScore: 847 },
  { id: 'Baseline' as PolicyId, name: 'Baseline', description: 'Greedy nearest-threat heuristic. Simple ETA-based prioritization without lookahead.', avgScore: 623 },
  { id: 'JamFirst' as PolicyId, name: 'JamFirst', description: 'Prioritizes jamming threats first, then standard hostiles. Designed for dense jamming environments.', avgScore: 712 },
  { id: 'UnjamFirst' as PolicyId, name: 'UnjamFirst', description: 'Delays jamming engagements to focus on standard threats. Maximizes kill count in mixed environments.', avgScore: 698 },
  { id: 'NeverLaunch' as PolicyId, name: 'NeverLaunch', description: 'DELIBERATELY POOR POLICY — never launches interceptors. Used to verify comparison system produces diverging metrics.', avgScore: 0 },
]

export interface SimStoreState {
  simTime: number
  tracks: Track[]
  interceptors: Track[]
  explosions: Explosion[]
  missMarkers: MissMarker[]
  radarSites: RadarSite[]
  threats: ThreatAlert[]
  events: EventEntry[]
  destroyedGhosts: DestroyedGhost[]
  simulationState: SimulationState
  speed: number
  mode: ConnectionMode
  stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
  selectedTrackId: number | null

  scenario: ScenarioConfig
  activePolicy: PolicyId
  aiDecisions: AIDecision[]
  comparison: ComparisonState
  responseTime: number

  comparisonStatsA: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
  comparisonStatsB: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
  comparisonTimeA: number
  comparisonTimeB: number
  comparisonRunningA: boolean
  comparisonRunningB: boolean

  timelineSnapshots: TimelineSnapshot[]
  timelineReplay: boolean
  timelinePosition: number

  toasts: Toast[]
  toastIdCounter: number
}

export interface SimStoreActions {
  applySnapshot: (data: Partial<SimStoreState>) => void
  setMode: (mode: ConnectionMode) => void
  setSimulationState: (state: SimulationState) => void
  setSpeed: (speed: number) => void
  setSelectedTrack: (id: number | null) => void
  reset: () => void
  setScenario: (config: Partial<ScenarioConfig>) => void
  setActivePolicy: (policy: PolicyId) => void
  addAIDecision: (decision: AIDecision) => void
  setComparison: (state: Partial<ComparisonState>) => void
  setResponseTime: (time: number) => void
  setComparisonStatsA: (stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }) => void
  setComparisonStatsB: (stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }) => void
  setComparisonTimeA: (t: number) => void
  setComparisonTimeB: (t: number) => void
  setComparisonRunningA: (r: boolean) => void
  setComparisonRunningB: (r: boolean) => void
  pushTimelineSnapshot: (snap: TimelineSnapshot) => void
  clearTimeline: () => void
  setTimelineReplay: (active: boolean) => void
  setTimelinePosition: (pos: number) => void
  restoreTimelineSnapshot: (index: number) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: number) => void
}

type SimStore = SimStoreState & SimStoreActions

const INITIAL: SimStoreState = {
  simTime: 0,
  tracks: [],
  interceptors: [],
  explosions: [],
  missMarkers: [],
  radarSites: [],
  threats: [],
  events: [],
  simulationState: 'idle',
  speed: 1,
  mode: 'connecting',
  stats: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: 30 },
  selectedTrackId: null,
  scenario: { ...DEFAULT_SCENARIO },
  activePolicy: 'PPO_800k',
  aiDecisions: [],
  comparison: {
    active: false,
    policyA: 'PPO_800k',
    policyB: 'Baseline',
    scoreA: 0,
    scoreB: 0,
    runningA: false,
    runningB: false,
    timeA: 0,
    timeB: 0,
    winner: null,
  },
  responseTime: 0,
  destroyedGhosts: [],
  comparisonStatsA: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: 30 },
  comparisonStatsB: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: 30 },
  comparisonTimeA: 0,
  comparisonTimeB: 0,
  comparisonRunningA: false,
  comparisonRunningB: false,
  timelineSnapshots: [],
  timelineReplay: false,
  timelinePosition: 0,
  toasts: [],
  toastIdCounter: 0,
}

export const useSimStore = create<SimStore>((set) => ({
  ...INITIAL,

  applySnapshot: (data: Partial<SimStoreState>) => {
    set((state) => ({
      ...state,
      ...data,
    }))
  },

  setMode: (mode: ConnectionMode) => set({ mode }),
  setSimulationState: (state: SimulationState) => set({ simulationState: state }),
  setSpeed: (speed: number) => set({ speed }),
  setSelectedTrack: (id: number | null) => set({ selectedTrackId: id }),

  reset: () => set({
    ...INITIAL,
    comparisonStatsA: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: 30 },
    comparisonStatsB: { kills: 0, misses: 0, launched: 0, leakers: 0, threats_engaged: [], inventory_remaining: 30 },
    comparisonTimeA: 0,
    comparisonTimeB: 0,
    comparisonRunningA: false,
    comparisonRunningB: false,
  }),

  setScenario: (config: Partial<ScenarioConfig>) => {
    console.log('[Store] setScenario called with:', JSON.stringify(config))
    set((state) => {
      const updated = { ...state.scenario, ...config }
      console.log('[Store] scenario after update:', JSON.stringify(updated))
      return { scenario: updated }
    })
  },

  setActivePolicy: (policy: PolicyId) => set({ activePolicy: policy }),

  addAIDecision: (decision: AIDecision) =>
    set((state) => ({
      aiDecisions: [decision, ...state.aiDecisions].slice(0, 100),
    })),

  setComparisonStatsA: (stats) => set({ comparisonStatsA: stats }),
  setComparisonStatsB: (stats) => set({ comparisonStatsB: stats }),
  setComparisonTimeA: (t) => set({ comparisonTimeA: t }),
  setComparisonTimeB: (t) => set({ comparisonTimeB: t }),
  setComparisonRunningA: (r) => set({ comparisonRunningA: r }),
  setComparisonRunningB: (r) => set({ comparisonRunningB: r }),

  setComparison: (state: Partial<ComparisonState>) =>
    set((prev) => ({ comparison: { ...prev.comparison, ...state } })),

  setResponseTime: (time: number) => set({ responseTime: time }),

  pushTimelineSnapshot: (snap: TimelineSnapshot) =>
    set((state) => {
      if (state.timelineReplay) return state
      const updated = [...state.timelineSnapshots, snap]
      if (updated.length > 600) updated.splice(0, updated.length - 600)
      return { timelineSnapshots: updated, timelinePosition: updated.length - 1 }
    }),

  clearTimeline: () => set({ timelineSnapshots: [], timelineReplay: false, timelinePosition: 0 }),

  setTimelineReplay: (active: boolean) => set({ timelineReplay: active }),

  setTimelinePosition: (pos: number) => set({ timelinePosition: pos }),

  restoreTimelineSnapshot: (index: number) =>
    set((state) => {
      const snap = state.timelineSnapshots[index]
      if (!snap) return state
      return {
        simTime: snap.simTime,
        tracks: snap.tracks,
        interceptors: snap.interceptors,
        explosions: snap.explosions,
        missMarkers: snap.missMarkers,
        radarSites: snap.radarSites,
        threats: snap.threats,
        events: snap.events,
        destroyedGhosts: snap.destroyedGhosts,
        stats: snap.stats,
        timelinePosition: index,
      }
    }),

  addToast: (toast: Omit<Toast, 'id'>) =>
    set((state) => {
      const id = state.toastIdCounter + 1
      return {
        toasts: [...state.toasts, { ...toast, id }],
        toastIdCounter: id,
      }
    }),

  removeToast: (id: number) =>
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id),
    })),
}))
