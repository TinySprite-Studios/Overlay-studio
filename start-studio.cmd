@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Installing TinySprite Studio dependencies...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
call npm run studio
if errorlevel 1 pause
