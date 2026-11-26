<#
.SYNOPSIS
    FlowForge AI - Windows Local Convenience Startup Script
.DESCRIPTION
    Launches the FastAPI backend and the React frontend dev server, each in its
    own PowerShell window.

    The backend is started with the virtual environment's python.exe directly
    (no Activate.ps1), so it works even when PowerShell's default execution
    policy blocks scripts.
#>

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "             Starting FlowForge AI Locally             " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# --- Backend environment file ------------------------------------------------
$BackendEnv = Join-Path $BackendDir ".env"
if (-not (Test-Path $BackendEnv)) {
    Write-Host "[!] backend\.env not found. Creating it from .env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $BackendDir ".env.example") $BackendEnv
}

# Warn (but keep going) if the API key is missing or still the placeholder.
$EnvText = Get-Content $BackendEnv -Raw
if ($EnvText -notmatch '(?m)^\s*GEMINI_API_KEY\s*=\s*(?!your_)[^\s#]+') {
    Write-Host "[!] GEMINI_API_KEY is not set in backend\.env." -ForegroundColor Yellow
    Write-Host "    Open backend\.env, paste your key after GEMINI_API_KEY=, save, then restart." -ForegroundColor Yellow
    Write-Host "    (The app will start, but blueprint generation will report 'not configured'.)" -ForegroundColor Yellow
}

# --- Frontend environment file -----------------------------------------------
$FrontendEnv = Join-Path $FrontendDir ".env"
if (-not (Test-Path $FrontendEnv)) {
    Write-Host "[*] Creating frontend\.env from .env.example..." -ForegroundColor Gray
    Copy-Item (Join-Path $FrontendDir ".env.example") $FrontendEnv
}

# --- Start backend in a new window --------------------------------------------
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $Python = "& '$VenvPython'"
} else {
    Write-Host "[!] backend\.venv not found - falling back to 'python' on your PATH." -ForegroundColor Yellow
    Write-Host "    If the backend window shows 'No module named uvicorn', create the virtual" -ForegroundColor Yellow
    Write-Host "    environment first (see 'Backend setup' in README.md)." -ForegroundColor Yellow
    $Python = "python"
}
$BackendCommand = "Set-Location '$BackendDir'; $Python -m uvicorn app.main:app --reload --port 8000"
Write-Host "[+] Launching FastAPI Backend on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCommand

# --- Start frontend in a new window -------------------------------------------
# Installs dependencies automatically the first time.
$FrontendCommand = "Set-Location '$FrontendDir'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
Write-Host "[+] Launching React Frontend on port 8080..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand

Write-Host ""
Write-Host "FlowForge AI servers have been launched!" -ForegroundColor Cyan
Write-Host "  Frontend URL:     http://localhost:8080" -ForegroundColor White
Write-Host "  Backend API:      http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:         http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health Check:     http://localhost:8000/api/health" -ForegroundColor White
Write-Host ""
