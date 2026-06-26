import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from simulation.simulator import Simulation
from simulation.trained_policy import TrainedPolicy
from simulation.policies import BaselinePolicy


MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'ppo_iads_safe_800000_steps.zip')


class TestSimulationWithPPO:
    def test_simulation_runs_with_ppo_policy(self):
        policy = TrainedPolicy(MODEL_PATH)
        sim = Simulation(dt=0.05, seed=42, policy=lambda: policy)
        for _ in range(500):
            sim.step(0.05)
        assert sim._stats is not None
        assert sim._stats['kills'] >= 0

    def test_ppo_policy_launches_interceptors(self):
        policy = TrainedPolicy(MODEL_PATH)
        sim = Simulation(dt=0.05, seed=42, policy=lambda: policy)
        steps = 0
        while sim._total_hostiles_spawned < 20 and steps < 2000:
            sim.step(0.05)
            steps += 1
        assert sim._stats['launched'] > 0, (
            f"PPO should launch interceptors. "
            f"launched={sim._stats['launched']}, "
            f"hostiles={sim._total_hostiles_spawned}, "
            f"steps={steps}"
        )

    def test_ppo_produces_different_behavior_from_baseline(self):
        ppo_policy = TrainedPolicy(MODEL_PATH)
        sim_ppo = Simulation(dt=0.05, seed=42, policy=lambda: ppo_policy)
        sim_base = Simulation(dt=0.05, seed=42, policy=BaselinePolicy)

        for _ in range(300):
            sim_ppo.step(0.05)
            sim_base.step(0.05)

        assert sim_ppo._stats['kills'] != sim_base._stats['kills'] or \
               sim_ppo._stats['launched'] != sim_base._stats['launched'] or \
               sim_ppo._stats['leakers'] != sim_base._stats['leakers'], \
               f"PPO and Baseline should diverge. PPO: kills={sim_ppo._stats['kills']} launched={sim_ppo._stats['launched']} | Base: kills={sim_base._stats['kills']} launched={sim_base._stats['launched']}"


class TestPolicySelection:
    def test_runner_registers_ppo(self):
        from simulation_runner import _POLICY_MAP
        assert "PPO_800k" in _POLICY_MAP, "PPO_800k must be registered in _POLICY_MAP"
        entry = _POLICY_MAP["PPO_800k"]
        policy = entry()
        from simulation.trained_policy import TrainedPolicy
        assert isinstance(policy, TrainedPolicy)
