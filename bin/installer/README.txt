Uruchom DAM-Setup.exe (w glownym folderze obok bin\).

Instalator:
- umowa licencyjna (akceptacja)
- wybor folderu instalacji
- wykrycie poprzedniej wersji (aktualizacja w tej samej sciezce)
- skrot na pulpicie

Po instalacji: skrot "DAM - Dobra Kaloria" -> logowanie.

Aktualizacje: Ustawienia -> Aktualizacje aplikacji (GitHub co 5 h).

Baza Postgres Synology:
  Szablon: bin\apps\desktop\data\pg-config.example.json
  Skopiuj do pg-config.json i wpisz haslo. Host: inyfinn.synology.me (albo LAN), port 5433.
  Bez pg-config.json DAM zostaje na SQLite (Baza lokalna).
  powershell -File bin\scripts\ops\setup-postgres-synology.ps1 -PullDump

Ikony / Branding:
  Setup musi zawierac apps\web\assets\vendor (Unicons+Jost) oraz branding-grid-head.json.

Build instalatora (dev):
  powershell -File bin\scripts\ops\build-installer.ps1
