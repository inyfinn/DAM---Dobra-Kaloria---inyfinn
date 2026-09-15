#!/usr/bin/env python3
"""Incremental copy of bin/PAMIEC-PODRECZNA <-> NAS Panel-DAM clone.

Default: workstation -> SSH (host syno-ddns). Compares size + relative
path and streams only new/changed files as a tar. Does not delete extras
on the NAS. Does not modify the local cache.

After a successful push, writes untracked NAS sidecars next to the cache:
  manifest.json  (generated_at, file_count, total_bytes, last_mtime, source)
  files.tsv      (size<TAB>rel) for HTTPS delta
  cache-pack.tar (full tree, refreshed when counts/bytes change)

--pull reverses the direction (NAS -> local) using the same SSH/tar protocol.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_SRC = Path(
    r"D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy"
    r"\DAM---Dobra-Kaloria---inyfinn\bin\PAMIEC-PODRECZNA"
)
DEFAULT_DEST = "/volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA"
DEFAULT_SSH = "syno-ddns"
DEFAULT_LOG = Path.home() / ".dam-ops" / "pamiec-podreczna-sync.log"
SIDECAR_NAMES = frozenset(
    {
        "manifest.json",
        "cache-pack.tar",
        "cache-pack.meta.json",
        "files.tsv",
        ".dam-write-probe",
    }
)


def log_line(log_path: Path, msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S %z")
    line = f"{ts} {msg}"
    print(line, flush=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def ssh_run(ssh_host: str, remote: str, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    cmd = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=20",
        ssh_host,
        remote,
    ]
    return subprocess.run(cmd, input=stdin, capture_output=True)


def ssh_ok(proc: subprocess.CompletedProcess[bytes], what: str) -> None:
    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", "replace").strip()
        out = (proc.stdout or b"").decode("utf-8", "replace").strip()
        raise SystemExit(f"FAIL {what} rc={proc.returncode} stderr={err} stdout={out}")


def walk_local(src: Path) -> dict[str, int]:
    files: dict[str, int] = {}
    for dirpath, _dirnames, filenames in os.walk(src):
        for name in filenames:
            if name in SIDECAR_NAMES:
                continue
            full = Path(dirpath) / name
            rel = full.relative_to(src).as_posix()
            try:
                files[rel] = full.stat().st_size
            except OSError:
                continue
    return files


def walk_remote(ssh_host: str, dest: str) -> dict[str, int]:
    script = (
        f'DEST={dest!r}\n'
        'if [ ! -d "$DEST" ]; then exit 0; fi\n'
        'find "$DEST" -type f -printf "%s\\t%P\\n"\n'
    )
    proc = ssh_run(ssh_host, "sh -s", stdin=script.encode("utf-8"))
    ssh_ok(proc, "remote find")
    files: dict[str, int] = {}
    text = (proc.stdout or b"").decode("utf-8", "replace")
    for line in text.splitlines():
        if not line.strip():
            continue
        size_s, rel = line.split("\t", 1)
        rel_n = rel.replace("\\", "/")
        if Path(rel_n).name in SIDECAR_NAMES:
            continue
        files[rel_n] = int(size_s)
    return files


def ensure_dest(ssh_host: str, dest: str) -> None:
    script = f"mkdir -p {dest!r}\n"
    proc = ssh_run(ssh_host, "sh -s", stdin=script.encode("utf-8"))
    ssh_ok(proc, "mkdir dest")


def remote_stats(ssh_host: str, dest: str) -> tuple[int, int]:
    script = (
        f'DEST={dest!r}\n'
        'if [ ! -d "$DEST" ]; then echo 0 0; exit 0; fi\n'
        'n=$(find "$DEST" -type f '
        '! -name manifest.json ! -name cache-pack.tar '
        '! -name cache-pack.meta.json ! -name files.tsv '
        '! -name .dam-write-probe | wc -l)\n'
        'b=$(find "$DEST" -type f '
        '! -name manifest.json ! -name cache-pack.tar '
        '! -name cache-pack.meta.json ! -name files.tsv '
        '! -name .dam-write-probe -printf "%s\\n" | awk \'{s+=$1} END {print s+0}\')\n'
        'echo "$n $b"\n'
    )
    proc = ssh_run(ssh_host, "sh -s", stdin=script.encode("utf-8"))
    ssh_ok(proc, "remote stats")
    parts = (proc.stdout or b"").decode("utf-8", "replace").strip().split()
    if len(parts) < 2:
        raise SystemExit(f"FAIL remote stats parse: {proc.stdout!r}")
    return int(parts[0]), int(parts[1])


def _utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_remote_sidecars(ssh_host: str, dest: str, log_path: Path, *, refresh_pack: bool) -> None:
    """Write manifest.json + files.tsv; refresh cache-pack.tar when stale."""
    script = (
        f"DEST={dest!r}\n"
        "set -e\n"
        "cd \"$DEST\"\n"
        "n=$(find . -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe | wc -l)\n"
        "b=$(find . -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe -printf '%s\\n' | awk '{s+=$1} END {print s+0}')\n"
        "mt=$(find . -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe -printf '%T@\\n' | sort -n | tail -1)\n"
        "mt=${mt:-0}\n"
        "find . -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe -printf '%s\\t%P\\n' > files.tsv\n"
        "echo \"$n $b $mt\"\n"
    )
    proc = ssh_run(ssh_host, "sh -s", stdin=script.encode("utf-8"))
    ssh_ok(proc, "remote sidecar scan")
    parts = (proc.stdout or b"").decode("utf-8", "replace").strip().split()
    if len(parts) < 3:
        raise SystemExit(f"FAIL sidecar stats parse: {proc.stdout!r}")
    n, b = int(float(parts[0])), int(float(parts[1]))
    mt = float(parts[2])
    generated = _utc_iso()
    last_iso = (
        datetime.fromtimestamp(mt, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if mt
        else generated
    )
    manifest = {
        "generated_at": generated,
        "file_count": n,
        "total_bytes": b,
        "last_mtime": last_iso,
        "last_mtime_unix": mt,
        "source": "synology",
    }
    man_json = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    write_man = (
        f"DEST={dest!r}\n"
        "cat > \"$DEST/manifest.json\" <<'EOF'\n"
        f"{man_json}"
        "EOF\n"
    )
    proc = ssh_run(ssh_host, "sh -s", stdin=write_man.encode("utf-8"))
    ssh_ok(proc, "write manifest.json")
    log_line(log_path, f"MANIFEST files={n} bytes={b} last_mtime={last_iso}")

    if not refresh_pack:
        return
    meta_json = json.dumps(
        {"file_count": n, "total_bytes": b, "generated_at": generated},
        ensure_ascii=False,
    )
    pack_script = (
        f"DEST={dest!r}\n"
        "set -e\n"
        "cd \"$DEST\"\n"
        "need=1\n"
        "if [ -f cache-pack.meta.json ] && [ -f cache-pack.tar ]; then\n"
        "  oldn=$(sed -n 's/.*\"file_count\"[[:space:]]*:[[:space:]]*\\([0-9]*\\).*/\\1/p' cache-pack.meta.json | head -1)\n"
        "  oldb=$(sed -n 's/.*\"total_bytes\"[[:space:]]*:[[:space:]]*\\([0-9]*\\).*/\\1/p' cache-pack.meta.json | head -1)\n"
        f"  if [ \"$oldn\" = \"{n}\" ] && [ \"$oldb\" = \"{b}\" ]; then need=0; fi\n"
        "fi\n"
        "if [ \"$need\" = 1 ]; then\n"
        "  tar -cf cache-pack.tar --exclude=cache-pack.tar --exclude=cache-pack.meta.json "
        "--exclude=manifest.json --exclude=files.tsv --exclude=.dam-write-probe .\n"
        "cat > cache-pack.meta.json <<'EOF'\n"
        f"{meta_json}\n"
        "EOF\n"
        "  echo PACK_REFRESHED\n"
        "else\n"
        "  echo PACK_OK\n"
        "fi\n"
    )
    proc = ssh_run(ssh_host, "sh -s", stdin=pack_script.encode("utf-8"))
    ssh_ok(proc, "refresh cache-pack.tar")
    note = (proc.stdout or b"").decode("utf-8", "replace").strip().splitlines()[-1:] or [""]
    log_line(log_path, note[0] or "PACK")


def pull_from_remote(src: Path, ssh_host: str, dest: str, log_path: Path) -> int:
    """NAS -> local, same size-compare protocol as push."""
    src.mkdir(parents=True, exist_ok=True)
    local = walk_local(src)
    remote = walk_remote(ssh_host, dest)
    to_get = sorted(rel for rel, size in remote.items() if local.get(rel) != size)
    log_line(log_path, f"PULL plan files={len(to_get)} remote={len(remote)} local={len(local)}")
    if not to_get:
        return 0
    proc = subprocess.Popen(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=20",
            ssh_host,
            f"tar -cf - -C {dest!r} -T -",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None
    proc.stdin.write("\n".join(to_get).encode("utf-8"))
    proc.stdin.close()
    assert proc.stdout is not None
    extracted = 0
    with tarfile.open(fileobj=proc.stdout, mode="r|") as tar:
        for member in tar:
            name = (member.name or "").replace("\\", "/").lstrip("/")
            if not name or Path(name).name in SIDECAR_NAMES:
                continue
            target = (src / name).resolve()
            if not str(target).startswith(str(src.resolve())):
                continue
            tar.extract(member, src)
            extracted += 1
    stderr = proc.stderr.read() if proc.stderr else b""
    if proc.wait() != 0 and extracted == 0:
        raise SystemExit(
            "FAIL pull tar rc={0} stderr={1}".format(
                proc.returncode,
                (stderr or b"").decode("utf-8", "replace").strip(),
            )
        )
    log_line(log_path, f"PULLED files={extracted}")
    return extracted


def stream_tar(src: Path, rels: list[str], ssh_host: str, dest: str) -> None:
    proc = subprocess.Popen(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=20",
            ssh_host,
            f"mkdir -p {dest!r} && tar -xf - -C {dest!r}",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None
    with tarfile.open(fileobj=proc.stdin, mode="w|", format=tarfile.PAX_FORMAT) as tar:
        total = len(rels)
        for i, rel in enumerate(rels, 1):
            full = src / Path(*rel.split("/"))
            tar.add(full, arcname=rel, recursive=False)
            if i % 1000 == 0 or i == total:
                print(f"  packed {i}/{total}", flush=True)
    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        raise SystemExit(
            "FAIL tar|ssh rc={0} stderr={1} stdout={2}".format(
                proc.returncode,
                (stderr or b"").decode("utf-8", "replace").strip(),
                (stdout or b"").decode("utf-8", "replace").strip(),
            )
        )


def write_local_manifest(src: Path, files: dict[str, int]) -> None:
    last_unix = 0.0
    for rel in files:
        try:
            mt = (src / Path(*rel.split("/"))).stat().st_mtime
        except OSError:
            continue
        if mt > last_unix:
            last_unix = mt
    generated = _utc_iso()
    last_iso = (
        datetime.fromtimestamp(last_unix, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if last_unix
        else generated
    )
    payload = {
        "generated_at": generated,
        "file_count": len(files),
        "total_bytes": sum(files.values()),
        "last_mtime": last_iso,
        "last_mtime_unix": last_unix,
        "source": "local",
    }
    path = src / "manifest.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="Incremental PAMIEC-PODRECZNA <-> NAS")
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--dest", default=DEFAULT_DEST)
    ap.add_argument("--ssh-host", default=DEFAULT_SSH)
    ap.add_argument("--log", type=Path, default=DEFAULT_LOG)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--pull", action="store_true", help="NAS -> local (first-run / delta)")
    ap.add_argument("--no-pack", action="store_true", help="Skip cache-pack.tar refresh")
    args = ap.parse_args()

    src = args.src.resolve()
    if args.pull:
        log_line(args.log, f"START PULL dest={args.dest} src={src} host={args.ssh_host}")
        if args.dry_run:
            log_line(args.log, "DRY-RUN no transfer")
            return 0
        pulled = pull_from_remote(src, args.ssh_host, args.dest, args.log)
        local = walk_local(src)
        write_local_manifest(src, local)
        log_line(args.log, f"OK pulled={pulled} local_files={len(local)}")
        return 0

    if not src.is_dir():
        raise SystemExit(f"FAIL local cache missing: {src}")

    log_line(args.log, f"START src={src} dest={args.dest} host={args.ssh_host}")
    local = walk_local(src)
    local_bytes = sum(local.values())
    log_line(args.log, f"LOCAL files={len(local)} bytes={local_bytes}")

    ensure_dest(args.ssh_host, args.dest)
    remote = walk_remote(args.ssh_host, args.dest)
    log_line(args.log, f"REMOTE_BEFORE files={len(remote)}")

    to_send = sorted(
        rel for rel, size in local.items() if remote.get(rel) != size
    )
    skipped = len(local) - len(to_send)
    send_bytes = sum(local[rel] for rel in to_send)
    log_line(
        args.log,
        f"PLAN send_files={len(to_send)} send_bytes={send_bytes} unchanged={skipped}",
    )

    if args.dry_run:
        log_line(args.log, "DRY-RUN no transfer")
        return 0

    if to_send:
        stream_tar(src, to_send, args.ssh_host, args.dest)
        log_line(args.log, f"SENT files={len(to_send)} bytes={send_bytes}")
    else:
        log_line(args.log, "NOOP all files already match by size")

    n, b = remote_stats(args.ssh_host, args.dest)
    log_line(args.log, f"REMOTE_AFTER files={n} bytes={b}")
    if n < len(local):
        log_line(args.log, f"FAIL remote file count {n} < local {len(local)}")
        return 1
    if b < local_bytes:
        # dest may be slightly larger (extras kept); smaller is a miss
        log_line(args.log, f"FAIL remote bytes {b} < local {local_bytes}")
        return 1
    write_local_manifest(src, local)
    write_remote_sidecars(
        args.ssh_host,
        args.dest,
        args.log,
        refresh_pack=not args.no_pack,
    )
    log_line(args.log, "OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
