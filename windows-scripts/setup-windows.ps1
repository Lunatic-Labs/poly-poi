# First-time setup on Windows. Mirrors `make setup`.
# Run via the double-click launcher: windows-scripts\setup-windows.cmd
# (that launcher handles PowerShell's execution policy for you).

$ErrorActionPreference = 'Stop'
$root     = Split-Path -Parent $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Host '== Checking prerequisites =='

# Find Python 3.12. Prefer the `py -3.12` launcher; fall back to `python`.
$pyExe = $null; $pyArgs = @()
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.12 --version *> $null 2>&1
    if ($LASTEXITCODE -eq 0) { $pyExe = 'py'; $pyArgs = @('-3.12') }
}
if (-not $pyExe -and (Get-Command python -ErrorAction SilentlyContinue)) { $pyExe = 'python' }
if (-not $pyExe) {
    Write-Error 'Python 3.12 not found. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run this again.'
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js (npm) not found. Install the LTS version from https://nodejs.org/, then run this again.'
    exit 1
}

Write-Host '== Creating the Python virtual environment =='
Push-Location $backend
try {
    & $pyExe @pyArgs -m venv .venv
    $venvPy = Join-Path $backend '.venv\Scripts\python.exe'
    & $venvPy -m pip install --upgrade pip
    & $venvPy -m pip install -r requirements-dev.txt
    # pre-commit hooks are a nice-to-have and only work inside a git checkout.
    try { & (Join-Path $backend '.venv\Scripts\pre-commit.exe') install } catch { Write-Host 'Skipped git pre-commit hooks (not required to run the app).' }
} finally {
    Pop-Location
}

Write-Host '== Installing frontend dependencies =='
Push-Location $frontend
try {
    & npm install
} finally {
    Pop-Location
}

# Create .env.local from the example if it's missing.
$envFile    = Join-Path $root '.env.local'
$envExample = Join-Path $root '.env.example'
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host 'Created .env.local from the example. Replace it with the shared one, or fill in the credentials.'
    } else {
        Write-Host 'No .env.local found. Put the shared .env.local at the project root before starting the app.'
    }
} else {
    Write-Host '.env.local is already in place.'
}

Write-Host ''
Write-Host 'Setup complete. Start the app by double-clicking windows-scripts\start.cmd'
