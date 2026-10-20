@echo off
setlocal
rem DSH and some Electron hosts inject ELECTRON_RUN_AS_NODE.
rem Clear it, otherwise Electron starts as Node instead of opening a window.
rem This machine's Windows policy also blocks Chromium's sandbox, so the
rem local-only pet runs with --no-sandbox for reliable startup.
set "ELECTRON_RUN_AS_NODE="

cd /d "%~dp0"
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
set "APPARGS="
if /I "%~1"=="smoke" (
  set "APPARGS=--smoke"
  if exist shots rmdir /s /q shots
  if exist .userdata rmdir /s /q .userdata
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%APPDIR%" %APPARGS% --no-sandbox
