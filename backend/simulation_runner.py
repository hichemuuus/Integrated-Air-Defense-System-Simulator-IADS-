import os
import time
import threading
import numpy as np
from dataclasses import dataclass, field
from queue import Queue, Empty
from simulation.simulator import Simulation
from simulation.policies import BaselinePolicy, PriorityPolicy, PriorityPolicyUnjammedFirst
from simulation.trained_policy import TrainedPolicy


_MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')

_POLICY_MAP = {
    "BaselinePolicy": BaselinePolicy,
    "PriorityPolicy": PriorityPolicy,
    "PriorityPolicyUnjammedFirst": PriorityPolicyUnjammedFirst,
    "PPO_800k": lambda: TrainedPolicy(os.path.join(_MODEL_DIR, "ppo_iads_safe_800000_steps.zip")),
}

# Default mapping from frontend ScenarioConfig keys to backend scenario keys
_FRONTEND_SCENARIO_DEFAULTS = {
    "numHostiles": 8,
    "numFriendlies": 3,
    "inventorySize": 30,
    "jammingIntensity": 0.2,
    "swarmMode": True,
    "threatSpeed": 1.0,
    "randomSeed": 42,
}

# Fixed spawn angles evenly distributed around the circle
_SPAWN_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315,
                 22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5,
                 11.25, 33.75, 56.25, 78.75, 101.25, 123.75, 146.25, 168.75,
                 191.25, 213.75, 236.25, 258.75, 281.25, 303.75]


def translate_frontend_config(frontend_config):
    """Convert frontend ScenarioConfig to backend simulation scenario dict.

    Accepts a dict with keys matching ScenarioConfig (camelCase) plus optional
    raw scenario keys that are passed through directly.

    Returns (seed, scenario_dict).
    """
    if frontend_config is None:
        return None, None

    seed = frontend_config.get("randomSeed", 42)
    threat_speed = frontend_config.get("threatSpeed", 1.0)
    base_hostile_speed = 250.0

    print(f"  [translate_frontend_config] raw config: {frontend_config}")
    print(f"  [translate_frontend_config] seed={seed}, threatSpeed={threat_speed}, inventorySize={frontend_config.get('inventorySize', 30)}, numHostiles={frontend_config.get('numHostiles', 8)}, numFriendlies={frontend_config.get('numFriendlies', 3)}, jammingIntensity={frontend_config.get('jammingIntensity', 0.2)}, swarmMode={frontend_config.get('swarmMode', True)}")

    # Spawn positions: distribute numHostiles around the circle
    num_hostiles = frontend_config.get("numHostiles", 8)
    spawn_dist = 11000.0
    selected_angles = _SPAWN_ANGLES[:num_hostiles]
    rng = np.random.default_rng(seed)
    rng.shuffle(selected_angles)
    initial_spawns = []
    for i, deg in enumerate(selected_angles):
        rad = np.radians(deg)
        alt = float(rng.integers(4000, 10000))
        initial_spawns.append({
            "x": spawn_dist * np.cos(rad),
            "y": spawn_dist * np.sin(rad),
            "alt": alt,
        })

    num_friendlies = frontend_config.get("numFriendlies", 3)
    friendly_spawns = []
    friendly_configs = [
        {"x": -3000, "y": 0, "vx": 0, "vy": 180, "alt": 3000},
        {"x": 3000, "y": -3000, "vx": 180, "vy": 0, "alt": 3500},
        {"x": 0, "y": 4000, "vx": -150, "vy": 0, "alt": 2800},
    ]
    for i in range(min(num_friendlies, 10)):
        fcfg = friendly_configs[i % len(friendly_configs)]
        friendly_spawns.append({
            "x": fcfg["x"], "y": fcfg["y"],
            "vx": fcfg["vx"], "vy": fcfg["vy"],
            "alt": fcfg["alt"],
        })

    scenario = {
        "initial_spawns": initial_spawns,
        "friendly_spawns": friendly_spawns,
        "interceptor_inventory": frontend_config.get("inventorySize", 30),
        "hostile_speed": base_hostile_speed * threat_speed,
        "threat_speed_min": 200 * threat_speed,
        "threat_speed_max": 280 * threat_speed,
        "interceptor_speed": 400.0,
        "jammer_chance": frontend_config.get("jammingIntensity", 0.2),
        "jam_radius": 2500,
        "jam_noise_multiplier": 5,
        "jam_flicker_chance": frontend_config.get("jammingIntensity", 0.2),
        "swarm_chance": 0.30 if frontend_config.get("swarmMode", True) else 0.0,
        "swarm_min_size": 4,
        "swarm_max_size": 6,
        "pk_base": 0.85,
        "pk_jam_factor": 0.40,
        "pk_swarm_factor": 0.70,
        "max_concurrent_engagements": 6,
        "leaker_threshold": 2000,
        "engagement_range": 500.0,
        "spawn_distance_min": 10000,
        "spawn_distance_max": 12000,
        "radar_configs": [
            {"x": 0, "y": 0, "sweep_start": 0.0},
            {"x": 7000, "y": 0, "sweep_start": np.pi},
            {"x": -7000, "y": 0, "sweep_start": np.pi / 2},
        ],
    }

    print(f"  [translate_frontend_config] generated scenario: interceptor_inventory={scenario['interceptor_inventory']}, hostile_speed={scenario['hostile_speed']}, jammer_chance={scenario['jammer_chance']}, swarm_chance={scenario['swarm_chance']}, friendly_spawns={len(friendly_spawns)}")

    # Allow pass-through of any raw backend keys
    for k in ("jam_radius", "pk_base", "max_concurrent_engagements",
              "engagement_range", "spawn_distance_min", "spawn_distance_max",
              "radar_configs", "swarm_min_size", "swarm_max_size",
              "pk_jam_factor", "pk_swarm_factor", "leaker_threshold",
              "interceptor_speed", "jam_noise_multiplier"):
        if k in frontend_config:
            scenario[k] = frontend_config[k]
            print(f"  [translate_frontend_config] pass-through key {k}={frontend_config[k]}")

    return seed, scenario


@dataclass
class ControlMessage:
    action: str
    payload: dict = field(default_factory=dict)


class SimulationRunner:
    def __init__(self, dt=0.05, seed=None, scenario=None):
        self.dt = dt
        self._seed = seed
        self._scenario_config = scenario
        self.sim = self._create_sim()
        self._speed = 1.0
        self._running = False
        self._thread = None
        self._state_queue: Queue = Queue(maxsize=2)
        self._control_queue: Queue = Queue()
        self._lock = threading.Lock()

    def _log_config(self, label="Simulation"):
        s = self._scenario_config or {}
        print(f"\n{'='*50}")
        print(f"  {label}")
        print(f"  {'='*50}")
        print(f"  Hostiles:        {s.get('numHostiles', 8)}")
        print(f"  Friendlies:      {s.get('numFriendlies', 3)}")
        print(f"  Inventory:       {s.get('inventorySize', 30)}")
        print(f"  Jamming:         {s.get('jammingIntensity', 0.2)}")
        print(f"  ThreatSpeed:     {s.get('threatSpeed', 1.0)}x")
        print(f"  Seed:            {s.get('randomSeed', 42)}")
        print(f"  Swarm Mode:      {s.get('swarmMode', True)}")
        print(f"  {'='*50}\n")

    def _create_sim(self):
        self._log_config("Starting Simulation")
        seed, scenario = translate_frontend_config(self._scenario_config)
        print(f"  [_create_sim] seed={seed}, scenario keys={list(scenario.keys()) if scenario else None}")
        print(f"  [_create_sim] interceptor_inventory={scenario.get('interceptor_inventory') if scenario else 'N/A'}")
        print(f"  [_create_sim] hostile_speed={scenario.get('hostile_speed') if scenario else 'N/A'}")
        print(f"  [_create_sim] friendly_spawns={len(scenario.get('friendly_spawns', [])) if scenario else 0}")
        return Simulation(dt=self.dt, seed=seed, scenario=scenario)

    @property
    def speed(self):
        return self._speed

    @speed.setter
    def speed(self, value):
        with self._lock:
            self._speed = max(0.1, min(10.0, value))

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None

    def get_state(self):
        try:
            return self._state_queue.get_nowait()
        except Empty:
            return None

    def send_control(self, msg: ControlMessage):
        if msg.action == "step":
            if not self._running:
                self._do_single_step()
            return
        if msg.action == "set_policy":
            policy_cls = _POLICY_MAP.get(msg.payload.get("policy_name", ""))
            if policy_cls:
                with self._lock:
                    self.sim.policy = policy_cls()
            return
        if msg.action == "pause":
            self._running = False
            snapshot = self.sim.get_state_snapshot(speed=self._speed)
            snapshot["running"] = False
            try:
                self._state_queue.put_nowait(snapshot)
            except:
                pass
            return
        if msg.action == "resume":
            scenario = msg.payload.get("scenario", {})
            if scenario:
                with self._lock:
                    self._scenario_config = scenario
                    self._seed = scenario.get("randomSeed", 42)
            self._running = True
            if not self._thread or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._run_loop, daemon=True)
                self._thread.start()
            return
        if msg.action == "reset":
            with self._lock:
                payload_scenario = msg.payload.get("scenario", None)
                if payload_scenario:
                    self._scenario_config = payload_scenario
                    self._seed = payload_scenario.get("randomSeed", 42)
            self.sim = self._create_sim()
            self._interceptors_launched = 0
            self._speed = 1.0
            return
        if msg.action == "speed":
            self.speed = msg.payload.get("speed", 1.0)
            return
        self._control_queue.put(msg)

    def _do_single_step(self):
        self.sim.step(self.dt)
        snapshot = self.sim.get_state_snapshot(speed=0)
        snapshot["running"] = False
        try:
            self._state_queue.put_nowait(snapshot)
        except:
            pass

    def _run_loop(self):
        while self._running:
            self._process_controls()
            if not self._running:
                break

            speed = self.speed
            self.sim.step(self.dt * speed)

            if not self._running:
                break

            snapshot = self.sim.get_state_snapshot(speed=speed)
            snapshot["running"] = self._running
            try:
                self._state_queue.put_nowait(snapshot)
            except:
                pass

            if not self._running:
                break

            sleep_time = self.dt * max(0.01, 1.0 / (speed or 1))
            sleep_time = max(0.001, min(sleep_time, 0.05))
            for _ in range(int(sleep_time / 0.01)):
                if not self._running:
                    return
                time.sleep(0.01)

    def _process_controls(self):
        while True:
            try:
                msg = self._control_queue.get_nowait()
            except Empty:
                return

            if msg.action == "pause":
                self._running = False
            elif msg.action == "resume":
                scenario = msg.payload.get("scenario", {})
                if scenario:
                    with self._lock:
                        self._scenario_config = scenario
                        self._seed = scenario.get("randomSeed", 42)
                self._running = True
                if not self._thread or not self._thread.is_alive():
                    self._thread = threading.Thread(target=self._run_loop, daemon=True)
                    self._thread.start()
            elif msg.action == "speed":
                self.speed = msg.payload.get("speed", 1.0)
            elif msg.action == "set_policy":
                policy_cls = _POLICY_MAP.get(msg.payload.get("policy_name", ""))
                if policy_cls:
                    self.sim.policy = policy_cls()
            elif msg.action == "configure":
                scenario = msg.payload.get("scenario", {})
                with self._lock:
                    self._scenario_config = scenario
                    self._seed = scenario.get("randomSeed", 42)
                print(f"  Configuration updated: {scenario}")
            elif msg.action == "step":
                pass  # Handled synchronously in send_control when paused; no-op when running
            elif msg.action == "launch":
                target_id = msg.payload.get("target_id")
                if target_id:
                    iid = self.sim.launch_interceptor(target_id)
                    if iid is not None:
                        ts = self.sim._format_ts(self.sim.sim_time)
                        self.sim._events.append({
                            "id": self.sim._next_id, "time": ts, "type": "LAUNCH",
                            "message": f"INT-{iid:03d} MANUAL LAUNCH -> TRK-{target_id:03d}"
                        })
                        self.sim._next_id += 1
            elif msg.action == "reset":
                with self._lock:
                    payload_scenario = msg.payload.get("scenario", None)
                    if payload_scenario:
                        self._scenario_config = payload_scenario
                        self._seed = payload_scenario.get("randomSeed", 42)
                print(f"  [reset] stored config: {self._scenario_config}")
                self.sim = self._create_sim()
                self._interceptors_launched = 0
