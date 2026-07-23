"""Trim pose-*.png to content (density bbox). Backup once to _trim_backup_*.

Usage: python apps/web/_qa/trim_maskotka_alpha.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "assets" / "img" / "maskotka"
BAK = ROOT / "_trim_backup_20260723"


def tight_bbox(im: Image.Image, alpha_thr: int = 40, min_run: int = 6, open_px: int = 2):
    a = im.split()[-1]
    mask = a.point(lambda p: 255 if p >= alpha_thr else 0).convert("L")
    if open_px > 0:
        for _ in range(open_px):
            mask = mask.filter(ImageFilter.MinFilter(3))
        for _ in range(open_px):
            mask = mask.filter(ImageFilter.MaxFilter(3))
    w, h = mask.size
    pix = mask.load()
    cols = [sum(1 for y in range(h) if pix[x, y] > 0) for x in range(w)]
    rows = [sum(1 for x in range(w) if pix[x, y] > 0) for y in range(h)]

    def span(counts, thr):
        left = 0
        while left < len(counts) and counts[left] < thr:
            left += 1
        right = len(counts) - 1
        while right >= 0 and counts[right] < thr:
            right -= 1
        if left > right:
            return None
        return left, right + 1

    cs = span(cols, max(min_run, int(h * 0.015)))
    rs = span(rows, max(min_run, int(w * 0.015)))
    if not cs or not rs:
        return mask.getbbox()
    return (cs[0], rs[0], cs[1], rs[1])


def main() -> None:
    BAK.mkdir(exist_ok=True)
    for src in sorted(ROOT.glob("pose-*.png")):
        bak_path = BAK / src.name
        if not bak_path.exists():
            bak_path.write_bytes(src.read_bytes())
        im = Image.open(bak_path).convert("RGBA")
        w0, h0 = im.size
        bb = tight_bbox(im)
        if not bb:
            continue
        l, t, r, b = bb
        l, t = max(0, l - 1), max(0, t - 1)
        r, b = min(w0, r + 1), min(h0, b + 1)
        im.crop((l, t, r, b)).save(src, optimize=True)
        print(f"{src.name}: {w0}x{h0} -> {r - l}x{b - t}")


if __name__ == "__main__":
    main()
