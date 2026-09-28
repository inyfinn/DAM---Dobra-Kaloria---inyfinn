# -*- coding: utf-8 -*-
"""Pomocnik dla testow, ktore CHCIALYBY uzyc prawdziwego, izolowanego
PostgreSQL (kontrakt `realpg` z DECYZJE 2026-09-28b, sekcja 3).

STAN 2026-09-28 (korekta wlasciciela, przekazana przez orkiestratora tego
samego dnia): zero lokalnego testowego PostgreSQL i zero baz testowych
gdziekolwiek (takze na NAS - zablokowane), zeby aplikacja "nie nauczyla sie",
ze baza bywa lokalna. Skutek: `require()` PONIZEJ ZAWSZE pomija test (skipTest)
na tej stacji, dopoki ktos jawnie nie ustawi `DAM_TEST_PG_DSN` (recznie
uruchomiona, jednorazowa instancja PG poza tym repo) - `realpg` nigdy nie
laczy sie z niczym domyslnie, nigdy nie zaklada localhost jako hosta.

Uzycie (gdy/jesli DAM_TEST_PG_DSN kiedys bedzie ustawione):
    from tests.realpg import require, fresh_db

    class MyTest(unittest.TestCase):
        def setUp(self):
            self.dsn = require(self)  # skipTest gdy brak srodowiska

        def test_x(self):
            with fresh_db(self.dsn) as test_dsn:
                ...

Kontrakt:
- `DAM_TEST_PG_DSN` = pelny DSN (`host=... port=... dbname=... user=... password=...
  sslmode=...`) do bazy, ktora JUZ ma tabele `dam_test_marker` i host loopback.
- `require(test_case)` -> zwraca DSN string albo wywoluje `test_case.skipTest(...)`
  z jasnym powodem. Dodatkowo PRZERYWA (fail, nie skip) gdy DSN wskazuje host
  inny niz loopback (127.0.0.1/::1/localhost) - to samo zalozenie bezpieczenstwa
  co bramka w `pg_db.py`.
- `fresh_db(dsn)` -> tworzy jednorazowa baze `dam_t_<random>` na tym samym
  serwerze, naklada schemat (patrz `bin/scripts/qa/testenv/schema.py`), oddaje
  nowy DSN, a na wyjsciu z kontekstu kasuje ta baze. Uzywalne wylacznie gdy
  `require()` juz potwierdzil, ze srodowisko istnieje.
- `set_pg_db_test_env(**overrides)` -> ustawia zmienne `DAM_PG_*`/`DAM_TEST_PG`
  w os.environ tak, aby `pg_db.connect()` W TYM SAMYM PROCESIE trafial
  WYLACZNIE do bazy testowej (patrz izolacja w `pg_db.py`), i resetuje cache
  `pg_db`. Zwraca funkcje czyszczaca (do `addCleanup`).
"""
from __future__ import annotations

import os
import random
import re
import string
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DESKTOP_DIR = Path(__file__).resolve().parents[1]
if str(DESKTOP_DIR) not in sys.path:
    sys.path.insert(0, str(DESKTOP_DIR))

try:
    import psycopg2
    import psycopg2.extensions
except ImportError:  # pragma: no cover
    psycopg2 = None  # type: ignore[assignment]

_LOOPBACK = {"127.0.0.1", "::1", "localhost"}

_SKIP_REASON = (
    "brak testowej bazy PostgreSQL - integracja niewykonana (decyzja "
    "wlasciciela 2026-09-28, przekazana przez orkiestratora: zero lokalnego "
    "testowego PostgreSQL i zero baz testowych na NAS na tym etapie; ustaw "
    "DAM_TEST_PG_DSN recznie, jesli/gdy taka instancja powstanie)"
)


def _parse_dsn_field(dsn: str, key: str) -> str:
    m = re.search(rf"(?:^|\s){re.escape(key)}=([^\s]+)", dsn)
    return m.group(1) if m else ""


def require(test_case) -> str:
    """Zwraca DSN gotowej testowej bazy albo woloa test_case.skipTest().

    NIGDY nie laczy sie z niczym samo z siebie - tylko czyta zmienna
    srodowiskowa. Brak DAM_TEST_PG_DSN = pominiecie testu, nie blad."""
    dsn = os.environ.get("DAM_TEST_PG_DSN", "").strip()
    if not dsn:
        test_case.skipTest(_SKIP_REASON)
        raise AssertionError("unreachable - skipTest musi przerwac test")

    host = _parse_dsn_field(dsn, "host").lower()
    if host not in _LOOPBACK:
        test_case.fail(
            f"DAM_TEST_PG_DSN wskazuje host '{host}', ktory nie jest loopbackiem - "
            "odmowa (ten sam bezpiecznik, co pg_db._test_pg_requested/connect())."
        )

    if psycopg2 is None:
        test_case.skipTest("psycopg2-binary niedostepny w tym srodowisku")
        raise AssertionError("unreachable")

    try:
        conn = psycopg2.connect(dsn, connect_timeout=2)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM dam_test_marker LIMIT 1")
            cur.fetchall()
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        test_case.skipTest(f"DAM_TEST_PG_DSN ustawione, ale polaczenie/marker nieudane: {exc}")
        raise AssertionError("unreachable")

    return dsn


def _random_dbname() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"dam_t_{suffix}"


def _dsn_with_dbname(dsn: str, dbname: str) -> str:
    if re.search(r"(?:^|\s)dbname=", dsn):
        return re.sub(r"(?:^|\s)dbname=([^\s]+)", f" dbname={dbname}", dsn)
    return f"{dsn} dbname={dbname}"


@contextmanager
def fresh_db(admin_dsn: str) -> Iterator[str]:
    """Nowa, jednorazowa baza na tym samym serwerze co `admin_dsn` - schemat
    aplikacji nalozony `bin/scripts/qa/testenv/schema.py::apply_schema`, na
    wyjsciu z kontekstu baza jest kasowana. Wymaga, ze `admin_dsn` juz przeszedl
    przez `require()` (host loopback, marker obecny)."""
    if psycopg2 is None:
        raise RuntimeError("psycopg2-binary niedostepny")

    dbname = _random_dbname()
    admin_conn = psycopg2.connect(admin_dsn, connect_timeout=2)
    admin_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    try:
        cur = admin_conn.cursor()
        cur.execute(f'CREATE DATABASE "{dbname}"')
    finally:
        admin_conn.close()

    fresh_dsn = _dsn_with_dbname(admin_dsn, dbname)
    try:
        sys.path.insert(0, str(DESKTOP_DIR.parent.parent / "scripts" / "qa" / "testenv"))
        import schema as _schema  # type: ignore[import-not-found]

        conn = psycopg2.connect(fresh_dsn, connect_timeout=2)
        try:
            _schema.apply_schema(conn)
            conn.commit()
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS dam_test_marker (created_at TIMESTAMPTZ NOT NULL DEFAULT now())")
            cur.execute("INSERT INTO dam_test_marker DEFAULT VALUES")
            conn.commit()
        finally:
            conn.close()
        yield fresh_dsn
    finally:
        admin_conn2 = psycopg2.connect(admin_dsn, connect_timeout=2)
        admin_conn2.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        try:
            cur = admin_conn2.cursor()
            cur.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid <> pg_backend_pid()",
                (dbname,),
            )
            cur.execute(f'DROP DATABASE IF EXISTS "{dbname}"')
        finally:
            admin_conn2.close()


def set_pg_db_test_env(*, host: str, port: int, dbname: str, user: str, password: str, sslmode: str = "disable"):
    """Ustawia DAM_PG_*/DAM_TEST_PG w os.environ i resetuje cache pg_db, tak
    zeby pg_db.connect() W TYM SAMYM PROCESIE trafil WYLACZNIE do bazy
    testowej (patrz izolacja w pg_db.py). Zwraca funkcje czyszczaca."""
    import pg_db  # noqa: E402  (import lokalny - modul zaleznosci opcjonalnej)

    keys = (
        "DAM_TEST_PG",
        "DAM_PG_HOST",
        "DAM_PG_HOSTS",
        "DAM_PG_PORT",
        "DAM_PG_DBNAME",
        "DAM_PG_USER",
        "DAM_PG_PASSWORD",
        "DAM_PG_SSLMODE",
    )
    previous = {k: os.environ.get(k) for k in keys}

    os.environ["DAM_TEST_PG"] = "1"
    os.environ["DAM_PG_HOST"] = host
    os.environ.pop("DAM_PG_HOSTS", None)
    os.environ["DAM_PG_PORT"] = str(port)
    os.environ["DAM_PG_DBNAME"] = dbname
    os.environ["DAM_PG_USER"] = user
    os.environ["DAM_PG_PASSWORD"] = password
    os.environ["DAM_PG_SSLMODE"] = sslmode
    pg_db.reset_config_cache()

    def _restore() -> None:
        for k, v in previous.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        pg_db.reset_config_cache()

    return _restore
