@echo off
title ChatWave Full Stack Starter
echo ==============================================
echo        Starting ChatWave (Full Setup)
echo ==============================================

start "ChatWave Backend (Port 8000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
start "ChatWave Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend running at:  http://localhost:8000
echo Frontend running at: http://localhost:5173
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
echo Done!
