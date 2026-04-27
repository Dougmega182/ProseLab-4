@echo off
title ProseLab V4 Launcher
echo.
echo   ==============================
echo    ProseLab V4 - Starting Up
echo   ==============================
echo.

:: Step 1: Start Ollama if not running
echo   [1/3] Starting Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I "ollama.exe" >NUL
if errorlevel 1 (
    start /min "" ollama serve
    timeout /t 3 /nobreak >NUL
    echo         Ollama started
) else (
    echo         Ollama already running
)

:: Step 2: Start Vite dev server
echo   [2/3] Starting Vite dev server...
cd /d "%~dp0proselab"
start /min "ProseLab-Vite" cmd /c "npm run dev"

:: Step 3: Wait for server and open browser
echo   [3/3] Waiting for server to be ready...
timeout /t 5 /nobreak >NUL

echo.
echo   ==============================
echo    ProseLab V4 is LIVE
echo    http://localhost:5173
echo   ==============================
echo.

start http://localhost:5173

echo   Press any key to STOP all servers...
pause >NUL

:: Cleanup
echo.
echo   Shutting down Vite...
taskkill /FI "WINDOWTITLE eq ProseLab-Vite" /F >NUL 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /PID %%a /F >NUL 2>&1
echo   ProseLab stopped. Goodbye!
timeout /t 2 /nobreak >NUL
