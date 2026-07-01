@echo off
title Syntra Build
cd /d "%~dp0"

echo.
echo  ========================================
echo    NOTICE: build.bat is deprecated
echo  ========================================
echo.
echo  Please use build_release.bat instead:
echo    .\build_release.bat
echo.
echo  build_release.bat builds the full desktop application
echo  including the Tauri native window installer.
echo  This script (build.bat) only built the backend.
echo.
echo  ========================================
echo.
timeout /t 3 /nobreak >nul

call build_release.bat
exit /b %ERRORLEVEL%
