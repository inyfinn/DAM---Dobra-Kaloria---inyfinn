# Runtime inventory (P0.0) — 2026-08-05

## Confirmed on build machine
- System Python (dev): `C:\Users\...\Python312\python.exe` 3.12.10
- sqlite3 stdlib: 3.49.1
- `import webview` OK (pywebview installed)
- `import bcrypt` OK

## Launch path (DAM.exe → pythonw → launch.py)
| Component | Role | Bundle? |
|-----------|------|---------|
| `dam_root_launcher.py` / DAM.exe | Resolve git root, spawn pythonw | thin |
| `bin/runtime/win/python/` | Embeddable CPython 3.12 + site-packages | **YES** |
| `launch.py` | UI http + pywebview window | in bin/apps/desktop |
| `local_bridge.py` | :8766 disk/API | in bin/apps/desktop |
| `dam_db.py` / sqlite | users/meta | stdlib sqlite3 + bcrypt |
| Microsoft Edge WebView2 Runtime | native host for pywebview WinForms | **NOT bundled** (Evergreen; self-heal link) |
| `bin/apps/web/**` | static UI | already in tree |

## Python packages for start (core)
From `requirements.txt` needed at cold start:
- pywebview (+ pythonnet on Win)
- bcrypt
- Pillow, pystray (tray)
- cryptography (auth crypto paths)
- redis (graceful degrade)
- openpyxl (invoice paths — install for parity)
- psycopg2-binary (pg optional — install for parity)

Heavy optional (can fail soft):
- rapidocr-onnxruntime
- psd-tools

## Decision
Bundle **core** + optional heavy in site-packages on build machine via `vendor-runtime-win.ps1`.
Target: `bin/runtime/win/python/` embeddable 3.12.10 amd64.
