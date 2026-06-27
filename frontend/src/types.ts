export type Classification = 'HOSTILE' | 'FRIENDLY' | 'INTERCEPTOR'
export type TrackType = 'STANDARD' | 'JAMMER' | 'SWARM'
export type PolicyId = 'PPO_800k' | 'Baseline' | 'JamFirst' | 'UnjamFirst' | 'NeverLaunch'

export type AssetRole = 'HighValueAsset' | 'SurfaceToAirSite' | 'NavalDefenseAsset' | 'FriendlyAircraft'

export interface AssetCapabilities {
  defendable: boolean
  interceptorLauncher: boolean
  mobile: boolean
  protected: boolean
  surveillanceOnly: boolean
}

export const ROLE_CAPABILITIES: Record<AssetRole, AssetCapabilities> = {
  HighValueAsset: { defendable: true, interceptorLauncher: false, mobile: false, protected: true, surveillanceOnly: false },
  SurfaceToAirSite: { defendable: false, interceptorLauncher: true, mobile: false, protected: false, surveillanceOnly: false },
  NavalDefenseAsset: { defendable: false, interceptorLauncher: true, mobile: true, protected: false, surveillanceOnly: false },
  FriendlyAircraft: { defendable: false, interceptorLauncher: false, mobile: true, protected: false, surveillanceOnly: true },
}

export interface SectorThreatData {
  sectorIndex: number
  hostileCount: number
  cumulativeThreatScore: number
  averagePriority: number
  color: string
  opacity: number
}

export interface RadarSite {
  id: number
  x: number
  y: number
  sweepAngle: number
}

export interface Track {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  altitude: number
  classification: Classification
  heading: number
  speed: number
  visible: boolean
  displayX: number
  displayY: number
  history: [number, number][]
  targetId?: number
  trackType?: TrackType
  jammed?: boolean
  groupId?: number | null
  offset_x?: number
  offset_y?: number
  assetRole?: AssetRole
  engagementRange?: number
  defendedRadius?: number
}

export interface Explosion {
  id: number
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  alive: boolean
}

export interface MissMarker {
  x: number
  y: number
  radius: number
  alpha: number
}

export interface DestroyedGhost {
  id: number
  trackId: number
  interceptorId: number
  x: number
  y: number
  displayX: number
  displayY: number
  vx: number
  vy: number
  history: [number, number][]
  interceptorX: number
  interceptorY: number
  life: number
  maxLife: number
}

export interface ThreatAlert {
  trackId: number
  eta: number
  firstSeen: number
  threatScore?: number
  approachingHva?: boolean
}

export interface EventEntry {
  id: number
  time: string
  type: 'THREAT' | 'LAUNCH' | 'DESTROYED' | 'INFO' | 'DETECTED' | 'JAMMER' | 'MISS' | 'NO_INTERCEPTORS' | 'LEAKER'
  message: string
}

export interface SimData {
  simTime: number
  tracks: Track[]
  interceptors: Track[]
  explosions: Explosion[]
  missMarkers: MissMarker[]
  radarSites: RadarSite[]
  threats: ThreatAlert[]
  events: EventEntry[]
  running: boolean
  stats: { kills: number; misses: number; launched: number; leakers: number; threats_engaged: number[]; inventory_remaining: number }
}

export interface ScenarioConfig {
  numHostiles: number
  numFriendlies: number
  inventorySize: number
  jammingIntensity: number
  swarmMode: boolean
  threatSpeed: number
  randomSeed: number
}

export interface PolicyInfo {
  id: PolicyId
  name: string
  description: string
  avgScore: number
}

export interface AIDecision {
  id: number
  time: string
  type: 'DETECTED' | 'PRIORITIZED' | 'LAUNCHED' | 'DESTROYED' | 'LEAKER' | 'WARNING'
  targetId: number
  targetLabel: string
  message: string
  eta?: number
  threatScore?: number
  inventoryRemaining?: number
  reasoning?: string
}

export interface ComparisonState {
  active: boolean
  policyA: PolicyId
  policyB: PolicyId
  scoreA: number
  scoreB: number
  runningA: boolean
  runningB: boolean
  timeA: number
  timeB: number
  winner: PolicyId | null
}

export interface TournamentEntry {
  policy: PolicyId
  meanScore: number
  ciLow: number
  ciHigh: number
  stdDev: number
  wins: number
}

export interface TournamentData {
  entries: TournamentEntry[]
  totalSeeds: number
  bugFixDescription: string
  significanceSummary: string
}
