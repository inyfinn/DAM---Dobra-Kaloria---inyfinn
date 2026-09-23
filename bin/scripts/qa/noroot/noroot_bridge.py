"""Harness QA: most DAM tak, jak widzi go komputer BEZ folderu Marketing (ROOT).

Nie zmienia kodu aplikacji. Przed uruchomieniem prawdziwego local_bridge.py
podmienia w tym procesie wejscie do systemu plikow: kazda sciezka pod M:\\, X:\\,
D:\\Marketing albo UNC (\\\\serwer\\...) zachowuje sie jak nieistniejaca
(FileNotFoundError). Tak wyglada swiat na komputerze bez ROOT.

Ten plik NIE lezy w folderze aplikacji (w odroznieniu od pierwowzoru w
C:\\Users\\krzysztof.wieczorek\\AppData\\Local\\DAM-bezroot-test\\noroot_bridge.py) -
zyje w repo, wiec folder aplikacji (kopia zbudowanego DAM bez ROOT) podaje
sie jawnie jako argument.

Uzycie:
    python.exe noroot_bridge.py --app <folder_aplikacji>
    (DAM_BRIDGE_PORT / DAM_STATE_DIR / DAM_UI_ORIGIN nadal z env, jak w local_bridge.py)
"""
import argparse
import builtins
import io
import os
import runpy
import sys

BLOCKED = ("m:\\", "x:\\", "d:\\marketing", "\\\\")
HITS = {"n": 0}


def _blocked(p) -> bool:
    try:
        s = os.fspath(p)
    except TypeError:
        return False
    if isinstance(s, bytes):
        s = s.decode("utf-8", "ignore")
    s = str(s).replace("/", "\\").lower()
    if s.startswith("\\\\?\\"):
        s = s[4:]
    if s.startswith("\\\\127.0.0.1") or s.startswith("\\\\localhost"):
        return False
    return s.startswith(BLOCKED)


def _deny(p):
    HITS["n"] += 1
    raise FileNotFoundError(2, "Brak ROOT (harness noroot)", str(p))


def _wrap(fn):
    def inner(path, *a, **k):
        if _blocked(path):
            _deny(path)
        return fn(path, *a, **k)
    inner.__wrapped__ = fn
    return inner


def install_noroot_filesystem():
    for _name in ("stat", "lstat", "scandir", "listdir", "mkdir", "makedirs",
                  "remove", "rename", "replace", "utime", "access"):
        _orig = getattr(os, _name, None)
        if _orig is None:
            continue
        if _name == "access":
            def _access(path, mode, *a, _o=_orig, **k):
                return False if _blocked(path) else _o(path, mode, *a, **k)
            os.access = _access
        else:
            setattr(os, _name, _wrap(_orig))

    _open = builtins.open
    builtins.open = _wrap(_open)
    io.open = builtins.open

    import ntpath  # noqa: E402

    for _name in ("exists", "isdir", "isfile", "lexists"):
        _o = getattr(ntpath, _name)

        def _f(path, _o=_o):
            return False if _blocked(path) else _o(path)

        setattr(ntpath, _name, _f)
        setattr(os.path, _name, _f)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True,
                         help="Folder skopiowanej aplikacji DAM (zawiera bin/apps/desktop/local_bridge.py)")
    args = parser.parse_args()

    app_dir = os.path.abspath(args.app)
    bridge = os.path.join(app_dir, "bin", "apps", "desktop", "local_bridge.py")
    if not os.path.isfile(bridge):
        print("[noroot] BLAD: nie znaleziono mostu pod", bridge, file=sys.stderr)
        sys.exit(2)

    install_noroot_filesystem()

    sys.path.insert(0, os.path.dirname(bridge))
    sys.argv = [bridge]
    print("[noroot] start mostu", bridge, "port", os.environ.get("DAM_BRIDGE_PORT"), flush=True)
    runpy.run_path(bridge, run_name="__main__")


if __name__ == "__main__":
    main()
