@echo off
title IADS Command Center — Development Mode
cd /d "%~dp0"

echo.
echo  ========================================
echo    IADS COMMAND CENTER — DEV MODE
echo  ========================================
echo.

:: ── Check prerequisites ──────────────────────────────────
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH
    echo         Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH
    echo         Install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

where rustc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Rust not found — Tauri build will fail
    echo        Install from https://rustup.rs
    pause
    exit /b 1
)

:: ── Python virtual environment ───────────────────────────
if not exist "venv" (
    echo [1/6] Creating Python virtual environment...
    python -m venv venv
)

echo [1/6] Installing backend dependencies...
call venv\Scripts\pip install -q -r backend\requirements.txt 2>&1 || (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)

:: ── Frontend dependencies ────────────────────────────────
pushd frontend
if not exist "node_modules" (
    echo [2/6] Installing frontend dependencies...
    call npm install
)
popd

:: ── Build frontend for fallback ──────────────────────────
echo [3/6] Building frontend...
pushd frontend
call npx vite build 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Frontend build failed
)
popd

:: ── Cleanup any leftover processes from previous run ──────
echo [4/5] Cleaning up previous backend processes...
if exist "backend_pid.txt" (
    set /p OLD_PID=<backend_pid.txt
    taskkill /F /PID %OLD_PID% >nul 2>&1
    del backend_pid.txt 2>nul
)
:: Also kill any process still listening on port 8000
powershell -Command "$p = netstat -ano | findstr ':8000'; if ($p) { $parts = $p[-1] -split '\s+'; $pid = $parts[-1]; if ($pid -match '^\d+$') { Write-Host 'Killing stale PID' $pid; taskkill /F /PID $pid | Out-Null } }" >nul 2>&1

:: ── Start backend server ─────────────────────────────────
echo [5/6] Starting backend server on 127.0.0.1:8000...
powershell -Command "$p = Start-Process -FilePath 'venv\Scripts\python.exe' -ArgumentList 'backend\server.py' -NoNewWindow -PassThru; $p.Id | Out-File -FilePath 'backend_pid.txt' -Encoding ASCII"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start backend server
    pause
    exit /b 1
)

:: Wait for backend to be ready
echo        Waiting for server...
:wait_loop
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/status' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    goto wait_loop
)
echo        Server ready.

:: ── Start Tauri dev window ──────────────────────────────
echo [6/6] Launching Tauri desktop application...
echo.
echo  ========================================
echo    IADS Command Center starting...
echo    Backend:  http://127.0.0.1:8000
echo    Tauri:    native window
echo    Close window or press Ctrl+C to stop
echo  ========================================
echo.

pushd frontend
call npx tauri dev
set TAURI_EXIT=%ERRORLEVEL%
popd

:: ── Cleanup ──────────────────────────────────────────────
echo.
echo Shutting down...
if exist "backend_pid.txt" (
    set /p BACKEND_PID=<backend_pid.txt
    taskkill /F /PID %BACKEND_PID% >nul 2>&1
    del backend_pid.txt 2>nul
)
echo Done.

exit /b %TAURI_EXIT%
