@echo off
title IADS Build
cd /d "%~dp0"

echo === Building IADS Command Center Distribution ===
echo.

:: Build frontend
echo [1/3] Building frontend...
cd frontend
call npx vite build
cd ..

:: Generate PyInstaller spec with correct paths
echo [2/3] Generating spec file...
call venv\Scripts\python -c "
import sys
from pathlib import Path
root = Path(r'%CD%')
spec = rf'''
# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path
root = Path(r'{root}')
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
    hookspath=[], hooksconfig={{}}, runtime_hooks=[], excludes=[], noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='iads-server',
    debug=False, bootloader_ignore_signals=True, strip=False, upx=True,
    upx_exclude=[], runtime_tmpdir=None, console=True,
    disable_windowed_traceback=False, argv_emulation=False,
    target_arch=None, codesign_identity=None, entitlements_file=None,
)
'''
with open('iads-server.spec', 'w') as f:
    f.write(spec)
print('Spec generated')
"

:: Build backend executable
echo [2/3] Building backend executable (this may take a few minutes)...
call venv\Scripts\pyinstaller --clean iads-server.spec 2>&1

if exist "dist\iads-server\iads-server.exe" (
    echo.
    echo === Build Complete ===
    echo Server binary: dist\iads-server\iads-server.exe
    echo To run: dist\iads-server\iads-server.exe
    echo Then open http://localhost:8000
) else (
    echo Build may have failed - check dist\ folder
)

pause
