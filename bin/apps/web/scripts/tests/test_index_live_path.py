# -*- coding: utf-8 -*-
"""resolve_index_live_path: empty env must not become Path('.')."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = SCRIPTS / "build-file-index.py"


def _load_builder():
    spec = importlib.util.spec_from_file_location("dam_build_file_index", BUILD)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {BUILD}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class ResolveIndexLivePathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.mod = _load_builder()
        cls.default = cls.mod._default_index_live_path()

    def test_empty_and_dot_use_canonical_live_file(self) -> None:
        resolve = self.mod.resolve_index_live_path
        for raw in ("", "   ", ".", "./", ".\\", None):
            got = resolve(raw)
            self.assertEqual(got, self.default, msg=repr(raw))
            self.assertTrue(got.name)
            self.assertNotEqual(got.name, ".")

    def test_explicit_path_kept(self) -> None:
        target = Path("C:/tmp/dam-index-live.json")
        self.assertEqual(self.mod.resolve_index_live_path(str(target)), target)


if __name__ == "__main__":
    unittest.main()
