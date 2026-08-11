# -*- mode: python ; coding: utf-8 -*-
# PyInstaller one-file launcher: starts bin/runtime/win/python/pythonw + launch.py
# Build: py -3.12 -m PyInstaller DAM.spec --noconfirm  (from GIT_ROOT, after sync-apps-to-bin)

import os
from pathlib import Path

ROOT = Path(SPECPATH).resolve()
launcher = ROOT / "bin" / "apps" / "desktop" / "dam_root_launcher.py"
icon = ROOT / "bin" / "apps" / "desktop" / "dam_app.ico"
if not launcher.is_file():
    raise SystemExit(f"Missing launcher (run sync-apps-to-bin): {launcher}")

a = Analysis(
    [str(launcher)],
    pathex=[str(launcher.parent)],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="DAM",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon) if icon.is_file() else None,
)
