#Requires -Version 5.1
# PRZESTARZALY - nie uruchamiaj. Zamienione na krotki komunikat 2026-09-27.
#
# Co robil dawniej (do 2026-09-27): wymuszal uklad "GIT_ROOT pokazuje tylko:
# DAM.exe, URUCHOM-DAM.bat, bin\, .cursor\, .git*". Kasowal rekurencyjnie
# (cmd /c rmdir /s /q) katalogi _restore_backups, _restore_snapshots,
# _restore_stage, _qa_screenshots, build; potem przenosil root-owe "dist" do
# "bin\dist" komenda robocopy "dist" "bin\dist" /E /MOVE (flaga /MOVE kasuje
# zrodlo po skopiowaniu - zakazana w tym repo) i "installer" do
# "bin\installer" plikami.
#
# Dlaczego zatrzymany: odtwarzal uklad sprzed porzadkow z 2026-09-27
# (bin/dist juz nie istnieje w korzeniu - zobacz bin/docs/REPO-LAYOUT.md) i
# uzywal /MOVE + rmdir /s, czyli dokladnie tych operacji, ktore reguly
# bezpieczenstwa tego repo zakazuja (patrz CLAUDE.md, zasada 0).
#
# Aktualny uklad repo opisuje: bin/docs/REPO-LAYOUT.md
# Aktualne porzadkowanie (przenoszenie, nigdy kasowanie) robi sie recznie,
# z wpisem do work/_porzadek-<data>/MANIFEST.tsv PRZED kazdym ruchem -
# patrz work/README.md.

Write-Host "cleanup-git-root.ps1 jest przestarzaly i nic nie robi. Uklad repo: bin/docs/REPO-LAYOUT.md. Porzadki: work/README.md." -ForegroundColor Yellow
exit 1
