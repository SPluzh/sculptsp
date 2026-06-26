@echo off
:: build_diag.bat — компилирует wintab_diag.exe через MSVC или MinGW

setlocal

:: Так как файл находится в папке wintab_diag, DIAG_DIR указывает на текущую директорию скрипта
set DIAG_DIR=%~dp0
set OUT=%DIAG_DIR%wintab_diag.exe

echo ================================================
echo  Building Wintab Diagnostic Tool
echo ================================================

:: Проверим, доступен ли cl.exe сразу
where cl.exe >nul 2>&1
if %ERRORLEVEL% == 0 goto :msvc_compile

:: Если нет, ищем vcvars64.bat в BuildTools
if not exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" goto :check_community
echo [MSVC] Setting up Build Tools environment...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
goto :msvc_check

:check_community
if not exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" goto :mingw_check
echo [MSVC] Setting up Community environment...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul

:msvc_check
where cl.exe >nul 2>&1
if %ERRORLEVEL% neq 0 goto :mingw_check

:msvc_compile
echo [MSVC] Compiling statically (/MT)...
cl /nologo /EHsc /W3 /O2 /MT "%DIAG_DIR%wintab_diag.cpp" /Fe:"%OUT%" /link user32.lib
if %ERRORLEVEL% == 0 goto :done
echo [MSVC] Compile failed, falling back to MinGW...

:mingw_check
where g++.exe >nul 2>&1
if %ERRORLEVEL% neq 0 goto :no_compiler
echo [MinGW] Compiling statically...
g++ -std=c++17 -O2 -static -o "%OUT%" "%DIAG_DIR%wintab_diag.cpp" -luser32
if %ERRORLEVEL% == 0 goto :done
echo [MinGW] Compile failed.

:no_compiler
echo.
echo ERROR: No compiler found!
echo Install Visual Studio Build Tools or MinGW-w64.
echo.
echo   MSVC:  https://aka.ms/vs/17/release/vs_BuildTools.exe
echo   MinGW: winget install MinGW.MinGW
echo.
pause
exit /b 1

:done
echo.
echo Build OK: %OUT%
echo.
echo Usage:
echo   wintab_diag.exe           -- single diagnostic check
echo   wintab_diag.exe --live    -- live pressure bar (Ctrl+C to exit)
echo.
pause
