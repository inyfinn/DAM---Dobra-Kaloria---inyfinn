"""Wipe PAMIEC-PODRECZNA/thumbs and rebuild from indexed local paths. AVIF q=30 via dam_thumb_cache."""
from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[3] / "apps" / "desktop"
sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402

LOCAL_JSON = Path(__file__).with_name("warm-local-indexed-5.0.191.json")
PROFILES = ["grid", "card"]


def main() -> int:
    local = json.loads(LOCAL_JSON.read_text(encoding="utf-8"))
    paths = [str(x.get("path")) for x in (local.get("paths") or []) if x.get("path")]
    root = tc.cache_root()
    thumbs = root / "thumbs"
    before = 0
    if thumbs.is_dir():
        before = sum(1 for _ in thumbs.glob("*"))
    print(f"[wipe] cache_root={root} thumbs={thumbs} files_before={before}", flush=True)
    if thumbs.is_dir():
        shutil.rmtree(thumbs)
    thumbs.mkdir(parents=True, exist_ok=True)
    after_del = sum(1 for _ in thumbs.glob("*")) if thumbs.is_dir() else -1
    print(f"[wipe] files_after_delete={after_del}", flush=True)

    t0 = time.time()
    queued = 0
    for profile in PROFILES:
        i = 0
        while i < len(paths):
            chunk = paths[i : i + 200]
            res = tc.enqueue_warm(chunk, profile=profile)
            added = int(res.get("queued") or 0)
            queued += added
            i += max(added, 1)
            print(
                f"[enqueue] profile={profile} i={i}/{len(paths)} queued={added} qlen={res.get('queue_len')}",
                flush=True,
            )
            if added == 0:
                break
    print(f"[enqueue] total_queued={queued} paths={len(paths)} profiles={PROFILES}", flush=True)

    last_done = -1
    idle_ok = 0
    while True:
        st = tc.warm_status()
        done = int(st.get("jobs_done") or 0)
        qlen = int(st.get("queue_len") or 0)
        avif_n = sum(1 for p in thumbs.glob("*.avif")) if thumbs.is_dir() else 0
        print(
            f"[drain] qlen={qlen} jobs_done={done} avif={avif_n} idle={st.get('worker_idle_sec')} elapsed={int(time.time()-t0)}s",
            flush=True,
        )
        if qlen == 0 and done >= queued and queued > 0:
            idle_ok += 1
            if idle_ok >= 2:
                break
        else:
            idle_ok = 0
        if qlen == 0 and done == last_done and done > 0:
            idle_ok += 1
            if idle_ok >= 4:
                break
        last_done = done
        time.sleep(8)

    avif_n = sum(1 for p in thumbs.glob("*.avif")) if thumbs.is_dir() else 0
    jpg_n = sum(1 for p in thumbs.glob("*.jpg")) if thumbs.is_dir() else 0
    print(
        f"[done] avif={avif_n} jpg={jpg_n} jobs_done={tc.warm_status().get('jobs_done')} elapsed_s={int(time.time()-t0)} encoder=PIL AVIF quality=30",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
