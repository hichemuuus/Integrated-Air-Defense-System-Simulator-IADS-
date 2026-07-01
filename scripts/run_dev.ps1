$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Path $PSScriptRoot -Parent

function Log($msg) {
    Write-Host ("[$([DateTime]::Now.ToString('HH:mm:ss'))] $msg")
}

function Free-Ports($Ports) {
    $pattern = ($Ports | ForEach-Object { ":$_" }) -join "|"
    $lines = netstat -ano | Select-String -Pattern $pattern
    foreach ($item in $lines) {
        $line = "$item"
        $parts = $line -split "\s+"
        $procId = $parts[-1]
        if ($procId -match "^\d+$") {
            $numericPid = [int]$procId
            if ($numericPid -le 4) { continue }
            Log ("Killing stale process $procId on port...")
            taskkill /F /T /PID $procId *>$null
        }
    }
}

function Test-PortFree($Port) {
    $lines = netstat -ano | Select-String -Pattern (":$Port")
    return ($null -eq $lines)
}

function Wait-BackendReady {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $url = "http://127.0.0.1:8000/api/status"
    while ($sw.Elapsed.TotalSeconds -lt 30) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) {
                Log ("Backend ready ($($sw.Elapsed.TotalSeconds.ToString('N1'))s)")
                return $true
            }
        } catch {
            # not ready yet
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# ============================================================
# Main
# ============================================================
Log "Syntra Command - Development Mode"

# --- Prerequisites ---
foreach ($cmd in @("python", "node", "rustc")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] $cmd not found in PATH"
        exit 1
    }
}

# --- Python virtual environment ---
$venvPython = [System.IO.Path]::Combine($RootDir, "venv", "Scripts", "python.exe")
$venvPip = [System.IO.Path]::Combine($RootDir, "venv", "Scripts", "pip.exe")

if (-not (Test-Path $venvPython)) {
    Log "Creating Python virtual environment..."
    python -m venv (Join-Path $RootDir "venv")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment"
        exit 1
    }
}

Log "Installing backend dependencies..."
& $venvPip install -q -r ([System.IO.Path]::Combine($RootDir, "backend", "requirements.txt"))
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install Python dependencies"
    exit 1
}

# --- Frontend dependencies ---
$frontendDir = Join-Path $RootDir "frontend"
$nodeModulesDir = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $nodeModulesDir)) {
    Log "Installing frontend dependencies..."
    Push-Location $frontendDir
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

# --- Process cleanup ---
Log "Cleaning up stale processes..."

# Remove leftover PID file from old-style scripts (harmless if absent)
Remove-Item (Join-Path $RootDir "backend_pid.txt") -ErrorAction SilentlyContinue

# Kill processes on ports 8000 (Python backend) and 3000 (Vite dev server)
Free-Ports -Ports @(8000, 3000)

# Kill any Tauri app process still running from a previous session
Get-Process -Name "Syntra Command" -ErrorAction SilentlyContinue |
    ForEach-Object {
        Log ("Killing previous Tauri instance (PID $($_.Id))...")
        taskkill /F /T /PID $_.Id *>$null
    }

Start-Sleep -Seconds 1

# --- Verify ports are free ---
$allFree = $true
foreach ($port in @(8000, 3000)) {
    if (-not (Test-PortFree $port)) {
        Write-Host ("[ERROR] Port $port is still in use after cleanup")
        $allFree = $false
    }
}
if (-not $allFree) {
    Write-Host "[ERROR] Cannot start - ports are blocked. Close the conflicting processes and retry."
    exit 1
}

# --- Launch backend ---
Log "Starting backend server on 127.0.0.1:8000..."
$backendProc = Start-Process -FilePath $venvPython -ArgumentList @("backend\server.py") -WorkingDirectory $RootDir -NoNewWindow -PassThru
Log ("Backend PID: $($backendProc.Id)")

# --- Wait for backend readiness ---
Log "Waiting for backend..."
$ready = Wait-BackendReady
if (-not $ready) {
    Write-Host "[ERROR] Backend did not become ready within 30 seconds"
    if (-not $backendProc.HasExited) {
        taskkill /F /T /PID $backendProc.Id *>$null
    }
    exit 1
}

# --- Launch Tauri dev (blocks until window closes) ---
Log "Launching Tauri dev..."
Write-Host ""
Write-Host "  Backend:  http://127.0.0.1:8000"
Write-Host "  Tauri:    native window with Hot Reload"
Write-Host "  Close the Tauri window or press Ctrl+C to stop"
Write-Host ""

$inFrontend = $false
try {
    Push-Location $frontendDir
    $inFrontend = $true
    & "npx" "tauri" "dev"
    $tauriExitCode = $LASTEXITCODE
    Log ("Tauri dev exited with code $tauriExitCode")
} catch {
    Log ("Tauri dev error: $_")
    $tauriExitCode = 1
} finally {
    if ($inFrontend) { Pop-Location }
}

# --- Cleanup ---
Log "Cleaning up..."

# Kill backend process tree (silent if already exited)
if ($backendProc) {
    $stillRunning = $false
    try { $stillRunning = -not $backendProc.HasExited } catch {}
    if ($stillRunning) {
        Log ("Stopping backend (PID $($backendProc.Id))...")
        taskkill /F /T /PID $backendProc.Id *>$null
    }
}

# Kill any lingering processes on dev ports (silent if none found)
Free-Ports -Ports @(8000, 3000)

Log "Done."
exit $tauriExitCode
