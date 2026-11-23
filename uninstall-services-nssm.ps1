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

# Helper to remove service, release ports, and handle SCM handles
function Remove-ServiceSafely {
    param([string]$ServiceName, [int]$Port = 0)
    Write-Host "Stopping and removing $ServiceName..." -ForegroundColor Yellow
    & $nssmPath stop $ServiceName 2>$null
    Start-Sleep -Seconds 1
    & $nssmPath remove $ServiceName confirm 2>$null
    Start-Sleep -Seconds 1

    # Fallback to sc.exe delete if NSSM left a lingering service
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        & sc.exe delete $ServiceName 2>$null
        Start-Sleep -Seconds 1
    }

    # Free up port if lingering node process holds it
    if ($Port -gt 0) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
            foreach ($conn in $connections) {
                if ($conn.OwningProcess -gt 0) {
                    Write-Host "Stopping lingering process on port $Port (PID: $($conn.OwningProcess))..." -ForegroundColor Gray
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {}
    }

    $rem = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $rem) {
        Write-Host "[OK] $ServiceName removed successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARN] $ServiceName is marked for deletion (DELETE_PENDING). If open, please close 'services.msc'." -ForegroundColor Yellow
    }
}

Write-Host "[1/3] Removing Backend Service..." -ForegroundColor Yellow
Remove-ServiceSafely -ServiceName "KardexJblBackend" -Port 5005

Write-Host ""
Write-Host "[2/3] Removing Frontend Service..." -ForegroundColor Yellow
Remove-ServiceSafely -ServiceName "KardexJblFrontend" -Port 3000

Write-Host ""
Write-Host "[3/3] Removing Windows Firewall Rules..." -ForegroundColor Yellow
try {
    Remove-NetFirewallRule -DisplayName "Kardex Frontend*" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Kardex Backend*" -ErrorAction SilentlyContinue
    Write-Host "[OK] Inbound Firewall Rules removed." -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not remove firewall rules automatically: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Uninstall Complete! Services have been removed.     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Logs are preserved in: $projectRoot\logs" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
