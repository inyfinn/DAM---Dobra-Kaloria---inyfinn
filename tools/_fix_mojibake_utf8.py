#!/usr/bin/env python3
"""Repair UTF-8 mojibake in apps/web chrome (HTML/JS/CSS), not binary indexes.

Root cause: UTF-8 Polish text was decoded as Windows-1250 (cp1250), then
re-saved as UTF-8. Reverse with a loose cp1250 encoder that also maps
C1 controls produced from undefined cp1250 bytes (e.g. U+0081 from 0x81
in 'L with stroke' / Lat).

Never touch large index JSON blobs.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web"
SKIP_NAMES = {
    "file-index.json",
    "branding-index.json",
    "change-log.json",
    "product-index.json",
}
SKIP_DIRS = {"node_modules", ".git", "vendor", "thumbs", "cache"}
EXTS = {".html", ".js", ".css", ".json", ".md", ".txt", ".svg"}

# Undefined CP1250 bytes often become C1 controls when mis-decoded.
# Map those controls back to the original byte for reverse repair.
C1_TO_BYTE = {i: i for i in range(0x80, 0xA0)}


def marker_score(text: str) -> int:
    n = 0
    n += text.count("\u00c4")  # A diaeresis from C4 xx
    n += text.count("\u0139")  # L acute from C5 xx
    n += text.count("\u0102")  # A breve from C3 xx (o-acute etc.)
    n += text.count("\u00e2\u20ac")  # a-circ + euro from E2 80 xx
    n += text.count("\u0081")  # C1 from undefined 0x81 (L-stroke)
    return n


def looks_mojibake(text: str) -> bool:
    if "\u0139" in text and (
        "\u203a" in text or "\u013d" in text or "\u0081" in text or "\u201a" in text
    ):
        return True
    if "\u00c4\u2026" in text or "\u00c4\u2021" in text:
        return True
    if "\u0102\u0142" in text:  # A-breve + l-stroke = mojibake for o-acute
        return True
    if "\u00e2\u20ac" in text:
        return True
    if text.count("\u00c4") + text.count("\u0139") + text.count("\u0102") >= 3:
        return True
    return False


def encode_cp1250_loose(text: str) -> bytes:
    out = bytearray()
    for ch in text:
        o = ord(ch)
        if o in C1_TO_BYTE:
            out.append(C1_TO_BYTE[o])
            continue
        out.extend(ch.encode("cp1250"))
    return bytes(out)


def try_fix(text: str) -> tuple[str, str | None]:
    body = text.lstrip("\ufeff")
    before = marker_score(body)
    if before == 0 and not looks_mojibake(body):
        return text, None
    try:
        fixed = encode_cp1250_loose(body).decode("utf-8")
    except UnicodeDecodeError:
        # Fall back: skip undecodable bytes one by one
        raw = encode_cp1250_loose(body)
        fixed_parts = []
        i = 0
        while i < len(raw):
            for size in (4, 3, 2, 1):
                if i + size > len(raw):
                    continue
                chunk = raw[i : i + size]
                try:
                    fixed_parts.append(chunk.decode("utf-8"))
                    i += size
                    break
                except UnicodeDecodeError:
                    continue
            else:
                i += 1
        fixed = "".join(fixed_parts)
    if fixed == body:
        return text, None
    after = marker_score(fixed)
    polish = sum(
        1
        for ch in fixed
        if ch in "\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0141"
    )
    if after < before or polish > 0:
        return fixed, "cp1250-loose"
    return text, None


def iter_files():
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.name in SKIP_NAMES:
            continue
        if p.suffix.lower() not in EXTS:
            continue
        yield p


def write_utf8(path: Path, text: str, original: bytes) -> None:
    use_crlf = b"\r\n" in original
    data = text.replace("\r\n", "\n").replace("\r", "\n")
    if use_crlf:
        data = data.replace("\n", "\r\n")
    path.write_bytes(data.encode("utf-8"))


def main() -> int:
    dry = "--dry" in sys.argv
    scan_only = "--scan" in sys.argv
    changed = []
    failed = []
    skipped = []

    for path in sorted(iter_files()):
        raw = path.read_bytes()
        if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
            skipped.append((path, "utf16"))
            continue
        rel = path.relative_to(ROOT.parent.parent).as_posix()
        tag = "SCAN" if scan_only else ("DRY" if dry else "FIX")

        # Case A: file saved as raw Windows-1250 (invalid UTF-8) -> rewrite UTF-8
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text_1250 = raw.decode("cp1250")
            except UnicodeDecodeError:
                skipped.append((path, "not-utf8-not-cp1250"))
                print("SKIP", rel)
                continue
            # Only convert if it looks like Polish UI text
            if not any(ch in text_1250 for ch in "\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0141"):
                skipped.append((path, "binary-ish"))
                print("SKIP-BIN", rel)
                continue
            print(f"{tag} raw-cp1250->utf8  {rel}")
            changed.append((path, text_1250, raw))
            if not scan_only and not dry:
                write_utf8(path, text_1250, raw)
            continue

        if not looks_mojibake(text):
            continue
        fixed, method = try_fix(text)
        if method is None:
            failed.append(path)
            print("FAIL", path.as_posix())
            continue
        before = marker_score(text.lstrip("\ufeff"))
        after = marker_score(fixed)
        print(f"{tag} markers {before}->{after} via {method}  {rel}")
        for line in fixed.splitlines():
            if "Urz" in line and "Marketing" in line:
                print("  SAMPLE", line.strip().encode("unicode_escape").decode()[:140])
                break
        changed.append((path, fixed, raw))
        if scan_only or dry:
            continue
        write_utf8(path, fixed, raw)

    print("---")
    print(
        f"matched={len(changed)+len(failed)} listed={len(changed)} "
        f"failed={len(failed)} skipped={len(skipped)}"
    )
    if failed:
        for p in failed:
            print("FAILFILE", p.as_posix())

    needles = {
        "sciezki": "\u015acie\u017cki",
        "wyczysc": "Wyczy\u015b\u0107",
        "pokaz": "Poka\u017c",
        "urzadzenia": "Urz\u0105dzenia",
        "ladowanie": "\u0141adowanie",
    }
    for name in ("settings.html", "branding.html", "explorer.html", "index.html"):
        s = ROOT / name
        if not s.exists():
            continue
        # After FIX mode read disk; after SCAN use in-memory if available
        t = s.read_text(encoding="utf-8")
        for key, needle in needles.items():
            print(f"CHECK {name}: {key}={'PASS' if needle in t else 'MISS'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
