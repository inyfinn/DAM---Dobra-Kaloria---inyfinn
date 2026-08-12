# -*- coding: utf-8 -*-
"""Fetch product prices from dobrakaloria.pl into cache (24h TTL)."""
from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
CATALOG_FILE = WEB / "data" / "product-catalog.json"
CACHE_FILE = WEB / "data" / "product-prices-cache.json"
SHOP_BASE = "https://dobrakaloria.pl"
TTL_HOURS = 24


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_price(url: str) -> dict | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DAM-PriceBot/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    m = re.search(r'itemprop="price"\s+content="([0-9.]+)"', html)
    if not m:
        m = re.search(r'"price"\s*:\s*"?([0-9.]+)"?', html)
    if not m:
        return None
    return {"price_pln": float(m.group(1)), "source": "shop"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--product-id", default="")
    args = ap.parse_args()
    catalog = load_json(CATALOG_FILE, {"products": {}})
    cache = load_json(CACHE_FILE, {"version": 1, "products": {}})
    products = cache.setdefault("products", {})
    now = datetime.now(timezone.utc)
    targets = catalog.get("products") or {}
    if args.product_id:
        targets = {args.product_id: targets.get(args.product_id, {})}
    for pid, entry in targets.items():
        if not isinstance(entry, dict):
            continue
        cached = products.get(pid) or {}
        fetched_at = cached.get("fetched_at")
        if fetched_at and not args.refresh:
            try:
                dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
                if dt > now - timedelta(hours=TTL_HOURS):
                    continue
            except ValueError:
                pass
        url = entry.get("shop_url")
        if not url and entry.get("shop_category_slug"):
            url = f"{SHOP_BASE}/szukaj?controller=search&s={pid.replace('-', '+')}"
        if not url:
            continue
        got = fetch_price(url)
        if not got:
            continue
        products[pid] = {
            **got,
            "fetched_at": now.isoformat(),
            "shop_url": url,
        }
    cache["updated_at"] = now.isoformat()
    save_json(CACHE_FILE, cache)
    print(f"Updated {CACHE_FILE} ({len(products)} products)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
