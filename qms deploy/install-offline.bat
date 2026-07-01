@echo off
setlocal
cd /d "%~dp0.."

echo.
echo QMS - offline npm install (no internet)
echo =====================================
echo.

if not exist "package-lock.json" (
  echo ERROR: package-lock.json not found. Run from project root or fix deploy path.
  exit /b 1
)

if not exist ".npm-offline-cache\_cacache" (
  echo ERROR: .npm-offline-cache is missing or empty.
  echo.
  echo On a connected machine with the same Windows version:
  echo   npm run vendor:npm-cache
  echo.
  echo Copy the full project folder including .npm-offline-cache to this PC, then run this script again.
  exit /b 1
)

call npm run install:offline
if errorlevel 1 exit /b 1

echo.
echo Next: npm run build
echo.
exit /b 0
