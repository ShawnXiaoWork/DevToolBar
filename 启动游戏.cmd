@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies for the first launch...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check your network and npm settings.
    pause
    exit /b 1
  )
)

node scripts\launch.mjs
if errorlevel 1 pause
