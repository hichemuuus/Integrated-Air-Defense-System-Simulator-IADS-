@echo off
title Syntra Command — Development Mode
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\run_dev.ps1"
exit /b %ERRORLEVEL%
 