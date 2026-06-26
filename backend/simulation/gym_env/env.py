import gymnasium as gym
import numpy as np
from gymnasium import spaces

from simulation.simulator import Simulation
from simulation.physics import Classification
from simulation.radar import ThreatAssessor
from simulation.observation_encoder import encode_observation, MAX_CANDIDATES, OBSERVATION_DIM

SIM_DT = 0.05
TRIAL_HOSTILES = 100


class _NullPolicy:
    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent):
        return []


class IADSGymEnv(gym.Env):
    def __init__(self):
        self.action_space = spaces.Discrete(1 + MAX_CANDIDATES)

        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(OBSERVATION_DIM,), dtype=np.float32,
        )

        self.sim = None
        self._current_candidates = []
        self._draining = False
        self._shaping_reward = 0.0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        scenario = (options or {}).get('scenario', None)
        self.sim = Simulation(dt=SIM_DT, seed=seed, scenario=scenario)
        self._episode_hostiles = (self.sim.scenario or {}).get('threat_count', TRIAL_HOSTILES)
        self.sim.policy = _NullPolicy()
        self._current_candidates = []
        self._draining = False
        self._shaping_reward = 0.0

        terminated = self._advance_to_next_decision()

        return self._build_observation(), {}

    def step(self, action):
        if self.sim is None:
            raise RuntimeError("Call reset() before step()")

        prev_kills = self.sim._stats['kills']
        prev_misses = self.sim._stats['misses']
        prev_leakers = self.sim._stats['leakers']

        had_candidates = len(self._current_candidates) > 0

        action_valid = False
        engagement_bonus = 0.0
        if action > 0:
            idx = action - 1
            if idx < len(self._current_candidates):
                target_id = self._current_candidates[idx]['track_id']
                if target_id in self.sim.tracks and target_id not in self.sim._launched_at:
                    self.sim._external_engagement = [target_id]
                    action_valid = True
                    engagement_bonus = 1.0

        idle_penalty = -50.0 if (had_candidates and action == 0) else 0.0

        self._shaping_reward = 0.0

        terminated = self._advance_to_next_decision()

        kill_delta = self.sim._stats['kills'] - prev_kills
        miss_delta = self.sim._stats['misses'] - prev_misses
        leaker_delta = self.sim._stats['leakers'] - prev_leakers

        reward = (+1.0 * kill_delta - 0.1 * miss_delta - 10.0 * leaker_delta
                  + self._shaping_reward)

        if action_valid:
            reward += engagement_bonus
        elif action > 0 and not action_valid:
            reward -= 0.05

        reward += idle_penalty

        reward = float(np.clip(reward, -20.0, 5.0))

        obs = self._build_observation()
        info = {
            'kills': self.sim._stats['kills'],
            'misses': self.sim._stats['misses'],
            'leakers': self.sim._stats['leakers'],
            'inventory': self.sim._stats['inventory_remaining'],
            'candidates': len(self._current_candidates),
        }

        return obs, reward, terminated, False, info

    def render(self):
        if self.sim is None:
            return
        n_cand = len(self._current_candidates)
        n_flight = len(self.sim.interceptors)
        inv = self.sim._stats['inventory_remaining']
        print(
            f"[IADS] t={self.sim.sim_time:7.1f}s  "
            f"candidates={n_cand:2d}  "
            f"kills={self.sim._stats['kills']:2d}  "
            f"misses={self.sim._stats['misses']:2d}  "
            f"leakers={self.sim._stats['leakers']:2d}  "
            f"in_flight={n_flight:1d}  "
            f"inventory={inv:2d}  "
            f"hostiles={self.sim._total_hostiles_spawned:3d}"
        )

    def close(self):
        self.sim = None

    def _advance_to_next_decision(self):
        while True:
            if not self._draining and self.sim._total_hostiles_spawned >= self._episode_hostiles:
                self._draining = True

            if self._draining:
                self.sim.step(SIM_DT)
                if not self.sim.interceptors and not self.sim.explosions:
                    self._current_candidates = []
                    return True
                continue

            self.sim.step(SIM_DT)
            self._accumulate_distance_shaping()

            decision = self._check_decision_point()
            if decision:
                self._current_candidates = decision
                return False

    def _accumulate_distance_shaping(self):
        engaged = {i.target_id for i in self.sim.interceptors.values()}
        max_range = self.sim.spawn_distance_max
        for tid, track in self.sim.tracks.items():
            if track.classification != Classification.HOSTILE or not track.visible:
                continue
            dist = np.sqrt(track.x ** 2 + track.y ** 2)
            closeness = max(0.0, 1.0 - dist / max_range)
            if tid in engaged:
                self._shaping_reward -= 0.001 * closeness
            else:
                self._shaping_reward -= 0.005 * closeness

    def _check_decision_point(self):
        candidates_info = []
        for tid, track in self.sim.tracks.items():
            if track.classification != Classification.HOSTILE or not track.visible:
                continue
            eta = ThreatAssessor.evaluate(track)
            if eta is None or eta >= 60.0:
                continue
            if tid in self.sim._launched_at:
                continue
            candidates_info.append({
                'track_id': tid,
                'x': track.x,
                'y': track.y,
                'vx': track.vx,
                'vy': track.vy,
                'eta': eta,
                'speed': track.speed,
                'dist': np.sqrt(track.x ** 2 + track.y ** 2),
                'track_type': track.track_type,
                'jammed': track.jammed,
                'heading': track.heading,
            })

        in_flight = len(self.sim.interceptors)
        inventory_remaining = self.sim.interceptor_inventory - self.sim._interceptors_launched
        slots = min(self.sim.max_concurrent_engagements - in_flight, inventory_remaining)

        if len(candidates_info) > 0 and slots > 0:
            return candidates_info
        return None

    def _build_observation(self):
        in_flight = len(self.sim.interceptors)
        max_inv = self.sim.interceptor_inventory
        max_conc = self.sim.max_concurrent_engagements
        inventory_remaining = max_inv - self.sim._interceptors_launched
        return encode_observation(
            self._current_candidates,
            in_flight,
            inventory_remaining,
            max_conc,
            max_inv,
        )
