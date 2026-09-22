# -*- mode: python ; coding: utf-8 -*-
# PyInstaller (macOS): DAM.app = cienki shim + NIEZAMROZONE drzewo bin/ jako datas.
# Odpowiednik DAM.spec dla Windows, ktory tez zamraza tylko launcher.
# Build (na macOS):  python -m PyInstaller bin/tooling/build/DAM-macos.spec --noconfirm
# Test bez GUI:      dist/DAM.app/Contents/MacOS/DAM --selftest

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = Path(SPECPATH).resolve().parents[2]  # bin/tooling/build -> GIT_ROOT
DESKTOP = ROOT / "bin" / "apps" / "desktop"
shim = DESKTOP / "dam_mac_shim.py"
if not shim.is_file():
    raise SystemExit(f"Brak shima: {shim}")

PAYLOAD = "damroot"  # musi zgadzac sie z dam_mac_shim.PAYLOAD_DIR_NAME


def tree(src: Path, dest_rel: str, skip_dirs=(), skip_suffixes=()):
    """Pliki src -> datas pod damroot/<dest_rel>, z zachowaniem zagniezdzenia."""
    out = []
    if not src.is_dir():
        return out
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(src)
        if any(part in skip_dirs for part in rel.parts):
            continue
        if path.suffix.lower() in skip_suffixes:
            continue
        if path.name in SKIP_NAMES:
            continue
        out.append((str(path), f"{PAYLOAD}/{dest_rel}/{rel.parent.as_posix()}".rstrip("/.")))
    return out


SKIP_DIRS = (
    "__pycache__", ".pytest_cache", ".venv", "node_modules", "webview2-profile",
    "logs", "_qa", "tests", "bootstrap", "thumbs", "_invoice_mail_stage",
)
SKIP_SUFFIXES = (".pyc", ".log", ".sqlite", ".env")

# NIGDY nie pakuj sekretow do .app. Repo jest PUBLICZNE, a .dmg trafia na
# GitHub Release (macos-build.yml: hdiutil create -> gh release upload), wiec
# kazdy plik w bundlu jest publiczny. Krok "Konfiguracja bazy" zapisuje
# pg-config.bundled.json z sekretu DAM_PG_CONFIG_JSON prosto do
# bin/apps/desktop/data/ - bez tej bramki poszedlby do publicznego .dmg.
# Audyt bezpieczenstwa 2026-09 zglosil juz dokladnie to samo dla instalatora
# Windows ("haslo PG w instalatorze") - to jest ta sama kategoria bledu.
SKIP_NAMES = (
    "pg-config.bundled.json",
    "pg-config.json",
    "users-seed.sqlite",
)

datas = []
datas += tree(DESKTOP, "bin/apps/desktop", SKIP_DIRS, SKIP_SUFFIXES)
datas += tree(ROOT / "bin" / "apps" / "web", "bin/apps/web", ("__pycache__", "node_modules", "_qa"), (".pyc",))
datas += tree(ROOT / "bin" / "THEME", "bin/THEME", ("__pycache__", "documentation"), (".zip", ".map"))
datas += tree(ROOT / "bin" / "DATABASE", "bin/DATABASE", ("__pycache__",), (".gz",))
# Cache miniatur (PAMIEC-PODRECZNA) dokladany przez CI przed buildem, jesli jest.
datas += tree(ROOT / "bin" / "PAMIEC-PODRECZNA", "bin/PAMIEC-PODRECZNA", ("__pycache__",), (".tmp",))

# Kod aplikacji jedzie jako datas, wiec Analysis nie widzi jego importow.
# Zaleznosci trzeba wymienic wprost.
hiddenimports = [
    "webview", "webview.platforms.cocoa",
    "bcrypt", "psycopg2", "cryptography", "openpyxl", "ijson", "redis",
    "PIL", "PIL.Image", "PIL.ImageDraw",
    "sqlite3", "ssl", "secrets", "hashlib", "hmac", "uuid",
    "http.server", "socketserver", "urllib.request", "json", "csv",
    # index_snapshots / pg_db: skan indeksu w bazie jest gzipowany (2.3.4)
    "gzip",
]
hiddenimports += collect_submodules("webview")

binaries = []
for pkg in ("psycopg2", "cryptography", "PIL"):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception:
        pass

a = Analysis(
    [str(shim)],
    pathex=[str(DESKTOP)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],  # na macOS folder wybiera osascript (platform_compat)
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="DAM",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="DAM",
)

app = BUNDLE(
    coll,
    name="DAM.app",
    icon=str(ROOT / "bin" / "tooling" / "build" / "dam_app.icns"),
    bundle_identifier="pl.inyfinn.dam",
    info_plist={
        "CFBundleName": "DAM",
        "CFBundleDisplayName": "DAM - Dobra Kaloria",
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
