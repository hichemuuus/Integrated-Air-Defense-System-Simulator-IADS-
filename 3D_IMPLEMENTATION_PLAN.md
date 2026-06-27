# Scene3D Integration Plan — IADS Frontend

---

## 1. Architecture Analysis

### 1.1 State Flow: WebSocket → Store → Renderers

The full path from network to pixels is:

```
WebSocket (ws://127.0.0.1:8000/ws/sim)
    │
    ▼
useSimulation hook (frontend/src/hooks/useSimulation.ts)
    │  ┌─ onmessage → applySnapshot(data)  [live mode]
    │  └─ runLoop rAF → stepSimulation() → syncMockToStore()  [standalone mode]
    │
    ▼
Zustand store (frontend/src/store/simulationStore.ts)
    │  applySnapshot merges: simTime, tracks[], interceptors[], explosions[],
    │  missMarkers[], radarSites[], threats[], events[], destroyedGhosts[],
    │  simulationState, speed, stats
    │
    ▼ (React subscribe via useSimStore selectors)
    │
    ├── TacticalDisplay (frontend/src/components/TacticalDisplay.tsx)
    │     subscribes individually to: tracks, interceptors, explosions, missMarkers,
    │     radarSites, threats, destroyedGhosts, selectedTrackId
    │     stores in stateRef.current, runs a separate rAF loop that calls renderFrame()
    │
    ├── ScenarioControls, TacticalSummary, LiveMetrics, TrackDetail, etc.
    │     each subscribe to specific slices (stats, tracks, etc.)
    │
    └── PolicyComparison → useComparisonBackend (separate WebSocket)
```

Key observation: **Two separate `requestAnimationFrame` loops coexist**:
- `useSimulation.runLoop` — advances simulation state (mock mode) and writes to store
- `TacticalDisplay`'s rAF — reads latest state from `stateRef.current` and draws

There is **no interpolation between frames**. The latest snapshot is rendered as-is. `useSimulation` in standalone mode ticks the physics at the browser's frame rate. In live mode, backend pushes state at ~20-30 Hz and store is updated directly.

### 1.2 Rendering Pipeline

`renderFrame` in `frontend/src/renderer/canvasRenderer.ts` (line 44) is called every rAF tick. It consumes a `RenderState` object:

```typescript
interface RenderState {
  tracks: Track[]          // drawTracks.ts: drawSymbol, drawLabel, drawTrail, drawVelocityVector, drawGlow, drawThreatPriorityRing, drawSelectionRing
  interceptors: Track[]    // same drawTracks functions
  explosions: Explosion[]  // drawTracks.drawExplosions
  missMarkers: MissMarker[]// drawTracks.drawMissMarkers
  radarSites: RadarSite[]  // drawRadar.ts: drawBackgroundSweep, drawRadarSweep
  threats: ThreatAlert[]   // used by drawSectors.ts, drawTracks threat rings
  destroyedGhosts: DestroyedGhost[] // drawTracks.drawDestroyedGhosts
}
```

Order of rendering layers (bottom to top):
1. Background fill (solid color)
2. Grid + threat zones (drawGrid.ts)
3. Radar sweeps (drawRadar.ts) — per site, animated via `Date.now()`
4. Sector overlays (drawSectors.ts) — computed threat density wedges
5. Coverage envelopes (drawCoverage.ts) — SAM engagement rings
6. Protection zones (drawCoverage.ts) — HVA defended areas
7. HVA approach threat lines (drawCoverage.ts)
8. Engagement lines (drawTracks.ts)
9. Destroyed ghosts (drawTracks.ts)
10. Trajectory predictions (drawPrediction.ts) — 45-step dashed lines
11. Tracks: impact markers, intercept markers, trails, jammer radii, velocity vectors, glows, threat rings, symbols, selection rings, labels
12. Explosions and miss markers
13. Cursor crosshair

All drawing functions receive `toScreenX`/`toScreenY` closure functions that apply the `ViewTransform` (offset + scale). No projection matrix — simple 2D affine transform.

### 1.3 Component Hierarchy Around TacticalDisplay

```
App.tsx
├── <ToastContainer />
├── <header>
│   ├── <SimulationControls />
│   └── [Export + UTC clock]
├── <AlertRibbon />
├── <div class="flex-1 flex">
│   ├── <aside style="width:260px">                     // Left sidebar
│   │   ├── Tab bar (Scenario | Policy)
│   │   └── <ScenarioControls /> or <PolicySelector />
│   ├── <main class="flex-1 flex flex-col">              // Center — the render target
│   │   ├── <TacticalSummary /> + <SectorAnalysis />
│   │   └── <div class="flex-1 relative">                // *** Scene3D mounts HERE ***
│   │       ├── <TacticalDisplay />                      //   Current 2D canvas
│   │       ├── <TrackDetail />                          //   Overlay on selected track
│   │       └── <ContextMenu />                          //   Right-click menu
│   └── <aside style="width:320px">                      // Right sidebar
│       ├── Tab bar (Feed | Timeline)
│       └── <AIDecisionFeed /> or <MissionTimeline />
├── <footer>
│   ├── <LiveMetrics />
│   └── <TimelineReplay />
└── {showComparison && <PolicyComparison />}             // Modal overlay
```

The exact mount point is **`App.tsx` line 393-397**:

```tsx
<div className="flex-1 relative">                        // line 393
  <TacticalDisplay                                       // line 394
    overlays={overlays}
    onContextMenu={setContextMenu}
  />
  {selectedTrack && (                                    // line 398
    <TrackDetail track={selectedTrack} ... />
  )}
  {contextMenu && (                                      // line 406
    <ContextMenu ... />
  )}
</div>
```

### 1.4 Current View Switching Mechanism

There is **no 2D/3D view toggle** today. The only view switch is:

- **Comparison mode**: `showComparison` (local `useState` in `App.tsx` line 227) toggles the `PolicyComparison` modal overlay. Controlled by a "Results" button at line 306.
- **Left/Right tabs**: `leftTab` and `rightTab` local state control side panel content.
- **Fullscreen**: `fullscreen` (line 224) controlled by 'f' key.

No Zustand field, URL param, or routing library is used for view switching.

---

## 2. Integration Point

### 2.1 Where Scene3D Mounts

**File**: `frontend/src/App.tsx`
**Lines**: 393-415 (inside the `<div className="flex-1 relative">` block)
**Strategy**: Mount `Scene3D` as **a sibling of `TacticalDisplay`**, conditionally rendered based on a view mode.

```tsx
// App.tsx line 393-397 becomes:
<div className="flex-1 relative">
  {viewMode === '2d' ? (
    <TacticalDisplay
      overlays={overlays}
      onContextMenu={setContextMenu}
    />
  ) : (
    <Scene3D />
  )}
  {selectedTrack && (<TrackDetail ... />)}
  {contextMenu && (<ContextMenu ... />)}
</div>
```

`Scene3D` occupies the same physical space as `TacticalDisplay` (the `flex-1 relative` container). This ensures TrackDetail and ContextMenu overlays work identically regardless of which view is active.

### 2.2 View Switching Mechanism

**Recommendation: Zustand store field** `viewMode: '2d' | '3d'`.

Rationale:
- A Zustand field makes the view mode accessible from any component without prop drilling.
- It can be persisted if needed.
- Keyboard shortcuts in `useKeyboardShortcuts` (line 260) can toggle it.
- The same field can drive UI indicators (e.g., a toggle button in the header).

Implementation:

1. Add to `SimStoreState` interface:
   ```typescript
   viewMode: '2d' | '3d'
   ```
2. Add action to `SimStoreActions`:
   ```typescript
   setViewMode: (mode: '2d' | '3d') => void
   ```
3. Default in `INITIAL`: `viewMode: '2d'`
4. In `App.tsx`:
   ```typescript
   const viewMode = useSimStore(s => s.viewMode)
   ```
5. Add a toggle button in the header (line 291 area) or bind to a key (e.g., '3' shift or 'v' key).
6. Add keyboard shortcut in `useKeyboardShortcuts`:
   ```typescript
   'v': () => useSimStore.getState().setViewMode(
     useSimStore.getState().viewMode === '2d' ? '3d' : '2d'
   )
   ```

Alternative (rejected): URL param — adds routing dependency and complicates deep integration. Local state — prevents other components from knowing the current view.

### 2.3 Shared Store Subscription

`Scene3D` uses **exactly the same `useSimStore` selectors** as `TacticalDisplay`:

```typescript
const tracks = useSimStore(s => s.tracks)
const interceptors = useSimStore(s => s.interceptors)
const explosions = useSimStore(s => s.explosions)
const missMarkers = useSimStore(s => s.missMarkers)
const radarSites = useSimStore(s => s.radarSites)
const threats = useSimStore(s => s.threats)
const destroyedGhosts = useSimStore(s => s.destroyedGhosts)
const selectedTrackId = useSimStore(s => s.selectedTrackId)
const simTime = useSimStore(s => s.simTime)
```

No changes to the store or its subscription mechanism are required. Both components read from the same reactive state. When one is mounted and the other unmounted (conditional rendering), React handles subscription cleanup automatically.

---

## 3. Data Flow Design

### 3.1 Zustand Selectors for Scene3D

| Selector | Type | Usage in 3D |
|---|---|---|
| `s.tracks` | `Track[]` | Hostile/friendly track meshes; instanced squares/diamonds with per-instance color + rotation |
| `s.interceptors` | `Track[]` | Interceptor meshes; instanced chevrons with per-instance target color |
| `s.explosions` | `Explosion[]` | Animated expanding spheres; small batch of separate mesh objects |
| `s.missMarkers` | `MissMarker[]` | Faint rings; instanced torus/ring geometry |
| `s.radarSites` | `RadarSite[]` | Static emitter meshes + rotating sweep indicator cone |
| `s.threats` | `ThreatAlert[]` | Threat rings around hostiles; pulsing edge glow shader |
| `s.destroyedGhosts` | `DestroyedGhost[]` | Fading X markers with ghost interceptor line |
| `s.selectedTrackId` | `number \| null` | Highlight ring + label billboard |
| `s.simTime` | `number` | Drives pulsing animations (protection zones, threat rings) |

### 3.2 Mapping TypeScript Types → 3D Scene Objects

| TS Type | 3D Representation | Geometry | Instanced? |
|---|---|---|---|
| `Track` (HOSTILE) | Red square with heading rotation | `PlaneGeometry` or `BoxGeometry` 0.4×0.4 | Yes — `InstancedMesh` |
| `Track` (FRIENDLY, standard) | Cyan circle | `CircleGeometry` | Yes |
| `Track` (HVA) | Cyan hollow square + inner cross | `EdgesGeometry` + `LineSegments` | Yes (per-instance edges) |
| `Track` (SAM site) | Filled upright triangle | Custom `BufferGeometry` | Yes |
| `Track` (Naval) | Filled diamond | Custom `BufferGeometry` | Yes |
| `Track` (INTERCEPTOR) | Amber chevron | Custom `BufferGeometry` | Yes |
| `Track` (JAMMER) | Purple diamond | Custom `BufferGeometry` | Yes |
| `Track` (SWARM) | Small orange square | `PlaneGeometry` | Yes |
| `Explosion` | Expanding ring + inner fill | `RingGeometry` + sprite | No (≤10 at a time) |
| `MissMarker` | Faint ring | `RingGeometry` | No (≤5 at a time) |
| `RadarSite` | Cone sweep + dot | `ConeGeometry` + `SphereGeometry` | No (≤10 at a time) |
| `DestroyedGhost` | Fading X marker | `LineSegments` (two crossed lines) | Yes |
| `ThreatAlert` | Pulsing ring around track | `RingGeometry` as child of track instance | Per-threat child |

### 3.3 3D-Specific Transforms — Separate Compute Pass?

**Recommendation: No separate worker.**

Rationale:
- The 3D transform is simple: map (`displayX`, `displayY`) → (`x`, `0`, `-y`) world coordinates, and linearly interpolate between stored snapshots.
- The interpolation buffer (see §4.2) is updated on the main thread in a single pass.
- Worker overhead (serialization cost, transfer latency) outweighs benefit for ≤200 entities at 60 fps.
- If track count exceeds 500 in future, a `SharedArrayBuffer` + worker can be introduced without changing the Scene3D API.

The interpolation buffer module will compute the lerped position/rotation for every entity each frame. Scene3D reads from this buffer directly.

---

## 4. Rendering Strategy

### 4.1 Why GPU Instancing

**Track count**: Worst case scenario, 30 hostiles + 10 friendlies + 30 interceptors = 70 tracks. With destroyed ghosts and explosions, ≤85 draw calls.

**Update frequency**: Positions change every frame (16ms @ 60fps). Instanced meshes need one `instanceMatrix` upload per frame per mesh type — that's ~6-8 `setAttribute` calls total vs 70+ individual `mesh.position.set()` calls.

**Fragment count**: Each track is 4-6 triangles. 70 tracks × 6 triangles = 420 triangles — trivial for any GPU. The bottleneck is draw call overhead, not fill rate.

**Why instancing wins**: Without instancing, 70 individual `THREE.Mesh` objects = 70 draw calls + 70 material binds per frame. With instancing, 6 draw calls (one per shape type) + 6 material binds. This is the difference between 70 API calls and 6.

**Other benefits**:
- Single `dirty` flag per instanced mesh to trigger attribute update
- GPU culling works per-instance
- Adding/removing tracks = adjusting instance count + re-uploading matrix buffer

### 4.2 Centralized Interpolation

**Current problem**: `useSimulation` updates the store at frame rate (mock mode) or at WebSocket message rate (live mode, ~20-30 Hz). `TacticalDisplay` renders every rAF tick with the latest state. There is no interpolation — the display "steps" between state updates.

**Design**: Centralized interpolation buffer that lives between the store and Scene3D.

```
Store state (snapshot N)
       │
       ▼
InterpolationBuffer (standalone module)
       │  Stores: previousSnapshot, nextSnapshot, interpT [0-1]
       │  Updated once per rAF: reads latest store state, advances interpT
       │  Exposes: getInterpolatedTracks(), getInterpolatedInterceptors(), etc.
       │  Each call returns [{id, x, y, heading, vx, vy, ...}] with lerped values
       │
       ▼
Scene3D rAF loop
       │  Reads interpolated buffer → updates instance matrices
       │  Calls renderer.render()
```

**Where the buffer lives**: Standalone module `frontend/src/renderer/interpolationBuffer.ts` — not in the store, not in a ref inside a component. Exported as a singleton with functions:

```typescript
// API for interpolationBuffer.ts
function updateInterpolation(currentSnapshot: RenderState, simTime: number): void
function setTimeScale(scale: number): void
function getInterpolatedTracks(): InterpolatedEntity[]
function getInterpolatedInterceptors(): InterpolatedEntity[]
```

**How it works**:
1. Each frame, before Scene3D renders, `updateInterpolation(currentSnapshot, simTime)` is called.
2. The buffer compares the new snapshot with the previous one. If the snapshot changed (different `simTime`), it stores the old as `previous`, the new as `next`, and resets `interpT = 0`.
3. Each frame, `interpT` advances by `dt / (nextSimTime - previousSimTime)`, clamped to [0, 1].
4. `getInterpolatedTracks()` returns tracks with lerped positions: `x = prev.x + (next.x - prev.x) * interpT`.
5. When `interpT >= 1`, the buffer snaps to `next` and waits for a new snapshot.

**Why not ref-based**: A standalone module can be imported by both Scene3D and (optionally) TacticalDisplay without being tied to React's lifecycle. A ref would be owned by a component and unavailable during SSR or testing.

### 4.3 Batch Update Strategy

Each frame, the following happens in order:

1. **Update interpolation buffer** (see §4.2):
   ```typescript
   const state = {
     tracks: useSimStore.getState().tracks,
     interceptors: useSimStore.getState().interceptors,
     explosions: useSimStore.getState().explosions,
     // ... etc
   }
   interpBuffer.updateInterpolation(state, useSimStore.getState().simTime)
   ```

2. **Compute instance matrices** for each track category:
   ```typescript
   const trackData = interpBuffer.getInterpolatedTracks()
   const hostiles = trackData.filter(t => t.classification === 'HOSTILE')
   const friendlies = trackData.filter(t => t.classification === 'FRIENDLY' && !t.assetRole)
   const hvas = trackData.filter(t => t.assetRole === 'HighValueAsset')
   // ... per category

   // Build Float32Array for each InstancedMesh
   const dummy = new THREE.Object3D()
   for (let i = 0; i < hostiles.length; i++) {
     const t = hostiles[i]
     dummy.position.set(t.x, 0, -t.y)  // Z-up → Y-up conversion
     dummy.rotation.y = -t.heading
     dummy.updateMatrix()
     hostileMesh.setMatrixAt(i, dummy.matrix)
   }
   hostileMesh.instanceMatrix.needsUpdate = true
   ```

3. **Per-frame animations** (explosions, sweep, pulses) use `simTime` or `Date.now()` in the animation loop.

4. **Render** with `renderer.render(scene, camera)`.

---

## 5. Implementation Plan

### Step 1: Add view mode to Zustand store (low complexity)

**Files modified**: `frontend/src/store/simulationStore.ts`
- Add `viewMode: '2d' | '3d'` to `SimStoreState`
- Add `setViewMode` action to `SimStoreActions`
- Default `viewMode: '2d'` in `INITIAL`
- Add `setViewMode` in the store creator

**Files created**: None

**Rationale**: All subsequent steps depend on this field. Minimal change, trivially testable.

---

### Step 2: Add InterpolationBuffer module (medium complexity)

**File created**: `frontend/src/renderer/interpolationBuffer.ts`

**Contents**:
- Module-level state: `prevSnapshot`, `nextSnapshot`, `interpT`, `timeScale`
- `updateInterpolation(currentSnapshot: RenderState, simTime: number): void`
- `getInterpolatedTracks(): InterpolatedTrack[]`
- `getInterpolatedInterceptors(): InterpolatedTrack[]`
- `InterpolatedTrack` type (subset of Track with lerped x, y, heading, vx, vy)
- Helper: `lerp(a, b, t)` for scalar, `slerpAngle(a, b, t)` for heading

**Testable independently**: Unit tests with known snapshots verify lerp output.

---

### Step 3: Install Three.js dependencies (low complexity)

```bash
npm install three @react-three/fiber @react-three/drei
```

**Files modified**: `frontend/package.json`

**Note**: Although we plan to use r3f for ergonomic React integration, see §6 for full discussion of r3f vs raw Three.js.

---

### Step 4: Create Scene3D component shell (medium complexity)

**File created**: `frontend/src/components/Scene3D.tsx`

**Contents**:
- Canvas element filling parent container (`flex-1 relative`)
- `<Canvas>` from @react-three/fiber with orthographic camera (top-down view matching 2D)
- Camera setup: `position={[0, 12000, 0]}`, `near={0.1}`, `far={30000}`, looking down at origin
- Orbit controls from @react-three/drei (pan + zoom, matching 2D pan/zoom)
- Initial scene: grid helper, concentric rings, threat zone overlays
- Subscribe to `useSimStore` for `tracks`, `interceptors`, `explosions`, `missMarkers`, `radarSites`, `threats`, `destroyedGhosts`, `simTime`, `selectedTrackId`

**Files modified**: None
**No instancing yet** — just wireframe to validate camera, controls, and store subscription.

---

### Step 5: Create instanced mesh builder module (high complexity)

**File created**: `frontend/src/renderer/InstancedTrackMeshes.ts`

**Contents**:
- Pre-build geometry for each track shape (square, circle, chevron, diamond, triangle, HVA frame)
- Function `buildInstancedMeshes(): TrackMeshGroup` that creates all `InstancedMesh` objects for each classification
- Each mesh: `InstancedMesh` with `maxCount = MAX_TRACKS` (e.g., 200)
- `updateInstances(tracks: InterpolatedTrack[], interceptors: InterpolatedTrack[]): void` — computes matrices and updates `instanceMatrix`
- Per-instance colors via `instanceColor` attribute
- Per-instance threat rings as children of track instances (non-instanced, separate `RingGeometry` objects, one per threat, pooled)

**Why separate module**: Keeps the GPU-heavy logic decoupled from React components. Can be unit-tested with mock data.

---

### Step 6: Wire Scene3D animation loop (high complexity)

**Files modified**: `frontend/src/components/Scene3D.tsx`

**Changes**:
- Replace `useFrame` stub with full per-frame update:
  1. Call `interpolationBuffer.updateInterpolation(storeState, simTime)` once
  2. Call `trackMeshes.updateInstances(interpBuffer.getInterpolatedTracks(), interpBuffer.getInterpolatedInterceptors())`
  3. Update explosion animations (scale + alpha over lifetime)
  4. Update threat ring pulses (based on `simTime`)
  5. Update camera orbit/zoom from view transform
- Add selected track highlight (emissive ring + label sprite)
- Add cursor raycasting for track selection
- Track selection integration: `onClick` → `setSelectedTrack(trackId)`

---

### Step 7: Add view toggle button + keyboard shortcut (low complexity)

**Files modified**: `frontend/src/App.tsx`
- Add toggle button in the header (near simulation controls, line 291)
- Add keyboard shortcut `'v'` → `setViewMode(prev === '2d' ? '3d' : '2d')`

**File modified**: `frontend/src/hooks/useKeyboardShortcuts.ts` — no changes needed (already supports arbitrary key bindings)

---

### Step 8: Add radar sweep, grid, sector overlays (medium complexity)

**Files created**: `frontend/src/renderer/Scene3DOverlays.ts`

**Contents**:
- `GridOverlay` — concentric circles + radial bearing lines + grid dots
- `RadarSweepOverlay` — animated sweep cone for each radar site
- `SectorOverlay` — colored wedges by threat density (matching `drawSectors.ts`)
- `CoverageEnvelopes` — SAM engagement rings (translucent cylinders/flat rings)
- `ProtectionZones` — HVA defended radius rings

These are static `THREE.Mesh` or `THREE.LineLoop` objects updated once per frame via `simTime` (for sweep animation) or re-created when radar sites change.

---

### Step 9: Add trajectory predictions, engagement lines, ghost markers (medium complexity)

**Files modified**: `frontend/src/renderer/Scene3DOverlays.ts` (extend)

**Contents**:
- `PredictionLines` — dashed line from each track along velocity vector, 45 segments
- `EngagementLines` — dotted line from interceptor → target (matching `drawEngagementLines`)
- `DestroyedGhosts` — fading X markers with interceptor track line

These are `THREE.Line` / `THREE.LineSegments` with `BufferGeometry` updated each frame.

---

### Step 10: Add labels / billboards (low complexity)

**Files created**: `frontend/src/renderer/TrackLabels.ts`

**Contents**:
- Sprite-based labels using `CanvasTexture` for each track
- Clustering logic (mirroring `drawTracks.ts` lines 161-196) to avoid label overlap
- Billboard sprites always facing camera
- Color-coded by classification

---

### Step 11: Integration test + bugfix (medium complexity)

- Verify 3D view renders identically to 2D view (determinism check, see §8.1)
- Verify view switching doesn't cause state desync
- Verify interpolation doesn't lag behind 2D rendering
- Verify keyboard shortcuts work in both views
- Verify TrackDetail and ContextMenu overlays work in 3D view

---

## 6. Dependencies

### 6.1 Required Packages

| Package | Version | Size (min+gzip) | Purpose |
|---|---|---|---|
| `three` | ^0.170 | ~650 KB (150 KB gz) | Core WebGL library, `InstancedMesh`, `BufferGeometry`, materials |
| `@react-three/fiber` | ^8.x | ~30 KB (10 KB gz) | React renderer for Three.js, Canvas lifecycle, useFrame |
| `@react-three/drei` | ^9.x | ~150 KB (40 KB gz) | OrbitControls, Text, Billboard, Html, helper utilities |

**Total added**: ~830 KB minified, ~200 KB gzipped.

**Impact on current bundle** (currently only React + Zustand + Vite):
- Current: ~150 KB minified
- New: ~980 KB minified
- This is acceptable for a desktop-targeted Tauri app (frontend/package.json includes `@tauri-apps/cli`).

### 6.2 react-three-fiber vs Raw Three.js + Canvas

| Criterion | r3f | Raw Three.js |
|---|---|---|
| React integration | Native — `useFrame`, `useThree`, automatic disposal | Manual lifecycle — create/cleanup renderer in useEffect |
| Performance overhead | Slight (React reconciliation on each frame) | Zero — direct imperative API |
| Development speed | Fast — components are declarative | Slower — imperative add/remove to scene |
| Bundle size | +30 KB (r3f) + 150 KB (drei) | Zero extra |
| Instancing | Same API (Three.js is the renderer either way) | Same API |
| Controls | `<OrbitControls>` from drei, draggable | Manual `OrbitControls` instantiation |
| Hot reload | Works (r3f handles disposal) | Fragile (must manually dispose scene on HMR) |

**Recommendation: Use @react-three/fiber**.

Rationale:
- The existing codebase is heavily React-idiomatic (Zustand, hooks, components).
- The Scene3D component will live inside a React tree with sibling overlays (TrackDetail, ContextMenu) that are React components. r3f's `<Canvas>` children are React components that can consume the same store.
- `useFrame` gives us a clean hook to run per-frame logic without managing a separate rAF loop.
- `drei`'s `OrbitControls` + `Html` (for labels) eliminate hundreds of lines of boilerplate.
- Perf overhead is negligible for <100 entities.

**Caveat**: For the interpolation buffer and instanced mesh update, use imperative Three.js calls inside `useFrame` — not declarative JSX for each track. JSX for individual track meshes would create 70+ React components, which defeats the purpose of instancing. The approach is:
- `<Canvas>` + `<OrbitControls>` from r3f/drei (declarative)
- All track meshes created imperatively in a `useEffect` (via the `InstancedTrackMeshes` module)
- Per-frame matrix updates in `useFrame` (imperative)

---

## 7. Risks and Mitigations

### Risk 1: Performance — 60+ tracks × interpolation × instanced draw calls

**Severity**: Medium. 70 tracks × 6 draw calls = very low triangle count. The interpolation buffer is simple arithmetic: ~70 × 6 float lerps = 420 ops per frame, negligible.

**Mitigation**:
- Use `InstancedMesh` with `instanceMatrix.needsUpdate = true` (single attribute upload per mesh type, not per entity).
- Pool and reuse instance slots — don't create/destroy meshes each frame.
- Set `maxCount` to a reasonable upper bound (e.g., 200) and reuse instances; hide off-screen instances by setting scale to 0.
- Profile with Chrome DevTools' Performance panel targeting 16ms frame budget.

### Risk 2: Integration — conflicting with existing store subscriptions

**Severity**: Low. `Scene3D` uses `useSimStore` selectors identically to `TacticalDisplay`. Zustand's subscription mechanism handles multiple subscribers efficiently. Both components read from the same state; only one is mounted at a time due to conditional rendering.

**Mitigation**:
- Conditional rendering (`viewMode === '2d' ? <TacticalDisplay /> : <Scene3D />`) means only one renderer is subscribed at a time. This avoids double rAF loops.
- Test switching rapidly (10+ times per second) to verify no stale closures or orphaned subscriptions.

### Risk 3: Maintenance — two parallel rendering code paths diverging

**Severity**: Medium-High. Every change to the simulation state shape (new fields on `Track`, new entity types) must be propagated to both renderers.

**Mitigation**:
- **Share the data mapping layer**: The `InterpolationBuffer` module produces `InterpolatedTrack` objects. Both renderers could theoretically consume the same buffer (though 2D currently doesn't interpolate). Adding a common mapping layer later reduces divergence.
- **Feature flag new visual elements**: If a new track type or visual effect is added, implement it in both renderers within the same PR.
- **Accept visual differences for non-critical effects**: The 3D view does not need to pixel-match the 2D view for decorative elements (e.g., glow gradients, scan line opacity). It must match for: position, classification, heading, speed, engagement status, threat level, destruction status.

### Risk 4: Bundle size from Three.js

**Severity**: Medium. Three.js adds ~200 KB gzipped to the bundle.

**Mitigation**:
- This is a Tauri desktop app, not a mobile web app. Bundle size is irrelevant for a locally-installed application.
- If Tauri is replaced with a web deployment, lazy-load Three.js with `React.lazy(() => import('./components/Scene3D'))` and `Suspense`.
- Tree-shaking: Only import what's used (`import { InstancedMesh, ... } from 'three'` rather than `import * as THREE from 'three'`).

### Risk 5: WebSocket state update frequency causing visual stutter

**Severity**: Medium. In live mode, the backend may push updates at 20 Hz while the renderer runs at 60 Hz. Without interpolation, 3D entities would jerk.

**Mitigation**: The interpolation buffer (see §4.2) is the designed solution. It smooths 20 Hz updates to 60 Hz by lerping between snapshots. The buffer also handles the case where mock mode ticks at frame rate (no interpolation needed — snaps immediately).

---

## 8. Evaluation Criteria

### 8.1 Determinism Check — 3D View Matches 2D View

**Method**:

1. Run a fixed scenario (e.g., "STANDARD THREAT" preset, same random seed).
2. Pause simulation at a random time.
3. Take a screenshot of the 2D canvas.
4. Switch to 3D view.
5. Verify the following match within a tolerance:
   - Number of visible tracks per classification
   - Track positions (within 1 world unit)
   - Track headings (within 2°)
   - Engagement line endpoints
   - Explosion positions
   - Destroyed ghost positions
   - Sector threat density (count per octant)
6. Write a Playwright or Vitest-based snapshot test that captures both renders and compares using `pixelmatch` (or manually verify).

**Automated check**:
- Export `RenderState` from `canvasRenderer.ts` and use the same state object as input to both `renderFrame()` (in a headless canvas) and `Scene3D` (in a headless `gl` context).
- Compare rendered output pixel-by-pixel for the core deterministic layers (tracks, grid, engagement lines, explosions). Skip non-deterministic layers (animated sweeps, pulsing rings) or freeze their time value.

### 8.2 Frame Budget Headroom

**Method**:

1. Profile the 3D view in Chrome DevTools Performance tab.
2. Run worst-case scenario: SWARM ATTACK (50 hostiles + 30 interceptors + explosions).
3. Measure frame time for: JavaScript (interpolation + matrix update), Render (WebGL draw calls), GPU (composite + rasterize).
4. Target: ≤14ms total frame budget (leaving 2ms for browser overhead at 60 fps).

**Success criteria**:
- JavaScript: ≤4ms
- Render: ≤6ms
- GPU: ≤4ms
- No frame drops (no consecutive frames > 16ms)

**Regression check**: Add a `performance.mark()`/`performance.measure()` around each frame and log to console in dev mode. Compare against baseline after each Scene3D change.

### 8.3 Seamless View Switching

**Method**:

1. Start simulation with 2D view active.
2. Verify simulation state is populated (tracks visible).
3. Press 'v' to switch to 3D:
   - Verify 3D scene renders within one frame (no black flash).
   - Verify track positions in 3D match the last 2D position.
   - Verify selected track (if any) carries over.
   - Verify TrackDetail / ContextMenu overlays remain visible.
4. Press 'v' again to switch back to 2D:
   - Verify 2D canvas renders immediately with correct state.
   - Verify pan/zoom offset did not reset.
5. Switch 10 times during active simulation — verify no memory leak (check heap snapshot), no rAF leak (check frame rate), no console errors.

**Failure signals**:
- Black frame on switch (renderer not ready)
- Position mismatch (interpolation state not flushed)
- TrackDetail disappears (React key changing on switch)
- Dropped frames for 2-3 seconds after switch (GC from three.js scene disposal)
