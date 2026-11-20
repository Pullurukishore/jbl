# Kardex JBL - 24/7 Windows Service Installation Script
# Installs Backend & Frontend as native Windows services that run 24/7 on boot
# Run this script as Administrator

param (
    [switch]$SkipBuild = $false,
    [string]$ServerIP = ""
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
$backendEnvFile = Join-Path $backendPath "config\config.env"
$frontendEnvFile = Join-Path $frontendPath ".env.local"

# Helper to read .env file key-value pairs
function Get-EnvSettings {
    param([string]$FilePath)
    $settings = @{}
    if (Test-Path $FilePath) {
        Get-Content $FilePath | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith('#') -and -not $line.StartsWith('//')) {
                if ($line -match '^([^=]+)=(.*)$') {
                    $key = $matches[1].Trim()
                    $val = $matches[2].Trim().Trim("'`"")
                    $settings[$key] = $val
                }
            }
        }
    }
    return $settings
}

# 1. Read Settings from config.env and .env.local
$backendEnv = Get-EnvSettings -FilePath $backendEnvFile
$frontendEnv = Get-EnvSettings -FilePath $frontendEnvFile

$backendPort = 5005
if ($backendEnv.ContainsKey('PORT') -and [int]::TryParse($backendEnv['PORT'], [ref]$null)) {
    $backendPort = [int]$backendEnv['PORT']
}
$frontendPort = 3000

# 2. Extract Server IP directly from config.env or .env.local
if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    if ($backendEnv.ContainsKey('SERVER_IP') -and -not [string]::IsNullOrWhiteSpace($backendEnv['SERVER_IP'])) {
        $ServerIP = $backendEnv['SERVER_IP'].Trim()
    } elseif ($frontendEnv.ContainsKey('NEXT_PUBLIC_API_BASE_URL')) {
        if ($frontendEnv['NEXT_PUBLIC_API_BASE_URL'] -match 'https?://([^:/]+)') {
            $ServerIP = $matches[1].Trim()
        }
    }
}

# Fallback if neither config has an IP set
if (-not $ServerIP) {
    try {
        $ServerIP = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notmatch '^(127\.|169\.254\.)' } |
            Select-Object -First 1 -ExpandProperty IPAddressToString
    } catch {
        $ServerIP = "localhost"
    }
}

Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Configuration Loaded from config.env / .env.local   " -ForegroundColor Cyan
Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host "[OK] Server IP:     $ServerIP (from config/env)" -ForegroundColor Green
Write-Host "[OK] Backend Port:  $backendPort (from kardex-node\config\config.env)" -ForegroundColor Green
Write-Host "[OK] Frontend Port: $frontendPort" -ForegroundColor Green
Write-Host ""

# 3. Synchronize frontend .env.local with configured Server IP & Port
$apiUrl = "http://${ServerIP}:${backendPort}/api"
if ($frontendEnv['NEXT_PUBLIC_API_BASE_URL'] -ne $apiUrl) {
    Set-Content -Path $frontendEnvFile -Value "NEXT_PUBLIC_API_BASE_URL=$apiUrl`n" -Force
    Write-Host "[OK] Synchronized kardex-next\.env.local: NEXT_PUBLIC_API_BASE_URL=$apiUrl" -ForegroundColor Green
}

# 4. Ensure CORS_ORIGIN in config.env includes this Server IP
if (Test-Path $backendEnvFile) {
    $configContent = Get-Content $backendEnvFile -Raw
    $frontendOrigin = "http://${ServerIP}:${frontendPort}"
    if ($configContent -notmatch [regex]::Escape($frontendOrigin) -and $ServerIP -ne "localhost") {
        if ($configContent -match 'CORS_ORIGIN=([^\r\n]+)') {
            $existingCors = $matches[1]
            $updatedCors = "$existingCors,$frontendOrigin"
            $configContent = $configContent -replace 'CORS_ORIGIN=[^\r\n]+', "CORS_ORIGIN=$updatedCors"
            Set-Content -Path $backendEnvFile -Value $configContent -Force
            Write-Host "[OK] Added $frontendOrigin to CORS_ORIGIN in config.env" -ForegroundColor Green
        }
    }
}

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
    Write-Host "[OK] Frontend built successfully with API URL: $apiUrl" -ForegroundColor Green
} else {
    Write-Host "[1/4] Skipping build as requested..." -ForegroundColor Gray
}

# ----------------------------------------------------
# Step 2: Install Backend Service (KardexJblBackend)
# ----------------------------------------------------
Write-Host ""
Write-Host "[2/4] Registering Backend Service (KardexJblBackend)..." -ForegroundColor Yellow

Set-Location $backendPath
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Gray
    npm install
}

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

Write-Host "[OK] Backend Service registered (Port: $backendPort)" -ForegroundColor Green

# ----------------------------------------------------
# Step 3: Install Frontend Service (KardexJblFrontend)
# ----------------------------------------------------
Write-Host ""
Write-Host "[3/4] Registering Frontend Service (KardexJblFrontend)..." -ForegroundColor Yellow

# Stop and remove if previously installed
& $nssmPath stop KardexJblFrontend 2>$null
& $nssmPath remove KardexJblFrontend confirm 2>$null

# Register service using direct next runner (avoids cmd orphan process issues)
& $nssmPath install KardexJblFrontend "$nodePath" "node_modules\next\dist\bin\next" "start" "-p" "$frontendPort" "-H" "0.0.0.0"
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

Write-Host "[OK] Frontend Service registered (Port: $frontendPort)" -ForegroundColor Green

# ----------------------------------------------------
# Configure Windows Firewall
# ----------------------------------------------------
try {
    $feRule = "Kardex Frontend (Next.js $frontendPort)"
    if (-not (Get-NetFirewallRule -DisplayName $feRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $feRule -Direction Inbound -LocalPort $frontendPort -Protocol TCP -Action Allow | Out-Null
        Write-Host "[OK] Inbound Firewall Rule added for Port $frontendPort" -ForegroundColor Green
    }
    $beRule = "Kardex Backend (Node.js $backendPort)"
    if (-not (Get-NetFirewallRule -DisplayName $beRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $beRule -Direction Inbound -LocalPort $backendPort -Protocol TCP -Action Allow | Out-Null
        Write-Host "[OK] Inbound Firewall Rule added for Port $backendPort" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not configure firewall automatically: $($_.Exception.Message)" -ForegroundColor Yellow
}

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
Write-Host "Configured IP: $ServerIP" -ForegroundColor Yellow
Write-Host "Frontend URL:  http://${ServerIP}:${frontendPort}  (or http://localhost:${frontendPort})" -ForegroundColor Cyan
Write-Host "Backend URL:   http://${ServerIP}:${backendPort}/api  (or http://localhost:${backendPort}/api)" -ForegroundColor Cyan
Write-Host "Logs Location: $logsPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both services will automatically start on Windows boot," -ForegroundColor Gray
Write-Host "even without any user logged in." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
