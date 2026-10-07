# -*- coding: utf-8 -*-
"""ETAP 0: rejestr komputerow z M: - czysta logika klienta (m_computers.py), bez bazy.

SQL (odczyt wiersza, samozgloszenie, dam_is_m_computer) jest w test_fleet_heartbeat_realpg.py na
prawdziwym PostgreSQL. Tu: normalizacja klucza ROOT, wykrywanie dysku, regula roli (decide),
cache po root_path i zachowanie przy niedostepnej bazie (baza po prostu nie odpowiada)."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import m_computers as mc  # noqa: E402


def _no_db():
    raise OSError("baza nie odpowiada")


class NormalizeTests(unittest.TestCase):
    def test_machine_key_jak_w_sql(self):
        self.assertEqual(mc.machine_key("KRZYSZTOFWI"), "krzysztofwi")
        self.assertEqual(mc.machine_key("  Test-A:m1 "), "test-a")
        self.assertEqual(mc.machine_key("TEST-A:repair"), "test-a")
        self.assertEqual(mc.machine_key(""), "")
        self.assertEqual(mc.machine_key(None), "")

    def test_normalize_share(self):
        self.assertEqual(mc.normalize_share("\\\\Serwer\\Marketing\\"), "//serwer/marketing")
        self.assertEqual(mc.normalize_share("//SERWER/Marketing//"), "//serwer/marketing")
        self.assertEqual(mc.normalize_share("D:\\DAM\\Root"), "d:/dam/root")
        self.assertEqual(mc.normalize_share(""), "")


@unittest.skipUnless(sys.platform == "win32", "wykrywanie dyskow Windows")
class RootInfoWindowsTests(unittest.TestCase):
    def test_brak_root(self):
        self.assertEqual(mc.root_info(""), {"kind": "none", "drive": "", "share": ""})

    def test_dysk_sieciowy_z_udzialem(self):
        with mock.patch.object(mc, "_drive_kind", return_value="remote"), \
                mock.patch.object(mc, "_wnet_connection", return_value="\\\\192.0.2.10\\Marketing"):
            self.assertEqual(mc.root_info("M:\\"), {"kind": "remote", "drive": "M:", "share": "//192.0.2.10/marketing"})
            self.assertEqual(mc.root_info("m:"), {"kind": "remote", "drive": "M:", "share": "//192.0.2.10/marketing"})

    def test_dysk_sieciowy_z_podsciezka(self):
        with mock.patch.object(mc, "_drive_kind", return_value="remote"), \
                mock.patch.object(mc, "_wnet_connection", return_value="\\\\serwer\\Dane"):
            self.assertEqual(mc.root_info("M:\\Marketing\\")["share"], "//serwer/dane/marketing")

    def test_dysk_sieciowy_bez_wykrytego_udzialu_to_sciezka_lokalna(self):
        with mock.patch.object(mc, "_drive_kind", return_value="remote"), \
                mock.patch.object(mc, "_wnet_connection", return_value=""):
            self.assertEqual(mc.root_info("X:\\Marketing"), {"kind": "remote", "drive": "X:", "share": "x:/marketing"})

    def test_dysk_lokalny(self):
        with mock.patch.object(mc, "_drive_kind", return_value="fixed"), \
                mock.patch.object(mc, "_wnet_connection") as wnet:
            self.assertEqual(mc.root_info("D:\\DAM\\Root"), {"kind": "fixed", "drive": "D:", "share": "d:/dam/root"})
            wnet.assert_not_called()

    def test_nieznany_typ_dysku_to_unknown(self):
        with mock.patch.object(mc, "_drive_kind", return_value="unknown"):
            self.assertEqual(mc.root_info("Z:\\")["kind"], "unknown")

    def test_unc_bez_litery(self):
        self.assertEqual(mc.root_info("\\\\Serwer\\Marketing\\"), {"kind": "remote", "drive": "", "share": "//serwer/marketing"})
        self.assertEqual(mc.root_info("//Serwer/Marketing"), {"kind": "remote", "drive": "", "share": "//serwer/marketing"})


class RootInfoPosixTests(unittest.TestCase):
    def test_nie_windows_to_unknown_z_pelna_sciezka(self):
        with mock.patch.object(mc.sys, "platform", "darwin"):
            self.assertEqual(mc.root_info("/Volumes/Marketing"), {"kind": "unknown", "drive": "", "share": "/volumes/marketing"})


class DecideTests(unittest.TestCase):
    INFO = {"kind": "remote", "drive": "M:", "share": "//a/marketing"}

    def test_brak_wiersza_to_kopia(self):
        self.assertEqual(mc.decide(self.INFO, None), {"role": "copy", "state": "none", "share": "//a/marketing", "drive": "M:"})

    def test_approved_auto_ten_sam_udzial_to_m(self):
        r = mc.decide(self.INFO, {"state": "approved", "source": "auto", "share": "//a/marketing"})
        self.assertEqual((r["role"], r["state"]), ("m", "approved"))

    def test_approved_auto_inny_udzial_nie_dziedziczy(self):
        r = mc.decide(self.INFO, {"state": "approved", "source": "auto", "share": "//inny/marketing"})
        self.assertEqual((r["role"], r["state"]), ("copy", "approved"))

    def test_approved_admin_to_m_mimo_innego_udzialu(self):
        r = mc.decide({"kind": "unknown", "drive": "X:", "share": ""}, {"state": "approved", "source": "admin", "share": "x"})
        self.assertEqual(r["role"], "m")

    def test_approved_auto_bez_wykrytego_udzialu_to_kopia(self):
        r = mc.decide({"kind": "unknown", "drive": "", "share": ""}, {"state": "approved", "source": "auto", "share": ""})
        self.assertEqual(r["role"], "copy")

    def test_pending_i_revoked_to_kopia_z_tym_stanem(self):
        for st in ("pending", "revoked"):
            r = mc.decide(self.INFO, {"state": st, "source": "auto", "share": "//a/marketing"})
            self.assertEqual((r["role"], r["state"]), ("copy", st))


class RoleForRootTests(unittest.TestCase):
    """Cache, plik ostatniej znanej wartosci i niedostepna baza."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.state_dir = Path(tmp.name)
        for p in (
            mock.patch.object(mc, "_state_path", return_value=self.state_dir / "m-computers.json"),
            mock.patch.object(mc, "_machine_name", return_value="TEST-A"),
            mock.patch.object(mc, "root_info", side_effect=self._info),
        ):
            p.start()
            self.addCleanup(p.stop)
        mc.reset_cache()
        self.addCleanup(mc.reset_cache)
        self.shares = {"M:\\": "//a/marketing", "N:\\": "//b/marketing"}

    def _info(self, root):
        return {"kind": "remote", "drive": root[:2], "share": self.shares.get(root, "")} if root else \
            {"kind": "none", "drive": "", "share": ""}

    def _ok(self, row):
        """Zapisuje wynik udanego odczytu (to robi role_for_root przez apply_row) bez sieci."""
        info = self._info("M:\\")
        return mc.apply_row("M:\\", info, row)

    def test_brak_root_to_kopia_bez_pytania_bazy(self):
        connect = mock.Mock(side_effect=AssertionError("nie wolno pytac bazy"))
        r = mc.role_for_root(connect, "")
        self.assertEqual((r["role"], r["state"]), ("copy", "none"))

    def test_baza_niedostepna_bez_historii_to_kopia(self):
        r = mc.role_for_root(_no_db, "M:\\")
        self.assertEqual((r["role"], r["state"], r["stale"]), ("copy", "none", True))

    def test_baza_niedostepna_po_udanym_odczycie_zostaje_ostatni_znany_wiersz(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        mc.reset_cache()  # jak po restarcie procesu: zostaje tylko plik
        r = mc.role_for_root(_no_db, "M:\\")
        self.assertEqual((r["role"], r["stale"]), ("m", True))

    def test_ostatni_znany_wiersz_nie_przechodzi_na_inny_root(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        mc.reset_cache()
        r = mc.role_for_root(_no_db, "N:\\")  # inny ROOT = inna para: nigdy m z cudzego zatwierdzenia
        self.assertEqual(r["role"], "copy")

    def test_ostatni_znany_wiersz_nie_daje_m_gdy_udzial_sie_zmienil(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        mc.reset_cache()
        self.shares["M:\\"] = "//inny/marketing"  # litera przemapowana na inny udzial, baza nie odpowiada
        r = mc.role_for_root(_no_db, "M:\\")
        self.assertEqual(r["role"], "copy")

    def test_cache_60_s_i_force(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        connect = mock.Mock(side_effect=OSError("baza nie odpowiada"))
        self.assertEqual(mc.role_for_root(connect, "M:\\")["role"], "m")
        self.assertEqual(connect.call_count, 0)  # w oknie cache baza nie jest pytana
        mc.role_for_root(connect, "M:\\", force=True)
        self.assertEqual(connect.call_count, 1)  # force pomija cache

    def test_cache_wygasa_po_ttl(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        connect = mock.Mock(side_effect=OSError("baza nie odpowiada"))
        with mock.patch.object(mc.time, "monotonic", return_value=mc.time.monotonic() + mc.CACHE_TTL_S + 1):
            mc.role_for_root(connect, "M:\\")
        self.assertEqual(connect.call_count, 1)

    def test_cache_kluczowany_root_path(self):
        self._ok({"state": "approved", "source": "auto", "share": "//a/marketing"})
        r = mc.role_for_root(_no_db, "N:\\")  # inny root: cache z M: nie obowiazuje
        self.assertEqual(r["role"], "copy")


if __name__ == "__main__":
    unittest.main()
