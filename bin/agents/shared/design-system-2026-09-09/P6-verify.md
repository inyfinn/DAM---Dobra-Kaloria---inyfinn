# P6 — visual verification (Explorer filter band @ 5.0.178)

**Worker:** P6 (ui-create-design-system Mode A §12)  
**Captured:** 2026-09-09T09:14+02:00  
**Claim under test:** P5 recipes — §5.8 Explorer secondary filter band skeleton, §5.4 brand-chip addendum, §1 vendor bootstrap, §6 explorer pad **20px 0px** exception.  
**Method:** smoke ports → curl gates → headless Chrome CDP (no Cursor browser MCP) → PNG Write → **Read (vision)** → PIL WxH/bytes.

---

## Runtime gates

| Probe | Result |
|-------|--------|
| `smoke-dam-ports.ps1` | **PASS** — UI **200** @ `:8765`, Bridge **200** @ `:8766` |
| `curl.exe explorer.html?v=5.0.178` | **200**, ~174 KB HTML |
| `curl.exe :8766/health` | **200** |
| `curl.exe :8766/file-index?fields=explorer` | **200**, **512166 B** (P0 cited 46909 B — size drift; tree still populated live) |
| Sandbox HTTP root = `bin/` (`python -m http.server 9876`) | **PASS** — HTML + 8 CSS **200**, no 404 |

**Auth note:** First headless pass without `localStorage` token redirected to `signin.html?reason=no_token` — **FAIL probe**, superseded by second pass with bridge `POST /auth/rehydrate` token injection.

---

## Screenshot pixel record

| File | Bytes | WxH (PIL) | Vision usable? |
|------|-------|-----------|----------------|
| `explorer-p6-live.png` | **168783** | **1280×1800** | **YES** |
| `explorer-p6-filter-band.png` | **11957** | **950×110** | **YES** (CDP clip of secondary band) |
| `sandbox-p6.png` | **37134** | **1280×900** | **YES** |

All PNGs **> 10 KB** and non-zero dimensions. Zero-byte / undimensioned = **N/A**.

---

## Live Explorer — vision Read (`explorer-p6-live.png` @ 1280×1800)

- **Page:** Authenticated Eksplorator, footer **DAM v5.0.178**.
- **Tree (`#damFolderList`):** **8 categories** visible — Batony (85), Kulki (19), Roślinne (60), Sypkie (14), Napoje (3), Przetwory (3), Datesy (8), Chrupkulki (1). **PASS** (5.0.178 tree fix holds).
- **Main pane (`#damExplorerMain`):** Default welcome / “wybierz kategorię” empty state — **correct**, not FAIL.
- **Secondary filter band:** Produkty/Materiały mode chips, Pokaż wszystkie switch, **DK** + **GC** brand pills, Wszystkie języki select — all visible, not ghosted.
- **Tag toolbar above:** Smak/Typ/Opakowanie/Autor chip rows present (explorer-specific; not §5.8 inner spine but expected on live page).

## Live filter band crop — vision Read (`explorer-p6-filter-band.png` @ 950×110)

- **Mode:** `#damExplorerCatMode` — Produkty active (purple), Materiały inactive.
- **Switch:** `label.dam-switch` + track + “Pokaż wszystkie”.
- **Brand:** `.dam-brand-chip-btn--dk` (lavender/purple **DK**), `.dam-brand-chip-btn--gc` (blue **GC**) — **not** `.dam-viz-badge.dam-badge-tag`. **PASS §5.4 addendum.**
- **Lang:** `#damExplorerLangFilter` select “Wszystkie języki”.

## Sandbox — vision Read (`sandbox-p6.png` @ 1280×900)

- Static lab mirror: same inner spine as §5.8 HTML block — mode chips, switch, DK/GC `.dam-brand-chip-btn`, lang select inside `.dam-explorer-shell` > `.dam-viz-secondary-filters.dam-explorer-secondary-filters`.
- Welcome panel in `#damExplorerMain` — P3 convention.
- Visual parity with live filter band crop: **MATCH** (mode/switch/chips/lang layout and chip colours).

---

## DOM / computed probes (CDP, authenticated live)

| Check | Result |
|-------|--------|
| `#damExplorerCatMode.dam-explorer-cat-mode` | **present** |
| `label.dam-db-mode-chip` ×2 | **present** |
| `#damExplorerShowAll` + `label.dam-switch` | **present** |
| `#damExplorerBrandMount` → `.dam-brand-chip-btn--dk/--gc` | **present**, opacity **1**, display **flex** |
| `#damExplorerLangFilter.dam-control--select` | **present** |
| `.dam-explorer-shell` wrapper | **present** |
| Tag badges on brand mount | **0** (`.dam-viz-badge.dam-badge-tag`) — **PASS §5.4** |
| Bootstrap link | `./assets/vendor/css/bootstrap/bootstrap.css` — **PASS §1** |
| Filter band pad (computed) | **`20px 0px`**, gap **10px 12px**, opacity **1** — **PASS §6 exception** |
| Sandbox filter band pad | **`20px 0px`** — **PASS** |

---

## Recipe gate matrix

| Gate | Result | Notes |
|------|--------|-------|
| §5.8 skeleton IDs + classes live | **PASS** | All four spine nodes + wrapper |
| §5.8 sandbox mirror | **PASS** | P3 HTML unchanged; CSS chain 8/8 **200** |
| §5.4 DK/GC not tag badges | **PASS** | Live + sandbox use `.dam-brand-chip-btn` |
| §1 vendor bootstrap path | **PASS** | Computed href on live |
| §6 explorer pad 20px 0px | **PASS** | CDP `getComputedStyle` live + sandbox |
| Tree populated @ 5.0.178 | **PASS** | 8 cats in vision + text probe |
| Empty main default state | **PASS** | Welcome panel, not product grid |
| Chips visible (not opacity 0) | **PASS** | opacity **1** on DK/GC |
| PNG evidence Read + WxH | **PASS** | 3 files |
| Branding.html optional | **SKIP** | DK/GC confirmed on Explorer |

---

## Mismatches / caveats

| Item | Severity |
|------|----------|
| Unauthenticated headless first shot = signin page | **Resolved** — not shipped as P6 proof |
| Slim index **512166 B** vs P0 **46909 B** | **Note only** — does not block filter-band DS proof; tree loads |
| `#damFolderList` CDP `liCount=0` | **Note** — categories render as non-`<li>` nodes; vision shows 8 folders |
| Filter band PNG is **clip** (950×110), not full viewport | **By design** — secondary band crop per brief |

---

## P6 verdict

**PASS** — Live Explorer @ **5.0.178** and P3 sandbox match P5 §5.8 / §5.4 recipes. Filter band pad **20px 0px** computed on both. Vision Read confirms DK/GC brand chips, skeleton IDs, populated tree, correct empty main.

**Pipeline complete:** **yes** (P0→P6 Mode A for Explorer filter band track).

---

*End P6-verify @ 2026-09-09*
