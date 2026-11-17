<#
.SYNOPSIS
    Kardex Remstar - Database & File Cleanup Tool

.DESCRIPTION
    Cleans database records (PUTs, PICKs, Logs, Files) and resets bins/compartments,
    or performs a complete database wipe and disk file purge.

.PARAMETER Bins
    Wipes all bin tables (compartment, handling_unit, bin_type) in addition to orders, keeping users.

.PARAMETER All
    Full wipe of all tables including bins and users.

.PARAMETER Yes
    Non-interactive mode (skips confirmation prompts).

.PARAMETER DbOnly
    Cleans only database tables, leaving files in text-file/ and uploads/ intact.

.PARAMETER FilesOnly
    Cleans only disk files, leaving database tables intact.

.PARAMETER IncludeUsers
    Also deletes user accounts.

.PARAMETER SeedAdmin
    Recreates the default administrator user (admin / admin123).

.EXAMPLE
    .\clean-data.ps1
    Opens the interactive menu.

.EXAMPLE
    .\clean-data.ps1 -Bins -Yes
    Clears all orders and wipes all bins/compartments while keeping users.
#>

[CmdletBinding()]
param (
    [switch]$Bins,
    [switch]$All,
    [switch]$Yes,
    [switch]$DbOnly,
    [switch]$FilesOnly,
    [switch]$IncludeUsers,
    [switch]$SeedAdmin,
    [switch]$Help
)

$scriptPath = Join-Path $PSScriptRoot "kardex-node\scripts\clean-all-data.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Clean script not found at: $scriptPath"
    exit 1
}

# If help was requested
if ($Help) {
    node $scriptPath --help
    exit 0
}

# Check if any switch parameter was provided
$hasArgs = $Bins -or $All -or $Yes -or $DbOnly -or $FilesOnly -or $IncludeUsers -or $SeedAdmin

if ($hasArgs) {
    $nodeArgs = @()
    if ($Bins) { $nodeArgs += "--bins" }
    if ($All) { $nodeArgs += "--all" }
    if ($Yes) { $nodeArgs += "--yes" }
    if ($DbOnly) { $nodeArgs += "--db-only" }
    if ($FilesOnly) { $nodeArgs += "--files-only" }
    if ($IncludeUsers) { $nodeArgs += "--include-users" }
    if ($SeedAdmin) { $nodeArgs += "--seed-admin" }

    node $scriptPath @nodeArgs
    exit $LASTEXITCODE
}

# Interactive Menu
Clear-Host
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "                  KARDEX REMSTAR - DATABASE CLEANUP TOOL                    " -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Select a cleanup option:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    [1] Reset Inventory & Orders (Preserve Bins & Users)" -ForegroundColor Green
Write-Host "        - Clears PUTs, PICKs, activity logs, and file records"
Write-Host "        - Resets Compartments to EMPTY and resets Handling Unit counters"
Write-Host "        - Keeps existing Users and Bin configurations intact"
Write-Host "        - Cleans generated text files and uploaded files"
Write-Host ""
Write-Host "    [2] Clear Inventory + Wipe Bins (Fresh Bin Setup)" -ForegroundColor Green
Write-Host "        - Wipes all Bins, Compartments, Bin Types, PUTs, PICKs, and Logs"
Write-Host "        - Keeps your user accounts intact so you can still log in"
Write-Host "        - Cleans generated text files and uploaded files"
Write-Host ""
Write-Host "    [3] Full Database Wipe (PURGE EVERYTHING)" -ForegroundColor Red
Write-Host "        - Truncates ALL database tables including Users"
Write-Host "        - Recreates default admin user (admin / admin123)"
Write-Host "        - Cleans all text files and uploads"
Write-Host ""
Write-Host "    [4] Clean Disk Files Only" -ForegroundColor Cyan
Write-Host "        - Cleans text-file/put, text-file/pick, and uploads (DB untouched)"
Write-Host ""
Write-Host "    [5] Cancel / Exit" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan

$choice = Read-Host "Enter choice [1-5]"

switch ($choice) {
    "1" {
        Write-Host ""
        node $scriptPath
    }
    "2" {
        Write-Host ""
        node $scriptPath --bins
    }
    "3" {
        Write-Host ""
        node $scriptPath --all --seed-admin
    }
    "4" {
        Write-Host ""
        node $scriptPath --files-only
    }
    "5" {
        Write-Host "`nOperation cancelled by user." -ForegroundColor Yellow
        exit 0
    }
    Default {
        Write-Host "`nInvalid choice." -ForegroundColor Red
        exit 1
    }
}
