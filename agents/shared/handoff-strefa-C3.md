# Handoff STREFA C3 - Task 39 (rename maskotki) - 2026-07-20

Kontynuacja po STREFA C / C2 (polish dymka). Pliki `dam-tutorial.js` / `dam-tutorial.css` byly wolne.

## Task 39 - STATUS: DONE

**Wymaganie:** zmien nazwe maskotki z "Bobek" na "DobroKaloriuś" we wszystkich
tekstach samouczka i zaproszenia.

### Zmiany kodu

| Plik | Co |
|------|-----|
| `apps/web/assets/js/dam-tutorial.js` | 3 zamiany Bobek -> DobroKaloriuś |
| 9 HTML | bump `dam-tutorial.js?v=7` -> `?v=8` |

Szczegoly zamian w JS:
1. Komentarz naglowka: `maskotka DobroKaloriuś`
2. Krok 1 title: `Cześć, tu DobroKaloriuś!`
3. Toast zaproszenia: `Cześć, tu DobroKaloriuś! Chcesz krótki samouczek po panelu?`

### Cache (aktualne)

- `dam-tutorial.js?v=8` (9 HTML)
- `dam-tutorial.css?v=3` (bez zmian w tej turze; stan po C2)

### Weryfikacja (HARD GATE)

- `DamTutorial.stop()` + clear `damTutorialSeen` / `damTutorialPhase` / `damTutorialNotNow`
- `DamTutorial.start()` -> CDP title = `Cześć, tu DobroKaloriuś!`, `hasBobek=false`
- `DamTutorial.showInvite()` -> inviteText z DobroKaloriuś
- Screenshot+Read:
  - `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\c3-task39-tutorial-dobrokalorius.png`
  - `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\c3-task39-invite-dobrokalorius.png`

### Poza zakresem (swiadomie)

- Nazwa pliku sprite `maskotka-bobek.png` / folder skryptu - bez rename assetow
- `agents/**` brief/handoff historyczne wzmianki "Bobek" (opis historyczny)
- Nie ruszano plikow rownoleglych agentow (media-preview, branding, assoc-edit, shell, bridge)

### NIE zrobione (nadal z C / C2)

- Przelot faz 3-9 samouczka screenshotem
- Commit (user nie prosil)
