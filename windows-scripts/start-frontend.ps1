# Start the Vite frontend on Windows. Mirrors `make frontend`.
$ErrorActionPreference = 'Stop'
$root     = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Error 'Frontend is not set up yet. Run windows-scripts\setup-windows.cmd first.'
    exit 1
}

Set-Location $frontend
& npm run dev
