@echo off
title Valley Security Local Server Launcher
cd /d "%~dp0"
echo =========================================================
echo       Valley Security Service Agency - Local Launcher
echo =========================================================
echo.
echo Starting web server on http://localhost:3000...
echo.
echo Press Ctrl+C in this window to stop the server.
echo.
"C:\Program Files\nodejs\node.exe" server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start Node server. Please ensure Node.js is installed at:
    echo "C:\Program Files\nodejs\node.exe"
    echo.
    pause
)
