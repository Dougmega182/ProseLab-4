@echo off
title ProseLab V4 - Premium Orchestration Engine
setlocal enabledelayedexpansion

:: Configuration
set "ENV_FILE=%~dp0proselab\.env"
set "PORT=5173"
set "READY=0"

:: ══════════════════════════════════════════════════════════
::  HEADER & BRANDING
:: ══════════════════════════════════════════════════════════
cls
echo.
echo   P R O S E L A B  V 4
echo   ------------------------------------------------------
echo   Analytical Editorial Engine ^| Quality Enforcement
echo   ------------------------------------------------------
echo.

:: ══════════════════════════════════════════════════════════
::  PHASE 1: HEALTH CHECK
:: ══════════════════════════════════════════════════════════
echo   [1/4] SYSTEM DIAGNOSTICS...

:: Check .env
if not exist "!ENV_FILE!" (
    echo         [ERROR] proselab\.env not found.
    echo         Please create it based on README.md.
    pause
    exit /b 1
)

:: Parse .env for diagnostics
for /f "tokens=1,2 delims==" %%a in (!ENV_FILE!) do (
    if "%%a"=="VITE_OPENAI_KEY" set "OKEY=%%b"
    if "%%a"=="VITE_OLLAMA_MODEL" set "OMODEL=%%b"
)

if "!OKEY!"=="" (
    echo         [WARNING] OpenAI Key missing in .env. Refinement will fail.
) else (
    echo         [OK] OpenAI Configuration detected.
)

:: Check Ollama
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I "ollama.exe" >NUL
if errorlevel 1 (
    echo         Ollama not running. Starting...
    start /min "" ollama serve
    timeout /t 5 /nobreak >NUL
    echo         [OK] Ollama Service started.
) else (
    echo         [OK] Ollama Service active.
)

:: Check Model
ollama list | findstr /i "!OMODEL!" >NUL
if errorlevel 1 (
    echo         [WARNING] Model !OMODEL! not found in Ollama.
    echo         Downloading now...
    ollama pull !OMODEL!
) else (
    echo         [OK] Model !OMODEL! verified.
)

:: ══════════════════════════════════════════════════════════
::  PHASE 2: SERVICE INITIALIZATION
:: ══════════════════════════════════════════════════════════
echo.
echo   [2/4] LAUNCHING SERVICES...

:: Kill existing Vite to ensure port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":!PORT!" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >NUL 2>&1
)

cd /d "%~dp0proselab"
start /min "ProseLab-Vite" cmd /c "npm run dev"
echo         Vite Dev Server initiated.

:: ══════════════════════════════════════════════════════════
::  PHASE 3: CONNECTIVITY
:: ══════════════════════════════════════════════════════════
echo.
echo   [3/4] ESTABLISHING CONNECTION...

for /L %%i in (1,1,30) do (
    if !READY! equ 0 (
        netstat -aon | findstr ":!PORT!" | findstr "LISTENING" >NUL
        if !errorlevel! equ 0 (
            set "READY=1"
            echo         [READY] Analytical Engine reachable on port !PORT!.
        ) else (
            timeout /t 1 /nobreak >NUL
        )
    )
)

if !READY! equ 0 (
    echo.
    echo   [FATAL] Timeout waiting for analytical engine.
    pause
    exit /b 1
)

:: ══════════════════════════════════════════════════════════
::  PHASE 4: LIVE DEPLOYMENT
:: ══════════════════════════════════════════════════════════
echo.
echo   [4/4] DEPLOYING UI...
start http://localhost:!PORT!

echo.
echo   ------------------------------------------------------
echo   ProseLab V4 is ACTIVE at http://localhost:!PORT!
echo   ------------------------------------------------------
echo.
echo   [PRESS ANY KEY TO TEARDOWN SESSION]
echo.

pause >NUL

:: ══════════════════════════════════════════════════════════
::  CLEANUP
:: ══════════════════════════════════════════════════════════
echo   Shutting down session...
taskkill /FI "WINDOWTITLE eq ProseLab-Vite" /F >NUL 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":!PORT!" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >NUL 2>&1
)
echo   Session terminated. Goodbye.
timeout /t 2 /nobreak >NUL
exit
