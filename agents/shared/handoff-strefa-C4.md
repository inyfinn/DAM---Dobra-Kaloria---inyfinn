# Handoff STREFA C4 - dymek / maskotka / anchor / pochwaly / typografia PL - 2026-07-20

Kontynuacja C / C3. Pliki wlasne: `dam-tutorial.js`, `dam-tutorial.css`, bump `?v=` w 9 HTML.

## Cache (aktualne)

- `dam-tutorial.js?v=12`
- `dam-tutorial.css?v=6`

## STATUS: DONE (CDP + screenshot)

### 1) Spacing dymka + maskotka (CSS, zachowane)

| Token / wartosc | Opis |
|-----------------|------|
| `gap: 36px` | maskotka↔body (+10 vs 26) |
| `padding: 26px 30px 16px` | mniejszy dolny pad |
| `--tut-medal: 103.5px` | kolko +15% vs 90 |
| `.dam-tut__mascot-img` `121%`, `bottom: 6px` | maskotka +10% vs 110%; nogi w kolku |
| cien kolka | `0 8px 22px rgba(0,130,68,0.38), 0 2px 6px rgba(0,130,68,0.22)` |
| body | `min-height: calc(var(--tut-medal)*1.32)`, mini-nav `margin: auto 0 0` |

### 2) Anchor dymka (KOREKTA user - PASS)

Stary 16-corner scorer laczyl BL targetu z TL dymka (= pod sidebarem, zaslanial menu). **Odrzucone.**

Nowa logika `placeBubble` (twarda kolejnosc):

1. **right-top**: `left = target.right + 40`, `top = target.top` (TR≈TL)
2. **right-bottom**: flip wertykalny (BR≈BL)
3. **left-top / left-bottom** gdy right nie miesci sie
4. **below / above** gdy horizontal nie miesci sie
5. HARD clamp do viewport (+ margin 12, ctrlZone 110)

CDP krok 1 (Dashboard sidebar): `anchor=right-top`, `gapX=40`, `topDelta≈0`, `coversMenuBelow=false`.

Screenshots:

- `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\c4-anchor-pass1-sidebar-right.png`
- `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\c4-pass-nbsp-step3-header.png`

### 3) Typografia PL - sieroty / wdowy

Helper `nbspPl(s)`:

- NBSP po 1-literowych: `i a o u w z` (case-insensitive)
- sklejenie 2 ostatnich slow (anty-wdowa)

Stosowane przy renderze: title, text kroku, toast invite, tekst pochwaly.

CDP na kroku "Od czego zacząć": `i\u00A0powiadomienia`, Range API `sameLineAsNext=true` (brak sieroty).

### 4) 40 wariantow pochwal

Losowanie: Fisher-Yates shuffle indeksow + `praiseIdx`; po wyczerpaniu puli reshuffle.
Reset przy `DamTutorial.start()`.

CDP off-path click: `"Brawo!"` / `"Panel lubi takich jak Ty. Lecimy."` (pose z puli).

#### Pelna lista 40 tekstow

1. Ooo, łapiesz to w mig! Lecimy dalej.
2. Świetnie Ci idzie! Następny krok.
3. No proszę, naturalny talent! Idziemy dalej.
4. Widzę, że ogarniasz temat. Super!
5. Pięknie! Jeszcze chwila i będziesz w domu.
6. Spokojnie i pewnie. Dokładnie tak.
7. Masz to! Panel zaczyna być Twój.
8. Brawo za refleks! Jedziemy.
9. Jak po maśle. Kolejny przystanek.
10. Czuję, że to lubisz. Lecimy!
11. Trafione w dziesiątkę. Dalej!
12. Reakcja godna listka! Następny krok.
13. Ładnie! Już prawie znasz drogę.
14. Bez stresu, z wyczuciem. Super robota.
15. Widzę rękę wprawnego użytkownika.
16. Kliknięte z klasą. Idziemy dalej.
17. To było szybkie! Trzymam tempo.
18. Dobrze Ci idzie, naprawdę. Dalej!
19. Panel lubi takich jak Ty. Lecimy.
20. Czysto i konkretnie. Brawo!
21. Jak świeży kiełek: szybko rośniesz w temacie!
22. Zero zgadywania, pełne ogarnięcie.
23. Widzę, że czytasz UI jak książkę.
24. Świetny wybór! Pokazuję następne.
25. Masz wyczucie. To lubię.
26. Klik jak z nut. Jedziemy dalej.
27. Dokładnie tam, gdzie trzeba. Super!
28. Spokojny strzał, celny efekt.
29. Roślinka jest dumna. Lecimy!
30. Coraz pewniej! Następny krok.
31. To był dobry ruch. Idziemy.
32. Łapiesz kontekst w mig. Brawo!
33. Energia dobra, kierunek jeszcze lepszy.
34. Już prawie ekspert. Dalej!
35. Widzę progres. Podoba mi się.
36. Bez pośpiechu, z efektem. Super.
37. Tak trzymaj! Jeszcze kilka kroków.
38. Kliknięcie z sensem. Lecimy.
39. Panel kiwa z uznaniem. Dalej!
40. Dobra robota! Pokazuję kolejny kawałek.

## Nie ruszane

`dam-media-preview.js`, `dam-branding.js`, `dam-assoc-edit.js`, `dam-shell.js`, `local_bridge.py`, `dam-danger.js`.

## NIE zrobione / poza scope

- Commit (user nie prosil)
- Przelot screenshotem faz 3-9 (nadal z C)
