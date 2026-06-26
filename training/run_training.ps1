$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
& "$root\venv\Scripts\python.exe" -m simulation.train_sb3 --timesteps 1000000 --model-dir "$root\backend\simulation\models"
