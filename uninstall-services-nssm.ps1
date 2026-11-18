# Kardex JBL - 24/7 Windows Service Uninstall Script
# Removes Backend and Frontend Windows services cleanly
# Run this script as Administrator

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Kardex JBL System - Service Uninstall               " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$projectRoot = $PSScriptRoot
$nssmPath = Join-Path $projectRoot "nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "ERROR: nssm.exe not found at $nssmPath!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/2] Stopping and removing Backend Service..." -ForegroundColor Yellow
& $nssmPath stop KardexJblBackend 2>$null
Start-Sleep -Seconds 2
& $nssmPath remove KardexJblBackend confirm 2>$null
Write-Host "[OK] Backend Service removed." -ForegroundColor Green

Write-Host "[2/2] Stopping and removing Frontend Service..." -ForegroundColor Yellow
& $nssmPath stop KardexJblFrontend 2>$null
Start-Sleep -Seconds 2
& $nssmPath remove KardexJblFrontend confirm 2>$null
Write-Host "[OK] Frontend Service removed." -ForegroundColor Green

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Uninstall Complete! Services have been removed.     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Logs are preserved in: $projectRoot\logs" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
