@echo off
REM Double-click this to set up the project on Windows.
REM It runs setup-windows.ps1 without changing your PowerShell execution policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"
echo.
pause
