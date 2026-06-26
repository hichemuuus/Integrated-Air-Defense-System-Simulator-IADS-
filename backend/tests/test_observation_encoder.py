import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
from simulation.observation_encoder import encode_observation, MAX_CANDIDATES, N_THREAT_FEATURES, OBSERVATION_DIM


def _old_implementation(candidates, in_flight, inventory_remaining, max_concurrent, interceptor_inventory):
    threat_feats = np.zeros((MAX_CANDIDATES, N_THREAT_FEATURES), dtype=np.float32)
    for i, cand in enumerate(candidates):
        if i >= MAX_CANDIDATES:
            break
        threat_feats[i] = [
            cand['x'] / 15000.0,
            cand['y'] / 15000.0,
            cand['vx'] / 400.0,
            cand['vy'] / 400.0,
            cand['eta'] / 60.0,
            1.0 if cand['jammed'] else 0.0,
            1.0 if cand.get('track_type') == 'SWARM' else 0.0,
            1.0,
        ]

    concurrent_capacity = max(0, max_concurrent - in_flight)
    n_candidates = min(len(candidates), MAX_CANDIDATES)

    defense_feats = np.array([
        inventory_remaining / interceptor_inventory,
        in_flight / max_concurrent,
        1.0,
        concurrent_capacity / max_concurrent,
        n_candidates / MAX_CANDIDATES,
    ], dtype=np.float32)

    return np.concatenate([threat_feats.flatten(), defense_feats])


def _sample_candidate(tid, x, y, vx, vy, eta, jammed=False, track_type='STANDARD'):
    return {
        'track_id': tid,
        'x': x, 'y': y, 'vx': vx, 'vy': vy,
        'eta': eta,
        'speed': np.sqrt(vx**2 + vy**2),
        'dist': np.sqrt(x**2 + y**2),
        'track_type': track_type,
        'jammed': jammed,
        'heading': np.arctan2(vy, vx),
    }


class TestObservationEncoder:
    def test_output_matches_old_implementation_empty_candidates(self):
        obs_new = encode_observation([], 0, 30, 6, 30)
        obs_old = _old_implementation([], 0, 30, 6, 30)
        assert np.array_equal(obs_new, obs_old)
        assert obs_new.shape == (OBSERVATION_DIM,)

    def test_output_matches_old_implementation_single_candidate(self):
        cand = [_sample_candidate(1, 5000, 3000, -200, -150, 35.0)]
        obs_new = encode_observation(cand, 0, 29, 6, 30)
        obs_old = _old_implementation(cand, 0, 29, 6, 30)
        assert np.array_equal(obs_new, obs_old)

    def test_output_matches_old_implementation_full_candidates(self):
        candidates = [_sample_candidate(i, 10000 - i * 500, 8000 - i * 300,
                                         -250 + i * 10, -180 + i * 5,
                                         20 + i * 2, jammed=(i % 3 == 0),
                                         track_type='SWARM' if i % 4 == 0 else 'STANDARD')
                      for i in range(1, 16)]
        obs_new = encode_observation(candidates, 2, 20, 6, 30)
        obs_old = _old_implementation(candidates, 2, 20, 6, 30)
        assert np.array_equal(obs_new, obs_old)

    def test_output_matches_old_implementation_exceeds_max(self):
        candidates = [_sample_candidate(i, 10000, 8000, -250, -180, 30.0)
                      for i in range(1, 25)]
        obs_new = encode_observation(candidates, 3, 15, 6, 30)
        obs_old = _old_implementation(candidates, 3, 15, 6, 30)
        assert np.array_equal(obs_new, obs_old)

    def test_output_matches_old_implementation_with_jammer(self):
        cand = [_sample_candidate(1, 2000, -5000, -100, 50, 25.0, jammed=True)]
        obs_new = encode_observation(cand, 1, 28, 6, 30)
        obs_old = _old_implementation(cand, 1, 28, 6, 30)
        assert np.array_equal(obs_new, obs_old)

    def test_output_matches_old_implementation_with_swarm(self):
        cand = [_sample_candidate(1, 7000, 2000, -300, -100, 40.0, track_type='SWARM')]
        obs_new = encode_observation(cand, 5, 10, 6, 30)
        obs_old = _old_implementation(cand, 5, 10, 6, 30)
        assert np.array_equal(obs_new, obs_old)

    def test_observation_dimension(self):
        assert OBSERVATION_DIM == MAX_CANDIDATES * N_THREAT_FEATURES + 5
        assert OBSERVATION_DIM == 125

    def test_defense_features_division_by_zero(self):
        """max_concurrent=0 should not crash (edge case)."""
        obs = encode_observation([], 0, 0, 1, 10)
        assert obs.shape == (OBSERVATION_DIM,)

    def test_bias_term_for_filled_candidate_is_one(self):
        cand = [_sample_candidate(1, 1000, 2000, -50, -30, 10.0)]
        obs = encode_observation(cand, 0, 30, 6, 30)
        assert obs[7] == 1.0, f"Filled candidate bias at index 7 is {obs[7]}, expected 1.0"

    def test_bias_term_for_unfilled_candidates_is_zero(self):
        cand = [_sample_candidate(1, 1000, 2000, -50, -30, 10.0)]
        obs = encode_observation(cand, 0, 30, 6, 30)
        for i in range(1, MAX_CANDIDATES):
            idx = i * N_THREAT_FEATURES + 7
            assert obs[idx] == 0.0, f"Unfilled candidate bias at index {idx} is {obs[idx]}, expected 0.0"

    def test_defense_bias_term_is_one(self):
        cand = [_sample_candidate(1, 1000, 2000, -50, -30, 10.0)]
        obs = encode_observation(cand, 0, 30, 6, 30)
        defense_bias_idx = MAX_CANDIDATES * N_THREAT_FEATURES + 2
        assert obs[defense_bias_idx] == 1.0
