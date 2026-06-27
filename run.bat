@echo off
title IADS Command Center — Development Mode
cd /d "%~dp0"

echo.
echo  ========================================
echo    NOTICE: run.bat is deprecated
echo  ========================================
echo.
echo  Please use run_dev.bat instead:
echo    .\run_dev.bat
echo.
echo  run_dev.bat removes the unnecessary vite build step,
echo  has robust process cleanup, and lets Tauri own the
echo  Vite dev server lifecycle.
echo.
echo  This script (run.bat) now delegates to run_dev.bat.
echo.
echo  ========================================
echo.
timeout /t 3 /nobreak >nul

call run_dev.bat
exit /b %ERRORLEVEL%
