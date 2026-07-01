@echo off
title QMS Application
 
echo Starting QMS Application...
cd /d "D:\Techfluent projects\qms 22-04-2026"
 
:start
npm start
 
echo QMS stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak
goto start