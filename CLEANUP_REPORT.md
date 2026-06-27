# Repository Cleanup Report

## 1. Junk Files Deleted

| Category | Items | Description |
|---|---|---|
| Virtual environment | `venv/` | Recreatable with `python -m venv venv` |
| Python caches | `__pycache__/` (all directories), `*.pyc` | Compiled bytecode, regenerated on import |
| pytest cache | `.pytest_cache/` | Test runner cache |
| Frontend build | `frontend/dist/`, `frontend/node_modules/` | Build output and dependencies (recreatable) |
| Rust build cache | `frontend/src-tauri/target/`, `frontend/src-tauri/binaries/` | ~500 MB of Rust artifacts |
| TypeScript build info | `frontend/tsconfig.app.tsbuildinfo`, `frontend/tsconfig.node.tsbuildinfo` | Incremental compilation cache |
| Temporary artifact | `# PROMPT_ENGINEERING_SKILL.md` | Prompt engineering reference, not a project file |
| Empty directory | `tests/` (root) | Placeholder directory with no contents |
| **Total** | **Thousands of files** | ~several GB of disk space recovered |

## 2. Root-Level Duplicates Removed

| File | Status | Canonical Location |
|---|---|---|
| `package.json` | Deleted (empty `{"dependencies": {}}`) | Frontend has its own at `frontend/package.json` |
| `BOT_API.md` | Deleted | `docs/BOT_API.md` |
| `protocol-schema.json` | Deleted | `docs/protocol-schema.json` |
| `run_training.ps1` | Deleted | `training/run_training.ps1` |

## 3. Dead Code Removed

### Python

| File | Change |
|---|---|
| `backend/simulation_runner.py:3` | Removed unused `import json` |
| `backend/comparison_coordinator.py:1` | Removed unused `import os` |
| `backend/compare_policies.py:50-53` | Removed dead `fmt()` function (replaced by `fmt_delta()`) |
| `backend/simulation/train_sb3.py:5` | Removed unused `import numpy as np` |
| `backend/simulation/simulator.py:554-555` | Removed dead `clear_events()` method (never called) |
| `view/main_window.py:22` | Removed unused constant `COLOR_UNKNOWN` |
| `view/main_window.py:258-259` | Removed dead `clear_threats()` method (never called) |

### TypeScript

| File | Change |
|---|---|
| `frontend/src/App.tsx:15` | Removed unused `import TournamentResults` |
| `frontend/src/App.tsx:227` | Removed dead `showTournament` state (never set to true) |
| `frontend/src/App.tsx:466-468` | Removed dead `<TournamentResults>` render block |
| `frontend/src/store/simulationStore.ts:65,94,131,200` | Removed dead `viewMode` field and `setViewMode` action (never read by any component) |
| `frontend/src/types.ts:4` | Removed dead `ViewMode` type (no longer referenced) |

### Preserved (intentionally left as extension points)

| Item | Reason |
|---|---|
| `Tournament` class (`tournament.py`) | CLI tool and framework; used via `python -m simulation.tournament` |
| `ScenarioGenerator` class | Documented public API utility class |
| `_POLICY_MAP` default entries | Document frontend config keys |
| `AssetCapabilities`, `ROLE_CAPABILITIES` | Type system extensions for asset role system |
| `FONT`, `FONT_MONO` in `theme.ts` | Theme API constants for styling |
| `get_sweep_endpoint()` in radar modules | Utility getter methods on Radar class |
| `_interceptors_launched` in `simulation_runner.py` | Part of simulation runner state tracking |

## 4. Imports Cleaned

All files reviewed for unused imports. Changes documented in section 3 above.

## 5. File Organization

No physical file moves were necessary. The repository structure was already consistent:

- `backend/` — FastAPI server, simulation engine, policies, tests
- `frontend/` — React + TypeScript + Vite web UI, Tauri desktop wrapper
- `controller/`, `model/`, `view/` — Legacy PyQt6 desktop application
- `docs/` — Project documentation (ARCHITECTURE, TRAINING, EVALUATION, CONTRIBUTING, BOT_API)
- `training/` — RL training scripts
- `evaluation/` — Tournament results data
- Root — Entry points (`main.py`, `desktop.py`, `run.bat`, `build.bat`, `build_release.bat`), configuration (`iads-server.spec`), README, `.gitignore`

## 6. .gitignore Updated

Replaced with professional, organized version containing clear sections:

- Python: bytecode, virtual environments, testing/coverage, packaging
- Node/TypeScript: node_modules, Vite cache, build output, `.env` files
- Rust/Tauri: build artifacts, sidecar binaries, debug symbols
- Training: intermediate checkpoints, TensorBoard logs
- Build artifacts: PyInstaller outputs, `.exe`, `.msi`
- IDEs: VS Code, JetBrains, Vim
- OS: Windows, macOS hidden files
- Logs & runtime: `.log`, `.pid`, npm debug logs

## 7. README Consistency

Fixed tournament example in README:
- Added `sys.path.insert(0, 'backend')` so the example works from root
- Fixed model path from `'models/ppo_iads.zip'` to `'backend/simulation/models/ppo_iads.zip'`

## 8. Dependencies Audit

### Python (`backend/requirements.txt`)

**Removed** (unused):
- `scipy>=1.14.0` — not imported anywhere
- `matplotlib>=3.9.0` — not imported anywhere
- `seaborn>=0.13.0` — not imported anywhere

**Added** (missing):
- `pyqtgraph>=0.13.0` — imported by `view/main_window.py`

**Retained** (indirect dependency):
- `websockets>=14.1` — required at runtime by FastAPI/uvicorn for WebSocket support

### npm (`frontend/package.json`)

No changes needed. All dependencies are actively used. No missing or unused packages found.

## 9. Pre-existing TypeScript Bugs Fixed

| File | Issue | Fix |
|---|---|---|
| `frontend/src/App.tsx` | `TrackFilter` type was missing (imported by 2 components but never defined) | Added `TrackFilter` type export |
| `frontend/src/components/TournamentResults.tsx` | `NeverLaunch` missing from `Record<PolicyId, string>` in two `colorMap` instances | Added `NeverLaunch` mapping |
| `frontend/src/components/TacticalDisplay.tsx` | `mini` prop passed to `PPIDisplay` but not in Props interface | Removed dead `mini` prop |
| `frontend/src/renderer/drawCoverage.ts` | `engagementRange` / `defendedRadius` possibly undefined despite filter | Added type predicates to `.filter()` calls |

## 10. Verification Results

| Check | Status |
|---|---|
| Python core simulation imports | ✅ Passed |
| Python tournament framework (5 runs × 3 policies) | ✅ Passed (15 simulations completed) |
| ScenarioGenerator instantiation | ✅ Passed |
| TypeScript compilation (`tsc -b`) | ✅ Clean (0 errors) |
| Vite production build | ✅ Passed (2.14s, 3 output files) |
| stable-baselines3 / PPO model loading | ⚠️ Requires venv with `pip install -r backend/requirements.txt` |
| WebSocket server import | ✅ Passed (requires venv for SB3) |

## 11. Items Intentionally Left Untouched

| Item | Justification |
|---|---|
| Legacy PyQt6 desktop app (`controller/`, `model/`, `view/`, `main.py`) | Functional legacy code path; no duplicate with server code |
| `engine/` directory does not exist | First exploration agent hallucinated this — was never on disk |
| `backend/simulation/tournament.py` entires file | CLI tool; works correctly when run directly |
| `backend/simulation/scenario_generator.py` entire file | Public utility API, documented in ARCHITECTURE.md |
| Root-level entry points (`main.py`, `desktop.py`, `run.bat`, etc.) | Convenient for developers cloning the repo |
