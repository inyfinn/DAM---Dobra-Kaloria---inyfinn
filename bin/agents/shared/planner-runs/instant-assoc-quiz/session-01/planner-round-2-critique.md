# Critique round 2
## Krytyczne
- [weryfikacja] KROK 3 nie ma jawnego testu regresji filtra „Tylko grafiki” + tag „Element produktu” (już wdrożone) → dodaj w weryfikacji K3: graphics-only ukrywa product_element; label PL widoczny gdy filtr off.
- [sekwencja] K7 „regeneruj slim z SQLite” bez kroku — po seed kolejność: seed → rebuild grid linked_ids → dopiero K8. Dopisz K7b lub podpunkt HARD w K7.
- [zasoby] Search-index ~41MB nadal na boot — plan milczy czy Instant gate obejmuje ten fetch. Decyzja: albo defer search-index lazy, albo zmierz osobno i dopisz do gate (boot_grid_ms vs boot_search_ms).

## Ważne
- [governance] Brak reguły „freeze hash branding-index przed refilter destrukcyjnym” — dopisz backup/hash w K6.
- [kontekst] Checklist wejścia C/D brak — skopiuj wzorzec z B.
- [ryzyko_modelowe] Floating index 6300749: „gdy widoczny” za miękkie — dodaj K3 weryfikacja: tytuł modala nie jest czystym indeksem numerycznym bez nazwy produktu/materiału.

## Kosmetyczne
- Ujednolić `kompletnosc_briefu` ortografię kategorii w changelog.

## Werdykt
CONTINUE

Przygotowano przy użyciu Critic inline (orchestrator).
