import time
import threading
from queue import Queue, Empty

from simulation.simulator import Simulation
from simulation_runner import translate_frontend_config, _POLICY_MAP


class ComparisonCoordinator:
    def __init__(self, scenario_cfg, policy_a_name, policy_b_name, dt=0.05):
        self.dt = dt
        seed, scenario = translate_frontend_config(scenario_cfg)
        self.sim_a = Simulation(dt=dt, seed=seed, scenario=scenario)
        self.sim_b = Simulation(dt=dt, seed=seed, scenario=scenario)
        self._apply_policy(self.sim_a, policy_a_name)
        self._apply_policy(self.sim_b, policy_b_name)
        self._speed = 1.0
        self._running = False
        self._thread = None
        self._state_queue: Queue = Queue(maxsize=4)

    @staticmethod
    def _apply_policy(sim, policy_name):
        entry = _POLICY_MAP.get(policy_name)
        if entry is not None:
            sim.policy = entry() if callable(entry) else entry

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

    def reset(self, scenario_cfg, policy_a_name, policy_b_name):
        self.stop()
        seed, scenario = translate_frontend_config(scenario_cfg)
        self.sim_a = Simulation(dt=self.dt, seed=seed, scenario=scenario)
        self.sim_b = Simulation(dt=self.dt, seed=seed, scenario=scenario)
        self._apply_policy(self.sim_a, policy_a_name)
        self._apply_policy(self.sim_b, policy_b_name)
        self._speed = 1.0
        self._state_queue = Queue(maxsize=4)

    def set_policy(self, which, policy_name):
        sim = self.sim_a if which == "A" else self.sim_b
        self._apply_policy(sim, policy_name)

    @property
    def speed(self):
        return self._speed

    @speed.setter
    def speed(self, value):
        self._speed = max(0.1, min(10.0, value))

    @property
    def running(self):
        return self._running

    @property
    def sim_time(self):
        return self.sim_a.sim_time

    def get_state(self):
        try:
            return self._state_queue.get_nowait()
        except Empty:
            return None

    def _run_loop(self):
        while self._running:
            self.sim_a.step(self.dt * self._speed)
            self.sim_b.step(self.dt * self._speed)

            snap_a = self.sim_a.get_state_snapshot(speed=self._speed)
            snap_b = self.sim_b.get_state_snapshot(speed=self._speed)
            try:
                self._state_queue.put_nowait({
                    "type": "snapshot",
                    "simTime": round(self.sim_a.sim_time, 2),
                    "snapshotA": snap_a,
                    "snapshotB": snap_b,
                })
            except:
                pass

            if not self._running:
                return

            sleep_time = self.dt * max(0.01, 1.0 / (self._speed or 1))
            sleep_time = max(0.001, min(sleep_time, 0.05))
            for _ in range(int(sleep_time / 0.01)):
                if not self._running:
                    return
                time.sleep(0.01)
