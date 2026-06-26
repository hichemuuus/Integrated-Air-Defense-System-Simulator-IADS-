# Training

## RL Environment

The training environment is `IADSGymEnv` (`backend/simulation/gym_env/env.py`), a Gymnasium environment wrapping the `Simulation` engine.

### Observation Space

```
Shape: (15 × 8 + 5,) = (125,)  float32
```

- **15 threat slots** × 8 features each (x, y, vx, vy, eta, jammed, swarm, bias), normalized
- **5 defense features** (inventory remaining, in-flight count, bias, concurrent capacity, candidate count), normalized

### Action Space

`Discrete(16)` — action 0 = do nothing, actions 1-15 = engage candidate at index (action-1).

### Reward Function

```
R = +1.0 × kill_delta
    - 0.1 × miss_delta
    - 10.0 × leaker_delta
    + shaping_reward (distance-based)
    + engagement_bonus (+1.0 for valid engage)
    + idle_penalty (-50.0 for no-op when candidates exist)
    - 0.05 for invalid engagement
Clipped to [-20.0, 5.0]
```

## Running Training

```powershell
# From repository root:
python -m simulation.train_sb3 --timesteps 1000000
```

Or use the convenience script:

```powershell
.\training\run_training.ps1
```

### Training Script (`backend/simulation/train_sb3.py`)

- Creates `min(cpu_count, 8)` parallel environments via `SubprocVecEnv`
- Loads existing model from `models/ppo_iads.zip` if present (resume training)
- Creates fresh model otherwise (`MlpPolicy`, default hyperparameters)
- Saves checkpoints every 100,000 steps to `models/ppo_iads_{n}steps.zip`
- Saves `best_model.zip` on evaluation callback
- Final model saved to `models/ppo_iads.zip`

### Key Parameters

| Parameter | Default | Description |
|---|---|---|
| `--timesteps` | 1,000,000 | Total training timesteps |
| `--checkpoint-freq` | 100,000 | Checkpoint interval |

## Model Checkpoints

Checkpoints are stored in `backend/simulation/models/`. The active model is `ppo_iads.zip`. Safe checkpoints are archived in `backend/models/` with format `ppo_iads_safe_{n}steps.zip`.

## Dependencies

- `stable-baselines3` (PPO algorithm)
- `gymnasium` (RL environment interface)
- `numpy` (numerical operations)
- `scipy` (statistical analysis)
