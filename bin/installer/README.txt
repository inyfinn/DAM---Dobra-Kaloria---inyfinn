Uruchom DAM-Setup.exe (w glownym folderze obok bin\).

Instalator:
- umowa licencyjna (akceptacja)
- wybor folderu instalacji
- wykrycie poprzedniej wersji (aktualizacja w tej samej sciezce)
- skrot na pulpicie

Po instalacji: skrot "DAM - Dobra Kaloria" -> logowanie.

Aktualizacje: Ustawienia -> Aktualizacje aplikacji (GitHub co 5 h).

Baza Postgres Synology:
  powershell -File bin\scripts\ops\setup-postgres-synology.ps1 -PullDump

Build instalatora (dev):
  powershell -File bin\scripts\ops\build-installer.ps1
