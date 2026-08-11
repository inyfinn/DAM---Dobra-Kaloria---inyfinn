#!/usr/bin/env python3
"""Migrate branding-grid-head.json ids from br-* to M-* (DamMarketingId.format parity)."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HEAD = DATA / "branding-grid-head.json"
NODE_SCRIPT = """
const fs = require('fs');
const path = require('path');
const headPath = process.argv[1];
const raw = fs.readFileSync(headPath, 'utf8');
const data = JSON.parse(raw);
const vm = require('vm');
const jsPath = path.join(path.dirname(headPath), '..', 'assets', 'js', 'dam-marketing-id.js');
const src = fs.readFileSync(jsPath, 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const fmt = sandbox.window.DamMarketingId && sandbox.window.DamMarketingId.format;
if (!fmt) { console.error('DamMarketingId.format missing'); process.exit(2); }
let br = 0, m = 0;
(data.assets || []).forEach(function (a) {
  if (!a || !a.id) return;
  var brId = String(a.id);
  if (!/^br-/i.test(brId)) return;
  br++;
  var mid = fmt(a);
  if (!mid || mid === brId) return;
  a.br_id = brId;
  a.id = mid;
  m++;
});
console.log(JSON.stringify({ br_before: br, migrated: m, count: (data.assets || []).length }));
fs.writeFileSync(headPath, JSON.stringify(data, {ensureAscii: false}) + '\\n', 'utf8');
"""


def main() -> int:
    if not HEAD.is_file():
        print(f"Brak {HEAD}", file=sys.stderr)
        return 1
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = DATA / f"branding-grid-head.backup-{stamp}.json"
    shutil.copy2(HEAD, backup)
    print(f"Backup: {backup}")
    before = json.loads(HEAD.read_text(encoding="utf-8"))
    br_before = sum(
        1 for a in (before.get("assets") or []) if str(a.get("id", "")).startswith("br-")
    )
    print(f"br- before: {br_before}")
    proc = subprocess.run(
        ["node", "-e", NODE_SCRIPT, str(HEAD)],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        shutil.copy2(backup, HEAD)
        print("Rollback from backup", file=sys.stderr)
        return proc.returncode
    stats = json.loads(proc.stdout.strip().splitlines()[-1])
    after = json.loads(HEAD.read_text(encoding="utf-8"))
    br_after = sum(
        1 for a in (after.get("assets") or []) if str(a.get("id", "")).startswith("br-")
    )
    print(f"migrated: {stats.get('migrated')} br- after: {br_after}")
    if br_after:
        shutil.copy2(backup, HEAD)
        print("Rollback: br- ids remain", file=sys.stderr)
        return 2
    # sample verify
    for a in (after.get("assets") or [])[:3]:
        print("sample", a.get("id"), a.get("br_id", ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
