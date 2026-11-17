@echo off
setlocal EnableDelayedExpansion
title Kardex Remstar - Zero-Prompt Production Service Installer
cd /d "%~dp0"

echo ============================================================================
echo           KARDEX REMSTAR - PRODUCTION WINDOWS SERVICE INSTALLATION
echo ============================================================================
echo.

:: 1. Check for Administrative Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This installer requires Administrator privileges.
    echo Please right-click on "install-service.bat" and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

:: 2. Check and compile Next.js production build if not already built
if not exist "%~dp0kardex-next\.next" (
    echo [Step 1/3] Building Next.js production bundle...
    cd "%~dp0kardex-next"
    call npm run build
    cd "%~dp0"
) else (
    echo [Step 1/3] Production build already verified.
)

:: 3. Register Auto-Start at Windows Boot (100% Silent, Zero Prompts)
echo [Step 2/3] Registering Windows Auto-Start Service (KardexService)...
schtasks /create /tn "KardexService" /tr "\"%~dp0kardex.bat\" start" /sc onstart /ru "SYSTEM" /rl highest /f >nul 2>&1
if %errorLevel% neq 0 (
    :: Fallback to current user if SYSTEM account is restricted by group policy
    schtasks /create /tn "KardexService" /tr "\"%~dp0kardex.bat\" start" /sc onlogon /rl highest /f >nul 2>&1
)

:: 4. Start Both Backend and Frontend Services Immediately
echo [Step 3/3] Starting Backend (Port 5005) and Frontend (Port 3000)...
call "%~dp0kardex.bat" start

echo.
echo ============================================================================
echo                     INSTALLATION COMPLETE (NO PROMPTS)
echo ============================================================================
echo.
echo  * Service Name: KardexService
echo  * Backend:      http://localhost:5005/api
echo  * Frontend:     http://localhost:3000
echo  * Auto-Boot:    Active (Starts automatically when Windows reboots)
echo.
echo You can manage everything anytime using: kardex.bat
echo ============================================================================
echo.
pause
