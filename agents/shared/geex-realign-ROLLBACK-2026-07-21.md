# Geex realign + follow-up — ROLLBACK 2026-07-21

**Inventory tip:** `origin/main` = `df870e2` (ctaUnify 12px/34px + Info Pakowania switch).  
**ESCALATE:** none.  
**Changelog:** [`geex-realign-CHANGELOG-2026-07-21.md`](geex-realign-CHANGELOG-2026-07-21.md)

---

## One-liners (copy-paste)

Prefer **soft** `git revert` on a clean tree. Hard reset only with explicit human OK.

```text
# Soft: undo only CTA unify (tip)
git revert df870e2 --no-edit

# Soft: undo only PAKIET (explorer zip / bridge)
git revert 435ea6b --no-edit

# Soft: undo pad-fix merge (keeps mainline parent = -m 1)
git revert -m 1 a400726 --no-edit

# Soft: undo entire Geex F0–F8 + taste merge (pre-realign tip = 092821f)
git revert -m 1 a4ba7c4 --no-edit

# Hard: go back to pre-realign backup (DESTROYS later commits on this branch — do not if tip moved)
git reset --hard 092821f

# Tag checkout (detached): tip of taste unify on design branch
git checkout design-geex-realign

# Tag checkout: start of realign work
git checkout geex-phase0
```

**Go back to X (pre-realign product UI):** `092821f`  
(`092821ff4bd2378d915ea32c777582d56f34e756` — first parent of `a4ba7c4`)

---

## Soft rollback — revert by SHA (newest first)

Run on `main` after `git fetch`; resolve conflicts if later commits touched same files.

| Goal | Command | Notes |
|------|---------|--------|
| Drop ctaUnify only | `git revert df870e2` | Restores prior int-cta / Info Pakowania markup path |
| Drop PAKIET only | `git revert 435ea6b` | Touches `local_bridge.py` + `dam-explorer.js` — restart bridge after |
| Drop pad-fix merge | `git revert -m 1 a400726` | Merge commit — **must** `-m 1` (mainline) |
| Drop pad-fix commit (if needed after undoing merge carefully) | `git revert 74eb7eb` | Usually covered by reverting `a400726` |
| Drop Geex merge (F0–F8 + taste) | `git revert -m 1 a4ba7c4` | Large; expect conflicts with pad-fix / ctaUnify / PAKIET if those stay |
| Order if peeling all follow-ups then merge | 1) `df870e2` 2) `435ea6b` 3) `-m 1 a400726` 4) `-m 1 a4ba7c4` | Leaves tip ≈ `092821f` content-wise |

Verified SHAs (exist on repo):

| Short | Full | Subject |
|-------|------|---------|
| `df870e2` | `df870e2406c6472ca4c49bcfbdb010e8a57bba70` | fix(ui): unify projects dam-int-cta… |
| `435ea6b` | `435ea6b6a6bb0cbca393326024a7597168f6900c` | feat: explorer PAKIET… |
| `a400726` | `a400726e1351b7622195d70bb0c237e2e63d2678` | Merge … (CTA pad fix) |
| `74eb7eb` | `74eb7eb0c07526288120c9f43084d65ddf032f25` | fix(ui): restore labeled modal CTAs… |
| `a4ba7c4` | `a4ba7c4f6a650ee68c6f9a8334bf450c61f1e453` | Merge … (F0-F8 + taste unify) |
| `88d6a7e` | `88d6a7e53957daea9f466730a66a1eb3f4b9d5e6` | taste unify (`design-geex-realign`) |
| `092821f` | `092821ff4bd2378d915ea32c777582d56f34e756` | Backup before Geex… |

---

## Hard rollback — reset / checkout

| Goal | Command | Risk |
|------|---------|------|
| Tip = pre-realign | `git checkout main`; `git reset --hard 092821f` | Drops `a4ba7c4`+follow-ups from branch tip; needs force-push if already on origin — **ask human** |
| Detached at taste tip | `git checkout design-geex-realign` | Read-only inspection / cherry-pick source |
| Detached at F0 | `git checkout geex-phase0` | Before tokens/buttons |
| Restore single file from pre-realign | `git checkout 092821f -- path/to/file` | Surgical; then commit |

**Do not** `git clean -fdx` as part of UI rollback — wipes untracked data/QA.

---

## Tag-based

```text
git tag -l "geex-*" "design-geex*"
# geex-phase0..4, geex-phase5a, geex-phase5b, geex-phase6..8, design-geex-realign
# NO bare geex-phase5
```

| Tag | Points at |
|-----|-----------|
| `geex-phase0` | `efdf632` |
| `geex-phase1` | `17e2dc3` |
| `geex-phase2` | `16f0c95` |
| `geex-phase3` | `7c9d346` |
| `geex-phase4` | `3ee60bf` |
| `geex-phase5a` | `9b5cea5` |
| `geex-phase5b` | `3d457df` |
| `geex-phase6` | `5c33525` |
| `geex-phase7` | `c6023e3` |
| `geex-phase8` | `339fec9` |
| `design-geex-realign` | `88d6a7e` |

To compare current tip vs pre-realign:

```text
git diff 092821f..df870e2 --stat
```

---

## Per-feature rollback

### Only CTA unify (`df870e2`)

```text
git revert df870e2 --no-edit
# or single-file:
git checkout df870e2^ -- apps/web/assets/css/dam-primitives.css apps/web/assets/js/dam-ui-cta.js apps/web/assets/css/dam-app.css
# then restore HTML cache-bust consistently
```

### Only PAKIET (`435ea6b` / sibling `a4e9d35`)

```text
git revert 435ea6b --no-edit
# files: apps/desktop/local_bridge.py, apps/web/assets/js/dam-explorer.js
```

After bridge change: **restart** `local_bridge.py` (port 8766). Do not wipe Postgres / JSON indexes.

### Only pad-fix (`a400726` / `74eb7eb`)

```text
git revert -m 1 a400726 --no-edit
```

### Entire Geex realign merge (`a4ba7c4`)

```text
# Prefer after peeling follow-ups, or expect conflicts:
git revert -m 1 a4ba7c4 --no-edit
```

Hard equivalent: reset to `092821f`.

---

## WARN — data / index files

**Do not wipe** as part of UI rollback:

- `apps/web/data/file-index.json`, `branding-index.json`, inbox/lifecycle/tag-proposals
- Postgres KV / auth sessions
- User prefs under `apps/desktop/data/`
- Local baseline PNGs under `apps/web/_qa/geex-realign-baseline/` (gitignored)

Unrelated WIP on working tree (inbox JSON, `_qa` scripts, maskotka poses, etc.) is **not** part of this doc commit — leave it unstaged.

`stash@{0}`: `WIP before main merge (pad-fix)` — inspect with `git stash show -p stash@{0}` before applying.

---

## Bridge / runtime after rollback

1. If `local_bridge.py` changed (PAKIET): stop and restart bridge on **8766**.
2. Hard-refresh web **8765** with cache-bust (`?v=` on CSS/JS in HTML — after revert, old `?v=` may need bump again).
3. Do not rely on Service Worker stale HTML — hard reload or unregister if UI looks stuck.

---

## PARTIAL / OPEN (do not “fix” by rollback alone)

- Baseline PNG **28/36** (process); local may have more.
- marketing↔viz cards, branding air, broader dark polish still open.
- Reverting Geex does **not** auto-clear `stash@{0}`.
