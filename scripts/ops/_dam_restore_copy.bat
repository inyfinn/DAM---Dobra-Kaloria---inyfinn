@echo off
set SRC=P:\DAM
set DEST=D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn
set LOGDIR=D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy
echo restore_copy START %TIME% >> "%LOGDIR%\_dam_move_status.txt"
for %%D in (_restore_snapshots _restore_backups _restore_stage) do (
  if exist "%SRC%\%%D" (
    echo copying %%D... >> "%LOGDIR%\_dam_move_status.txt"
    robocopy "%SRC%\%%D" "%DEST%\%%D" /E /COPY:DAT /R:1 /W:1 /MT:8 /NFL /NDL /NP /LOG:"%LOGDIR%\_dam_move_%%D.log"
    echo %%D %ERRORLEVEL% %TIME% >> "%LOGDIR%\_dam_move_status.txt"
  )
)
echo RESTORE_DONE %TIME% >> "%LOGDIR%\_dam_move_status.txt"
