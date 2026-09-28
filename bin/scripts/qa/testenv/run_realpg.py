"""Uruchamia wskazane testy desktop na PRAWDZIWYM PostgreSQL: baza `dam_eta_test`
(rola `dam_test`) na serwerze inyfinn-syno. Nie zapisuje zadnej konfiguracji
aplikacji - DSN idzie tylko w zmiennej DAM_TEST_PG_DSN procesu testow.

Haslo roli testowej: plik wskazany przez DAM_TEST_PG_SECRET albo
D:\\DAM-lokalne\\testpg\\nas-dam_test.secret (poza repo i poza Synology Drive).

Uzycie:
  bin\\runtime\\win\\python\\python.exe bin\\scripts\\qa\\testenv\\run_realpg.py test_repro_4*.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parents[2] / "apps" / "desktop"
DEFAULT_SECRET = Path(r"D:\DAM-lokalne\testpg\nas-dam_test.secret")
HOST = os.environ.get("DAM_TEST_PG_HOST", "inyfinn.synology.me")
PORT = os.environ.get("DAM_TEST_PG_PORT", "5433")


def main(argv: list[str]) -> int:
    patterns = argv or ["test_repro_4*.py"]
    secret = Path(os.environ.get("DAM_TEST_PG_SECRET") or DEFAULT_SECRET)
    password = secret.read_text(encoding="utf-8").strip()
    env = dict(os.environ)
    env["DAM_TEST_PG_DSN"] = (
        f"host={HOST} port={PORT} dbname=dam_eta_test user=dam_test "
        f"password={password} sslmode=require"
    )
    print(f"[realpg] host={HOST} port={PORT} dbname=dam_eta_test user=dam_test", flush=True)
    rc = 0
    for pat in patterns:
        print(f"== {pat}", flush=True)
        r = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", pat, "-v"],
            cwd=str(DESKTOP), env=env,
        )
        rc = rc or r.returncode
    return rc


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
