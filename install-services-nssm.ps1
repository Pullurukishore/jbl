# Kardex JBL - 24/7 Windows Service Installation Script
# Installs Backend & Frontend as native Windows services that run 24/7 on boot
# Run this script as Administrator

param (
    [switch]$SkipBuild = $false
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Kardex JBL System - 24/7 Windows Service Setup      " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Check Administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell, select 'Run as Administrator', and run this script." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "kardex-node"
$frontendPath = Join-Path $projectRoot "kardex-next"
$logsPath = Join-Path $projectRoot "logs"
$nssmPath = Join-Path $projectRoot "nssm.exe"

# Verify NSSM binary
if (-not (Test-Path $nssmPath)) {
    Write-Host "ERROR: nssm.exe not found at $nssmPath" -ForegroundColor Red
    Write-Host "Please place nssm.exe in the project root directory." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Locate node.exe
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Write-Host "ERROR: Node.js was not found in system PATH!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$nodePath = $nodeCommand.Source
Write-Host "[OK] Using Node.js at: $nodePath" -ForegroundColor Green

# Ensure logs directory exists
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
}

# ----------------------------------------------------
# Step 1: Build Frontend (Next.js)
# ----------------------------------------------------
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "[1/4] Building Frontend for Production..." -ForegroundColor Yellow
    Set-Location $frontendPath
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Gray
        npm install
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Frontend built successfully!" -ForegroundColor Green
} else {
    Write-Host "[1/4] Skipping build as requested..." -ForegroundColor Gray
}

# ----------------------------------------------------
# Step 2: Install Backend Service (KardexJblBackend)
# ----------------------------------------------------
Write-Host ""
Write-Host "[2/4] Registering Backend Service (KardexJblBackend)..." -ForegroundColor Yellow

# Stop and remove if previously installed
& $nssmPath stop KardexJblBackend 2>$null
& $nssmPath remove KardexJblBackend confirm 2>$null

# Register service
& $nssmPath install KardexJblBackend "$nodePath" "index.js"
& $nssmPath set KardexJblBackend AppDirectory "$backendPath"
& $nssmPath set KardexJblBackend DisplayName "Kardex JBL Validation Backend"
& $nssmPath set KardexJblBackend Description "Kardex Put and Pick Validation Node.js Express API Service"
& $nssmPath set KardexJblBackend Start SERVICE_AUTO_START
& $nssmPath set KardexJblBackend AppEnvironmentExtra NODE_ENV=production

# Logging & automatic rotation (10 MB per file)
& $nssmPath set KardexJblBackend AppStdout "$logsPath\backend-service.log"
& $nssmPath set KardexJblBackend AppStderr "$logsPath\backend-service-error.log"
& $nssmPath set KardexJblBackend AppRotateFiles 1
& $nssmPath set KardexJblBackend AppRotateBytes 10485760

# Auto-recovery: restart after 5 seconds if crashed
& $nssmPath set KardexJblBackend AppExit Default Restart
& $nssmPath set KardexJblBackend AppRestartDelay 5000

Write-Host "[OK] Backend Service registered (Port: 5005)" -ForegroundColor Green

# ----------------------------------------------------
# Step 3: Install Frontend Service (KardexJblFrontend)
# ----------------------------------------------------
Write-Host ""
Write-Host "[3/4] Registering Frontend Service (KardexJblFrontend)..." -ForegroundColor Yellow

# Stop and remove if previously installed
& $nssmPath stop KardexJblFrontend 2>$null
& $nssmPath remove KardexJblFrontend confirm 2>$null

# Register service using direct next runner (avoids cmd orphan process issues)
& $nssmPath install KardexJblFrontend "$nodePath" "node_modules\next\dist\bin\next" "start" "-p" "3000"
& $nssmPath set KardexJblFrontend AppDirectory "$frontendPath"
& $nssmPath set KardexJblFrontend DisplayName "Kardex JBL Validation Frontend"
& $nssmPath set KardexJblFrontend Description "Kardex Put and Pick Validation Next.js Web Application"
& $nssmPath set KardexJblFrontend Start SERVICE_AUTO_START
& $nssmPath set KardexJblFrontend AppEnvironmentExtra NODE_ENV=production

# Logging & automatic rotation (10 MB per file)
& $nssmPath set KardexJblFrontend AppStdout "$logsPath\frontend-service.log"
& $nssmPath set KardexJblFrontend AppStderr "$logsPath\frontend-service-error.log"
& $nssmPath set KardexJblFrontend AppRotateFiles 1
& $nssmPath set KardexJblFrontend AppRotateBytes 10485760

# Auto-recovery: restart after 5 seconds if crashed
& $nssmPath set KardexJblFrontend AppExit Default Restart
& $nssmPath set KardexJblFrontend AppRestartDelay 5000

Write-Host "[OK] Frontend Service registered (Port: 3000)" -ForegroundColor Green

# ----------------------------------------------------
# Step 4: Start Services
# ----------------------------------------------------
Write-Host ""
Write-Host "[4/4] Starting Services..." -ForegroundColor Yellow

& $nssmPath start KardexJblBackend
Start-Sleep -Seconds 3

& $nssmPath start KardexJblFrontend
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Service Status Verification                         " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$backendSvc = Get-Service -Name "KardexJblBackend" -ErrorAction SilentlyContinue
$frontendSvc = Get-Service -Name "KardexJblFrontend" -ErrorAction SilentlyContinue

if ($backendSvc) {
    Write-Host "Backend Service:  $($backendSvc.Name) - Status: $($backendSvc.Status) (Startup: $($backendSvc.StartType))" -ForegroundColor $(if ($backendSvc.Status -eq 'Running') { 'Green' } else { 'Red' })
}
if ($frontendSvc) {
    Write-Host "Frontend Service: $($frontendSvc.Name) - Status: $($frontendSvc.Status) (Startup: $($frontendSvc.StartType))" -ForegroundColor $(if ($frontendSvc.Status -eq 'Running') { 'Green' } else { 'Red' })
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Setup Complete! Applications are running 24/7.     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URL:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend URL:   http://localhost:5005/api" -ForegroundColor Cyan
Write-Host "Logs Location: $logsPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both services will automatically start on Windows boot," -ForegroundColor Gray
Write-Host "even without any user logged in." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
