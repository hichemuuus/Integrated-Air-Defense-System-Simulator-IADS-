import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import numpy as np
from simulation.trained_policy import TrainedPolicy


MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'ppo_iads_safe_800000_steps.zip')


def _sample_candidate(tid, x=5000, y=3000, vx=-200, vy=-150, eta=35.0):
    return {
        'track_id': tid, 'x': x, 'y': y,
        'vx': vx, 'vy': vy, 'eta': eta,
        'speed': np.sqrt(vx**2 + vy**2),
        'dist': np.sqrt(x**2 + y**2),
        'track_type': 'STANDARD',
        'jammed': False,
        'heading': np.arctan2(vy, vx),
    }


class TestTrainedPolicyLoads:
    def test_model_loading_succeeds(self):
        policy = TrainedPolicy(MODEL_PATH)
        assert policy is not None
        assert policy.model is not None

    def test_model_loading_fails_with_bad_path(self):
        with pytest.raises(Exception):
            TrainedPolicy("nonexistent_model.zip")


class TestTrainedPolicyInference:
    def test_returns_list_of_track_ids(self):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(1), _sample_candidate(2)]
        result = policy.select_engagements(threats, 0, 30, 6, interceptor_inventory=30)
        assert isinstance(result, list)
        if len(result) > 0:
            assert isinstance(result[0], int)

    def test_returns_empty_when_no_threats(self):
        policy = TrainedPolicy(MODEL_PATH)
        result = policy.select_engagements([], 0, 30, 6, interceptor_inventory=30)
        assert result == []

    def test_returns_empty_when_no_slots(self):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(1)]
        result = policy.select_engagements(threats, 6, 0, 6, interceptor_inventory=30)
        assert result == []

    def test_returns_empty_when_in_flight_at_capacity(self):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(1)]
        result = policy.select_engagements(threats, 6, 10, 6, interceptor_inventory=30)
        assert result == []

    def test_deterministic_inference(self):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(i, 10000 - i*500, 8000 - i*300, -250 + i*10, -180 + i*5, 20 + i*2)
                   for i in range(1, 9)]
        result1 = policy.select_engagements(threats, 0, 30, 6, interceptor_inventory=30)
        result2 = policy.select_engagements(threats, 0, 30, 6, interceptor_inventory=30)
        assert result1 == result2


class TestTrainedPolicyErrorHandling:
    def test_predict_failure_returns_empty_list(self, monkeypatch):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(1)]

        def _broken_predict(*args, **kwargs):
            raise RuntimeError("Model crashed")

        monkeypatch.setattr(policy.model, 'predict', _broken_predict)
        result = policy.select_engagements(threats, 0, 30, 6, interceptor_inventory=30)
        assert result == []

    def test_predict_failure_does_not_crash_sim(self, monkeypatch):
        policy = TrainedPolicy(MODEL_PATH)
        threats = [_sample_candidate(1)]

        def _broken_predict(*args, **kwargs):
            raise ValueError("OOM")

        monkeypatch.setattr(policy.model, 'predict', _broken_predict)
        for _ in range(10):
            result = policy.select_engagements(threats, 0, 30, 6, interceptor_inventory=30)
            assert result == []
