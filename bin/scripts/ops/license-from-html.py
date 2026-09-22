# -*- coding: utf-8 -*-
"""Tekst licencji dla instalatora z tej samej tresci, co strona Licencja w aplikacji.

22.09.2026: kreator pokazywal bin/installer/LICENSE.txt z 12.08 ("wlasnoscia Inyfinn",
bez polskich znakow), a aplikacja - inna, aktualna licencje (license.html). Jedno zrodlo:
license.html. Build nadpisuje LICENSE.txt przed kompilacja Inno Setup (UTF-8 z BOM).

  python license-from-html.py --html bin/apps/web/license.html --version-json bin/apps/web/version.json \
      --out bin/installer/LICENSE.txt
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import textwrap
from html.parser import HTMLParser
from pathlib import Path

WIDTH = 78


class _Article(HTMLParser):
    """Zbiera bloki (h3 / p / li) z <article class="dam-settings-card">."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.inside = False
        self.blocks: list[tuple[str, str]] = []
        self._kind = ""
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class") or ""
        if tag == "article" and "dam-settings-card" in cls and not self.inside:
            self.inside = True
            self.depth = 1
            return
        if not self.inside:
            return
        if tag == "article":
            self.depth += 1
        if tag in ("h3", "p", "li"):
            self._flush()
            self._kind = tag

    def handle_endtag(self, tag):
        if not self.inside:
            return
        if tag in ("h3", "p", "li"):
            self._flush()
        if tag == "article":
            self.depth -= 1
            if self.depth == 0:
                self._flush()
                self.inside = False

    def handle_data(self, data):
        if self.inside and self._kind:
            self._buf.append(data)

    def _flush(self) -> None:
        text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
        if self._kind and text:
            self.blocks.append((self._kind, text))
        self._kind = ""
        self._buf = []


def render(html_text: str, version: str) -> str:
    p = _Article()
    p.feed(html_text)
    blocks = p.blocks
    # stopka z odnosnikami do innych stron aplikacji nie ma sensu w instalatorze
    blocks = [b for b in blocks if not re.fullmatch(r"(Prywatność|Regulamin|Licencja|Zgody)( · .*)?", b[1])]
    blocks = [b for b in blocks if not b[1].startswith("Ten sam tekst pokazuje instalator")]
    if not blocks:
        raise SystemExit("license.html: nie znaleziono tresci <article class=\"dam-settings-card\">")
    out = ["UMOWA LICENCYJNA - DAM - DOBRA KALORIA - INYFINN", f"Wersja programu: {version}", ""]
    for kind, text in blocks:
        if kind == "h3":
            out += ["", text.upper(), ""]
        elif kind == "li":
            out += textwrap.wrap(text, WIDTH, initial_indent="  - ", subsequent_indent="    ")
        else:
            out += [""] + textwrap.wrap(text, WIDTH) + [""]
    out += ["", "Klikając \"Akceptuję warunki umowy\", akceptujesz powyższe warunki."]
    txt = "\n".join(out)
    txt = re.sub(r"\n{3,}", "\n\n", txt).strip() + "\n"
    return txt


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--version-json", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    src = Path(a.html).read_text(encoding="utf-8")
    if "?" in re.sub(r"<[^>]+>|https?://\S+", "", src.split('dam-settings-card', 1)[-1]).replace("?v=", ""):
        # Zepsute znaki (2026-09: "Copyright ? 2026", "6?900 PLN") nie moga trafic do kreatora.
        bad = re.findall(r".{0,20}\?.{0,20}", re.sub(r"<[^>]+>", "", src.split('dam-settings-card', 1)[-1]))
        bad = [b for b in bad if "?v=" not in b]
        if bad:
            print("UWAGA license.html ma znak '?':", bad[:3], file=sys.stderr)
    version = str(json.loads(Path(a.version_json).read_text(encoding="utf-8")).get("version") or "")
    text = render(src, version).replace("\n", "\r\n")
    Path(a.out).write_bytes(b"\xef\xbb\xbf" + text.encode("utf-8"))
    print(f"LICENSE.txt: {a.out} ({len(text)} znakow, wersja {version})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
