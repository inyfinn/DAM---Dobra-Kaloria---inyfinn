# -*- coding: utf-8 -*-
"""Restore Polish UTF-8 from git HEAD where working tree has U+FFFD."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps" / "web"
REPO = ROOT.parent if (ROOT.parent / ".git").exists() else ROOT
SKIP = ("node_modules", "vendor", "_qa", "data/branding-index", "scripts/_")


def git_show(rel: str) -> str | None:
    r = subprocess.run(
        ["git", "-C", str(REPO), "show", f"HEAD:bin/apps/web/{rel}"],
        capture_output=True,
    )
    if r.returncode != 0:
        return None
    return r.stdout.decode("utf-8")


def overlay_cache_tokens(cur: str, head: str) -> str:
    """Keep ?v= / version tokens from current line on HEAD Polish text."""
    out = head
    for pat in (
        r"\?v=[\w.]+",
        r"5\.0\.\d+",
        r"restore\d+[a-z]?",
        r"fix\d+[a-z]?",
    ):
        cur_hits = re.findall(pat, cur)
        head_hits = re.findall(pat, out)
        for cv, hv in zip(cur_hits, head_hits):
            if cv != hv:
                out = out.replace(hv, cv, 1)
    return out


def merge_lines(cur: str, head: str) -> str:
    if "\ufffd" not in cur:
        return cur
    if "\ufffd" in head:
        return cur
    c_lines = cur.splitlines()
    h_lines = head.splitlines()
    if len(c_lines) != len(h_lines):
        # whole-file fallback: replace FFFD spans using head as dictionary
        out = cur
        for m in re.finditer(r'["\']([^"\']*\ufffd[^"\']*)["\']', cur):
            broken = m.group(1)
            if broken in head:
                continue
            # find closest head string with same ASCII skeleton
            skel = re.sub(r"\ufffd+", "?", broken)
            for hm in re.finditer(r'["\']([^"\']{3,})["\']', head):
                cand = hm.group(1)
                if re.sub(r"[^\x00-\x7F]", "?", cand) == re.sub(r"[^\x00-\x7F]", "?", broken):
                    out = out.replace(broken, cand)
                    break
        return out
    merged = []
    for c, h in zip(c_lines, h_lines):
        if "\ufffd" in c and "\ufffd" not in h:
            merged.append(overlay_cache_tokens(c, h))
        else:
            merged.append(c)
    return "\n".join(merged) + ("\n" if cur.endswith("\n") else "")


def main() -> int:
    changed = 0
    remaining = 0
    for p in sorted(WEB.rglob("*.html")):
        rel = str(p.relative_to(WEB)).replace("\\", "/")
        if any(s in rel for s in SKIP):
            continue
        cur = p.read_text(encoding="utf-8")
        if "\ufffd" not in cur:
            continue
        head = git_show(rel)
        if not head or "\ufffd" in head:
            n = cur.count("\ufffd")
            remaining += n
            print("SKIP", rel, n)
            continue
        out = merge_lines(cur, head)
        if out != cur:
            p.write_text(out, encoding="utf-8", newline="\n")
            changed += 1
            n = out.count("\ufffd")
            print("merged", rel, "remaining_fffd", n)
            remaining += n
        else:
            n = cur.count("\ufffd")
            remaining += n
            print("NOCHANGE", rel, n)
    print(f"changed={changed} total_remaining_fffd={remaining}")
    return 0 if remaining == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
