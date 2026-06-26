# Integrated Air Defense System (IADS) Simulator

A real-time simulation framework for modeling integrated air defense engagements, with training agents via reinforcement learning (PPO).

## Features

- **Real-time 2D simulation** of hostile tracks, interceptors, radar sweeps, and engagement physics
- **Proportional Navigation guidance** for interceptor missiles
- **Radar model** with detection cones, jamming, noise, and track visibility
- **Swarm and jammer** track types with distinct behavior
- **Multiple engagement policies** (Baseline, Priority, PriorityUnjammedFirst)
- **Reinforcement Learning** via Stable-Baselines3 PPO
- **WebSocket Bot API** for connecting external AI agents

## Reinforcement Learning Results

After 800,000 steps of PPO training, the AI agent achieves **statistical parity** with all three hand-crafted heuristic policies. Over a 1,000-seed tournament (4,000 total simulations):

| Policy | Mean Score | Median | Std |
|---|---|---|---|
| PPO_800k | 5.70 | 5.67 | 1.45 |
| JamFirst | 5.74 | 5.67 | 1.47 |
| UnjamFirst | 5.75 | 5.67 | 1.48 |
| Baseline | 5.74 | 5.67 | 1.37 |

![Tournament Results](tournament_results_1000seeds.png)

**Key findings:**

- **PPO mean score: 5.70** vs **Baseline: 5.74** — a difference of only 0.04 points
- **No pairwise comparison is statistically significant** (Mann-Whitney U, all p > 0.05)
- **Effect sizes are negligible** (Cohen's d < 0.04 for all comparisons)
- The PPO model was trained using the Gymnasium environment with a Discrete(16) action space, normalized observations, and a shaped reward function (+1 per kill, -10 per leaker, -0.1 per miss)
- A critical bug was identified and fixed during evaluation: the PPO action indices were not clipped to the valid candidate range, causing 99.2% of actions to be ignored during inference

## Bot API WebSocket Interface

External AI agents can connect to the simulation server in real time via WebSocket. The Bot API supports engaging tracks, changing policies, pausing/resuming, and single-stepping through the simulation.

See [docs/BOT_API.md](docs/BOT_API.md) for full protocol documentation and a Python example.

Quick start:

```python
import asyncio, json, websockets

async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws/sim") as ws:
        state = await ws.recv()
        await ws.send(json.dumps({"action": "engage", "track_id": 42}))
        async for msg in ws:
            data = json.loads(msg)
            print(f"Tracks: {len(data.get('tracks', []))}")

asyncio.run(main())
```

## Project Structure

```
backend/
  simulation/       # Core simulation engine (Python package)
    gym_env/         # Gymnasium RL environment
    models/          # Trained PPO model checkpoints
  server.py          # FastAPI WebSocket + HTTP server
  simulation_runner.py
  requirements.txt
frontend/            # Web-based UI (React + Vite + Tailwind)
docs/                # Documentation
  ARCHITECTURE.md    # System architecture overview
  TRAINING.md        # RL training guide
  EVALUATION.md      # Tournament and analysis docs
  CONTRIBUTING.md    # Development setup guide
  BOT_API.md         # WebSocket protocol reference
training/            # Training scripts and configs
evaluation/          # Tournament results and analysis tools
controller/          # Legacy PyQt6 desktop app
model/               # Legacy PyQt6 model
view/                # Legacy PyQt6 view
```

## Running the Tournament

```bash
python -c "
from simulation.tournament import Tournament
from simulation.policies import BaselinePolicy, PriorityPolicy
from simulation.trained_policy import TrainedPolicy

t = Tournament(num_runs=100)
t.register('PPO', lambda: TrainedPolicy('models/ppo_iads.zip'))
t.register('Baseline', BaselinePolicy)
t.run()
t.save_html('report.html')
t.save_csv('results.csv')
"
```
