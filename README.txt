DAM - Dobra Kaloria - Inyfinn

GIT_ROOT = ten katalog (git + DAM.exe)
CONTENT_ROOT = bin\ (kod i dane dla DAM.exe)

Po git pull:
  powershell -File scripts\ops\sync-apps-to-bin.ps1

Uruchomienie:
  DAM.exe (albo DAM.cmd) — czyta z bin\
  dev: scripts\ops\dev-start.ps1 — czyta z apps\
