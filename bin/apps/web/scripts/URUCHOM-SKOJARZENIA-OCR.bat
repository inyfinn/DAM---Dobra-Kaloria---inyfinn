@echo off
setlocal
set HERE=%~dp0
set CHECKER_PY=D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\Program  do sprawdzania\PACKAGING-CHECKER\app\venv\Scripts\python.exe

echo Skojarzenia OCR dla Brandingu - dziala w tle, mozna zostawic na weekend.
echo Bezpiecznie przerwac Ctrl+C: przy ponownym uruchomieniu wznawia od miejsca przerwania.
echo Postep: bin\apps\desktop\data\ocr-assoc-batch.jsonl
echo.

if not exist "%CHECKER_PY%" (
    echo BLAD: nie znaleziono Pythona PACKAGING-CHECKER pod:
    echo   %CHECKER_PY%
    pause
    exit /b 1
)

"%CHECKER_PY%" "%HERE%ocr-assoc-batch.py" --apply
echo.
echo Skonczone. W DAM: Branding, wlacz tryb Admin (prawy gorny rog), przycisk
echo obok paska wyszukiwania otwiera kolejke skojarzen do zatwierdzenia/odrzucenia.
pause
