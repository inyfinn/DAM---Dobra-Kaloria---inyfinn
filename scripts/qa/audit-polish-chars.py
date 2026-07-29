#!/usr/bin/env python3
"""
Audit apps/web for Polish diacritic corruption (? placeholders).
Exit code 1 if corruption patterns found.
"""
from __future__ import annotations

import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB = os.path.join(ROOT, "apps", "web")

# Polish-context corruption signatures
CORRUPT_PATTERNS = [
    re.compile(r"Poka\?"),
    re.compile(r"Wyczy\?\?"),
    re.compile(r"j\?zyk"),
    re.compile(r"u\?yc"),
    re.compile(r"miesi\?c"),
    re.compile(r"Od\?wie"),
    re.compile(r"Wy\?\?cz"),
    re.compile(r"W\?\?cz"),
    re.compile(r"Wr\?\?"),
    re.compile(r"przegl\?d"),
    re.compile(r"niemi\?s"),
    re.compile(r"produkt\?w"),
    re.compile(r"\?cie\?c"),
    re.compile(r"od\?wie"),
    re.compile(r"Domy\?ln"),
    re.compile(r"dost\?p"),
    re.compile(r"wynik\?w"),
    re.compile(r"dopasowa\?"),
    re.compile(r"tag\?w"),
    re.compile(r"wy\?\?cz"),
    re.compile(r"grafik\?"),
    re.compile(r"powy\?ej"),
    re.compile(r"powi\?ksz"),
    re.compile(r"Podgl\?d"),
    re.compile(r"kafelk\?w"),
    re.compile(r"element\?w"),
    re.compile(r"pokaza\?"),
    re.compile(r"\?ywo"),
    re.compile(r"warto\?\?"),
    re.compile(r"zaznaczon\?"),
    re.compile(r"dobr\?"),
    re.compile(r"naci\?nij"),
    re.compile(r"Wsp\?lny"),
    re.compile(r"status\?w"),
    re.compile(r"je\?li"),
    re.compile(r"wygl\?d"),
    re.compile(r"asset\?w"),
    re.compile(r"opakowa\?"),
    re.compile(r"Pe\?na"),
    re.compile(r"\?adowanie"),
    re.compile(r"indeksu\?"),
    re.compile(r"Sprawd\?"),
    re.compile(r"kategori\?"),
    re.compile(r"B\?\?d"),
    re.compile(r"po\?\?czen"),
    re.compile(r"Has\?o"),
    re.compile(r"u\?ytkownik"),
    re.compile(r"zastrze\?one"),
    re.compile(r"zg\?oszen"),
    re.compile(r"\?r\?d"),
    re.compile(r"folder\?w"),
    re.compile(r"wed\?ug"),
    re.compile(r"K\?ko"),
    re.compile(r"zatwierd\?"),
    re.compile(r"Odwrotno\?\?"),
    re.compile(r"list\? "),
    re.compile(r"Od\?o\?one"),
    re.compile(r"Dzi\?"),
    re.compile(r"tydzie\?"),
    re.compile(r"checklistk\?"),
    re.compile(r"Powr\?t"),
    re.compile(r"Op\?ac"),
    re.compile(r"p\?atno"),
    re.compile(r"Wy\?lij"),
    re.compile(r"Wys\?lij"),
    re.compile(r"Oczekuj\?ce"),
    re.compile(r"Aktywno\?\?"),
    re.compile(r"zaanga\?owan"),
    re.compile(r"bezpo\?redn"),
    re.compile(r"ca\?kowit"),
    re.compile(r"Mno\?nik"),
    re.compile(r"\?wi\?t"),
    re.compile(r"Bo\?e"),
    re.compile(r"Stycze\?"),
    re.compile(r"Kwiecie\?"),
    re.compile(r"Wrzesie\?"),
    re.compile(r"Pa\?dziernik"),
    re.compile(r"Sierpie\?"),
    re.compile(r"Wsp\?lny"),
    re.compile(r"status\?w"),
    re.compile(r"je\?+\?*li"),
]

SKIP_LINE_RE = re.compile(
    r"(?:\?v=|\?=[^=]|location\.search|indexOf\([\"']\?[\"']\)|"
    r"http[s]?://[^\s\"']*\?|\.css\?|\.js\?)"
)


def is_excluded(path: str) -> bool:
    p = path.replace("\\", "/")
    return "_qa" in p or "node_modules" in p or "/vendor/" in p


def scan_file(path: str) -> list[tuple[int, str, str]]:
    hits: list[tuple[int, str, str]] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f, 1):
            if SKIP_LINE_RE.search(line):
                continue
            for pat in CORRUPT_PATTERNS:
                m = pat.search(line)
                if m:
                    hits.append((i, m.group(), line.rstrip()[:120]))
                    break
    return hits


def main() -> int:
    total = 0
    failed = False
    for pattern in (
        os.path.join(WEB, "*.html"),
        os.path.join(WEB, "assets", "js", "dam-*.js"),
    ):
        for path in sorted(glob.glob(pattern)):
            if is_excluded(path):
                continue
            hits = scan_file(path)
            if hits:
                failed = True
                rel = os.path.relpath(path, WEB)
                print(f"\n{rel}: {len(hits)} hit(s)")
                for ln, sig, text in hits[:10]:
                    print(f"  L{ln} [{sig}]: {text}")
                if len(hits) > 10:
                    print(f"  ... +{len(hits) - 10} more")
                total += len(hits)
    if failed:
        print(f"\nFAIL: {total} corruption pattern(s) found")
        return 1
    print("PASS: no Polish corruption patterns found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
