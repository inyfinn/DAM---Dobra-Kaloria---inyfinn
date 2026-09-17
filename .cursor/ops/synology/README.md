# Synology: git backup of this repo at `web/Panel-DAM`

The NAS folder **is the repository**. Every 4 hours it fetches GitHub and hard-resets to `origin/main`. No file-by-file upload from a workstation.

## Why pull, not push

| | NAS pulls GitHub | Workstation pushes files (`robocopy` / RaiDrive `W:`) |
|--|--|--|
| Self-healing | Yes — next run after a later commit | Only while this PC is on and `W:` is mounted |
| Half-tidied tree | Avoided — job waits for the next GitHub commit | Would copy the in-flight root cleanup |
| Auth | One deploy key on the NAS | Depends on SMB / RaiDrive |

Prior art already pointed the same way: `bin/scripts/ops/synology/dam-git.sh` (Entware git + deploy key) then `dam-sync-panel-web.sh` rsync’d only `bin/apps/web` into Panel-DAM. That Entware binary is gone (`/usr/local/bin/git` → missing `/opt/bin/git`). This job clones the **whole repo** into Panel-DAM and does not rsync a web subset.

## Ground truth (2026-09-15)

| Item | Value | How confirmed |
|--|--|--|
| Real path | `/volume1/web/Panel-DAM` (capital `P` and `DAM`) | `ls -ld` over SSH `syno-ddns`. No `web/panel-dam`. Windows `W:\web\Panel-DAM` is the same folder when RaiDrive is mounted; `W:` was **not** mapped from this PC. |
| Reachability | SSH `Inyfinn@inyfinn.synology.me:5022` (alias `syno-ddns`, key `~/.ssh/syno_ed25519`) | `ssh syno-ddns` → host `inyfinn-syno` |
| Native git | **Not working** | Git Server package not installed. `/usr/local/bin/git` is a broken Entware symlink. |
| Git used | Docker image `alpine/git:latest` via Container Manager | `docker pull` + `docker run` as user `Inyfinn` (group `docker`) |
| GitHub | **Private** repo, default branch `main` | `gh repo view` → `isPrivate: true` |
| Auth | Repo deploy key already on the NAS | `ssh -T git@github.com` → `Hi inyfinn/DAM---Dobra-Kaloria---inyfinn!` Key file: `/var/services/homes/Inyfinn/.ssh/id_ed25519`. HTTPS fallback file exists at `~/.git-credentials` (do not commit; do not paste). |

## Cache — option (B), locked 2026-09-15

The indexer writes AVIFs into `bin/PAMIEC-PODRECZNA` as files are added. That folder **must stay untracked**. Never `git add` it. A clone does not bring it; `reset --hard` does not delete it (`dam-repo-pull.sh` never runs `git clean`).

| | |
|--|--|
| Local source | `D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\PAMIEC-PODRECZNA` |
| Seed measured 2026-09-15 | First copy **12935 files / 102858090 bytes (98.09 MB)**. Then the indexer added 2 files; incremental send was **3 files / 122147 bytes**. NAS now **12937 / 102921212**. Largest single file **656092 bytes** (~0.63 MB). |
| NAS destination | `/volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA` (same relative path; not the old lowercase `pamiec-podreczna`) |
| HTTPS / first-run | `https://inyfinn.synology.me/Panel-DAM/bin/PAMIEC-PODRECZNA/manifest.json` plus `cache-pack.tar` when the sync job refreshes it |
| Provenance | `manifest.json` next to the cache (`generated_at`, `file_count`, `total_bytes`, `last_mtime`, `source`). Desktop copies the same fields + `synced_at` into SQLite `dam_kv_local.thumb-cache-manifest`. |
| Why not git | Regenerable binaries that grow after every index. GitHub 100 MB/file is not the risk (max here is 656 KB); history churn and clone size are. |

### Incremental refresh (workstation → NAS)

| | |
|--|--|
| Script | `.cursor/ops/synology/sync-pamiec-podreczna.ps1` (calls `sync-pamiec-podreczna.py`) |
| How | SSH host `syno-ddns`. Lists NAS files (`size` + relative path), sends **only new or size-changed** files as one tar stream. No delete of extras on the NAS. Local cache is read-only. |
| Incremental | Yes. A newly indexed AVIF is one extra file on the next run, not a 98 MB re-upload. Same at 20k / 40k files. |
| Trigger | Windows Task Scheduler **`DAM-PAMIEC-PODRECZNA-sync`** (created 2026-09-15, State Ready). Daily from 00:20, repeat every 4 hours. Runs only while this PC is on and can SSH to the NAS. **Not** a DSM task. |
| Log | `%USERPROFILE%\.dam-ops\pamiec-podreczna-sync.log` |

```powershell
powershell -File "D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\.cursor\ops\synology\sync-pamiec-podreczna.ps1"
```

Optional Windows Task Scheduler (when this PC is on), every 4 hours, same clock as the git pull:

```
schtasks /Create /TN "DAM-PAMIEC-PODRECZNA-sync" /SC DAILY /ST 00:20 /RI 240 /DU 24:00 /RL LIMITED /F /TR "C:\Users\krzysztof.wieczorek\AppData\Local\Programs\Python\Python312\pythonw.exe \"D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\.cursor\ops\synology\sync-pamiec-podreczna.py\" --ssh-host syno-ddns"
```

**Use the full path to `pythonw.exe`, never the bare name.** Found 2026-09-17: the live task had been left pointing at the deleted `sync-pamiec-podreczna-hidden.vbs` (WSH popup on this PC), so it was repointed at `pythonw.exe` by bare name via `Set-ScheduledTask` — that registered fine and looked correct in `Get-ScheduledTask`, but every actual run failed with `LastTaskResult 0x80070002` (file not found), because Task Scheduler's process launch does not reliably resolve a bare exe name against the interactive user's `PATH` the way a shell does. Resolving it to the absolute path (`(Get-Command pythonw.exe).Source`) fixed it immediately — confirmed by `LastTaskResult 0`. If this task (or `run-dam-bg-job-hidden.vbs`'s successor) is ever recreated, always use the full path.

`Panel-DAM/data/*.json` on the NAS is leftover from the old web-only mirror, not the thumb cache. It stays **inside** `Panel-DAM`. If that folder exists without `.git`, the pull script **inits in place**. It must never create a sibling (`*.pre-git*`, `*.bak`, timestamped sidecars). There is exactly one panel folder: `/volume1/web/Panel-DAM`.

## Semantics of the 4-hour job

- `git fetch --prune origin`
- `git reset --hard origin/main`
- **No** `git clean` — untracked files stay
- Nothing new → log line `NOOP commit=<sha>`
- Auth/network failure → log line `FAIL ...` and exit 1 (DSM marks the task failed)

## Files

| Path | Role |
|--|--|
| `.cursor/ops/synology/dam-repo-pull.sh` | Clone if dest missing; if dest exists without `.git`, init in place (never a sibling sidecar); else fetch + hard reset |
| `.cursor/ops/synology/dsm-task-user-script.txt` | One-liner to paste into DSM |
| `.cursor/ops/synology/sync-pamiec-podreczna.py` | Incremental cache copy (size-compare, tar over SSH) |
| `.cursor/ops/synology/sync-pamiec-podreczna.ps1` | PowerShell wrapper for the cache copy |
| (removed 2026-09-16) `sync-pamiec-podreczna-hidden.vbs` / `.cmd` | Bitdefender flagged the hidden VBS → PowerShell `-ExecutionPolicy Bypass` chain as Heur.BZC.PZQ.Boxter. The task calls `pythonw.exe` directly: no console, no script-host chain. |
| `.cursor/ops/synology/DAM-PAMIEC-PODRECZNA-sync.xml` | Task definition used to register the job |
| `.cursor/ops/synology/_count-nas-cache.py` | Read-only NAS file/byte count |
| `/var/services/homes/Inyfinn/bin/dam-repo-pull.sh` | Copy the DSM task actually runs (works before this folder is on `main`) |
| `/var/services/homes/Inyfinn/logs/panel-dam-git-pull.log` | Git-pull run log |
| `%USERPROFILE%\.dam-ops\pamiec-podreczna-sync.log` | Cache-sync run log (this PC) |

After this file is committed and pulled, you may point DSM at:

`/bin/sh /volume1/web/Panel-DAM/.cursor/ops/synology/dam-repo-pull.sh`

Until then, keep the home copy.

## DSM Task Scheduler (every 4 hours)

**Already created 2026-09-15** as task id **18**, owner `Inyfinn`, enabled. Next trigger after setup: `2026-09-15 12:00`. Manual DSM run: **Success** (log `NOOP commit=511d39c`).

Settings (if you ever recreate it):

1. Open DSM: `https://inyfinn.synology.me:5001/`
2. **Sterowanie** (Control Panel) → **Harmonogram zadan** (Task Scheduler)
3. **Utworz** (Create) → **Zaplanowane zadanie** (Scheduled Task) → **Skrypt zdefiniowany przez uzytkownika** (User-defined script)
4. **Ogolne** (General):
   - Task name: `DAM-Panel-DAM-git-pull`
   - User: **Inyfinn** (not `root`)
   - Enabled: yes
5. **Harmonogram** (Schedule):
   - Run on: **Daily**
   - First run: `00:00`
   - **Repeat every:** `4 hours`
   - Last run time: `20:00` (runs 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
6. **Ustawienia zadania** (Task Settings) → User-defined script:

```
/bin/sh /var/services/homes/Inyfinn/bin/dam-repo-pull.sh
```

7. Notify on error: on (no password/token in the script).
8. Save. Select the task → **Uruchom** (Run) once. Open `/var/services/homes/Inyfinn/logs/panel-dam-git-pull.log`.

## What you must do by hand

1. **Nothing for the schedule** — task `DAM-Panel-DAM-git-pull` is already in DSM. Optional: open Task Scheduler and confirm you see it.
2. **Do not put a PAT in the repo.** SSH deploy key is already installed and accepted by GitHub for this private repo. If that key is ever revoked: generate a new ed25519 key for user `Inyfinn`, add it as a **Deploy key** (read-only) on `inyfinn/DAM---Dobra-Kaloria---inyfinn`.
3. **Thumb cache** is option (B). Windows task `DAM-PAMIEC-PODRECZNA-sync` is already registered (next run 12:20). Optional: open Task Scheduler and confirm you see it. Do not add `bin/PAMIEC-PODRECZNA` to git.
4. **Web Station:** `https://inyfinn.synology.me/Panel-DAM/` used to serve a flat `apps/web` mirror. After clone it serves the **repo root**. To host the UI again, point the virtual host at `/volume1/web/Panel-DAM/bin/apps/web` (after the later push lands that tree).
5. Old leftover JSON (not the thumb cache) lives at `/volume1/web/Panel-DAM/data` if still present. Do not park it in a sibling folder.

## Manual SSH check

From a PC that has `~/.ssh/config` host `syno-ddns`:

```powershell
ssh -o BatchMode=yes syno-ddns "/bin/sh /var/services/homes/Inyfinn/bin/dam-repo-pull.sh"
ssh -o BatchMode=yes syno-ddns "tail -n 20 /var/services/homes/Inyfinn/logs/panel-dam-git-pull.log"
powershell -File "D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\.cursor\ops\synology\sync-pamiec-podreczna.ps1"
```
