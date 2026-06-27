@echo off
cd /d "%~dp0"
title SculptSP Tauri Builder
echo ===================================================
echo             Building SculptSP for Tauri
echo ===================================================
echo.

:: Fix for OpenSSL 3.0 legacy provider requirement (Node.js 17+)
set NODE_OPTIONS=--openssl-legacy-provider

:: Detect package manager (yarn or npm)
where yarn >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Yarn detected. Using Yarn.
    set PKG_MANAGER=yarn
    set INSTALL_CMD=yarn install --ignore-scripts
) else (
    where npm >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [INFO] Yarn not found. NPM detected. Using NPM.
        set PKG_MANAGER=npm
        set INSTALL_CMD=npm install --ignore-scripts
    ) else (
        echo.
        echo [ERROR] Neither yarn nor npm was found in your PATH!
        echo Please install Node.js and try again.
        pause
        exit /b 1
    )
)

:: Ensure dependencies are installed
if not exist "node_modules\" (
    echo.
    echo [INFO] node_modules not found. Installing dependencies...
    call %INSTALL_CMD%
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] Dependency installation failed!
        pause
        exit /b %ERRORLEVEL%
    )
)

:: Run tauri build using @tauri-apps/cli
echo.
echo Running Tauri build...
call npx @tauri-apps/cli build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Tauri build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo         SculptSP Tauri Build Successful!
echo ===================================================
echo Executable: "src-tauri\target\release\sculptsp.exe"
echo Installers: "src-tauri\target\release\bundle\"
echo.
pause
