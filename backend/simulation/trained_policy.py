import sys
import traceback
from stable_baselines3 import PPO

from simulation.observation_encoder import encode_observation


class TrainedPolicy:
    def __init__(self, model_path):
        self.model = PPO.load(model_path, device='cpu')

    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent, **kwargs):
        slots = min(max_concurrent - in_flight, inventory_remaining)
        if slots <= 0 or not threats:
            return []

        interceptor_inventory = kwargs.get('interceptor_inventory', max_concurrent * 5)
        obs = encode_observation(threats, in_flight, inventory_remaining, max_concurrent, interceptor_inventory)
        try:
            action, _ = self.model.predict(obs, deterministic=True)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            return []
        if action == 0:
            return []
        idx = action - 1
        if idx >= len(threats):
            idx = len(threats) - 1
        return [threats[idx]["track_id"]]
