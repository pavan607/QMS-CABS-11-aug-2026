@echo off
setlocal enabledelayedexpansion

title QMS Watchdog

set "FLAG=%~dp0qms.intentional_stop"

:loop

timeout /t 10 /nobreak >nul

:: Check Docker Engine
docker info >nul 2>&1
if errorlevel 1 goto loop

:: Check container exists
docker inspect qms >nul 2>&1
if errorlevel 1 goto loop

:: Get running state
set STATUS=

for /f %%i in ('docker inspect -f "{{.State.Running}}" qms 2^>nul') do (
    set STATUS=%%i
)

:: If running -> continue monitoring
if /i "!STATUS!"=="true" (
    if exist "%FLAG%" del "%FLAG%" >nul 2>&1
    goto loop
)

:: If intentionally stopped -> do not restart
if exist "%FLAG%" (
    goto loop
)

echo [%date% %time%] Restarting qms container...

docker start qms >nul 2>&1

goto loop