# Contributing

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- Rust toolchain (optional, for Tauri desktop builds)

### Setup

```powershell
# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r backend/requirements.txt
pip install gymnasium stable-baselines3 scipy matplotlib seaborn

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Running

```powershell
# Backend server + web UI
.\run.bat

# Desktop app (PyQt6 legacy)
python main.py
```

## Code Organization

| Directory | Purpose |
|---|---|
| `backend/simulation/` | Core simulation engine (Python package) |
| `backend/server.py` | FastAPI WebSocket server |
| `frontend/` | React + TypeScript web UI |
| `training/` | RL training scripts |
| `evaluation/` | Tournament and analysis tools |
| `docs/` | Documentation |
| `tests/` | Test suite |

## Adding a New Policy

Create a class implementing `select_engagements()` and register it:

```python
class MyPolicy:
    def select_engagements(self, threats, in_flight, inventory_remaining, max_concurrent, **kwargs):
        slots = min(max_concurrent - in_flight, inventory_remaining)
        if slots <= 0 or not threats:
            return []
        return [t["track_id"] for t in threats[:slots]]
```

## Running the Tournament

```powershell
python -c "
from simulation.tournament import Tournament
from simulation.policies import BaselinePolicy
t = Tournament(num_runs=100)
t.register('Baseline', BaselinePolicy)
t.run()
t.save_html('report.html')
"
```

## Pull Request Guidelines

- Match existing code style (no comments, type hints where practical)
- Verify all imports work (run `python -c "from simulation.simulator import Simulation"`)
- Run the tournament for at least 10 seeds to validate no regressions
- Update `EVALUATION.md` with any new results
