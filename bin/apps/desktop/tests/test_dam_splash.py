# -*- coding: utf-8 -*-
"""Plansza startowa Dobra Kaloria (2.5.2): czas oczekiwany, zapis czasu, sygnaly do planszy."""
from __future__ import annotations

import json
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_splash  # noqa: E402


def test_expected_seconds_defaults_local_and_network(tmp_path):
    missing = tmp_path / "brak.json"
    assert dam_splash.expected_seconds(missing, tmp_path) == dam_splash.DEFAULT_ETA_LOCAL
    assert dam_splash.expected_seconds(missing, Path(r"\\nas\dam\bin")) == dam_splash.DEFAULT_ETA_NETWORK


def test_saved_duration_becomes_next_eta(tmp_path):
    f = tmp_path / "splash-eta.json"
    dam_splash.save_duration(9.37, f)
    assert json.loads(f.read_text(encoding="utf-8"))["last_start_sec"] == 9.37
    assert dam_splash.expected_seconds(f, tmp_path) == 9.37


def test_absurd_durations_are_ignored(tmp_path):
    f = tmp_path / "splash-eta.json"
    dam_splash.save_duration(0.1, f)
    assert not f.exists()
    dam_splash.save_duration(dam_splash.HARD_LIMIT_SEC + 5, f)
    assert not f.exists()
    f.write_text(json.dumps({"last_start_sec": 999}), encoding="utf-8")
    assert dam_splash.expected_seconds(f, tmp_path) == dam_splash.DEFAULT_ETA_LOCAL
    f.write_text("{zepsuty", encoding="utf-8")
    assert dam_splash.expected_seconds(f, tmp_path) == dam_splash.DEFAULT_ETA_LOCAL


def test_handle_ready_writes_flag_once(tmp_path, monkeypatch):
    saved = []
    monkeypatch.setattr(dam_splash, "save_duration", lambda sec, state_file=None: saved.append(sec))
    h = dam_splash.SplashHandle()
    h.flag = tmp_path / "x.flag"
    h.flag.write_text("", encoding="utf-8")
    h.ready()
    h.close()  # po ready nic juz nie zmienia
    assert h.flag.read_text(encoding="utf-8") == "ready"
    assert len(saved) == 1


def test_handle_close_does_not_save(tmp_path, monkeypatch):
    saved = []
    monkeypatch.setattr(dam_splash, "save_duration", lambda sec, state_file=None: saved.append(sec))
    h = dam_splash.SplashHandle()
    h.flag = tmp_path / "x.flag"
    h.flag.write_text("", encoding="utf-8")
    h.close()
    assert h.flag.read_text(encoding="utf-8") == "close"
    assert saved == []


def test_disabled_by_env(monkeypatch):
    monkeypatch.setenv("DAM_NO_SPLASH", "1")
    h = dam_splash.start()
    assert h.done and h.proc is None
    h.ready()  # bez wyjatku


def test_read_flag_missing_file_means_close(tmp_path):
    assert dam_splash._read_flag(tmp_path / "nie-ma.flag") == "close"


def test_splash_page_exists_and_counts_from_program_start():
    html = dam_splash.SPLASH_HTML.read_text(encoding="utf-8")
    assert "damSplashDone" in html
    assert "t0=" in html and "eta=" in html
    for asset in ("assets/vendor/fonts/mindset/Mindset.otf", "assets/vendor/fonts/lato/Lato-Regular.ttf",
                  "assets/img/dk-logo-white-box.png"):
        assert asset in html
        assert (dam_splash.SPLASH_HTML.parent / asset).is_file(), asset


def test_mac_shim_whitelists_splash():
    import dam_mac_shim

    assert dam_mac_shim.RUNNABLE.get("splash") == "apps/desktop/dam_splash.py"
