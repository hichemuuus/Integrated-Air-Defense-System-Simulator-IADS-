import json
import numpy as np

DEFAULT_RADAR = {"detection_range": 10000, "auto_track_range": 4000,
                 "noise_std": 50.0}
DEFAULT_SPAWNS = [
    {"x": -9500, "y": -2000, "alt": 7500},
    {"x": 1500, "y": -9500, "alt": 4500},
    {"x": 9500, "y": 3000, "alt": 9000},
]


class ScenarioGenerator:
    def generate_easy(self):
        return {
            "name": "easy",
            "threat_count": 80,
            "interceptor_inventory": 50,
            "max_concurrent_engagements": 8,
            "jammer_chance": 0.10,
            "swarm_chance": 0.15,
            "swarm_min_size": 3,
            "swarm_max_size": 4,
            "threat_speed_min": 150,
            "threat_speed_max": 200,
            "hostile_speed": 200.0,
            "pk_base": 0.90,
            "pk_jam_factor": 0.50,
            "pk_swarm_factor": 0.75,
            "spawn_distance_min": 12000,
            "spawn_distance_max": 15000,
            "leaker_threshold": 1500,
            "interceptor_speed": 500.0,
            "engagement_range": 600.0,
            "jam_radius": 2000,
            "jam_flicker_chance": 0.10,
            "radar_configs": [
                {"x": 0, "y": 0, "sweep_start": 0.0, **DEFAULT_RADAR},
                {"x": 7000, "y": 0, "sweep_start": 3.1416, **DEFAULT_RADAR},
            ],
            "initial_spawns": DEFAULT_SPAWNS,
        }

    def generate_medium(self):
        return {
            "name": "medium",
            "threat_count": 100,
            "interceptor_inventory": 30,
            "max_concurrent_engagements": 6,
            "jammer_chance": 0.20,
            "swarm_chance": 0.30,
            "swarm_min_size": 4,
            "swarm_max_size": 6,
            "threat_speed_min": 200,
            "threat_speed_max": 280,
            "hostile_speed": 250.0,
            "pk_base": 0.85,
            "pk_jam_factor": 0.40,
            "pk_swarm_factor": 0.70,
            "spawn_distance_min": 10000,
            "spawn_distance_max": 12000,
            "leaker_threshold": 2000,
            "interceptor_speed": 400.0,
            "engagement_range": 500.0,
            "jam_radius": 2500,
            "jam_flicker_chance": 0.20,
            "radar_configs": [
                {"x": 0, "y": 0, "sweep_start": 0.0, **DEFAULT_RADAR},
                {"x": 7000, "y": 0, "sweep_start": 3.1416, **DEFAULT_RADAR},
                {"x": -7000, "y": 0, "sweep_start": 1.5708, **DEFAULT_RADAR},
            ],
            "initial_spawns": DEFAULT_SPAWNS,
        }

    def generate_hard(self):
        return {
            "name": "hard",
            "threat_count": 120,
            "interceptor_inventory": 20,
            "max_concurrent_engagements": 4,
            "jammer_chance": 0.30,
            "swarm_chance": 0.40,
            "swarm_min_size": 5,
            "swarm_max_size": 8,
            "threat_speed_min": 250,
            "threat_speed_max": 350,
            "hostile_speed": 300.0,
            "pk_base": 0.75,
            "pk_jam_factor": 0.30,
            "pk_swarm_factor": 0.60,
            "spawn_distance_min": 8000,
            "spawn_distance_max": 10000,
            "leaker_threshold": 2500,
            "interceptor_speed": 350.0,
            "engagement_range": 400.0,
            "jam_radius": 3000,
            "jam_flicker_chance": 0.30,
            "radar_configs": [
                {"x": 0, "y": 0, "sweep_start": 0.0, **DEFAULT_RADAR},
                {"x": 7000, "y": 0, "sweep_start": 3.1416, **DEFAULT_RADAR,
                 "detection_range": 8000, "noise_std": 80.0},
            ],
            "initial_spawns": DEFAULT_SPAWNS,
        }

    def generate_extreme(self):
        return {
            "name": "extreme",
            "threat_count": 150,
            "interceptor_inventory": 12,
            "max_concurrent_engagements": 3,
            "jammer_chance": 0.35,
            "swarm_chance": 0.50,
            "swarm_min_size": 6,
            "swarm_max_size": 10,
            "threat_speed_min": 300,
            "threat_speed_max": 400,
            "hostile_speed": 350.0,
            "pk_base": 0.65,
            "pk_jam_factor": 0.25,
            "pk_swarm_factor": 0.50,
            "spawn_distance_min": 6000,
            "spawn_distance_max": 9000,
            "leaker_threshold": 3000,
            "interceptor_speed": 300.0,
            "engagement_range": 350.0,
            "jam_radius": 3500,
            "jam_flicker_chance": 0.40,
            "radar_configs": [
                {"x": 0, "y": 0, "sweep_start": 0.0, **DEFAULT_RADAR,
                 "detection_range": 7000, "noise_std": 100.0},
                {"x": 7000, "y": 0, "sweep_start": 3.1416, **DEFAULT_RADAR,
                 "detection_range": 7000, "noise_std": 100.0},
            ],
            "initial_spawns": DEFAULT_SPAWNS,
        }

    def generate_random(self, seed):
        rng = np.random.default_rng(seed)
        smin = rng.integers(3, 7)
        return {
            "name": "random",
            "threat_count": int(rng.integers(60, 160)),
            "interceptor_inventory": int(rng.integers(10, 50)),
            "max_concurrent_engagements": int(rng.integers(2, 8)),
            "jammer_chance": round(rng.uniform(0.05, 0.40), 2),
            "swarm_chance": round(rng.uniform(0.10, 0.50), 2),
            "swarm_min_size": int(smin),
            "swarm_max_size": int(rng.integers(smin + 1, 11)),
            "threat_speed_min": int(rng.integers(150, 280)),
            "threat_speed_max": int(rng.integers(250, 400)),
            "hostile_speed": round(rng.uniform(180, 350), 1),
            "pk_base": round(rng.uniform(0.60, 0.95), 2),
            "pk_jam_factor": round(rng.uniform(0.20, 0.55), 2),
            "pk_swarm_factor": round(rng.uniform(0.45, 0.80), 2),
            "spawn_distance_min": int(rng.integers(6000, 12000)),
            "spawn_distance_max": int(rng.integers(9000, 15000)),
            "leaker_threshold": int(rng.integers(1500, 3000)),
            "interceptor_speed": round(rng.uniform(280, 500), 1),
            "engagement_range": round(rng.uniform(300, 650), 1),
            "jam_radius": int(rng.integers(2000, 3500)),
            "jam_flicker_chance": round(rng.uniform(0.10, 0.40), 2),
            "radar_configs": [
                {"x": 0, "y": 0, "sweep_start": 0.0, **DEFAULT_RADAR},
            ],
            "initial_spawns": DEFAULT_SPAWNS,
        }

    @staticmethod
    def to_json(scenario):
        return json.dumps(scenario, indent=2, default=str)

    @staticmethod
    def from_json(text):
        return json.loads(text)
