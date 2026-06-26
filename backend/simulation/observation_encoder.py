import numpy as np

MAX_CANDIDATES = 15
N_THREAT_FEATURES = 8
OBSERVATION_DIM = MAX_CANDIDATES * N_THREAT_FEATURES + 5


def encode_observation(candidates, in_flight, inventory_remaining, max_concurrent, interceptor_inventory):
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
