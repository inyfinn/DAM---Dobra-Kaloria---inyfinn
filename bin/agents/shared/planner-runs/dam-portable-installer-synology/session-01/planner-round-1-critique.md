# Critique round 1

## READ wykonany
- [x] `AGENTS.md` — layout GIT_ROOT/bin, SQLite-only freeze do powrotu Synology, program-instructions jako baza decyzji
- [x] `agents/shared/planner-runs/.../brief.md` — 15 celów HARD, fakty audytu, zakazy anty-wzorce
- [x] `agents/shared/planner-runs/.../planner-round-1-draft.md` — pełny draft R1 (decyzje D1–D6, fazy A–G, macierz CM)
- [x] `memory.md` (§84–85) — DDNS first, CGNAT/Tailscale, offline SQLite, pg-config gitignored
- [x] `bin/scripts/ops/build-dam-root-exe.ps1` — thin exe wymaga host Python + PyInstaller na maszynie build
- [x] `bin/scripts/ops/vendor-runtime-win.ps1` — embed vendor na build machine; end-user nie uruchamia
- [x] `bin/scripts/ops/build-release-zip.ps1` — staging z całego `bin/`, exclude `tooling`, brak gwarancji runtime
- [x] `apps/desktop/launch.py` — WebView2 Evergreen jako zewnętrzny prereq (heal `?reason=webview2`)
- [x] `bin/docs/ADR/ADR-009-postgres-synology.md` — DDNS, offline, migracja, security checklist częściowo open
- [x] Brak `.cursor/agents/critic.md` w repo — tylko checklista globalna

## Krytyczne
- [weryfikacja] CM1 deklaruje „PC bez Python”, ale C1 weryfikuje tylko `import webview, bcrypt, psycopg2` na maszynie build — to nie dowodzi cold-start na czystym Windows → CM1 musi być na izolowanym VM/profilu bez Pythona, bez repo, bez dev tools; dowód = log uruchomienia + screenshot okna/heal z tego VM.
- [weryfikacja] Plan nie uwzględnia WebView2 i VC++ Redistributable jako failure modes na clean PC (`launch.py` kieruje na Evergreen Bootstrapper przy braku WebView2; `pythonnet`/PyInstaller mogą wymagać MSVC) → dodać wiersze CM11 (brak WebView2 → heal/bootstrapper, nie silent crash) i CM12 (brak VC++ → jawny komunikat lub prereq check w `release-gate.ps1`); bez tego CM1 może dać fałszywe PASS.
- [zasoby] E2 allowlist mówi „THEME subset” i „data indexes potrzebne” bez ścieżek ani testu → dopisać konkretną listę (`bin/THEME/geex-html-main`, `bin/THEME/inyfinn-geex-kit`, `bin/apps/web/data/file-index.json`, `search-index.json`, `naming-dictionary.json` min.) i `Test-Path` per pozycja w `release-gate.ps1` (fail = stop ship).
- [weryfikacja] Brak SBOM / third-party notices w DoD mimo `requirements-portable.txt` i licencji w `site-packages` → krok E1/E4: generacja `dist/release/THIRD_PARTY_NOTICES.txt` (np. `pip-licenses` z vendored site-packages) + kopia `bin/LICENSE.md` do root payload; CM10 rozszerzyć o skan brakujących notices.
- [ryzyko_modelowe] Draft sugeruje reuse pipeline, ale `build-release-zip.ps1` kopiuje całe drzewo `bin/` z exclude `tooling`, bez gwarancji `runtime/win/python` i z innym layoutem niż D3 (`dist/staging`) → jawna decyzja „replace, not wrap”: nowy staging pod `dist/staging/`; stary skrypt oznaczony deprecated lub usunięty z ścieżki release; E1 nie może delegować do ZIP bez rewrite allowlist.
- [eskalacja] Brak pytania Parent o strategię WebView2 (bundled vs prereq vs silent install w installerze) — to blokuje realny clean-machine ship → dodać **Q6** A) prereq dokumentowany B) silent Evergreen w installerze C) inne; STOP E3/CM11 bez odpowiedzi.
- [governance] D3 zmienia default `dam_db._DEFAULT_PREFER` (konflikt z AGENTS.md „SQLite only until Synology returns”), ale plan wymienia tylko memory/ADR — pomija obowiązkowy update `program-instructions.json` + seed KV per AGENTS.md → przed D3 dopisać krok „PI db-prefer policy” z Parent APPROVAL i weryfikacją `GET /program-instructions`.
- [weryfikacja] Manifest SHA256 wspomniany bez kontraktu pliku → zdefiniować `dist/release/manifest-<version>.json` z polami `{version, built_at, git_sha, files:[{path, sha256, size}]}`; `release-gate.ps1` failuje gdy manifest nie pokrywa `pythonw.exe`, `DAM.exe`, `LICENSE.md`.

## Ważne
- [sekwencja] D3 warstwy (`dist/staging`, `dist/release`) vs istniejący `bin/dist/` w `build-release-zip.ps1` — dwie konwencje → jedna kanoniczna ścieżka w planie + grep że żaden skrypt release nie pisze do `bin/dist/`.
- [wspolbieznosc] Merge order krok 3 „sync apps→bin single-threaded” bez mechanizmu (lock file, wpis w `process.md`, kto wykonuje) → dopisać format handoffu i zakaz równoległego sync przez workerów.
- [weryfikacja] CM9 łączy pięć regresji (branding latency, quiz, titles, gazetka, indexes) w jeden wiersz — trudne do bisect → rozbić na CM9a–CM9e z konkretnym URL/flow i minimum 3 przeloty UI (doctrine) na zainstalowanej instancji WebView2, nie tylko CDP headless.
- [eskalacja] Q4 ma opcję Tailscale (memory §85 CGNAT), ale nie jest blocking przy scenariuszu „clean PC poza LAN bez DDNS” → jeśli CM3 fail na DDNS, eskalacja Parent z Q4=C lub osobnym Q7 zanim ship multi-PC.
- [kompletność_briefu] D1 (dev sync + release gate) spełnia intencję „nie rebuild przy każdej edycji”, ale brak ochrony przed wydaniem starego `DAM.exe` → `release-gate` porównuje hash/timestamp `DAM.exe` vs ostatni sync `bin/apps` (lub wymusza rebuild exe w bramce).
- [zasoby] `requirements-portable.txt` zawiera `redis` — plan nie mówi czy Redis jest wymagany w release/offline → decyzja: optional stub vs bundled vs wyłączenie feature; bez tego payload może failować przy imporcie lub obiecywać usługę niedostępną.
- [weryfikacja] Ikony: B1/CM7 obejmują `dam_app.ico` i taskbar, ale brak installer/uninstall/shortcut ICO multi-DPI (16/32/48/256) i brak AppUserModelID dla pin taskbara → rozszerzyć B1 o artefakty Inno (`SetupIconFile`, `UninstallDisplayIcon`) i weryfikację Properties na każdym surface z brief §6.
- [weryfikacja] ADR-009 wymienia `migrate_to_postgres.py` — plan D2/D3 nie ma kroku evidence pierwszego connect/migracji na clean PC → dodać D2b dry-run/apply z logiem (bez sekretów w artefakcie).
- [ryzyko_modelowe] Rozdzielenie „build machine prereqs” (host Python, PyInstaller, sieć do python.org) vs „end-user prereqs” (WebView2, ewentualnie VC++) nie jest jawnie w sekcji 1 — dopisać tabelę, żeby wykonawca nie mylił CM1 z C1.
- [weryfikacja] Rollback SQLite (D3, CM4) nie definiuje testu powrotu `prefer` sqlite po nieudanym PG — dodać CM4b: revert prefer + potwierdzenie lokalnej bazy bez utraty danych user-facing.

## Kosmetyczne
- [jednostka_miary] Budżet E1 „5 przebiegów” na greenfield `release-gate.ps1` + installer może być niedoszacowany — oznaczyć jako minimum z eskalacją po 3 failach (zgodnie z guardrails), nie jako twardy sufit.
- [kontekst] C4 wspomina `install-desktop-shortcut.ps1` bez ścieżki WRITE (`apps/` vs `bin/scripts`) — doprecyzować mirror po sync.
- [kompletność_briefu] `README-START.txt` w payload bez szablonu 5 linii — dodać placeholder treści w E2 (start, heal URL, unsupported UNC).

## Werdykt
CONTINUE

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
