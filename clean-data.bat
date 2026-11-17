@echo off
setlocal EnableDelayedExpansion
title Kardex Remstar - Database Cleanup Tool
cd /d "%~dp0"

:: If any arguments were passed, forward them directly to the node script and exit without pause
if not "%~1"=="" (
    node "%~dp0kardex-node\scripts\clean-all-data.js" %*
    goto quit
)

:menu
cls
echo ============================================================================
echo                   KARDEX REMSTAR - DATABASE CLEANUP
echo ============================================================================
echo.
echo  Select a cleanup option:
echo.
echo    [1] Reset Inventory ^& Orders (Preserve Bins ^& Users)
echo        - Clears PUTs, PICKs, activity logs, and file records
echo        - Resets Compartments to EMPTY and resets Handling Unit counters
echo        - Keeps existing Users and Bin configurations intact
echo        - Cleans generated text files and uploaded files
echo.
echo    [2] Clear Inventory + Wipe Bins (RECOMMENDED for fresh bin setup)
echo        - Wipes all Bins, Compartments, Bin Types, PUTs, PICKs, and Logs
echo        - Keeps your user accounts intact so you can still log in
echo        - Cleans generated text files and uploaded files
echo.
echo    [3] Full Database Wipe (PURGE EVERYTHING)
echo        - Truncates ALL database tables including Users
echo        - Recreates default admin user (admin / admin123)
echo        - Cleans all text files and uploads
echo.
echo    [4] Clean Disk Files Only
echo        - Cleans text-file/put, text-file/pick, and uploads (DB untouched)
echo.
echo    [5] Cancel / Exit
echo.
echo ============================================================================
set /p choice="Enter choice [1-5]: "

if "%choice%"=="1" (
    echo.
    node "%~dp0kardex-node\scripts\clean-all-data.js"
    goto end
)
if "%choice%"=="2" (
    echo.
    node "%~dp0kardex-node\scripts\clean-all-data.js" --bins
    goto end
)
if "%choice%"=="3" (
    echo.
    node "%~dp0kardex-node\scripts\clean-all-data.js" --all --seed-admin
    goto end
)
if "%choice%"=="4" (
    echo.
    node "%~dp0kardex-node\scripts\clean-all-data.js" --files-only
    goto end
)
if "%choice%"=="5" (
    echo Operation cancelled.
    goto quit
)

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu

:end
echo.
pause

:quit
