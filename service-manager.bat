@echo off
setlocal EnableDelayedExpansion
title Kardex Remstar - Production Service Manager
cd /d "%~dp0"

:menu
cls
echo ============================================================================
echo                   KARDEX REMSTAR - PRODUCTION SERVICE MANAGER
echo ============================================================================
echo.
echo  Select an option:
echo.
echo    [1] Check Service Status (View CPU, RAM, Uptime)
echo    [2] View Live Streamed Logs (Backend + Frontend)
echo    [3] View Backend Logs Only
echo    [4] View Frontend Logs Only
echo    [5] Restart All Services (Zero-Downtime Reload)
echo    [6] Stop All Services
echo    [7] Start / Restore Services
echo    [8] Rebuild Frontend ^& Reload (After Code Changes)
echo    [9] Save Current State to Windows Boot (pm2 save)
echo    [0] Exit
echo.
echo ============================================================================
set /p choice="Enter choice [0-9]: "

if "%choice%"=="1" (
    echo.
    call pm2 status
    echo.
    pause
    goto menu
)
if "%choice%"=="2" (
    echo.
    echo Press Ctrl+C to exit log view...
    call pm2 logs
    goto menu
)
if "%choice%"=="3" (
    echo.
    echo Press Ctrl+C to exit log view...
    call pm2 logs kardex-backend
    goto menu
)
if "%choice%"=="4" (
    echo.
    echo Press Ctrl+C to exit log view...
    call pm2 logs kardex-frontend
    goto menu
)
if "%choice%"=="5" (
    echo.
    echo Restarting all Kardex services...
    call pm2 restart all
    call pm2 save
    echo.
    pause
    goto menu
)
if "%choice%"=="6" (
    echo.
    echo Stopping all Kardex services...
    call pm2 stop all
    echo.
    pause
    goto menu
)
if "%choice%"=="7" (
    echo.
    echo Starting Kardex services via ecosystem.config.js...
    call pm2 start ecosystem.config.js
    call pm2 save
    echo.
    pause
    goto menu
)
if "%choice%"=="8" (
    echo.
    echo [1/2] Building Next.js frontend production bundle...
    cd kardex-next
    call npm run build
    cd ..
    echo [2/2] Restarting frontend service...
    call pm2 restart kardex-frontend
    call pm2 save
    echo.
    echo Frontend rebuilt and restarted successfully!
    pause
    goto menu
)
if "%choice%"=="9" (
    echo.
    echo Saving current running process list to Windows boot registry...
    call pm2 save
    echo.
    pause
    goto menu
)
if "%choice%"=="0" (
    goto quit
)

goto menu

:quit
exit /b 0

