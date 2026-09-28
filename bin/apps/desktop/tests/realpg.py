# -*- coding: utf-8 -*-
"""Pomocnik dla testow na prawdziwym PostgreSQL (kontrakt `realpg`, DECYZJE
2026-09-28b).

STAN 2026-09-28 (decyzja wlasciciela): testowa baza NIE jest lokalna (aplikacja
nie moze "nauczyc sie", ze baza bywa na localhost). Jest osobna baza
`dam_eta_test` na serwerze PostgreSQL na inyfinn-syno, z osobna rola `dam_test`
(bez dostepu do tabel produkcji `dam_eta`). Testy lacza sie z nia TYLKO przez
zmienna `DAM_TEST_PG_DSN` ustawiona przez skrypt uruchamiajacy
(`bin/scripts/qa/testenv/run_realpg.py`) - nic nie jest zapisywane do
konfiguracji aplikacji. Bez zmiennej testy sa pomijane (skipTest).

Bezpieczniki `require()` (fail, nie skip):
- dbname musi zaczynac sie od `dam_eta_test`, nigdy `dam_eta`;
- user nie moze byc `dam_eta` (rola produkcyjna);
- w bazie musi byc tabela `dam_test_marker`.

`fresh_db(dsn)` -> jednorazowy SCHEMAT `t_<losowy>` w bazie testowej, ze
schematem aplikacji; DSN z `options=-csearch_path=t_<..>,public`; `set_pg_db_test_env`
przenosi search_path przez PGOPTIONS, zeby `pg_db.connect()` w tym samym procesie
trafial w ten schemat. Na wyjsciu schemat jest usuwany (tylko on).
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
    "brak DAM_TEST_PG_DSN - test na prawdziwym PostgreSQL pominiety; "
    "uruchom przez bin/scripts/qa/testenv/run_realpg.py (baza dam_eta_test na NAS)"
)


def _parse_dsn_field(dsn: str, key: str) -> str:
    m = re.search(rf"(?:^|\s){re.escape(key)}=([^\s]+)", dsn)
    return m.group(1) if m else ""


def _dsn_safety_error(dsn: str) -> str:
    dbname = _parse_dsn_field(dsn, "dbname").strip("'\"")
    user = _parse_dsn_field(dsn, "user").strip("'\"").lower()
    if not dbname.startswith("dam_eta_test"):
        return f"dbname '{dbname}' nie jest baza testowa (wymagane dam_eta_test*)"
    if user in ("dam_eta", "postgres", ""):
        return f"user '{user}' to rola produkcyjna/administracyjna - odmowa"
    return ""


def require(test_case) -> str:
    """Zwraca DSN testowej bazy albo wola test_case.skipTest(). Czyta tylko
    zmienna srodowiskowa; brak DAM_TEST_PG_DSN = pominiecie testu, nie blad."""
    dsn = os.environ.get("DAM_TEST_PG_DSN", "").strip()
    if not dsn:
        test_case.skipTest(_SKIP_REASON)
        raise AssertionError("unreachable - skipTest musi przerwac test")
    err = _dsn_safety_error(dsn)
    if err:
        test_case.fail(f"DAM_TEST_PG_DSN: {err}")
    if psycopg2 is None:
        test_case.skipTest("psycopg2-binary niedostepny w tym srodowisku")
        raise AssertionError("unreachable")
    try:
        conn = psycopg2.connect(dsn, connect_timeout=10)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM public.dam_test_marker LIMIT 1")
            cur.fetchall()
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        test_case.fail(f"DAM_TEST_PG_DSN ustawione, ale polaczenie/marker nieudane: {exc}")
    return dsn


def _random_schema() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"t_{suffix}"


def _dsn_with_search_path(dsn: str, schema: str) -> str:
    dsn = re.sub(r"(?:^|\s)options=('[^']*'|[^\s]+)", "", dsn)
    return f"{dsn} options='-csearch_path={schema},public'"


@contextmanager
def fresh_db(admin_dsn: str) -> Iterator[str]:
    """Nowy, jednorazowy schemat w bazie testowej ze schematem aplikacji;
    oddaje DSN z search_path na ten schemat; na wyjsciu schemat jest usuwany."""
    if psycopg2 is None:
        raise RuntimeError("psycopg2-binary niedostepny")
    err = _dsn_safety_error(admin_dsn)
    if err:
        raise RuntimeError(err)
    schema = _random_schema()
    admin = psycopg2.connect(admin_dsn, connect_timeout=10)
    admin.autocommit = True
    try:
        admin.cursor().execute(f'CREATE SCHEMA "{schema}"')
    finally:
        admin.close()
    fresh_dsn = _dsn_with_search_path(admin_dsn, schema)
    try:
        tenv = str(DESKTOP_DIR.parent.parent / "scripts" / "qa" / "testenv")
        if tenv not in sys.path:
            sys.path.insert(0, tenv)
        import schema as _schema  # type: ignore[import-not-found]

        conn = psycopg2.connect(fresh_dsn, connect_timeout=10)
        try:
            _schema.apply_schema(conn)
            conn.commit()
        finally:
            conn.close()
        yield fresh_dsn
    finally:
        admin2 = psycopg2.connect(admin_dsn, connect_timeout=10)
        admin2.autocommit = True
        try:
            admin2.cursor().execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        finally:
            admin2.close()


def set_pg_db_test_env(*, host: str, port: int, dbname: str, user: str, password: str, sslmode: str = "require", search_path: str = ""):
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
        "PGOPTIONS",
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
    if search_path:
        os.environ["PGOPTIONS"] = f"-csearch_path={search_path},public"
    pg_db.reset_config_cache()

    def _restore() -> None:
        for k, v in previous.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        pg_db.reset_config_cache()

    return _restore
