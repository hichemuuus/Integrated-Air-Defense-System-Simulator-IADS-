# Repository Cleanup Report

## Files Removed

| Category | Items | Description |
|---|---|---|
| Tournament results | 10 directories | Historical 50-seed runs, superseded by 1,000-seed evaluation |
| Session working notes | 9 files | `prompt1.md`–`prompt5.md`, `plan.md`, `PROJECT_CONTEXT.md`, `RESUME_PROMPT.md`, `skills.md` |
| Empty directories | 3 | `build/`, `dist/`, `models/` |
| Training artifact | 1 | `backend/simulation/models/evaluations.npz` |
| **Total** | **23 items** | |

## Files Moved

| File | From | To |
|---|---|---|
| `tournament_stats_1000/` | root | `evaluation/tournament_results/` |
| `BOT_API.md` | root | `docs/BOT_API.md` |
| `protocol-schema.json` | root | `docs/protocol-schema.json` |
| `run_training.ps1` | root | `training/run_training.ps1` (copy kept at root) |

## Files Created

| File | Description |
|---|---|
| `docs/ARCHITECTURE.md` | System architecture overview, component dependency map |
| `docs/TRAINING.md` | RL training guide: environment, action space, reward, CLI usage |
| `docs/EVALUATION.md` | Tournament framework documentation and results summary |
| `docs/CONTRIBUTING.md` | Developer setup guide, PR guidelines, code organization |

## Directories Created

| Directory | Purpose |
|---|---|
| `training/` | RL training scripts and configs |
| `evaluation/` | Tournament and analysis tools |
| `docs/` | Project documentation |
| `tests/` | Test suite (placeholder) |

## Dependencies Removed

**requirements.txt**: None removed. All 5 listed dependencies are actively used.
**package.json**: None removed. All 17 dependencies are actively used.

**Dependencies ADDED to requirements.txt** (were missing):

| Package | Used By |
|---|---|
| `gymnasium>=1.0.0` | `gym_env/env.py` — RL environment |
| `stable-baselines3>=2.4.0` | `trained_policy.py`, `train_sb3.py` — PPO algorithm |
| `scipy>=1.14.0` | Statistical analysis scripts |
| `matplotlib>=3.9.0` | Plotting scripts |
| `seaborn>=0.13.0` | Plotting scripts |

## Disk Space Recovered

| Category | Est. Size |
|---|---|
| Tournament result dirs | ~180 KB |
| Session notes | ~45 KB |
| Empty dirs | 0 |
| Training artifact | ~100 KB |
| **Total** | **~325 KB** |

(Note: `frontend/src-tauri/target/` Rust build cache was left in place at ~500 MB — removing it would free significant space but requires a rebuild.)

## Remaining Technical Debt

1. **Duplicate simulation implementations**: `model/simulation.py` (PyQt6 desktop app) and `backend/simulation/simulator.py` + `physics.py` (server) share ~60% code overlap. The desktop classes (`Track`, `Interceptor`, `Explosion`, `Radar`, `Simulation`) are simplified copies without jamming, swarms, inventory, or leaker logic. Recommended: unify into a single simulation package.

2. **TrainedPolicy not wired into server**: `trained_policy.py` is importable but not registered in `simulation_runner.py`'s `_POLICY_MAP`. The PPO model cannot be selected at runtime from the WebSocket UI.

3. **No test suite**: The `tests/` directory is empty. There are no unit tests for the simulation engine, policies, or server.

4. **No CI/CD configuration**: No GitHub Actions or similar pipeline for automated testing.

5. **Rust build artifacts**: `frontend/src-tauri/target/` contains ~500 MB of Rust build cache. These are regenerable with `cargo build` but consume significant disk space.

6. **Legacy PyQt6 desktop app**: `main.py`, `controller/`, `model/`, `view/` — functional but superseded by the web frontend. The two code paths maintain duplicate physics models.

7. **Root-level entry points**: `desktop.py` and `main.py` at the repository root are convenient but clutter the top level. Consider moving to `backend/`.

## Recommendations Before Open-Sourcing

- [ ] **Unify simulation models**: Merge `model/simulation.py` into `backend/simulation/` or retire the desktop app.
- [ ] **Add license file**: Choose an open-source license (MIT recommended).
- [ ] **Create `.gitignore`**: Exclude `venv/`, `node_modules/`, `__pycache__/`, `*.pyc`, `.rustc_info.json`, `frontend/src-tauri/target/`.
- [ ] **Write unit tests**: At minimum for `simulator.py`, `physics.py`, `radar.py`, `policies.py`.
- [ ] **Set up CI**: GitHub Actions with `pip install -r backend/requirements.txt` and `pytest`.
- [ ] **Remove Rust build cache**: `Remove-Item -Recurse frontend/src-tauri/target/` (will be rebuilt on demand).
- [ ] **Add `.env.example`**: Document any environment variables needed (none currently).
- [ ] **Wire TrainedPolicy into server**: Add to `_POLICY_MAP` in `simulation_runner.py`.
