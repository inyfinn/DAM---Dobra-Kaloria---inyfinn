"""Build apps/desktop/dam_app.ico from brand green (#008244)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "apps" / "desktop" / "dam_app.ico"
GREEN = (0, 130, 68, 255)
WHITE = (255, 255, 255, 255)


def render(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), GREEN)
    draw = ImageDraw.Draw(img)
    margin = max(4, size // 8)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=max(6, size // 6),
        fill=GREEN,
        outline=WHITE,
        width=max(2, size // 32),
    )
    label = "DK"
    font_size = max(12, size // 3)
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - margin // 4), label, fill=WHITE, font=font)
    return img


def main() -> None:
    sizes = [(256, render(256)), (128, render(128)), (64, render(64)), (48, render(48)), (32, render(32)), (16, render(16))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sizes[0][1].save(
        OUT,
        format="ICO",
        sizes=[(img.size[0], img.size[1]) for _, img in sizes],
        append_images=[img for _, img in sizes[1:]],
    )
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
