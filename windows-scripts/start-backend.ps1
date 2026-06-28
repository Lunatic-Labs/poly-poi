# Start the FastAPI backend on Windows. Mirrors `make backend`.
$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$uvicorn = Join-Path $backend '.venv\Scripts\uvicorn.exe'

if (-not (Test-Path $uvicorn)) {
    Write-Error 'Backend is not set up yet. Run windows-scripts\setup-windows.cmd first.'
    exit 1
}

Set-Location $backend
& $uvicorn app.main:app --reload --port 8000
