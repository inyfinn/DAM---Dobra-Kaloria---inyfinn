# P2 — DESIGN_SYSTEM.md surgical update from P0+P1 evidence

**Worker:** Mode A P2 (ui-create-design-system)  
**Captured:** 2026-09-09  
**Target:** `bin/design-system/DESIGN_SYSTEM.md` (in-place; chapter order preserved; §9 anti-patterns untouched)

---

## Summary

| Gate | Result |
|------|--------|
| P2 Pass/Fail | **PASS** — required UPDATEs applied; anti-patterns §9 not emptied; no product file edits |
| Contradictions with `design-system-rhythm.mdc` | **One tension (documented, rule not edited)** — see below |

---

## Sections touched

- **Header / evidence hygiene** — captured 2026-09-09; runtime UP; slim index 46909 B / 193 products; sandbox N/A
- **§1 Control plane** — timestamps, channel (c) → DAM REST (not Browser MCP); explorer `?v=5.0.178`; bridge slim index cite
- **§2 Layer map + TRAPs** — `dam-primitives.css:540-547`; broken `./assets/css/?v=*` **gone** (rg 0)
- **§3 Token tables** — control-h line `:73`; sidebar nav lines + computed @ 2026-09-09; rhythm token line refs; dark block line refs; unverified downgrade where P1 did not re-probe
- **§5 Component recipes** — sidebar canonical `:540-547`; badge live winner → unverified @ 2026-09-09
- **§6 Spacing rhythm** — explorer filter pad **20px 0px** ownership exception; explorer mb **14px**; bento/branding/badge computed → unverified
- **§7 Content architecture** — explorer copy owners from P1-ownership-map; version **5.0.178**; boot-race note; sandbox N/A
- **P1 evidence gaps** — rewritten for 2026-09-09 probes + blunt unverified list
- **P6 appendix** — explorer screenshot row; runtime reconfirm; P6 branding/viz vision marked not re-run
- **Footer** — P2 refresh attribution

**Not touched:** §9 Anti-patterns (P3 fill intact), §8 Workflow ladder (no P1 deltas), most light-token table rows (file values unchanged; captured dates left 2026-09-07 where P1 did not re-list every cell — blunt: bulk colour/type rows still cite 2026-09-07 command stamp; only rows explicitly cited in P1-tokens.md got line/date fixes)

---

## Changelog (WRONG → RIGHT)

| DS cell (before) | After | P1 cite |
|------------------|-------|---------|
| Runtime @ 2026-09-07, branding `?v=5.0.165` | **2026-09-09 UP**; `explorer.html?v=5.0.178`; slim index **46909 B**, 193 products | P0 §1, §6.1; P1-computed-live header |
| Channel (c) Browser MCP | Channel (c) **DAM REST** / `local_bridge.py` | P0 §1, §6.6 |
| `dam-primitives.css:526-533` nav winner | **`:540-547`** | P0 §2; P1-tokens TRAP table; P1-computed-live |
| `--dam-control-h` @ `:71` | **`:73`** (+ fs `:74`, radius `:75`, h-sm `:108`) | P1-tokens §Controls |
| Broken link “still on index/inbox” | **TRAP gone** — `rg` **0** @ 2026-09-09 | P1-ownership-map §TRAPs |
| Filter band computed **20×24** everywhere | **Explorer exception:** pad **`20px 0px`**, mb **14px**; viz still 20×24 | P1-rhythm §5-bullet #2; P1-computed-live Explorer filters |
| Empty Kategorie = default? | **Boot race (5.0.178 fix)**; capture shows **8 cats** populated | P0 §4; P1-computed-live screenshot note |
| Sidebar nav computed verified @ 2026-09-07 | **Re-verified @ 2026-09-09** (Playwright) | P1-computed-live §Sidebar |
| Branding filter / bento / badge computed ✓ | **Unverified @ 2026-09-09** (not re-probed — old verified not copied) | P1-computed-live scope (explorer+viz only) |
| Explorer §7 two-row table | Full **copy owner** table (Kategorie HTML-hardcoded, JS orphans) | P1-ownership-map §Explorer user-facing copy |
| Sandbox STALE/deleted | **N/A — static git** | P1-ownership-map §Sandbox |
| Slim index ~512 KB | **46909 B** — use dated curl | P0 §6.1 |

---

## Cells left `unverified` (P1 did not re-prove — blunt)

- Bento gap **16px** computed (2026-09-07 claim retained as historical, not bumped)
- Branding filter band **20×24**, tag-filter band, search chrome computed
- Badge pill **2.1×8.4px** computed
- P6 branding/viz vision **1610×869** (2026-09-07 PASS only)
- Glyph gate / orphan sweep / page-title live size / body font live
- `--dam-dark` dark-scheme line (not in P1-2026-09-09 token excerpt)
- `--dam-space-filter-nested-mb` token line
- Most §3 colour/surface token rows: file values unchanged; **Captured** column still **2026-09-07** (P1 re-read file but did not re-emit every row — no false refresh)

---

## Contradiction check: `design-system-rhythm.mdc`

| Rule | DS P2 position | Verdict |
|------|----------------|---------|
| “Panel CSS must not win with one-off padding” | Explorer horizontal pad **0** comes from **`dam-brand.css` shell** `:4445-4449` (shared owner), documented as **ownership exception** — not panel sheet beating tokens | **Tension, not block** — exception is in shared brand sheet, intentional; rule still bans ad-hoc panel one-offs. **Did not edit `.mdc`.** |
| Edit `--dam-sidebar-nav-*` not Geex 16px | Unchanged — computed 13.6px @ 2026-09-09 | **Aligned** |
| No raw hex / frozen card anatomy | Unchanged | **Aligned** |
| Wire copy through i18n | DS now flags **Kategorie** + JS orphan strings | **Aligned** (DS stricter on orphans) |

---

## Verification

- Read whole DS structure before edit — chapter order preserved
- §9 anti-patterns: **zero edits**
- No `dam-tokens.css` / HTML / JS / CSS product edits
- No version bump
- No probe scripts created

---

*End P2-from-evidence*
