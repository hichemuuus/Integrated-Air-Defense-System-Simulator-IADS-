import numpy as np
from .physics import Track, Interceptor, Explosion, MissMarker, Classification
from .radar import Radar, ThreatAssessor
from .policies import BaselinePolicy

JAMMER_SPAWN_CHANCE = 0.20
JAM_RADIUS = 2500
JAM_NOISE_MULTIPLIER = 5
JAM_FLICKER_CHANCE = 0.20

SWARM_SPAWN_CHANCE = 0.30
SWARM_MIN_SIZE = 4
SWARM_MAX_SIZE = 6

PK_BASE = 0.85
PK_JAM_FACTOR = 0.40
PK_SWARM_FACTOR = 0.70

MAX_CONCURRENT_ENGAGEMENTS = 6
INTERCEPTOR_INVENTORY = 30
LEAKER_THRESHOLD = 2000

DEFAULT_SCENARIO = {
    "jammer_chance": JAMMER_SPAWN_CHANCE,
    "jam_radius": JAM_RADIUS,
    "jam_noise_multiplier": JAM_NOISE_MULTIPLIER,
    "jam_flicker_chance": JAM_FLICKER_CHANCE,
    "swarm_chance": SWARM_SPAWN_CHANCE,
    "swarm_min_size": SWARM_MIN_SIZE,
    "swarm_max_size": SWARM_MAX_SIZE,
    "pk_base": PK_BASE,
    "pk_jam_factor": PK_JAM_FACTOR,
    "pk_swarm_factor": PK_SWARM_FACTOR,
    "max_concurrent_engagements": MAX_CONCURRENT_ENGAGEMENTS,
    "interceptor_inventory": INTERCEPTOR_INVENTORY,
    "leaker_threshold": LEAKER_THRESHOLD,
    "interceptor_speed": 400.0,
    "engagement_range": 500.0,
    "spawn_distance_min": 10000,
    "spawn_distance_max": 12000,
    "threat_speed_min": 200,
    "threat_speed_max": 280,
    "hostile_speed": 250.0,
    "radar_configs": [
        {"x": 0, "y": 0, "sweep_start": 0.0},
        {"x": 7000, "y": 0, "sweep_start": np.pi},
        {"x": -7000, "y": 0, "sweep_start": np.pi / 2},
    ],
    "initial_spawns": [
        {"x": -9500, "y": -2000, "alt": 7500},
        {"x": 1500, "y": -9500, "alt": 4500},
        {"x": 9500, "y": 3000, "alt": 9000},
    ],
    "friendly_spawns": [],
}


class Simulation:
    def __init__(self, dt=0.05, seed=None, policy=None, scenario=None):
        self.dt = dt
        self.sim_time = 0.0
        self._seed = seed
        self._rng = np.random.default_rng(seed)
        self.tracks = {}
        self.interceptors = {}
        self.explosions = []
        self._apply_scenario(scenario)
        self.radars = []
        for rcfg in self.radar_configs:
            self.radars.append(Radar(
                id=len(self.radars), rng=self._rng,
                jam_radius=self.jam_radius,
                jam_noise_multiplier=self.jam_noise_multiplier,
                jam_flicker_chance=self.jam_flicker_chance,
                **rcfg,
            ))
        self._next_id = 1
        self._warned_threats = set()
        self._launched_at = set()

        self._events = []
        self._threats = []
        self._no_interceptor_logged = set()
        self._external_engagement = None
        self.miss_markers = []
        self._stats = {
            'kills': 0, 'misses': 0,
            'launched': 0,
            'leakers': 0,
            'threats_engaged': [],
            'inventory_remaining': self.interceptor_inventory,
        }
        self._interceptors_launched = 0
        self._total_hostiles_spawned = 0
        self._jammed_candidate_count = 0
        self._swarm_candidate_count = 0
        self._jammed_spawned = 0
        self._swarm_spawned = 0
        self.policy = policy() if policy is not None else BaselinePolicy()
        print(f"  [Simulation.__init__] seed={seed}, interceptor_inventory={self.interceptor_inventory}, hostile_speed={self.hostile_speed}, friendly_spawns={len(self.friendly_spawns)}")
        self._spawn_hostiles()
        self._spawn_friendlies()

    def _apply_scenario(self, scenario):
        merged = dict(DEFAULT_SCENARIO)
        if scenario is not None:
            merged.update(scenario)
        self.scenario = merged
        self.jammer_chance = merged["jammer_chance"]
        self.jam_radius = merged["jam_radius"]
        self.jam_noise_multiplier = merged["jam_noise_multiplier"]
        self.jam_flicker_chance = merged["jam_flicker_chance"]
        self.swarm_chance = merged["swarm_chance"]
        self.swarm_min_size = merged["swarm_min_size"]
        self.swarm_max_size = merged["swarm_max_size"]
        self.pk_base = merged["pk_base"]
        self.pk_jam_factor = merged["pk_jam_factor"]
        self.pk_swarm_factor = merged["pk_swarm_factor"]
        self.max_concurrent_engagements = merged["max_concurrent_engagements"]
        self.interceptor_inventory = merged["interceptor_inventory"]
        self.leaker_threshold = merged["leaker_threshold"]
        self.interceptor_speed = merged["interceptor_speed"]
        self.engagement_range = merged["engagement_range"]
        self.spawn_distance_min = merged["spawn_distance_min"]
        self.spawn_distance_max = merged["spawn_distance_max"]
        self.threat_speed_min = merged["threat_speed_min"]
        self.threat_speed_max = merged["threat_speed_max"]
        self.hostile_speed = merged["hostile_speed"]
        self.radar_configs = list(merged["radar_configs"])
        self.initial_spawns = list(merged["initial_spawns"])
        self.friendly_spawns = list(merged.get("friendly_spawns", []))

        print(f"  [_apply_scenario] interceptor_inventory={self.interceptor_inventory}, hostile_speed={self.hostile_speed}, jammer_chance={self.jammer_chance}, swarm_chance={self.swarm_chance}, spawns={len(self.initial_spawns)} hostiles, {len(self.friendly_spawns)} friendlies")

    def _spawn_hostiles(self):
        for spawn in self.initial_spawns:
            sx, sy, alt = spawn["x"], spawn["y"], spawn["alt"]
            angle = np.arctan2(-sy, -sx)
            vx = self.hostile_speed * np.cos(angle)
            vy = self.hostile_speed * np.sin(angle)
            track_type = 'JAMMER' if self._rng.random() < self.jammer_chance else 'STANDARD'
            track = Track(self._next_id, sx, sy, vx, vy, Classification.HOSTILE, altitude=alt, track_type=track_type)
            self.tracks[self._next_id] = track
            self._next_id += 1
            self._total_hostiles_spawned += 1
            if track_type == 'JAMMER':
                self._jammed_spawned += 1
        print(f"  [_spawn_hostiles] spawned {len(self.initial_spawns)} hostiles using hostile_speed={self.hostile_speed}")

    def _spawn_friendlies(self):
        for spawn in self.friendly_spawns:
            sx, sy = spawn["x"], spawn["y"]
            vx = spawn.get("vx", 0)
            vy = spawn.get("vy", 0)
            alt = spawn.get("alt", 5000)
            track = Track(self._next_id, sx, sy, vx, vy, Classification.FRIENDLY, altitude=alt, track_type='STANDARD')
            self.tracks[self._next_id] = track
            self._next_id += 1
        if self.friendly_spawns:
            print(f"  [_spawn_friendlies] spawned {len(self.friendly_spawns)} friendlies")

    def launch_interceptor(self, target_id):
        if target_id not in self.tracks:
            return None
        target = self.tracks[target_id]
        dx = target.x
        dy = target.y
        dist = np.sqrt(dx**2 + dy**2)
        if dist < 1.0:
            return None
        angle = np.arctan2(dy, dx)
        iid = self._next_id
        self._next_id += 1
        interceptor = Interceptor(
            iid, 0.0, 0.0, self.interceptor_speed * np.cos(angle), self.interceptor_speed * np.sin(angle),
            target_id=target_id,
        )
        self.interceptors[iid] = interceptor
        return iid

    def _resolve_pk(self, target):
        pk = self.pk_base
        if target.jammed:
            pk *= self.pk_jam_factor
        if target.track_type == 'SWARM':
            pk *= self.pk_swarm_factor
        return self._rng.random() < pk

    def step(self, dt):
        self.sim_time += dt

        for track in self.tracks.values():
            track.step(dt)

        self._detect_leakers()

        groups = {}
        for tid, track in self.tracks.items():
            if track.group_id is not None:
                groups.setdefault(track.group_id, []).append(track)

        for gid, members in groups.items():
            alive = sorted(
                [m for m in members if m.id in self.tracks],
                key=lambda m: m.id
            )
            if len(alive) < 2:
                continue
            lead = alive[0]
            if gid not in self.tracks:
                for m in alive:
                    m.offset_x = m.x - lead.x
                    m.offset_y = m.y - lead.y
            for follower in alive[1:]:
                follower.x = lead.x + follower.offset_x
                follower.y = lead.y + follower.offset_y
                follower.vx = lead.vx
                follower.vy = lead.vy

        destroyed_interceptors = []
        destroyed_targets = []
        for iid, interceptor in list(self.interceptors.items()):
            target = self.tracks.get(interceptor.target_id)
            if target is None:
                destroyed_interceptors.append((iid, interceptor.x, interceptor.y))
                continue
            interceptor.step(dt, (target.x, target.y), (target.vx, target.vy))
            dx = interceptor.x - target.x
            dy = interceptor.y - target.y
            if np.sqrt(dx**2 + dy**2) < self.engagement_range and not interceptor.has_engaged:
                interceptor.has_engaged = True
                ts = self._format_ts(self.sim_time)
                if self._resolve_pk(target):
                    destroyed_targets.append((iid, interceptor.target_id, interceptor.x, interceptor.y))
                    self._stats['kills'] += 1
                    self._events.append({
                        "id": self._next_id, "time": ts, "type": "DESTROYED",
                        "message": f"TRK-{interceptor.target_id:03d} DESTROYED by INT-{iid:03d}"
                    })
                    self._next_id += 1
                else:
                    destroyed_interceptors.append((iid, interceptor.x, interceptor.y))
                    self._stats['misses'] += 1
                    self._launched_at.discard(interceptor.target_id)
                    self._warned_threats.discard(interceptor.target_id)
                    self._no_interceptor_logged.discard(interceptor.target_id)
                    self.miss_markers.append(MissMarker(interceptor.x, interceptor.y))
                    self._events.append({
                        "id": self._next_id, "time": ts, "type": "MISS",
                        "message": f"INT-{iid:03d} MISSED TRK-{interceptor.target_id:03d}"
                    })
                    self._next_id += 1

        for iid, x, y in destroyed_interceptors:
            self.interceptors.pop(iid, None)
        for iid, tid, x, y in destroyed_targets:
            self.interceptors.pop(iid, None)
            if tid in self.tracks:
                self.tracks.pop(tid, None)
            self.explosions.append(Explosion(x, y))
            self._threats = [t for t in self._threats if t["track_id"] != tid]
            self._warned_threats.discard(tid)
            self._launched_at.discard(tid)
            self._no_interceptor_logged.discard(tid)

        for explosion in list(self.explosions):
            explosion.update(dt)
            if not explosion.alive:
                self.explosions.remove(explosion)

        for marker in list(self.miss_markers):
            marker.update(dt)
            if not marker.alive:
                self.miss_markers.remove(marker)

        # Radar phase: each site computes its own visibility
        site_visibility = {}
        for radar in self.radars:
            radar.update(self.tracks, self.sim_time, dt)
            site_visibility[radar.id] = radar.get_visible_set()

        # Aggregate: visible if ANY site detects the track
        for tid, track in self.tracks.items():
            track.visible = any(tid in sv for sv in site_visibility.values())

        # Global jamming and flicker (ground truth, computed once per tick)
        self._compute_jamming_and_flicker()

        # Display position: closest detecting site determines noise
        self._fuse_display_positions(site_visibility)

        self._evaluate_threats()

    def _compute_jamming_and_flicker(self):
        jammer_ids = {
            tid for tid, t in self.tracks.items()
            if getattr(t, 'track_type', 'STANDARD') == 'JAMMER'
        }

        for tid, track in self.tracks.items():
            track.jammed = False
            if tid in jammer_ids:
                continue
            min_dist = float('inf')
            for jid in jammer_ids:
                jammer = self.tracks[jid]
                d = np.sqrt((track.x - jammer.x)**2 + (track.y - jammer.y)**2)
                if d < min_dist:
                    min_dist = d
            if min_dist <= self.jam_radius:
                track.jammed = True

        # Flicker: global — may override aggregated visibility
        for tid, track in self.tracks.items():
            if track.jammed and self._rng.random() < self.jam_flicker_chance:
                track.visible = False

    def _fuse_display_positions(self, site_visibility):
        for tid, track in self.tracks.items():
            track.display_x = track.x
            track.display_y = track.y
            if not track.visible:
                continue
            best_radar = None
            best_dist = float('inf')
            for radar in self.radars:
                if tid in site_visibility.get(radar.id, set()):
                    d = np.sqrt((track.x - radar.x)**2 + (track.y - radar.y)**2)
                    if d < best_dist:
                        best_dist = d
                        best_radar = radar
            if best_radar is not None:
                noise_std = best_radar.noise_std
                if track.jammed:
                    noise_std *= best_radar.jam_noise_multiplier
                track.display_x = track.x + self._rng.normal(0, noise_std)
                track.display_y = track.y + self._rng.normal(0, noise_std)

    def _detect_leakers(self):
        for tid, track in list(self.tracks.items()):
            if track.classification != Classification.HOSTILE:
                continue
            dist = np.sqrt(track.x**2 + track.y**2)
            if dist < self.leaker_threshold:
                self._stats['leakers'] += 1
                ts = self._format_ts(self.sim_time)
                self._events.append({
                    "id": self._next_id, "time": ts, "type": "LEAKER",
                    "message": f"TRK-{tid:03d} breached defensive perimeter at {dist:.0f}m"
                })
                self._next_id += 1
                self.tracks.pop(tid, None)
                self._threats = [t for t in self._threats if t["track_id"] != tid]
                self._warned_threats.discard(tid)
                self._launched_at.discard(tid)
                self._no_interceptor_logged.discard(tid)

    def _evaluate_threats(self):
        candidates = []
        for tid, track in list(self.tracks.items()):
            is_eligible = (
                track.classification == Classification.HOSTILE and track.visible
            )
            eta = ThreatAssessor.evaluate(track) if is_eligible else None

            if is_eligible and eta is not None and eta < 120:
                entry = {"track_id": tid, "eta": round(eta, 1)}
                existing = next((t for t in self._threats if t["track_id"] == tid), None)
                if existing:
                    existing["eta"] = round(eta, 1)
                else:
                    self._threats.append(entry)

                if eta < 60 and tid not in self._warned_threats:
                    self._warned_threats.add(tid)
                    ts = self._format_ts(self.sim_time)
                    m, s = divmod(int(eta), 60)
                    self._events.append({
                        "id": self._next_id, "time": ts, "type": "THREAT",
                        "message": f"TRK-{tid:03d} THREAT ETA {m:02d}:{s:02d} SPD {track.speed:.0f}"
                    })
                    self._next_id += 1

                if eta < 60 and tid not in self._launched_at:
                    candidates.append({
                        "track_id": tid,
                        "x": track.x,
                        "y": track.y,
                        "vx": track.vx,
                        "vy": track.vy,
                        "eta": eta,
                        "speed": track.speed,
                        "dist": np.sqrt(track.x**2 + track.y**2),
                        "track_type": track.track_type,
                        "jammed": track.jammed,
                        "heading": track.heading,
                    })
                    if track.jammed:
                        self._jammed_candidate_count += 1
                    if track.track_type == 'SWARM':
                        self._swarm_candidate_count += 1
            else:
                self._threats = [t for t in self._threats if t["track_id"] != tid]
                self._no_interceptor_logged.discard(tid)

        in_flight = len(self.interceptors)
        inventory_remaining = self.interceptor_inventory - self._interceptors_launched
        if self._external_engagement is not None:
            selected = self._external_engagement
            self._external_engagement = None
        else:
            selected = self.policy.select_engagements(candidates, in_flight, inventory_remaining, self.max_concurrent_engagements, interceptor_inventory=self.interceptor_inventory)

        if len(selected) < len(candidates):
            for c in candidates:
                if c["track_id"] not in selected and c["track_id"] not in self._no_interceptor_logged:
                    self._no_interceptor_logged.add(c["track_id"])
                    ts = self._format_ts(self.sim_time)
                    if inventory_remaining <= 0:
                        msg = f"TRK-{c['track_id']:03d} cannot engage — inventory exhausted"
                    else:
                        msg = f"TRK-{c['track_id']:03d} cannot engage — concurrent limit reached ({self.max_concurrent_engagements})"
                    self._events.append({
                        "id": self._next_id, "time": ts, "type": "NO_INTERCEPTORS",
                        "message": msg,
                    })
                    self._next_id += 1

        for tid in selected:
            self._launched_at.add(tid)
            self._no_interceptor_logged.discard(tid)
            iid = self.launch_interceptor(tid)
            if iid is not None:
                self._interceptors_launched += 1
                self._stats['launched'] = self._interceptors_launched
                self._stats['inventory_remaining'] = self.interceptor_inventory - self._interceptors_launched
                if tid not in self._stats['threats_engaged']:
                    self._stats['threats_engaged'].append(tid)
                ts = self._format_ts(self.sim_time)
                self._events.append({
                    "id": self._next_id, "time": ts, "type": "LAUNCH",
                    "message": f"INT-{iid:03d} LAUNCH -> TRK-{tid:03d}"
                })
                self._next_id += 1

        if len([t for t in self.tracks.values() if t.classification == Classification.HOSTILE]) < 6:
            self._spawn_extra_hostile()

    def _spawn_extra_hostile(self):
        angle = self._rng.uniform(0, 2 * np.pi)
        r = self._rng.uniform(self.spawn_distance_min, self.spawn_distance_max)
        spd = self._rng.uniform(self.threat_speed_min, self.threat_speed_max)
        sx = r * np.cos(angle)
        sy = r * np.sin(angle)
        target_angle = np.arctan2(-sy, -sx)
        ts = self._format_ts(self.sim_time)

        if self._rng.random() < self.swarm_chance:
            swarm_size = self._rng.integers(self.swarm_min_size, self.swarm_max_size + 1)
            member_ids = []
            for i in range(swarm_size):
                off_x = self._rng.uniform(-200, 200)
                off_y = self._rng.uniform(-200, 200)
                mid = self._next_id
                self._next_id += 1
                member_ids.append(mid)
                track = Track(
                    mid, sx + off_x, sy + off_y,
                    spd * np.cos(target_angle), spd * np.sin(target_angle),
                    Classification.HOSTILE,
                    altitude=self._rng.uniform(4000, 10000),
                    track_type='SWARM',
                    group_id=member_ids[0],
                )
                track.offset_x = off_x
                track.offset_y = off_y
                self.tracks[mid] = track
                self._total_hostiles_spawned += 1
                self._swarm_spawned += 1
            self._events.append({
                "id": self._next_id, "time": ts, "type": "DETECTED",
                "message": f"SWARM contact: {swarm_size} hostiles, group GRP-{member_ids[0]:03d}"
            })
            self._next_id += 1
            return

        track_type = 'JAMMER' if self._rng.random() < self.jammer_chance else 'STANDARD'
        track = Track(
            self._next_id, sx, sy,
            spd * np.cos(target_angle), spd * np.sin(target_angle),
            Classification.HOSTILE,
            altitude=self._rng.uniform(4000, 10000),
            track_type=track_type,
        )
        self.tracks[self._next_id] = track
        self._total_hostiles_spawned += 1
        self._events.append({
            "id": self._next_id, "time": ts, "type": "DETECTED",
            "message": f"NEW CONTACT TRK-{self._next_id:03d} AZ {np.degrees(angle):.0f} RNG {r/1000:.1f}km"
        })
        if track_type == 'JAMMER':
            self._jammed_spawned += 1
            self._events.append({
                "id": self._next_id + 1, "time": ts, "type": "JAMMER",
                "message": f"JAM TRK-{self._next_id:03d} jamming active, range {self.jam_radius}m"
            })
            self._next_id += 1
        self._next_id += 1

    def get_state_snapshot(self, speed=None):
        def serialize_track(t):
            target_id = getattr(t, "target_id", None)
            return {
                "id": t.id, "x": round(t.x, 1), "y": round(t.y, 1),
                "vx": round(t.vx, 1), "vy": round(t.vy, 1),
                "altitude": round(t.altitude, 0),
                "classification": t.classification.name,
                "heading": round(t.heading, 3),
                "speed": round(t.speed, 1),
                "visible": t.visible,
                "displayX": round(t.display_x, 1),
                "displayY": round(t.display_y, 1),
                "history": [[round(p[0], 1), round(p[1], 1)] for p in t.history[-30:]],
                "targetId": target_id,
                "trackType": t.track_type,
                "jammed": t.jammed,
                "groupId": t.group_id,
            }

        return {
            "simTime": round(self.sim_time, 2),
            "tracks": [serialize_track(t) for t in self.tracks.values()],
            "interceptors": [serialize_track(t) for t in self.interceptors.values()],
            "explosions": [
                {"x": round(e.x, 1), "y": round(e.y, 1),
                 "radius": round(e.radius, 1), "alpha": round(e.alpha, 2)}
                for e in self.explosions
            ],
            "missMarkers": [
                {"x": round(m.x, 1), "y": round(m.y, 1),
                 "radius": round(m.radius, 1), "alpha": round(m.alpha, 2)}
                for m in self.miss_markers
            ],
            "radarSites": [
                {"id": r.id, "x": r.x, "y": r.y, "sweepAngle": round(r.sweep_angle, 3)}
                for r in self.radars
            ],
            "threats": self._threats,
            "events": self._events[-100:],
            "speed": speed,
            "stats": dict(self._stats),
        }

    def clear_events(self):
        self._events = []

    @staticmethod
    def _format_ts(sim_time):
        h = int(sim_time // 3600)
        m = int((sim_time % 3600) // 60)
        s = int(sim_time % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
