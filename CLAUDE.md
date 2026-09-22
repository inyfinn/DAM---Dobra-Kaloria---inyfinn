# DAM — Dobra Kaloria (project rules for Claude Code)

This repo also has Cursor-native rules under `.cursor/rules/*.mdc` and `bin/.cursor/rules/*.mdc` (used by Cursor's own agent). This file is the Claude Code translation of the ones that still apply, kept next to them — update both sides when either changes.

## Versioning is a dotted integer, not semver (`.cursor/rules/dam-version-bump.mdc`)

The version footer looks like semver (`1.8.2`) but behaves like a flat counter with dots inserted for display. **Strip the dots, increment by 1 as a plain integer, reinsert dots as `M.m.p`.**

| Display | Integer | Next (never write) |
|---|---|---|
| 1.7.9 | 179 | → 1.8.0 (never `1.7.10`) |
| 1.8.2 | 182 | → 1.8.3 |
| 1.8.9 | 189 | → 1.9.0 (never `1.8.10`) |

On every product change, bump the counter by 1 and sync it in all of:
- `bin/apps/web/version.json` (`version`)
- `bin/apps/web/assets/js/dam-version.js` (`DAM_APP_VERSION`)
- `bin/apps/desktop/runtime_config.py` (`APP_VERSION`)
- `bin/installer/DAM-Setup.iss` (`MyAppVersion`)
- `#damSidebarVersion` via `DamVersion.setSidebarLabel`
- any `?v=` cache-bust query strings on touched assets

Don't use the old `git rev-list --count main` baseline formula — it's superseded. Put a change description in `version.json`'s `note` field.

## "Ship" means a GitHub Release, not just a push (`.cursor/rules/dam-ship-github-release.mdc`)

When the user asks for "commit + push + build" / "zrób instalator" / "wyślij release" (in any phrasing), that means the **whole chain**, not just git or just a local exe:

1. Bump the version (above).
2. Commit to `main` (if commit was requested).
3. `git push origin main` (if push was requested).
4. Local build: `bin/scripts/ops/build-installer.ps1` → `bin/instalator/DAM-Setup.exe`.
5. New GitHub Release on `inyfinn/DAM---Dobra-Kaloria---inyfinn`:
   `gh release create v{VERSION} bin/instalator/DAM-Setup.exe --title "DAM {VERSION}" --target HEAD --latest`
6. Report back the release URL: `https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v{VERSION}`

Don't declare the task done after only a push, or only a local `.exe` on disk — a stale `Latest` release tag is exactly the failure this guards against. Never force-push, never delete old tags/releases.

**Do NOT ask for confirmation before pushing or releasing.** Krzysztof stated this explicitly on 2026-09-22: asking on routine ship work stalls his workflow. When he asks for a change, a fix, a build or a release, that IS the authorization — including product changes that require a version bump. Diagnose, fix, bump, commit, push, build, release, then report with evidence. Asking "should I?" on this chain is a failure, not caution.

Still ask only when the action is genuinely destructive and irreversible (deleting tags/releases/branches, force-push, dropping data) — that is a different category.

## Design system rhythm (`.cursor/rules/design-system-rhythm.mdc`)

Before any layout, colour, type, spacing, component, or page-content change, read `bin/design-system/DESIGN_SYSTEM.md` first.

Hard bans:
- Don't copy Geex `style.css` sidebar nav sizing as truth — edit `--dam-sidebar-nav-*` tokens/primitives instead.
- Don't edit the unlinked `assets/css/sidebar.css` for nav spacing.
- No raw hex for brand/surface/text colors — use `--dam-*` tokens.
- Don't restyle the frozen card anatomy in panel sheets — `dam-brand.css` (`.dam-viz-card__body`) owns it.
- Don't treat a zero-byte or undimensioned PNG as visual proof — record actual W×H and actually read the image.
- Don't leave Polish glyphs mangled or one-letter orphans unbound in user-facing copy.

Token ladder: `dam-tokens.css` → `dam-primitives.css` / `dam-brand.css` → panel sheets (`dam-viz.css`, `dam-branding.css`). Panel CSS must not win over tokens with one-off padding.

New user-facing strings go through `dam-i18n.js` or match surrounding panel conventions — no orphan hard-coded PL/EN string in a single HTML file.

## "Wizka" ≠ project file / dieline (`.cursor/rules/wizka-to-nie-projekt.mdc`)

When asked for "wizki" / product visualizations / front PNGs, only deliver a finished-packaging packshot. **Read the actual image pixels before handing it over** — don't trust the filename or `.png` extension alone.

**This IS a wizka:** a closed package as it looks on shelf (bar with wrapper seams, doypack with stand + spout, 6-pack carton as a solid volume) on a black/studio background, single object, FRONT (or L/S) perspective. Look in slot `4 - WIZKI` / `4 - VISUALS`, folder `Wizualizacje\...\WEB_RGB`, filenames like `FRONT-S`/`FRONT-L`/`RGB_1200px`/`*_wiz.png`. If slot 4 under `D:\Marketing\...` is empty, check the mirrors: `M:\-- ARCHIWUM --\01_Opakowania\Wizualizacje\` and `G:\Sprzedaż Marketing\GC WIZUALIZACJE` — never substitute a raster pulled from `2 - PROJECT` instead.

**This is NOT a wizka (never hand these over as one):** dielines/wykrojniki (cut lines, mm arrows, front+back on one sheet, an upside-down panel), `FQ.pdf`, `*_podglad.pdf`, `*_PREV.png` from the PROJECT folder, a PNG exported from a print PDF, a flattened AI mockup showing the whole package net, or anything from `2 - PROJECT` / `3 - PRINT` / `links`. If OCR/vision shows dimensions, bleed marks, both sides of the package, or an unfolded net — that's a project/print file: say "no wizka found," don't improvise a substitute.

## Workspace/theme constraints (`bin/.cursor/rules/dam-p-only.mdc`) — check before relying on this

This rule as written references a `P:\DAM` workspace root that doesn't match this repo's actual current path (`D:\Marketing\...\DAM---Dobra-Kaloria---inyfinn`) — confirm with the user which is current before enforcing the path restriction literally. The parts still clearly applicable regardless of drive letter:
- UI is exclusively the Geex theme (`THEME\geex-html-main` / equivalent) — not a Next.js skin. Tokens live in `apps/web/assets/css/dam-tokens.css`.
- No em dashes in UI copy or commit messages — use a hyphen (`-`) instead.
- Desktop launcher lives under `apps/desktop`, plus a browser/localhost mode, mobile-first.
- Integrations: Asana + Microsoft Teams (see ADR-005 if present in the repo).
