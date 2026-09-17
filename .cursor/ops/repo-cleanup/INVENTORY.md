# Root cleanup inventory

Inventory captured before moves on 2026-09-15. The application tree was not restarted or built.

| Root entry | Git / ignore state | What it is | Reference evidence | Decision | Destination |
|---|---|---|---|---|---|
| `._wip-weekend-pull-2026-09-14/` | untracked; not independently ignored (parent `.cursor/` destination is ignored) | protected weekend recovery snapshot; 10 files, 483,927 bytes by metadata; three cloud placeholders could not be content-hashed | no live-code reference; only its own copied `parent-agent-gate.ps1` mentions `DAM-Setup.exe` | relocate intact, never rewrite/delete; compare file count and byte count after move | `.cursor/backup/._wip-weekend-pull-2026-09-14/` |
| `.cursor/` | ignored by `.gitignore:140` | Cursor/tooling workspace | tooling only | keep at root | unchanged |
| `.git/` | Git plumbing | repository metadata | required by Git and portable update detection | keep at root | unchanged |
| `.pytest_cache/` | untracked; not ignored before cleanup | generated pytest cache; 4 files, 1,677 bytes | no load-bearing reference | relocate rather than delete; add `.pytest_cache/` ignore | `.cursor/backup/.pytest_cache/` |
| `_backup-dash-bento-2026-09-10/` | tracked (13 files); not ignored at source | dated UI backup, 13 files, 546,508 bytes, metadata/content manifest `3EEDF13ADEE0518F7216B77C4205AEEB224300A273CFA03ED90D4A7E16848603` | no live-code reference | `git mv -f` into ignored backup home, then leave index unstaged; local snapshot retained and old tracked version remains in Git history | `.cursor/backup/_backup-dash-bento-2026-09-10/` |
| `_backup-shell-geex-2026-09-10/` | tracked (34 files); not ignored at source | dated shell/UI backup, 34 files, 3,636,645 bytes, metadata/content manifest `4B203ED7C47505FF38EAD2398B16D4683EEDB06197F9BC85DBEE13E9D7E5CE0E` | references only inside the backup's own historical `verify-results.json`; no live-code consumer | `git mv -f` into ignored backup home, then leave index unstaged; local snapshot retained and old tracked version remains in Git history | `.cursor/backup/_backup-shell-geex-2026-09-10/` |
| `_fffd.txt` | tracked | 598-byte diagnostic line-number dump about historical replacement-character/mojibake work | no live-code reference; current code mentions FFFD conceptually, not this file | treat as scratch evidence, not delete; `git mv -f` into ignored backup home, then leave index unstaged | `.cursor/backup/_fffd.txt` |
| `bin/` | tracked content root plus ignored runtime/build data | all application code, runtime, assets, dependencies, build/installer scripts and data | `runtime_config.py:11-14`, `dam_root_launcher.py:30-38`, installer/build scripts | keep at root; add exact Polish installer artifact folder | unchanged, plus `bin/instalator/` |
| `DAM.exe` | untracked and ignored by `.gitignore:22`; 2,225,152 bytes | public frozen/Go launcher | `dam_root_launcher.py:30-38` resolves `GIT_ROOT` from the executable directory, then requires `bin/`; `build-installer.ps1:109-144` also reads root `DAM.exe` | load-bearing; must stay at root | unchanged |
| `DAM-Setup.exe` | untracked and ignored by `.gitignore:263`; 78,670,359 bytes | generated Inno Setup installer binary | `build-installer.ps1:290-333` currently outputs it at root; release/update code refers to asset name, not a local root path | plain move to requested folder; update build output and local evidence path, without changing GitHub release asset name | `bin/instalator/DAM-Setup.exe` |
| `dist/` | untracked and ignored by `.gitignore:236`; 18 files, 6,002,609 bytes, manifest `AFCA3D6154E90E7463FF02B42306045D6B44F352865B9B21BE98A1CC855A2A83` | generated portable/build output | `build-portable.ps1`, `build-engine-onedir.ps1` and QA scripts generate/use root `dist/`; installer staging separately uses `bin/dist/` | relocate current generated snapshot rather than delete; keep ignore because future build scripts may regenerate it | `.cursor/backup/root-dist-2026-09-15/` |
| `PLAN-INSTALATOR.md` | tracked | installer working/status note; not a build input | its own lines 1-45; full canonical plan is under `.cursor/plans/` | move beside installer as requested and update stale root-path statements | `bin/instalator/PLAN-INSTALATOR.md` |
| `URUCHOM-DAM.bat` | tracked | user-facing double-click launcher | lines 2-10 change to the batch directory, require sibling `DAM.exe`, and launch it | load-bearing user entry point; keep at root beside `DAM.exe` | unchanged |
| `.gitattributes` | tracked Git plumbing | Git attributes | required repository configuration | keep at root | unchanged |
| `.gitignore` | tracked Git plumbing | ignore policy | required repository configuration | keep at root; add pytest ignore and unignore `bin/instalator/` while installer EXE remains ignored | unchanged |
| `.gitleaks.toml` | tracked Git plumbing | secret-scanning configuration | required repository configuration | keep at root | unchanged |

## Runtime and build conclusions

- `DAM.exe` cannot move: in frozen mode `Path(sys.executable).resolve().parent` is `GIT_ROOT`, and runtime paths are derived as `GIT_ROOT/bin/...`.
- `URUCHOM-DAM.bat` is a real launch entry point and must remain beside `DAM.exe`.
- Root `dist/` is generated output and already ignored. It is not a tracked fixture. Its current contents are archived, not deleted.
- `DAM-Setup.exe` is a generated, ignored 78,670,359-byte artifact, so moving it does not add a fat binary to Git history. Build configuration must emit future installers to `bin/instalator/`.
- The two dated backup folders are currently tracked. Moving their live copies into an ignored backup home necessarily means the next commit will remove those snapshots from the current tree; their prior versions remain recoverable in Git history, and their local copies remain under `.cursor/backup/`.

## Executed moves

| Method | Old path | New path |
|---|---|---|
| `git mv -f`, then index unstaged | `_backup-dash-bento-2026-09-10/` | `.cursor/backup/_backup-dash-bento-2026-09-10/` |
| `git mv -f`, then index unstaged | `_backup-shell-geex-2026-09-10/` | `.cursor/backup/_backup-shell-geex-2026-09-10/` |
| `git mv -f`, then index unstaged | `_fffd.txt` | `.cursor/backup/_fffd.txt` |
| `git mv`, then index unstaged | `PLAN-INSTALATOR.md` | `bin/instalator/PLAN-INSTALATOR.md` |
| plain `Move-Item` | `DAM-Setup.exe` | `bin/instalator/DAM-Setup.exe` |
| plain `Move-Item` | `._wip-weekend-pull-2026-09-14/` | `.cursor/backup/._wip-weekend-pull-2026-09-14/` |
| plain `Move-Item` | `.pytest_cache/` | `.cursor/backup/.pytest_cache/` |
| plain `Move-Item` | `dist/` | `.cursor/backup/root-dist-2026-09-15/` |

## Post-move proof

- Backup dash: 13/13 files, 546,508/546,508 bytes, manifest unchanged.
- Backup shell: 34/34 files, 3,636,645/3,636,645 bytes, manifest unchanged.
- Protected WIP: 10/10 files and 483,927/483,927 bytes. Three cloud placeholders could not be content-hashed before the move, so count plus byte equality is the strongest non-hydrating proof.
- Root dist snapshot: 18/18 files, 6,002,609/6,002,609 bytes, manifest unchanged.
- Pytest cache: 4/4 files, 1,677/1,677 bytes, manifest unchanged.
- Root launcher remains 2,225,152 bytes; installer remains 78,670,359 bytes.
- PowerShell parser: zero errors in `build-installer.ps1`, `cleanup-git-root.ps1`, and `parent-agent-gate.ps1`.
- Read-only HTTP: `http://127.0.0.1:8765/` returned HTTP 200 (9,122 bytes); `http://127.0.0.1:8766/health` returned HTTP 200 (3,660 bytes). No process was restarted or killed.
- Git index is empty after `git restore --staged -- .`; nothing is staged.
- `git diff -- bin/DATABASE` is empty. No database file was edited, moved, or removed.
