@echo off
:: build_diag.bat — компилирует wintab_diag.exe и wintab_wininc_diag.exe через MSVC или MinGW

setlocal

set DIAG_DIR=%~dp0
set OUT1=%DIAG_DIR%wintab_diag.exe
set OUT2=%DIAG_DIR%wintab_wininc_diag.exe
set SRC1=%DIAG_DIR%wintab_diag.cpp
set SRC2=%DIAG_DIR%wintab_wininc_diag.cpp

echo ================================================
echo  Building WinTab Diagnostic Tools
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
echo.
echo [MSVC] Compiling wintab_diag.exe...
cl /nologo /EHsc /W3 /O2 /MT "%SRC1%" /Fe:"%OUT1%" /link user32.lib
if %ERRORLEVEL% neq 0 echo [MSVC] wintab_diag compile FAILED.

echo.
echo [MSVC] Compiling wintab_wininc_diag.exe...
cl /nologo /EHsc /W3 /O2 /MT "%SRC2%" /Fe:"%OUT2%" /link user32.lib advapi32.lib gdi32.lib /SUBSYSTEM:WINDOWS
if %ERRORLEVEL% == 0 goto :done
echo [MSVC] wintab_wininc_diag compile failed, falling back to MinGW...

:mingw_check
where g++.exe >nul 2>&1
if %ERRORLEVEL% neq 0 goto :no_compiler

echo.
echo [MinGW] Compiling wintab_diag.exe...
g++ -std=c++17 -O2 -static -o "%OUT1%" "%SRC1%" -luser32

echo.
echo [MinGW] Compiling wintab_wininc_diag.exe...
g++ -std=c++17 -O2 -static -o "%OUT2%" "%SRC2%" -luser32 -ladvapi32 -lgdi32 -mwindows
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
echo ================================================
echo  Build complete
echo ================================================
echo.
echo Usage: wintab_diag.exe
echo   wintab_diag.exe              -- single check
echo   wintab_diag.exe --live       -- live pressure bar
echo.
echo Usage: wintab_wininc_diag.exe
echo   wintab_wininc_diag.exe               -- LIVE (WinTab + Windows Ink)
echo   wintab_wininc_diag.exe --wintab      -- WinTab only, live
echo   wintab_wininc_diag.exe --ink         -- Windows Ink only, live
echo   wintab_wininc_diag.exe --check       -- single-shot, no live loop
echo.
pause
