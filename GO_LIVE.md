# GO-LIVE — DAM - Dobra Kaloria - Inyfinn

**Nazwa profesjonalna:** Production Readiness Review (PRR) + Go-Live Checklist  
**Data docelowa klienta:** 2026-07-19  
**Wersja checklisty:** 1.0  
**Właściciel wdrożenia:** Krzysztof Wieczorek

---

## 0. Co to jest

Przed oddaniem aplikacji klientowi przechodzimy **Production Readiness Review**:
sprawdzamy, czy build jest gotowy do użycia produkcyjnego (nie „demo w Cursorze”).

Trzy fazy:
1. **Gate A — Środowisko** (PC klienta: Python, WebView2, dysk Marketing, Postgres)
2. **Gate B — Smoke** (automat + 15 min ręcznie)
3. **Gate C — Handover** (konta, hasła, skrót, instrukcja 1-stronicowa)

**Zasada:** nie oddajemy przy czerwonym Gate A/B. Gate C można domknąć przy odbiorze.

---

## 1. Architektura „produkcyjna” (jak działa u klienta)

```
Skrót pulpitu
  -> wscript run-dam.vbs
    -> pythonw launch.py
      -> UI http://127.0.0.1:8765  (Geex)
      -> most http://127.0.0.1:8766 (local_bridge)
      -> Postgres Synology (priorytet) / SQLite offline
      -> dysk Marketing (X:\Marketing lub ustawiona ścieżka)
```

Użytkownik **nie** otwiera przeglądarki ręcznie. Porty są wewnętrzne.

---

## 2. Gate A — Środowisko (przed startem)

| # | Check | Jak | Pass |
|---|--------|-----|------|
| A1 | Windows 10/11 + WebView2 Runtime | `winget list Microsoft.EdgeWebView2Runtime` lub edge:// | [ ] |
| A2 | Python 3.11+ z `pythonw` | `py -3 --version` | [ ] |
| A3 | Pakiety: `pywebview`, `Pillow`, `bcrypt`, `psycopg` (wg wymagań) | import w python | [ ] |
| A4 | Skrót pulpitu: `DAM - Dobra Kaloria - Inyfinn.lnk` | ikona zielona DAM, target = `run-dam.vbs` | [ ] |
| A5 | Dysk Marketing online | `X:\Marketing\- POLSKA` lub lokalna mapa | [ ] |
| A6 | Postgres Synology osiągalny **albo** akceptacja offline SQLite | panel: Baza online / offline z hintem | [ ] |
| A7 | `pg-config.json` / sekrety **nie** na publicznym Git | tylko lokalnie / Synology | [ ] |
| A8 | Hasła kont **nie** są domyślnym `test` | patrz §4 | [ ] |

---

## 3. Gate B — Smoke (30 min)

### 3.1 Automat

```powershell
cd "P:\DAM"   # lub lokalna sciezka repo
powershell -NoProfile -File apps\desktop\scripts\smoke-production.ps1
```

Oczekiwany wynik: wszystkie `PASS` (albo znane WARN offline PG z uzasadnieniem).

### 3.2 Ręcznie (kolejność)

| # | Krok | Pass |
|---|------|------|
| B1 | Dwuklik skrótu — okno w ~5 s, tytuł `DAM - Dobra Kaloria - Inyfinn` | [ ] |
| B2 | Ikona w pasku zadań ≠ logo Pythona | [ ] |
| B3 | Sign-in: konto admin / user — wejście na dashboard | [ ] |
| B4 | Header: **Pliki online** + **Baza online** (lub świadomy offline) | [ ] |
| B5 | Eksplorator: kategoria DK, produkt, rewizja, galeria miniatur | [ ] |
| B6 | Reveal w Eksploratorze Windows (ikona folderu) | [ ] |
| B7 | Admin: zmiana statusu / propozycja tagu (bez crasha) | [ ] |
| B8 | Wyloguj → signin → ponowne logowanie | [ ] |
| B9 | Drugi dwuklik skrótu — focus istniejącego okna (single-instance) | [ ] |
| B10 | Restart PC → skrót dalej działa | [ ] |

---

## 3.3 Follow-up z PRR (2026-07-18/19)

Po skanie produkcyjnym domknięte w kodzie:
- logout kasuje `bound-session.json` (brak cichego rehydrate po wylogowaniu)
- `POST /machine-config` wymaga loginu
- skrót pulpitu: `DAM - Dobra Kaloria - Inyfinn` (`install-desktop-shortcut.ps1`)
- OAuth callback wraca na `DAM_UI_ORIGIN` (nie hardcoded 8765)
- cache-bust `dam-api.js?v=20260719golive1` na stronach HTML

Nadal **Gate C**: rotacja haseł z `test` (patrz niżej).

---

## 4. Gate C — Konta i bezpieczeństwo (KRYTYCZNE)

### 4.1 Hasła startowe

Seed historyczny używał hasła `test` dla kont Kubara — **to jest NIEDOPUSZCZALNE na produkcji**.

Przed oddaniem ustaw hasła:

```powershell
$env:DAM_SEED_PASSWORD = "<silne-haslo-tymczasowe>"
python apps\desktop\scripts\set-all-passwords.py
```

Albo pojedynczo:

```powershell
python apps\desktop\scripts\set-user-password.py --email krzysztof.wieczorek@kubara.pl
```

Potem przekaż hasła **poza** Git (Teams/SMS/koperta). Poproś o zmianę przy pierwszym logowaniu (ręcznie w adminie / kolejny skrypt).

### 4.2 Rejestracja publiczna

UI logowania: zakładka „Utwórz konto” jest **ukryta** gdy baza ma już użytkowników.  
Nowe konta: tylko admin (`POST /auth/register` z sesją admina) albo skrypt seed.

### 4.3 Most lokalny

Bridge słucha tylko `127.0.0.1`. Media/browse wymagają loginu + ścieżki Marketing.  
Status plików/bazy jest bez Bearera (localhost) — świadomy kompromis UX.

---

## 5. Gate D — Dane / Metadata

| # | Check | Pass |
|---|--------|------|
| D1 | `file-index.json` świeży (produkty > 0) | [ ] |
| D2 | `GET /meta/status` → `synced: true` | [ ] |
| D3 | Po rebuild indeksu meta_store się odświeża | [ ] |
| D4 | audit_log przyjmuje wpisy po akcji użytkownika | [ ] |

Rebuild:

```powershell
# z UI (admin) albo:
python apps\web\scripts\build-file-index.py
python apps\desktop\meta_store.py
```

---

## 6. Znane ograniczenia (uczciwie do klienta)

1. UI Geex czyta głównie `file-index.json` + KV; tabele FK (`meta_*`) są warstwą spójności / przyszłości.
2. Laravel API (`apps/api`) nie jest ścieżką dnia-1 dla panelu Geex.
3. Integracje Asana/Teams wymagają osobnego OAuth (Settings) — bez tego działają dane lokalne / mocki.
4. Offline Postgres = SQLite lokalny + komunikat; sync wraca gdy DDNS/NAT OK.

---

## 7. Rollback (gdy coś padnie u klienta)

1. Zamknij aplikację.
2. Przywróć poprzedni folder `apps/desktop/data/` (backup z GO_LIVE).
3. Uruchom skrót ponownie.
4. Jeśli dysk: sprawdź Synology Drive / mapowanie `X:`.

Backup przed go-live:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmm"
$src = "apps\desktop\data"
$dst = "DATABASE\backups\go-live-$ts"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Recurse $src $dst
```

---

## 8. Handover — 1 strona dla użytkownika

1. Uruchom skrót **DAM - Dobra Kaloria - Inyfinn**.
2. Zaloguj się emailem firmowym.
3. Zielone: Pliki online + Baza online.
4. Jeśli czerwone Pliki → „Wskaż folder” → wybierz Marketing.
5. Problemy: napisz do Krzysztofa (kontakt w Licencji).

---

## 9. Definition of Done (DoD) oddania

- [ ] Gate A wszystkie Pass (lub świadomy WARN PG offline)
- [ ] Gate B smoke PASS + 10 kroków ręcznych
- [ ] Gate C hasła zmienione, rejestracja UI ukryta
- [ ] Gate D meta synced
- [ ] Skrót + ikona + tytuł okna poprawne
- [ ] Backup `data/` zrobiony
- [ ] Klient dostał instrukcję §8

**Sign-off:** _________________ data _______
