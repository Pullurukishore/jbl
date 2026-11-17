@echo off
setlocal EnableDelayedExpansion
title Kardex Remstar - Production Control Center
cd /d "%~dp0"

:: ----------------------------------------------------------------------------
:: Direct Command Line Arguments Handling
:: Example: kardex.bat start | stop | restart | status | logs | build | install
:: ----------------------------------------------------------------------------
if /i "%~1"=="start"   goto cmd_start
if /i "%~1"=="stop"    goto cmd_stop
if /i "%~1"=="restart" goto cmd_restart
if /i "%~1"=="status"  goto cmd_status
if /i "%~1"=="logs"    goto cmd_logs
if /i "%~1"=="build"   goto cmd_build
if /i "%~1"=="install" goto cmd_install

:menu
cls
echo ============================================================================
echo                   KARDEX REMSTAR - PRODUCTION CONTROL
echo ============================================================================
echo.
echo   [1] START Both Services       - Start Backend (5005) + Frontend (3000)
echo   [2] RESTART Services          - Reload all services
echo   [3] STOP Services             - Stop both Backend and Frontend
echo   [4] STATUS                    - Check if Backend (5005) ^& Frontend (3000) are up
echo   [5] LIVE LOGS                 - View real-time logs
echo   [6] REBUILD ^& RESTART         - Compile Next.js Frontend and reload
echo   [7] INSTALL WINDOWS SERVICE   - Register PM2 auto-boot Windows Service
echo   [0] Exit
echo.
echo ============================================================================
echo  Tip: You can also run: kardex.bat [start^|restart^|stop^|status]
echo ============================================================================
set /p choice="Enter choice [0-7]: "

if "%choice%"=="1" goto cmd_start
if "%choice%"=="2" goto cmd_restart
if "%choice%"=="3" goto cmd_stop
if "%choice%"=="4" goto cmd_status
if "%choice%"=="5" goto cmd_logs
if "%choice%"=="6" goto cmd_build
if "%choice%"=="7" goto cmd_install
if "%choice%"=="0" exit /b 0

goto menu

:: ----------------------------------------------------------------------------
:: COMMAND IMPLEMENTATIONS
:: ----------------------------------------------------------------------------

:cmd_start
echo.
echo [*] Checking PM2 availability...
call pm2 -v >nul 2>&1
if %errorLevel% equ 0 (
    echo [*] Starting via PM2...
    call pm2 start "%~dp0ecosystem.config.js"
    call pm2 save >nul 2>&1
    echo [*] Services online with PM2!
) else (
    echo [*] Starting Backend (Port 5005) in background...
    start "Kardex-Backend (Port 5005)" /min cmd /c "cd /d %~dp0kardex-node && node index.js"
    timeout /t 2 /nobreak >nul
    echo [*] Starting Frontend (Port 3000) in background...
    start "Kardex-Frontend (Port 3000)" /min cmd /c "cd /d %~dp0kardex-next && npm run start"
    echo [*] Both Backend and Frontend launched!
)
echo.
echo Backend:  http://localhost:5005/api
echo Frontend: http://localhost:3000
echo.
if "%~1"=="" pause & goto menu
exit /b 0

:cmd_restart
echo.
call pm2 -v >nul 2>&1
if %errorLevel% equ 0 (
    echo [*] Restarting via PM2...
    call pm2 restart all
    echo [*] Done!
) else (
    echo [*] Stopping existing Node processes...
    taskkill /f /im node.exe >nul 2>&1
    timeout /t 1 /nobreak >nul
    goto cmd_start
)
if "%~1"=="" pause & goto menu
exit /b 0

:cmd_stop
echo.
call pm2 -v >nul 2>&1
if %errorLevel% equ 0 (
    call pm2 stop all
    echo [*] Services stopped via PM2.
) else (
    echo [*] Stopping background node processes...
    taskkill /f /im node.exe >nul 2>&1
    echo [*] Services stopped.
)
if "%~1"=="" pause & goto menu
exit /b 0

:cmd_status
echo.
echo ============================================================================
echo                          SERVICE HEALTH STATUS
echo ============================================================================
call pm2 -v >nul 2>&1
if %errorLevel% equ 0 (
    call pm2 status
) else (
    echo Checking Port 5005 (Backend):
    netstat -ano | findstr :5005 >nul
    if %errorLevel% equ 0 (
        echo   [ONLINE]  Backend is LISTENING on port 5005
    ) else (
        echo   [OFFLINE] Backend is NOT running
    )
    echo Checking Port 3000 (Frontend):
    netstat -ano | findstr :3000 >nul
    if %errorLevel% equ 0 (
        echo   [ONLINE]  Frontend is LISTENING on port 3000
    ) else (
        echo   [OFFLINE] Frontend is NOT running
    )
)
echo ============================================================================
echo.
if "%~1"=="" pause & goto menu
exit /b 0

:cmd_logs
echo.
call pm2 -v >nul 2>&1
if %errorLevel% equ 0 (
    call pm2 logs
) else (
    echo Inspecting latest logs in logs directory...
    dir /b "%~dp0logs" 2>nul
    type "%~dp0logs\backend-out.log" 2>nul
)
if "%~1"=="" goto menu
exit /b 0

:cmd_build
echo.
echo [*] Compiling Next.js production build...
cd /d "%~dp0kardex-next"
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Next.js build failed.
    cd /d "%~dp0"
    if "%~1"=="" pause & goto menu
    exit /b 1
)
cd /d "%~dp0"
echo [*] Restarting frontend...
goto cmd_restart

:cmd_install
echo.
echo [*] Setting up Windows Auto-Start Service (Zero Prompts)...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required for Windows Service installation.
    echo Please right-click "kardex.bat" and select "Run as administrator".
    if "%~1"=="" pause & goto menu
    exit /b 1
)
schtasks /create /tn "KardexService" /tr "\"%~dp0kardex.bat\" start" /sc onstart /ru "SYSTEM" /rl highest /f >nul 2>&1
if %errorLevel% neq 0 (
    schtasks /create /tn "KardexService" /tr "\"%~dp0kardex.bat\" start" /sc onlogon /rl highest /f >nul 2>&1
)
echo [*] KardexService registered to auto-start on Windows boot!
call "%~dp0kardex.bat" start
if "%~1"=="" pause & goto menu
exit /b 0
