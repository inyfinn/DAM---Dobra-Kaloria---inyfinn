@echo off
REM Ciche uruchomienie bez wiszacego okna CMD.
REM Oficjalna sciezka: DAM.exe (skrot instalatora). Ten bat tylko przekazuje dalej.
cd /d "%~dp0"
if exist "DAM.exe" (
  start "" "%~dp0DAM.exe"
  exit /b 0
)
if exist "bin\apps\desktop\run-dam.vbs" (
  wscript //nologo "%~dp0bin\apps\desktop\run-dam.vbs"
  exit /b 0
)
echo Brak DAM.exe ani run-dam.vbs w:
echo %~dp0
pause
exit /b 1
