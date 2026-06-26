# Evaluation

## Tournament Framework

The `Tournament` class (`backend/simulation/tournament.py`) runs N random seeds for each registered policy and produces comparative results.

### Usage

```python
from simulation.tournament import Tournament
from simulation.policies import BaselinePolicy
from simulation.trained_policy import TrainedPolicy

t = Tournament(num_runs=100)
t.register('PPO', lambda: TrainedPolicy('models/ppo_iads.zip'))
t.register('Baseline', BaselinePolicy)
t.run()
t.save_html('report.html')
t.save_csv('results.csv')
t.save_leaderboard('leaderboard.json')
```

### CLI

```bash
python -m simulation.tournament --runs 100 --hostiles 100 --output-dir ./results
```

## Policies

| Policy | Description |
|---|---|
| `BaselinePolicy` | Engages first N threats in list order |
| `PriorityPolicy` (JamFirst) | ETA bands (critical/urgent/standard), jammed-first, swarm-first |
| `PriorityPolicyUnjammedFirst` | Same bands, unjammed-first (higher Pk) |
| `TrainedPolicy` | PPO neural network policy (800k steps) |

## Results

After 800k training steps, the PPO model achieves **statistical parity** with all heuristic baselines:

| Policy | Mean Score | vs Baseline |
|---|---|---|
| PPO_800k | 5.70 | p > 0.05, d = 0.03 |
| Baseline | 5.74 | — |
| JamFirst | 5.74 | p > 0.05 |
| UnjamFirst | 5.75 | p > 0.05 |

Full 1,000-seed results: `evaluation/tournament_results/all_scores.json`

### Generating the Plot

```python
# See tournament_results_1000seeds.png in repository root
# Data source: evaluation/tournament_results/all_scores.json
```

## Key Bug Fixed

During evaluation, 99.2% of PPO actions were out of range (e.g., `action=2` when only 1 candidate existed). The fix was to clip action indices to `[0, len(threats)-1]` instead of returning empty. This dropped response time from 7.30s to 2.27s.
