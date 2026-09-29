# -*- coding: utf-8 -*-
"""
Konfiguracja Postgres bez jawnego hasla w instalatorze i na dysku.

Problem (audyt 2026-09-17): build wklejal data/pg-config.json z haslem do
DAM-Setup.exe. Kazdy, kto pobral instalator, mial haslo do bazy na Synology.

Teraz:
  * Instalator wozi TYLKO data/pg-config.sealed.json - szyfrogram Fernet, klucz
    z scrypt(kod aktywacyjny). Kod administrator przekazuje uzytkownikowi poza
    aplikacja (rozmowa, SMS). Sam instalator jest bezuzyteczny dla obcego.
  * Po aktywacji konfiguracja lezy w data/pg-config.dpapi zaszyfrowana Windows
    DPAPI (konto Windows tego uzytkownika). Inny uzytkownik tego PC, kopia dysku
    ani backup folderu nie odczytaja hasla.
  * Jawny data/pg-config.json zostaje wylacznie w drzewie deweloperskim (repo
    z .git, gitignored) jako zrodlo dla builda. W instalacji jest migrowany do
    DPAPI i kasowany.

macOS (29.09.2026, DAM 2.4.7 na Macu: "nieprawidlowy email lub haslo"):
  * _dpapi() dziala tylko na Windows, wiec aktywacja kodem na Macu konczyla sie
    dpapi_failed, a bez konfiguracji logowanie szlo do lokalnych kont seed.
  * Odpowiednik DPAPI na macOS = pek kluczy logowania uzytkownika (login
    Keychain), przez systemowe narzedzie /usr/bin/security:
        security add-generic-password -U -a <konto> -s pl.inyfinn.dam.pgconfig -w <base64>
        security find-generic-password -a <konto> -s pl.inyfinn.dam.pgconfig -w
    Wpis tworzy i czyta ten sam program (security), wiec system nie pyta o zgode.
  * Zapas, gdy pek kluczy jest niedostepny (sesja bez GUI, zablokowany pek):
    plik w katalogu uzytkownika z prawami 0600 (tylko wlasciciel). KOMPROMIS:
    plik chroni tylko uprawnienie systemu plikow (i FileVault na wylaczonym
    dysku) - root i kopie zapasowe (Time Machine) widza haslo. Uzywany tylko,
    gdy pek kluczy odmowil zapisu; udany zapis do peku kasuje plik zapasowy.
  * Stan aktywacji (pek + plik zapasowy + skrot sealed.json) lezy w katalogu
    uzytkownika (~/Library/Application Support/DAM/state albo DAM_STATE_DIR),
    NIE w DAM.app: pakiet bywa tylko do odczytu (.dmg, translokacja), zapis w
    nim psuje pieczec podpisu, a aktualizacja podmienia caly DAM.app.
  * Sam sealed.json jedzie w DAM.app (tylko do odczytu) jak w instalatorze Windows.
Windows bez zmian (DPAPI, pliki w data/ obok aplikacji). Linux bez zmian (brak
ochrony -> store_protected zwraca False, jawny plik zostaje).

Zadna funkcja nie rzuca wyjatkiem na zewnatrz.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
SEALED_PATH = DATA_DIR / "pg-config.sealed.json"


def _activation_state_dir() -> Path:
    """Gdzie zapisywac stan aktywacji. Czysta funkcja (bez mkdir) - wolana przy imporcie.

    Windows: data/ obok aplikacji - dokladnie jak dotad.
    macOS: katalog uzytkownika (ta sama baza co platform_compat.user_state_dir()),
    bo DAM.app bywa tylko do odczytu, a aktualizacja podmienia caly pakiet.
    """
    if sys.platform == "win32":
        return DATA_DIR
    raw = (os.environ.get("DAM_STATE_DIR") or "").strip()
    if raw:
        return Path(raw)
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "DAM" / "state"
    return DATA_DIR  # Linux (most na NAS): bez zmian


STATE_DIR = _activation_state_dir()
# Windows (i Linux): nazwy i miejsca bez zmian. macOS: ".protected" = wpis w peku
# kluczy (plik o tej nazwie istnieje tylko jako zapas 0600, patrz docstring modulu).
_PROT_SUFFIX = ".protected" if sys.platform == "darwin" else ".dpapi"
DPAPI_PATH = STATE_DIR / f"pg-config{_PROT_SUFFIX}"
# Kod aktywacyjny pod DPAPI + skrot sealed.json, z ktorego powstalo obecne haslo.
# 2026-09-22: aktualizacja przywozila nowy sealed.json (nowe haslo), ale DPAPI
# trzymalo haslo z pierwszej aktywacji i nikt go nie odswiezal -> "password
# authentication failed" i tryb offline na kazdym komputerze po zmianie hasla.
CODE_PATH = STATE_DIR / f"pg-config.code{_PROT_SUFFIX}"
SEALED_USED_PATH = STATE_DIR / "pg-config.sealed.used"
_ENTROPY = b"DAM-pg-config-v1"

# macOS Keychain (login keychain uzytkownika) przez systemowe narzedzie security.
KEYCHAIN_SERVICE = "pl.inyfinn.dam.pgconfig"
KEYCHAIN_LABEL = "DAM - konfiguracja bazy"
SECURITY_BIN = "/usr/bin/security"
_KEYCHAIN_TIMEOUT_S = 20.0
# Odczyt z peku = osobny proces. pg_db.is_configured() wolane jest przy kazdym
# polaczeniu z baza, wiec bez pamieci podrecznej kazde zapytanie odpalaloby
# "security". Zapis/usuniecie w tym procesie od razu aktualizuja cache.
_KEYCHAIN_HIT_TTL_S = 60.0
_KEYCHAIN_MISS_TTL_S = 5.0
_KEYCHAIN_CACHE: dict[str, tuple[float, bytes | None]] = {}
_KEYCHAIN_LOCK = threading.Lock()

SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
MIN_CODE_LEN = 16

_ATTEMPT_LOCK = threading.Lock()
_ATTEMPTS: list[float] = []
MAX_ATTEMPTS_PER_WINDOW = 5
ATTEMPT_WINDOW_S = 60.0


def normalize_code(code: str) -> str:
    """Kod dyktuje sie przez telefon: spacje, myslniki i wielkosc liter nie maja znaczenia."""
    return "".join(ch for ch in str(code or "").upper() if ch.isalnum())


def generate_code() -> str:
    """25 znakow base32 (~125 bitow) w grupach po 5: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # bez 0/O/1/I
    raw = "".join(secrets.choice(alphabet) for _ in range(25))
    return "-".join(raw[i : i + 5] for i in range(0, 25, 5))


def _derive_key(code: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    raw = hashlib.scrypt(
        normalize_code(code).encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=32, maxmem=128 * 1024 * 1024
    )
    return base64.urlsafe_b64encode(raw)


def seal(config: dict[str, Any], code: str) -> dict[str, Any]:
    from cryptography.fernet import Fernet

    if len(normalize_code(code)) < MIN_CODE_LEN:
        raise ValueError(f"kod aktywacyjny za krotki (min {MIN_CODE_LEN} znakow alfanumerycznych)")
    salt = secrets.token_bytes(16)
    key = _derive_key(code, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    token = Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode("utf-8"))
    return {
        "v": 1,
        "kdf": "scrypt",
        "n": SCRYPT_N,
        "r": SCRYPT_R,
        "p": SCRYPT_P,
        "salt": base64.b64encode(salt).decode("ascii"),
        "token": token.decode("ascii"),
    }


def unseal(sealed: dict[str, Any], code: str) -> dict[str, Any] | None:
    try:
        from cryptography.fernet import Fernet

        if int(sealed.get("v") or 0) != 1 or sealed.get("kdf") != "scrypt":
            return None
        n, r, p = int(sealed["n"]), int(sealed["r"]), int(sealed["p"])
        # Plik pochodzi z instalatora: nie pozwol mu zamowic gigabajtow pamieci.
        if not (2**14 <= n <= 2**17 and r == 8 and 1 <= p <= 2):
            return None
        salt = base64.b64decode(str(sealed["salt"]), validate=True)
        key = _derive_key(code, salt, n, r, p)
        raw = Fernet(key).decrypt(str(sealed["token"]).encode("ascii"))
        cfg = json.loads(raw.decode("utf-8"))
        return cfg if isinstance(cfg, dict) else None
    except Exception:
        return None


# --- Windows DPAPI (CurrentUser) -------------------------------------------------


def _dpapi(data: bytes, *, protect: bool) -> bytes | None:
    if sys.platform != "win32":
        return None
    try:
        import ctypes
        from ctypes import wintypes

        class Blob(ctypes.Structure):
            _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

        def blob(raw: bytes) -> Blob:
            buf = ctypes.create_string_buffer(raw, len(raw))
            return Blob(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

        crypt32 = ctypes.windll.crypt32
        kernel32 = ctypes.windll.kernel32
        src, ent, out = blob(data), blob(_ENTROPY), Blob()
        flags = 0x1  # CRYPTPROTECT_UI_FORBIDDEN
        fn = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
        if protect:
            ok = fn(ctypes.byref(src), None, ctypes.byref(ent), None, None, flags, ctypes.byref(out))
        else:
            ok = fn(ctypes.byref(src), None, ctypes.byref(ent), None, None, flags, ctypes.byref(out))
        if not ok:
            return None
        try:
            return ctypes.string_at(out.pbData, out.cbData)
        finally:
            kernel32.LocalFree(out.pbData)
    except Exception:
        return None


# --- macOS: pek kluczy (login Keychain) + zapasowy plik 0600 -----------------------


def protection_backend() -> str:
    """"dpapi" (Windows), "keychain" (macOS: pek kluczy, zapas plik 0600), "" (brak)."""
    if sys.platform == "win32":
        return "dpapi"
    if sys.platform == "darwin":
        return "keychain"
    return ""


def _keychain_cli() -> str | None:
    """Sciezka do narzedzia security. Najpierw systemowa (nie z PATH - nie da sie jej podmienic)."""
    try:
        if Path(SECURITY_BIN).is_file():
            return SECURITY_BIN
        return shutil.which("security")
    except Exception:
        return None


def _keychain_account() -> str:
    try:
        import getpass

        name = getpass.getuser()
    except Exception:
        name = ""
    return str(name or os.environ.get("USER") or "dam")


def _default_macos_state_dir() -> Path:
    return Path.home() / "Library" / "Application Support" / "DAM" / "state"


def _keychain_service(dest: Path) -> str:
    """Nazwa wpisu w peku kluczy dla danej sciezki stanu.

    Konfiguracja i zapamietany kod to dwa osobne wpisy. Nazwy produkcyjne
    (pl.inyfinn.dam.pgconfig, ...code) dostaje WYLACZNIE domyslny katalog
    uzytkownika. Kazda inna lokalizacja (testy, DAM_STATE_DIR, izolowane instancje)
    dostaje przyrostek ze skrotu sciezki - inaczej zestaw testow uruchomiony na
    prawdziwym Macu nadpisalby prawdziwa aktywacje uzytkownika."""
    name = dest.name
    if name == f"pg-config{_PROT_SUFFIX}" or name == "pg-config.protected":
        base = KEYCHAIN_SERVICE
    elif name.startswith("pg-config.code"):
        base = KEYCHAIN_SERVICE + ".code"
    else:
        slug = "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-")
        base = f"{KEYCHAIN_SERVICE}.{slug or 'item'}"
    try:
        canonical = dest.parent.resolve() == _default_macos_state_dir().resolve()
    except (OSError, RuntimeError):
        canonical = False
    if canonical:
        return base
    digest = hashlib.sha256(str(dest.parent).encode("utf-8")).hexdigest()[:12]
    return f"{base}.{digest}"


def _security(args: list[str]) -> subprocess.CompletedProcess | None:
    exe = _keychain_cli()
    if not exe:
        return None
    try:
        return subprocess.run(
            [exe, *args],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=_KEYCHAIN_TIMEOUT_S,
        )
    except Exception:
        return None


def _keychain_cache_put(service: str, value: bytes | None) -> None:
    with _KEYCHAIN_LOCK:
        _KEYCHAIN_CACHE[service] = (time.monotonic(), value)


def _keychain_load(service: str) -> bytes | None:
    now = time.monotonic()
    with _KEYCHAIN_LOCK:
        hit = _KEYCHAIN_CACHE.get(service)
    if hit is not None:
        ts, value = hit
        ttl = _KEYCHAIN_HIT_TTL_S if value is not None else _KEYCHAIN_MISS_TTL_S
        if now - ts < ttl:
            return value
    res = _security(["find-generic-password", "-a", _keychain_account(), "-s", service, "-w"])
    value: bytes | None = None
    if res is not None and res.returncode == 0:
        try:
            value = base64.b64decode((res.stdout or "").strip().encode("ascii"), validate=True) or None
        except Exception:
            value = None
    _keychain_cache_put(service, value)
    return value


def _keychain_store(service: str, raw: bytes) -> bool:
    """Zapis do peku + kontrola odczytu (jak roundtrip DPAPI). Tylko base64 w argumencie."""
    secret = base64.b64encode(raw).decode("ascii")
    res = _security(
        ["add-generic-password", "-U", "-a", _keychain_account(), "-s", service,
         "-l", KEYCHAIN_LABEL, "-w", secret]
    )
    with _KEYCHAIN_LOCK:
        _KEYCHAIN_CACHE.pop(service, None)
    if res is None or res.returncode != 0:
        return False
    return _keychain_load(service) == raw


def _keychain_delete(service: str) -> None:
    _security(["delete-generic-password", "-a", _keychain_account(), "-s", service])
    _keychain_cache_put(service, None)


def _file_store_0600(dest: Path, raw: bytes) -> bool:
    """Zapas bez peku kluczy: plik tylko dla wlasciciela (0600), zapis atomowy."""
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + f".{os.getpid()}.tmp")
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_BINARY", 0)
        fd = os.open(str(tmp), flags, 0o600)
        with os.fdopen(fd, "wb") as fh:
            fh.write(raw)
        try:
            os.chmod(tmp, 0o600)  # umask/istniejacy plik: wymus 0600 niezaleznie od stanu
        except OSError:
            pass
        os.replace(tmp, dest)
        return dest.read_bytes() == raw
    except Exception:
        return False


def _file_load(src: Path) -> bytes | None:
    try:
        if not src.is_file():
            return None
        return src.read_bytes() or None
    except Exception:
        return None


def _unlink_quiet(path: Path) -> None:
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def _macos_store(dest: Path, raw: bytes) -> bool:
    service = _keychain_service(dest)
    if _keychain_store(service, raw):
        # Udany zapis do peku: zapasowy plik (z czasu bez peku) jest juz nieaktualny.
        _unlink_quiet(dest)
        if dest.is_file() and not _file_store_0600(dest, raw):
            return False  # plik zostal i nie da sie go wyrownac - lepiej zglosic blad
        return True
    if not _file_store_0600(dest, raw):
        return False
    # Pek odmowil (np. zablokowany) - nie zostawiaj w nim starszej wersji.
    _keychain_delete(service)
    return True


def _macos_load(src: Path) -> bytes | None:
    # Plik zapasowy istnieje tylko wtedy, gdy OSTATNI zapis nie wszedl do peku,
    # wiec ma pierwszenstwo (jest nowszy niz ewentualny wpis w peku).
    raw = _file_load(src)
    if raw:
        return raw
    return _keychain_load(_keychain_service(src))


def _protected_exists(path: Path) -> bool:
    if sys.platform == "darwin":
        return path.is_file() or _keychain_load(_keychain_service(path)) is not None
    return path.is_file()


def _state_dir_writable() -> bool:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        probe = STATE_DIR / f".pg-seal-probe.{os.getpid()}"
        probe.write_bytes(b"1")
        probe.unlink()
        return True
    except OSError:
        return False


def dpapi_available() -> bool:
    """Czy da sie chronic konfiguracje na tym systemie (nazwa historyczna).

    Windows: DPAPI (bez zmian). macOS: pek kluczy albo zapasowy plik 0600."""
    if sys.platform == "darwin":
        return _keychain_cli() is not None or _state_dir_writable()
    probe = _dpapi(b"dam", protect=True)
    return bool(probe) and _dpapi(probe, protect=False) == b"dam"


def store_protected(config: dict[str, Any], path: Path | None = None) -> bool:
    """Zapis konfiguracji pod ochrona systemu. False = nie zapisano (wolajacy NIE kasuje zrodla).

    Windows: DPAPI do pliku. macOS: pek kluczy (zapas: plik 0600)."""
    dest = path or DPAPI_PATH
    try:
        raw = json.dumps(config, ensure_ascii=False).encode("utf-8")
        if sys.platform == "darwin":
            return _macos_store(dest, raw)
        blob = _dpapi(raw, protect=True)
        if not blob or _dpapi(blob, protect=False) != raw:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + f".{os.getpid()}.tmp")
        tmp.write_bytes(blob)
        os.replace(tmp, dest)
        return True
    except Exception:
        return False


def load_protected(path: Path | None = None) -> dict[str, Any] | None:
    src = path or DPAPI_PATH
    try:
        if sys.platform == "darwin":
            raw = _macos_load(src)
        else:
            if not src.is_file():
                return None
            raw = _dpapi(src.read_bytes(), protect=False)
        if not raw:
            return None
        cfg = json.loads(raw.decode("utf-8"))
        return cfg if isinstance(cfg, dict) else None
    except Exception:
        return None


def sealed_present() -> bool:
    try:
        return SEALED_PATH.is_file() and SEALED_PATH.stat().st_size > 0
    except OSError:
        return False


def _throttled() -> bool:
    now = time.time()
    with _ATTEMPT_LOCK:
        _ATTEMPTS[:] = [t for t in _ATTEMPTS if now - t < ATTEMPT_WINDOW_S]
        if len(_ATTEMPTS) >= MAX_ATTEMPTS_PER_WINDOW:
            return True
        _ATTEMPTS.append(now)
        return False


def activate(code: str) -> dict[str, Any]:
    """Kod aktywacyjny -> konfiguracja pod DPAPI (Windows) / w peku kluczy (macOS). Bez sieci, bez logowania."""
    if _throttled():
        return {"ok": False, "error": "too_many_attempts", "hint": "Odczekaj minutę i spróbuj ponownie."}
    if len(normalize_code(code)) < MIN_CODE_LEN:
        return {"ok": False, "error": "code_invalid", "hint": "Kod aktywacyjny jest niepoprawny."}
    try:
        sealed = json.loads(SEALED_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"ok": False, "error": "sealed_missing", "hint": "Brak pliku konfiguracji w instalacji."}
    # unseal() lyka kazdy wyjatek, wiec brak biblioteki wygladalby jak zly kod.
    # 20.09.2026: Smart App Control zablokowal cryptography/_rust.pyd i uzytkownik
    # dostawal "Kod aktywacyjny jest niepoprawny" przy poprawnym kodzie.
    try:
        from cryptography.fernet import Fernet  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "error": "crypto_unavailable",
            "hint": "Windows zablokował bibliotekę szyfrującą (Smart App Control). "
                    "Kod jest poprawny - odblokuj plik w Zabezpieczeniach Windows.",
            "detail": str(exc)[:200],
        }
    cfg = unseal(sealed if isinstance(sealed, dict) else {}, code)
    if not cfg or not cfg.get("password"):
        return {"ok": False, "error": "code_invalid", "hint": "Kod aktywacyjny jest niepoprawny."}
    if not store_protected(cfg):
        # Kod bledu bez zmian (UI pokazuje hint); opis zalezny od systemu.
        where = "pęk kluczy macOS" if sys.platform == "darwin" else "DPAPI"
        return {"ok": False, "error": "dpapi_failed", "hint": f"Nie udało się zapisać konfiguracji ({where})."}
    # Kod zostaje pod DPAPI / w peku kluczy (ta sama ochrona co samo haslo), zeby
    # kolejna aktualizacja z nowym haslem odswiezyla konfiguracje bez pytania usera.
    store_protected({"code": normalize_code(code)}, CODE_PATH)
    _remember_sealed_used()
    return {"ok": True}


def _sealed_fingerprint() -> str:
    try:
        return hashlib.sha256(SEALED_PATH.read_bytes()).hexdigest()
    except OSError:
        return ""


def _remember_sealed_used() -> None:
    fp = _sealed_fingerprint()
    if not fp:
        return
    try:
        # macOS: katalog uzytkownika moze jeszcze nie istniec (Windows: data/ juz jest).
        SEALED_USED_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = SEALED_USED_PATH.with_name(SEALED_USED_PATH.name + f".{os.getpid()}.tmp")
        tmp.write_text(fp, encoding="ascii")
        os.replace(tmp, SEALED_USED_PATH)
    except OSError:
        pass


def remembered_code_present() -> bool:
    return _protected_exists(CODE_PATH)


def reseal_if_newer(*, force: bool = False) -> bool:
    """Odswiez konfiguracje DPAPI z sealed.json przywiezionego przez aktualizacje.

    True = konfiguracja zostala przepisana (wolajacy powinien wyczyscic cache).
    Bez zapamietanego kodu (stara aktywacja) zwraca False - wtedy UI prosi o kod.
    force=True: przepisz nawet przy tym samym sealed.json (po odrzuconym hasle).
    """
    if not sealed_present():
        return False
    fp = _sealed_fingerprint()
    if not fp:
        return False
    if not force:
        try:
            used = SEALED_USED_PATH.read_text(encoding="ascii").strip()
        except OSError:
            used = ""
        if used == fp and _protected_exists(DPAPI_PATH):
            return False
    saved = load_protected(CODE_PATH)
    code = str((saved or {}).get("code") or "")
    if len(code) < MIN_CODE_LEN:
        return False
    try:
        sealed = json.loads(SEALED_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    cfg = unseal(sealed if isinstance(sealed, dict) else {}, code)
    if not cfg or not cfg.get("password"):
        return False
    current = load_protected()
    if current and current == cfg:
        # Ta sama konfiguracja - nic nowego (takze po odrzuconym hasle: wtedy
        # potrzebny jest nowszy instalator albo nowy kod, nie ponowny zapis).
        _remember_sealed_used()
        return False
    if not store_protected(cfg):
        return False
    _remember_sealed_used()
    return True
