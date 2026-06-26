# Architecture

## System Overview

The IADS Simulator has two independent code paths sharing the same simulation engine:

```
┌─────────────────────────────────────────────────┐
│                  Entry Points                    │
│  run.bat ── desktop.py ──┐                      │
│  main.py ────────────────┼── PyQt6 Desktop App  │
└──────────────────────────┴──────────────────────┘
                           │
┌──────────────────────────▼──────────────────────┐
│              Backend Server (FastAPI)             │
│  server.py ── simulation_runner.py               │
│                    │                              │
│         ┌──────────▼──────────┐                   │
│         │  simulation/        │                   │
│         │  simulator.py       │                   │
│         │  physics.py         │                   │
│         │  radar.py           │                   │
│         │  policies.py        │                   │
│         │  trained_policy.py  │                   │
│         │  tournament.py      │                   │
│         │  scenario_generator │                   │
│         │  gym_env/env.py     │                   │
│         └─────────────────────┘                   │
└──────────────────────────────────────────────────┘
```

## Backend (Python)

### Simulation Engine (`backend/simulation/`)

The core simulation library, structured as a Python package:

| Module | Responsibility |
|---|---|
| `simulator.py` | Main `Simulation` class — runs the physics loop, manages tracks, interceptors, radar, engagements |
| `physics.py` | `Track`, `Interceptor` (Proportional Navigation), `Explosion`, `MissMarker`, `Classification` |
| `radar.py` | `Radar` (multi-site, configurable range/noise), `ThreatAssessor` (ETA calculation) |
| `policies.py` | `BaselinePolicy`, `PriorityPolicy` (JamFirst), `PriorityPolicyUnjammedFirst` |
| `trained_policy.py` | `TrainedPolicy` — wraps a Stable-Baselines3 PPO model as a policy |
| `tournament.py` | `Tournament` framework — runs N seeds across M policies, generates leaderboards |
| `scenario_generator.py` | `ScenarioGenerator` — produces scenario configs (easy/medium/hard/extreme/random) |
| `gym_env/env.py` | `IADSGymEnv` — Gymnasium environment for RL training |
| `train_sb3.py` | Training script — PPO with SubprocVecEnv, checkpointing |

### Server (`backend/server.py` + `simulation_runner.py`)

FastAPI WebSocket server that runs the simulation asynchronously. The `SimulationRunner` wraps the simulation in a background thread with a command queue. External agents connect via WebSocket to observe state and send commands.

### Desktop App (Legacy PyQt6)

`main.py`, `controller/`, `model/`, `view/` form a Model-View-Controller desktop application using PyQt6 + pyqtgraph. This is a legacy code path predating the web frontend.

## Frontend (`frontend/`)

React + TypeScript + Vite single-page application with Tailwind CSS. Uses `zustand` for state management and a Canvas2D renderer for the tactical display. Can be packaged as a Tauri desktop app.

## Training (`training/`)

Scripts and configs for RL training using Stable-Baselines3 PPO with SubprocVecEnv parallel environments.

## Evaluation (`evaluation/`)

Tournament framework and analysis scripts for comparing policies across multiple random seeds.
