# -*- coding: utf-8 -*-
"""Kolejka zapisow SQLite per uzytkownik (FIFO w obrebie konta)."""
from __future__ import annotations

import threading
from collections import defaultdict
from contextlib import contextmanager
from typing import Iterator

_LOCKS: defaultdict[str, threading.Lock] = defaultdict(threading.Lock)


def _key(email: str) -> str:
    e = (email or "").strip().lower()
    return e if e else "_anonymous_"


@contextmanager
def user_db_lock(email: str = "") -> Iterator[None]:
    """Jeden strumien zapisow na konto — bez rownych race na SQLite."""
    lock = _LOCKS[_key(email)]
    lock.acquire()
    try:
        yield
    finally:
        lock.release()
