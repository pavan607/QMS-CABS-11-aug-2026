@echo off
setlocal

title Stop QMS

set "FLAG=%~dp0qms.intentional_stop"

echo Creating intentional stop flag...

:: Create stop flag
type nul > "%FLAG%"

:: Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running.
    pause
    exit /b
)

:: Check container exists
docker inspect qms >nul 2>&1
if errorlevel 1 (
    echo Container qms not found.
    pause
    exit /b
)

echo Stopping qms container...

:: Force stop after 5 seconds if needed
docker stop -t 5 qms

if errorlevel 1 (
    echo Normal stop failed. Force removing...
    docker rm -f qms
)

echo.
echo QMS stopped successfully.
pause