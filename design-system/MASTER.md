# DAM ETA - Design System Master

## Baza: Geex Bootstrap HTML Template (themewant.com)

## Tokeny kolorow

| Token | Wartosc | Zastosowanie |
|-------|---------|--------------|
| Primary | #AB54DB | Akcenty, CTA, aktywne elementy |
| Dark bg | #17161E | Dark mode tlo |
| Success | #00A389 | Kompletne, oplacone |
| Danger | #FF5653 | Bledy, brakujace, po terminie |
| Warning | #FDB23A | Oczekujace, ostrzezenia |
| Info | #3F9CF8 | Informacje |
| Text primary | #464255 | Glowny tekst light mode |
| Text muted | #B9BBBD | Placeholdery, meta |
| Border | #E7E7E7 | Linie podzialow |
| Card bg | #FFFFFF | Tla kart (light) |

## Typografia
- Font: Jost (Google Fonts)
- Weights: 400, 500, 600, 700
- Base size: 14px
- H1: 24px / 700
- H2: 20px / 600
- H3: 16px / 600
- Body: 14px / 400
- Small/meta: 12px / 400

## Promienie (border-radius)
- Card: 12px
- Button: 6-8px
- Badge: 4px
- Input: 8px

## Ikonografia
- Biblioteka: Unicons (uil-*) via iconscout CDN
- Rozmiar standardowy: 20-24px w nawigacji, 32px w kartach

## Cienie
- Card: 0 2px 12px rgba(0,0,0,0.06)
- Popup: 0 8px 24px rgba(0,0,0,0.12)

## Grid / Layout
- Sidebar: 250px (fixed), zamykana na mobile
- Header: 60px (fixed top)
- Content: fluid, padding 24px
- Geex class: .geex-dashboard, .geex-sidebar, .geex-content

## Klasy Geex kluczowe
- `.geex-btn--primary` -> kolor #AB54DB
- `.geex-badge--success-transparent` -> zielony badge
- `.geex-badge--danger-transparent` -> czerwony badge
- `.geex-badge--warning-transparent` -> zolty badge
- `.geex-card` -> biala karta z shadow
- `.primay-bg` -> background primary (note: literowka w Geex)
- `.success-bg` / `.danger-bg` / `.warning-bg` -> colored card backgrounds

## Chrome / Header (GLOBALNE - nie per-strona)
- Header actions (szukaj, wiadomosci, powiadomienia, profil): jeden markup / jedna logika w `dam-shell.js` (`ensureHeaderChrome` + `bindDamHeaderPopups`)
- Popupy: class `.is-open` w `dam-brand.css` - NIE jQuery `slideToggle` (koliduje z wysokoscia panelu wiadomosci)
- Style: tokeny z `dam-tokens.css` / Geex; zakaz inline one-off kolorow w shellu
- Zmiana ikony / typografii / przycisku w chrome = zmiana w shellu lub dam-brand - automatycznie wszedzie

## Ludzkie etykiety rol assetow (OBOWIAZUJACE)
- artwork -> Projekt graficzny
- viz_3d -> Wizualizacja 3D
- print_pdf -> Plik do druku
- tech -> Specyfikacja techniczna
- photo -> Fotografia produktowa
- packaging_text -> Teksty na opakowanie

## Zasady copywritingu UI
- Jezyk domyslny: Polski
- BRAK em-dash (- lub -) w UI - tylko dywiz (-)
- Wszystkie stringi przez data-i18n lub dam-i18n.t()
- Brak technicznych terminow na widoku uzytkownika
- Etykiety przycisku akcji: max 3 slowa, jasne, czasownikowe
