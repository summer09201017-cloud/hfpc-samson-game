@echo off
REM Samson Game launcher. English-only (Chinese breaks .bat parsing on Windows).
setlocal enableextensions
title Samson Game
cd /d "%~dp0"

echo ============================================
echo    Samson and the Lion  -  starting...
echo ============================================
echo.

REM ---- need Node.js ----
where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js not found. Install it from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

REM ---- first run: install packages ----
if not exist "node_modules" (
  echo  First run - installing packages, about 1-2 minutes, only once...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Please screenshot the message above.
    pause
    exit /b 1
  )
)

REM ---- find a free port (scan up from 5273) ----
set /a PORT=5273
set /a TRIES=0
:findport
netstat -ano | findstr "LISTENING" | findstr ":%PORT% " >nul 2>&1
if errorlevel 1 goto gotport
set /a PORT+=1
set /a TRIES+=1
if %TRIES% GEQ 50 (
  echo  No free port found. Close some apps and try again.
  pause
  exit /b 1
)
goto findport
:gotport

set "URL=http://localhost:%PORT%/"
echo.
echo  Game URL:  %URL%
echo.
echo  *** Keep THIS window open while playing. Close it to stop the game. ***
echo.

REM Open the browser a few seconds later (hidden helper), then run the server here.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process '%URL%'"

echo  Starting server (browser opens automatically in a few seconds)...
echo.
call npm run dev -- --port %PORT% --strictPort --host

echo.
echo  Server stopped.
pause
exit /b 0
