@echo off
setlocal
title Enchanted Shop - Rebuild

rem Always run from the repo root regardless of where this was double-clicked from.
cd /d "%~dp0"

rem --- Make sure Node/npm are actually available before trying anything ----
rem On a fresh clone this is the very first thing that can fail (Node not
rem installed at all) - fail loudly here with a clear message instead of
rem letting a cryptic "'npm' is not recognized" error be the first thing
rem someone sees.
where npm >nul 2>nul
if errorlevel 1 (
    echo [rebuild.bat] npm was not found on PATH.
    echo [rebuild.bat] Install Node.js LTS from https://nodejs.org/ ^(this also installs npm^),
    echo [rebuild.bat] then close and reopen this window so PATH picks it up.
    echo.
    pause
    exit /b 1
)

rem --- Install/refresh dependencies -----------------------------------------
rem "npm install" is what makes a bare "git clone -^> rebuild.bat -^> start.bat"
rem actually work with no manual setup step: on a fresh clone there's no
rem node_modules yet at all, and this creates it from package-lock.json. On
rem every later run it's a fast near-no-op (npm only touches anything if
rem package.json/package-lock.json changed since the last install), so this
rem is safe to always run rather than trying to guess when it's needed.
echo.
echo [rebuild.bat] Running "npm install"...
echo.
call npm install
set INSTALL_EXIT=%ERRORLEVEL%
if not "%INSTALL_EXIT%"=="0" (
    echo.
    echo [rebuild.bat] "npm install" FAILED with exit code %INSTALL_EXIT%.
    echo [rebuild.bat] Check your internet connection and the error above, then try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [rebuild.bat] Running "npm run build"...
echo.

rem IMPORTANT: npm.cmd is itself a batch script that ends with "exit /b".
rem Without "call" here, that exit terminates THIS script too and skips
rem everything below it (including pause) - which is why the window was
rem closing instantly.
call npm run build
set BUILD_EXIT=%ERRORLEVEL%

echo.
if "%BUILD_EXIT%"=="0" (
    echo [rebuild.bat] Build succeeded.
) else (
    echo [rebuild.bat] Build FAILED with exit code %BUILD_EXIT%.
)

echo.
pause
