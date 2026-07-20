# -*- coding: utf-8 -*-
"""
Tnie sprite maskotki 3x3 (JPEG, kremowe tlo) na 9 przezroczystych PNG.

Metoda: flood-fill od krawedzi kazdego kafla - usuwa TYLKO obszar tla spojny
z krawedziami (tolerancja koloru wzgledem kremowego), wiec jasne fragmenty
wewnatrz postaci zostaja. Potem 1px erozja maski nieprzezroczystosci, zeby
zdjac kremowa obwodke antyaliasingu.

Wyjscie: apps/web/assets/img/maskotka/pose-1.png ... pose-9.png
Kolejnosc: 1 standard, 2 explain, 3 happy, 4 joy, 5 present, 6 think,
7 wave, 8 approve, 9 zen (wiersze gora->dol, kolumny lewa->prawa).
"""
import os
import sys
from collections import deque

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "assets", "img", "maskotka-bobek.png")
OUT_DIR = os.path.join(HERE, "..", "assets", "img", "maskotka")

# tolerancja odleglosci koloru od kremowego tla (suma roznic kanalow)
TOL = 90


def remove_bg(tile):
    tile = tile.convert("RGBA")
    w, h = tile.size
    px = tile.load()

    # kolor tla = mediana z 4 naroznikow
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3))

    def is_bg(p):
        return abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) <= TOL

    # flood-fill od wszystkich pikseli krawedzi
    mask = bytearray(w * h)  # 1 = tlo do usuniecia
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not mask[y * w + x] and is_bg(px[x, y]):
                mask[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y * w + x] and is_bg(px[x, y]):
                mask[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not mask[ny * w + nx] and is_bg(px[nx, ny]):
                mask[ny * w + nx] = 1
                q.append((nx, ny))

    # maska nieprzezroczystosci (255 = postac)
    keep = bytearray(255 - m * 255 for m in mask)

    # usun resztki plakietki z numerem: komponenty spojne dotykajace gornej
    # krawedzi w lewych 38% szerokosci albo lezace w calosci w rogu gora-lewo
    visited = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if visited[i0] or not keep[i0]:
                continue
            comp = []
            q2 = deque([(sx, sy)])
            visited[i0] = 1
            minx, miny, maxx, maxy = sx, sy, sx, sy
            while q2:
                x, y = q2.popleft()
                comp.append(y * w + x)
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not visited[j] and keep[j]:
                            visited[j] = 1
                            q2.append((nx, ny))
            touches_top_left = miny <= 2 and maxx < w * 0.38
            corner_blob = maxx < w * 0.22 and maxy < h * 0.16
            top_scrap = miny <= 2 and (maxy - miny) < h * 0.12
            if touches_top_left or corner_blob or top_scrap:
                for j in comp:
                    keep[j] = 0

    alpha = Image.frombytes("L", (w, h), bytes(keep))
    # 1px erozja usuwa kremowa obwodke, lekki blur wygladza krawedz
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    tile.putalpha(alpha)
    return tile


def crop_content(tile, pad=6):
    """Przytnij do zawartosci (bbox alpha) + maly margines."""
    bbox = tile.getchannel("A").getbbox()
    if not bbox:
        return tile
    w, h = tile.size
    l = max(0, bbox[0] - pad)
    t = max(0, bbox[1] - pad)
    r = min(w, bbox[2] + pad)
    b = min(h, bbox[3] + pad)
    return tile.crop((l, t, r, b))


def main():
    img = Image.open(SRC)
    w, h = img.size
    cw, ch = w // 3, h // 3
    os.makedirs(OUT_DIR, exist_ok=True)
    n = 0
    for row in range(3):
        for col in range(3):
            n += 1
            tile = img.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            # odetnij pasek podpisu u gory kafla (~14% wysokosci)
            tile = tile.crop((0, int(ch * 0.14), cw, ch))
            tile = remove_bg(tile)
            tile = crop_content(tile)
            out = os.path.join(OUT_DIR, "pose-%d.png" % n)
            tile.save(out, "PNG")
            print(out, tile.size)


if __name__ == "__main__":
    sys.exit(main())
