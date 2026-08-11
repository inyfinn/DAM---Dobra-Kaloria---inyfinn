# Ściągawka: Geex Design System Realignment v0 → v6.1

Globalna kopia: `C:\Users\xpret\.cursor\skills\planner\geex-plan-retro-cheat-sheet.md`

## Co było źle → jak naprawiono

| Kategoria | Błąd w v0–v3 | Naprawa w v4–v6.1 |
|-----------|--------------|-------------------|
| Sekwencja | Tokeny przed audytem | Inventory-first |
| Zasoby | PNG w git bez decyzji | PNG poza git + manifest |
| Jednostka miary | Godziny ludzkie | Przebiegi / tool calls |
| Eskalacja stagnacji | % overrun czasu | 3 fail cykle pod rząd |
| Współbieżność | Race na process.md / brand.css | WRITE sets + handoff-faza3/4 + join Lead |
| Eskalacja „do kogo” | „parent” bez definicji | Parent = Ty; kanał process.md / handoff |
| Kontekst | Jedna sesja 0→8 | 1 faza = 1 nowa sesja |
| Ryzyko modelowe | Założony flagowiec | 5a/5b, §7 quote, Composer RO |
| Viewporty | Brak mobile/tablet | 1440 / 1024 / 390 |
| Bisect | Tylko backup + merge | Tag `geex-phaseN` per faza |
| Governance | Słaba bramka człowieka | ESCALATE + stop + decyzja usera |

**Wniosek:** najgłębsze poprawki = proces AI, nie treść CSS.
