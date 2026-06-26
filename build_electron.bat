@echo off
cd /d "%~dp0"
title SculptSP Electron Builder
echo ===================================================
echo             Building SculptSP for Electron
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
    set RELEASE_CMD=yarn release
) else (
    where npm >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [INFO] Yarn not found. NPM detected. Using NPM.
        set PKG_MANAGER=npm
        set INSTALL_CMD=npm install --ignore-scripts
        set RELEASE_CMD=npm run release
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

:: Run Webpack release build
echo.
echo Running Webpack release build...
call %RELEASE_CMD%
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Webpack release build failed!
    pause
    exit /b %ERRORLEVEL%
)

:: Clean up old files in standalone/app
echo.
echo Preparing standalone build directory...
if exist "standalone\app" (
    echo Cleaning existing standalone\app directory...
    rmdir /s /q "standalone\app"
    if exist "standalone\app" (
        echo [ERROR] Failed to delete standalone\app folder. Close any open files and try again.
        pause
        exit /b 1
    )
)

:: Copy app assets
echo Copying app directory contents to standalone\app...
xcopy "app" "standalone\app" /E /I /Y >nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to copy app directory contents!
    pause
    exit /b %ERRORLEVEL%
)

:: Copy package.json
echo Copying package.json to standalone...
copy /Y "package.json" "standalone\package.json" >nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to copy package.json!
    pause
    exit /b %ERRORLEVEL%
)

:: Check and build wintab binaries if missing
if not exist "standalone\wintab-x64.node" (
    echo [WARNING] standalone\wintab-x64.node is missing. Building it...
    call yarn build-wintab-x64
)

:: Build Standalone Electron App
echo.
echo Packaging Electron App...
cd standalone
node buildStandalone.js
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Electron packaging failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)

cd ..
echo.
echo ===================================================
echo        SculptSP Electron Build Successful!
echo ===================================================
echo Output directories can be found inside: "%~dp0standalone"
echo.
pause
