@echo off
title Stop QMS

echo Stopping QMS Application...

:: Kill Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Optional: Kill PM2 if using PM2
taskkill /F /IM pm2.exe >nul 2>&1

echo QMS Stopped Successfully.

timeout /t 2 >nul
exit