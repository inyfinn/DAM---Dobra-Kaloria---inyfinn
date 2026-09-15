#!/usr/bin/env python3
"""Read-only NAS cache count. File count + summed file sizes + du -sb."""
import subprocess
import sys

DEST = "/volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA"
script = (
    f'DEST={DEST!r}\n'
    "if [ ! -d \"$DEST\" ]; then echo MISSING; exit 0; fi\n"
    "echo DIR_OK\n"
    "find \"$DEST\" -type f -printf '%s\\n'\n"
    "echo --DU--\n"
    "du -sb \"$DEST\"\n"
    "echo --LS--\n"
    "ls -ld \"$DEST\"\n"
)
proc = subprocess.run(
    ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "syno-ddns", "sh", "-s"],
    input=script.encode(),
    capture_output=True,
)
if proc.returncode != 0:
    sys.stderr.buffer.write(proc.stderr)
    raise SystemExit(proc.returncode)
text = proc.stdout.decode("utf-8", "replace")
if text.startswith("MISSING"):
    print("MISSING")
    raise SystemExit(0)
parts = text.split("--DU--", 1)
sizes_block = parts[0]
rest = parts[1] if len(parts) == 2 else ""
sizes = []
for line in sizes_block.splitlines():
    line = line.strip()
    if line.isdigit():
        sizes.append(int(line))
print(f"FILES {len(sizes)}")
print(f"FILE_BYTES {sum(sizes)}")
print(rest.strip())
