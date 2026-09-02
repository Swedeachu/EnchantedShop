@echo off
setlocal EnableDelayedExpansion
title Enchanted Shop - Bedrock Dedicated Server
chcp 65001 >nul

rem This script lives at the repo root for convenience, but bedrock_server.exe
rem resolves its packs/worlds/server.properties relative to the current
rem directory, so it must actually run from inside "server\".
set "REPO_ROOT=%~dp0"
set "SERVER_DIR=%REPO_ROOT%server"
set "PACK_SOURCE=%REPO_ROOT%packs\EnchantedShop_BP"
set "PACK_DEST=%SERVER_DIR%\behavior_packs\EnchantedShop_BP"

rem Set to 0 to run the server once and exit instead of auto-restarting on crash.
set AUTO_RESTART=1
rem Seconds to wait before restarting after a crash - Ctrl+C during the
rem countdown ("Terminate batch job (Y/N)?") backs out without restarting.
set RESTART_DELAY=5

if not exist "%SERVER_DIR%\bedrock_server.exe" (
    echo [start.bat] bedrock_server.exe not found in "%SERVER_DIR%".
    echo [start.bat] Extract the Bedrock Dedicated Server zip into the "server" folder first -
    echo [start.bat] see README.md for the download link and steps.
    echo.
    pause
    exit /b 1
)

if not exist "%PACK_SOURCE%\scripts\main.js" (
    echo [start.bat] "%PACK_SOURCE%\scripts\main.js" not found.
    echo [start.bat] Run "npm run build" first to compile the pack.
    echo.
    pause
    exit /b 1
)

rem --- Deploy the pack as real files, not a symlink/junction ---------------
rem A directory junction ("npm run link-dev-pack") is easy to get into a
rem broken state (wrong target, stale after a repo move, or just plain
rem unreliable to verify), and when broken bedrock_server.exe silently loads
rem ZERO behavior packs - no error, just "Pack Stack - None" in the log. A
rem clean delete + copy on every launch removes that failure mode entirely:
rem the server always sees an actual, current copy of what was last built.
rem "rmdir /s /q" is safe here even if PACK_DEST is still a leftover junction
rem from before - Windows deletes just the link itself, never the junction's
rem target (packs\EnchantedShop_BP), so nothing in the repo is at risk.
echo [start.bat] Deploying pack -^> "%PACK_DEST%"
if exist "%PACK_DEST%" rmdir /s /q "%PACK_DEST%"
mkdir "%PACK_DEST%" >nul 2>nul
xcopy "%PACK_SOURCE%" "%PACK_DEST%" /E /I /Y /Q >nul
if errorlevel 1 (
    echo [start.bat] Failed to copy the pack into "%PACK_DEST%".
    echo.
    pause
    exit /b 1
)

rem --- Make sure a world exists AND has the pack activated on it -----------
rem On a brand new clone there is no world yet - Bedrock only creates one
rem during bedrock_server.exe's own startup, and the file that activates a
rem pack has to exist inside that world folder BEFORE that same startup
rem checks it. tools\prepare-server.ps1 handles this: if the world doesn't
rem exist yet, it launches bedrock_server.exe once just to create it, stops
rem it cleanly the moment the world files show up, and only then writes
rem world_behavior_packs.json - so the very first "start.bat" on a fresh
rem clone launches with the pack already active, no second run needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%tools\prepare-server.ps1"
if errorlevel 1 (
    echo [start.bat] Failed to prepare the world/pack activation - see the error above.
    echo.
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"

:run
echo.
echo [start.bat] ==============================================
echo [start.bat] Starting bedrock_server.exe
echo [start.bat] Type "stop" in this window for a clean shutdown.
echo [start.bat] ==============================================
echo.

bedrock_server.exe
set EXIT_CODE=%ERRORLEVEL%

echo.
echo [start.bat] Server process exited with code %EXIT_CODE%.

if "%EXIT_CODE%"=="0" (
    echo [start.bat] Clean shutdown - not restarting.
    goto end
)

if not "%AUTO_RESTART%"=="1" (
    echo [start.bat] AUTO_RESTART is off - not restarting.
    goto end
)

echo [start.bat] That looked like a crash. Restarting in %RESTART_DELAY% seconds...
echo [start.bat] ^(Ctrl+C now, then "Y", to cancel instead of restarting.^)
timeout /t %RESTART_DELAY%
goto run

:end
echo.
pause
