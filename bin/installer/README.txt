Ten plik NIE jest juz uzywany przez instalator.

README pokazywane na ostatniej stronie kreatora generuje
bin/scripts/ops/build-installer.ps1 z bin/apps/web/version.json przy kazdym
buildzie. Powod: recznie pisana wersja zostala na "DAM 6.0.2" i instalator
2.1.5 konczyl sie ekranem z wersja 6 oraz nieaktualnymi krokami.

Tresc zmieniaj w build-installer.ps1 (zmienna $readmeLines), nie tutaj.
