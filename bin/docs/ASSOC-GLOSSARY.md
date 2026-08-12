# Skojarzenia (assoc) — słownik pojęć (metafory + kod)

> **Dla kogo:** product, QA, nowi agenci — bez zakładania znajomości `dam-assoc-edit.js`.  
> **Źródło prawdy techniczna:** [`agents/shared/code-doctrine.md`](../agents/shared/code-doctrine.md) §12 REFERENCE.  
> **Ostatnia aktualizacja:** 2026-07-26 · wersja aplikacji odniesienia: **4.0.41**

---

## Metaphora bazowa: szafa, strażnik, karteczka, kurier

Wyobraź sobie **szafę** (modal podglądu). W środku są **przyciski** (dzwonki). Obok szafy stoi **strażnik** (listener). Przy szafie jest **karteczka** (kontekst / ctx). Z magazynu przyjeżdża **kurier** z pełnymi półkami (async fetch indeksu).

Trzy warstwy — **nie jedno „bind”**:

| Warstwa | Metaphora | W kodzie (przykład) |
|---------|-----------|---------------------|
| **1. Listener** | Strażnik przy drzwiach szafy | `bindAssocCtas` / `bindVizAssocCtas` na rodzicu |
| **2. Kontekst (ctx)** | Karteczka: dla kogo, co zapisać | `_damAssocCtx`, `_damMaterialsCtx` |
| **3. Dane listy** | Rzeczy na półkach | `linked_products`, `materialCandidates`, `loadIndexAssets` |

---

## Sync vs async

| Termin | Znaczenie | Metafora |
|--------|-----------|----------|
| **Sync** | Od razu, w tej samej chwili (zanim UI „oddycha”) | Otwierasz lodówkę — od razu widzisz zawartość |
| **Async** | Później, w tle (Promise, `.then()`) | Zamawiasz pizzę — przychodzi po chwili |

**Seed → enrich** (wzorzec brandingu produktów):

1. **Seed (sync):** szybka lista — np. same ID produktów (`6300654`) bez miniaturek.
2. **Enrich (async):** kurier dociąga nazwy i miniatury z `file-index` / `enrichLinkedProducts`.

**Sync ctx przed async enrich** (zasada obowiązkowa):

- **Karteczka (ctx)** musi być włożona **od razu** (sync).
- **Pełne półki (lista kandydatów)** mogą dojechać **później** (async).
- Nie mylić: „sync ctx” ≠ „sync cały katalog” — tylko minimum do otwarcia pickera bez toastu.

---

## Kontekst (ctx)

**Ctx** = obiekt w pamięci z informacją, **co** edytujesz i **jak** zapisać.

Typowe pola (branding produkty):

- `asset` — który materiał brandingowy
- `groupContext` — warianty folderu, `linked_product_ids`
- `onRefresh` / `onSaved` — co zrobić po zapisie

Viz sugestie używają **`_damMaterialsCtx`** (kontekst produktu + lista materiałów), nie `ctx.asset` jak przy produktach materiału.

---

## Listener i delegacja

**Listener** = funkcja nasłuchująca kliknięć.

**Delegacja** = jeden listener na **rodzicu** (np. `#damMediaPreviewAssoc`, `#damVizModal`), nie na każdym przycisku.

**`_damAssocCtasBound` / `_damVizAssocCtasBound`** = flaga „strażnik już stoi” — drugi `bind()` **nie** dokleja drugiego strażnika, tylko aktualizuje karteczkę i opcje.

---

## Bind — **dwa osobne zjawiska** (ważne, nie mieszać)

Po `innerHTML` przyciski w szafie **giną i powstają na nowo**. `bind()` robi dwie różne rzeczy:

### A) Strażnik zostaje (delegacja)

- Listener siedzi na **rodzicu**, który **nie** jest kasowany przy malowaniu listy przycisków.
- Nowy guzik w HTML nadal trafia pod te same drzwi — strażnik go słyszy.
- **To** dlatego **drugi klik** w ogóle dochodzi do handlera.

### B) Karteczka jest **wymieniana** (świeży ctx)

- Przy **każdym** `bind()` kod robi m.in. `root._damAssocCtx = ctx` — **nowa** karteczka, nie „ta sama stara”.
- Po zapisie / `renderMeta` → `paintAssoc` → `bind()` — karteczka ma **aktualne** `linked_product_ids`, asset itd.
- **To** dlatego drugi klik ma **świeży** kontekst zapisu, a nie zdezaktualizowany z przed pickera.

**Błędna metafora:** „karteczka zostaje” — **nie**. Zostaje **strażnik**; karteczka jest **podmieniana** przy każdym bindzie (gdy tylko wywołano `bind()` z nowym `ctx`).

Kod (branding):

```js
root._damAssocCtx = ctx;           // nowa karteczka — ZAWSZE
if (root._damAssocCtasBound) return; // strażnik — tylko raz
root.addEventListener("click", onAssocCtaClick);
```

---

## Typ awarii A vs B (nie mylić z „freeze”)

| Typ | Objaw | Metafora | Przykład historyczny |
|-----|-------|----------|----------------------|
| **A — silent freeze** | UI stoi, brak reakcji | Dom zamarzł w betonie | Sync skan całego katalogu w click stacku pickera (v4.0.20/21) |
| **B — responsywna odmowa** | Toast / komunikat, UI żyje | Strażnik słyszy dzwonek, ale brak karteczki | Viz sugestie przed `loadIndexAssets`: „Brak kontekstu materiałów” |

Naprawiając „freeze”, najpierw ustal: **A** (ciężki sync) czy **B** (brak ctx / zły adapter).

---

## Branding „Dodaj/Edytuj produkty” vs viz „sugestie”

### Złoty path (branding produkty — działa)

1. **Strażnik** — delegacja na `#damMediaPreviewAssoc` ✓  
2. **Karteczka sync** — `_damAssocCtx` w `paintAssoc()` przed klikiem ✓  
3. **Seed sync + enrich async** — lista ID od razu, miniatury później ✓  
4. **Zapis** — `saveAssociations` z `ctx.asset.id` ✓  

### Viz sugestie (stan 4.0.41 — luka typu B)

1. **Strażnik** — `bindVizAssocCtas(modal)` zaraz po otwarciu ✓  
2. **Karteczka** — `_damMaterialsCtx` dopiero w `.then()` po `loadIndexAssets` ✗ (toast jeśli klik za wcześnie)  
3. **Fix P1 (plan):** sync seed karteczki w `dam-viz.js`; lista materiałów — enrich async  

---

## Słowniczek skrótów

| Termin | Znaczenie |
|--------|-----------|
| **Picker** | Modal wyboru `#damAssocEditPopover` |
| **paintAssoc** | Przerysowanie sekcji skojarzeń w modalu |
| **materialCandidates** | Lista materiałów brandingowych w pickerze sugestii |
| **loadIndexAssets** | Async fetch katalogu materiałów (`branding-index`) |
| **ensureFileIndex** | Async/cache katalogu **produktów** — używane m.in. przez picker `kind:product` |
| **Złoty path** | Branding `data-viz-assoc-cta="product"` — punkt kontrolny regresji |

---

## Testy i bramki (P1)

| Bramka | Co sprawdza | Status 2026-07-26 |
|--------|-------------|-------------------|
| `sim-assoc-material-empty-seed.js` | Produkcyjny `dam-assoc-edit.js`: pusty `materialCandidates` nie robi ciężkiego worku w click stacku | `[x]` PASS (DOM-shim) |
| Sync seed ctx w `dam-viz.js` | Karteczka od razu po open modala | `[ ]` do wdrożenia |
| Runtime user | Ctrl+F5, klik sugestii natychmiast po open | `[ ]` po kodzie |
| Regresja złotego path | Branding „Dodaj/Edytuj produkty” bez zmian | wymagane po każdej zmianie w obszarze assoc |

---

## Powiązane dokumenty

- [`agents/shared/code-doctrine.md`](../agents/shared/code-doctrine.md) — §12 REFERENCE (diagramy, macierz P1–P4, backlog)
- [`docs/PROGRAM_INSTRUCTIONS.md`](PROGRAM_INSTRUCTIONS.md) — reguły biznesowe assoc
- [`scripts/qa/sim-assoc-material-empty-seed.js`](../scripts/qa/sim-assoc-material-empty-seed.js) — bramka pustego seed pickera
