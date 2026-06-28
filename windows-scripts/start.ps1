# Start backend and frontend together, each in its own PowerShell window.
$ErrorActionPreference = 'Stop'
$scripts = $PSScriptRoot

Start-Process powershell -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-File', (Join-Path $scripts 'start-backend.ps1'))
Start-Process powershell -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-File', (Join-Path $scripts 'start-frontend.ps1'))

Write-Host 'Started the backend and frontend in two new windows.'
Write-Host 'Open http://localhost:5173 in your browser once they finish loading.'
Write-Host 'To stop the app, close those two windows.'
