@echo off
title IADS Command Center — Release Build
cd /d "%~dp0"

echo.
echo  ========================================
echo    IADS COMMAND CENTER — RELEASE BUILD
echo  ========================================
echo.

:: ── Prerequisites ────────────────────────────────────────
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH
    pause
    exit /b 1
)

where rustc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rust not found — install from https://rustup.rs
    pause
    exit /b 1
)

:: ── Detect target triple for sidecar naming ──────────────
for /f "tokens=*" %%i in ('rustc -vV ^| findstr host') do set "HOST_TRIPLE=%%i"
set "HOST_TRIPLE=%HOST_TRIPLE:host: =%"
echo [INFO] Target triple: %HOST_TRIPLE%

:: ── Python virtual environment ───────────────────────────
echo [1/6] Setting up Python virtual environment...
if not exist "venv" (
    python -m venv venv
)

echo [2/6] Installing backend dependencies...
call venv\Scripts\pip install -q -r backend\requirements.txt 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)

:: Also install PyInstaller if not present
call venv\Scripts\pip install -q pyinstaller 2>&1

:: ── Build backend with PyInstaller ───────────────────────
echo [3/6] Building backend executable with PyInstaller...
if exist "dist\iads-server" rmdir /s /q "dist\iads-server"

call venv\Scripts\python -c "import sys; from pathlib import Path; root = Path(r'%CD%')"
call venv\Scripts\python -c "
import json, uuid
from pathlib import Path
root = Path(r'%CD%')

spec = '''# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path
root = Path(r\"\"\"''' + str(root) + '''\"\"\")

a = Analysis(
    [str(root / 'backend' / 'server.py')],
    pathex=[str(root / 'backend')],
    binaries=[],
    datas=[(str(root / 'frontend' / 'dist'), '_frontend')],
    hiddenimports=[
        'uvicorn.logging', 'uvicorn.loops.auto',
        'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan.on', 'websockets', 'numpy',
        'simulation.physics', 'simulation.radar', 'simulation.simulator',
        'simulation_runner',
    ],
    hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='iads-server',
    debug=False, bootloader_ignore_signals=True, strip=False, upx=True,
    upx_exclude=[], runtime_tmpdir=None, console=False,
    disable_windowed_traceback=False, argv_emulation=False,
    target_arch=None, codesign_identity=None, entitlements_file=None,
)
'''

with open('iads-server.spec', 'w') as f:
    f.write(spec)
print('Spec file generated')
"

call venv\Scripts\pyinstaller --clean iads-server.spec 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PyInstaller build failed
    pause
    exit /b 1
)

if not exist "dist\iads-server\iads-server.exe" (
    echo [ERROR] Backend executable not found at dist\iads-server\iads-server.exe
    pause
    exit /b 1
)
echo        Backend executable built: dist\iads-server\iads-server.exe

:: ── Build frontend ───────────────────────────────────────
echo [4/6] Building frontend...
cd frontend
call npm install 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

call npx vite build 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)
cd ..
echo        Frontend built to frontend\dist

:: ── Install frontend in backend dist ─────────────────────
echo [5/6] Copying frontend to backend distribution...
if not exist "dist\iads-server\_frontend" (
    echo [ERROR] Frontend dist not in backend package — build issue
    echo        Attempting manual copy...
    if not exist "dist\iads-server\_frontend" mkdir "dist\iads-server\_frontend"
    xcopy /E /I /Y "frontend\dist\*" "dist\iads-server\_frontend\" >nul
)

:: ── Copy backend exe to Tauri sidecar location ───────────
echo        Copying to Tauri sidecar location...
copy /Y "dist\iads-server\iads-server.exe" "frontend\src-tauri\binaries\iads-server-%HOST_TRIPLE%.exe" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Could not copy sidecar — check paths
) else (
    echo        Sidecar placed at frontend\src-tauri\binaries\iads-server-%HOST_TRIPLE%.exe
)

:: ── Build Tauri application ──────────────────────────────
echo [6/6] Building Tauri desktop application...
echo        This compiles Rust and creates the installer.
echo        May take several minutes on first build.
echo.

cd frontend
call npx tauri build 2>&1
set BUILD_EXIT=%ERRORLEVEL%
cd ..

if %BUILD_EXIT% NEQ 0 (
    echo [ERROR] Tauri build failed — see output above
    pause
    exit /b %BUILD_EXIT%
)

:: ── Show results ─────────────────────────────────────────
echo.
echo  ========================================
echo    BUILD COMPLETE
echo  ========================================
echo.

set "TAURI_DIST=frontend\src-tauri\target\release"

if exist "%TAURI_DIST%\IADS Command Center.exe" (
    echo  Executable: %TAURI_DIST%\IADS Command Center.exe
) else (
    echo  Executable: %TAURI_DIST%\*.exe (check the release folder)
)

if exist "%TAURI_DIST%\bundle\nsis\IADS Command Center_1.0.0_x64-setup.exe" (
    echo  Installer:  %TAURI_DIST%\bundle\nsis\IADS Command Center_1.0.0_x64-setup.exe
)

if exist "%TAURI_DIST%\bundle\msi\IADS Command Center_1.0.0_x64_en-US.msi" (
    echo  MSI:        %TAURI_DIST%\bundle\msi\IADS Command Center_1.0.0_x64_en-US.msi
)

echo.
echo  To install, run the NSIS installer or MSI.
echo  To run directly: %TAURI_DIST%\IADS Command Center.exe
echo.

pause
