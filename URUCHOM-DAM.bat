@echo off
REM DAM - Dobra Kaloria - uruchomienie (dwuklik)
cd /d "%~dp0"
if not exist "DAM.exe" (
  echo Brak DAM.exe w folderze:
  echo %~dp0
  pause
  exit /b 1
)
start "" "%~dp0DAM.exe"
