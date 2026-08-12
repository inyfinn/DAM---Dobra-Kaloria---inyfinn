"""Build branded dam_app.ico (green tile + DAM)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "dam_app.ico"
BG = (0, 130, 68, 255)
FG = (255, 255, 255, 255)
SIZES = [16, 32, 48, 64, 128, 256]


def main() -> None:
    images: list[Image.Image] = []
    for s in SIZES:
        im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        pad = max(1, s // 16)
        r = max(2, s // 6)
        d.rounded_rectangle([pad, pad, s - pad - 1, s - pad - 1], radius=r, fill=BG)
        text = "DAM"
        fsize = max(8, int(s * 0.34))
        font = None
        for name in ("segoeuib.ttf", "seguisb.ttf", "arialbd.ttf", "arial.ttf"):
            try:
                font = ImageFont.truetype(name, fsize)
                break
            except OSError:
                continue
        if font is None:
            font = ImageFont.load_default()
        bbox = d.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (s - tw) // 2 - bbox[0]
        y = (s - th) // 2 - bbox[1] - max(0, s // 32)
        d.text((x, y), text, font=font, fill=FG)
        images.append(im)
    # PIL: zapis z najwiekszego kadru + sizes=... daje pelny multi-size ICO
    images[-1].save(OUT, format="ICO", sizes=[(s, s) for s in SIZES])
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
