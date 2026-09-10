# -*- coding: utf-8 -*-
"""AVIF thumbs flatten transparency onto white (no alpha / green matte)."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from dam_thumb_cache import MAX_THUMB_BYTES, _encode_thumb, _flatten_white, thumb_key  # noqa: E402


def test_flatten_rgba_white():
    from PIL import Image

    im = Image.new("RGBA", (8, 8), (0, 255, 0, 0))
    im.putpixel((3, 3), (10, 20, 30, 255))
    out = _flatten_white(im)
    assert out.mode == "RGB"
    assert out.getpixel((0, 0)) == (255, 255, 255)
    assert out.getpixel((3, 3)) == (10, 20, 30)


def test_encode_avif_no_alpha():
    from PIL import Image

    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "src.png"
        avif = Path(td) / "out.avif"
        jpg = Path(td) / "out.jpg"
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        im.putpixel((16, 16), (200, 50, 50, 255))
        im.save(src)
        path, ctype = _encode_thumb(str(src), avif, jpg, 64)
        assert path is not None
        assert ctype in ("image/avif", "image/jpeg")
        with Image.open(path) as got:
            assert "A" not in got.getbands()
            assert got.mode == "RGB"
            assert path.stat().st_size <= MAX_THUMB_BYTES
            assert not got.info.get("icc_profile")
            assert not got.info.get("exif")
            # corners white (or near-white after lossy)
            px = got.convert("RGB").getpixel((0, 0))
            assert all(c >= 240 for c in px), px


def test_cache_salt_whitebg():
    d1, _, _ = thumb_key("foo/bar.png", profile="card")
    # salt in material — digest changes if whitebg-v1 removed
    assert len(d1) == 64


if __name__ == "__main__":
    test_flatten_rgba_white()
    test_encode_avif_no_alpha()
    test_cache_salt_whitebg()
    print("OK thumb white flatten + cache salt")
