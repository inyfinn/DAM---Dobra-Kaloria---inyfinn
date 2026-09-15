@echo off
REM Fallback only. Live task must call powershell -WindowStyle Hidden (see XML).
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0sync-pamiec-podreczna.ps1"
exit /b %ERRORLEVEL%
