@echo off
cd /d "%~dp0"
title SculptSP Dev Launcher
echo ===================================================
echo               Starting SculptSP
echo ===================================================
echo.

:: Fix for OpenSSL 3.0 legacy provider requirement (Node.js 17+)
set NODE_OPTIONS=--openssl-legacy-provider

REM Detect package manager yarn or npm
where yarn >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Yarn detected. Using Yarn.
    set PKG_MANAGER=yarn
    set INSTALL_CMD=yarn install --ignore-scripts
    set DEV_CMD=yarn dev
    set SERVER_CMD=yarn server
) else (
    where npm >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [INFO] Yarn not found. NPM detected. Using NPM.
        set PKG_MANAGER=npm
        set INSTALL_CMD=npm install --ignore-scripts
        set DEV_CMD=npm run dev
        set SERVER_CMD=npm run server
    ) else (
        echo.
        echo [ERROR] Neither yarn nor npm was found in your PATH!
        echo Please install Node.js and try again.
        pause
        exit /b 1
    )
)

echo.
echo Installing dependencies using %INSTALL_CMD%...
call %INSTALL_CMD%
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Dependency installation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Launching Webpack watch and Local server...
start "SculptSP Webpack Watch" cmd /k "%DEV_CMD%"
start "SculptSP Dev Server" cmd /k "%SERVER_CMD%"

echo.
echo SculptSP development environment is running!
echo - Webpack is watching for changes.
echo - Local server is hosting the app at http://localhost:8080
echo.
pause
