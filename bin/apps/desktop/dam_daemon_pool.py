# -*- coding: utf-8 -*-
"""Pula watkow daemon o STALEJ liczbie watkow i ograniczonej kolejce (05.10.2026, W11).

Po co: most zaczynal nowy watek na kazde zapytanie, ktore moglo zawisnac na wolnym SMB
(miniatura, stat, sonda litery dysku), po timeoucie porzucal go i watek zyl dalej. Przy
~80 zapytaniach/min i zawieszonym M: most mial po 3 godzinach ~20 000 watkow i 15-20 GB.
Tu liczba watkow jest stala, nadmiar zadan jest odrzucany (queue.Full) albo dolacza do
zadania o tym samym kluczu (run_once), a nie tworzy nowego watku.

Watki sa daemon (nie zatrzymuja wyjscia procesu zawieszonym odczytem; ThreadPoolExecutor
dolacza swoje watki przy wyjsciu - lekcja z doktryny: shutdown(wait=True) wisial).
"""
from __future__ import annotations

import queue
import threading
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any, Callable, Hashable

__all__ = ["DaemonPool", "FutureTimeout"]


class DaemonPool:
    def __init__(self, workers: int, queue_max: int, name: str) -> None:
        self._workers = max(1, int(workers))
        self._q: "queue.Queue[tuple]" = queue.Queue(maxsize=max(1, int(queue_max)))
        self._name = name
        self._started = 0
        self._lock = threading.RLock()
        self._inflight: dict[Hashable, list] = {}  # klucz -> [future, liczba czekajacych]

    # -- rdzen ---------------------------------------------------------------
    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> "Future | None":
        """Future albo None, gdy kolejka pelna (przeciazenie: odmow zamiast nowego watku)."""
        fut: Future = Future()
        try:
            self._q.put_nowait((fut, fn, args, kwargs))
        except queue.Full:
            return None
        with self._lock:
            if self._started < self._workers:
                self._started += 1
                threading.Thread(
                    target=self._loop, daemon=True, name=f"{self._name}-{self._started}"
                ).start()
        return fut

    def _loop(self) -> None:
        while True:
            fut, fn, args, kwargs = self._q.get()
            if not fut.set_running_or_notify_cancel():
                continue
            try:
                fut.set_result(fn(*args, **kwargs))
            except BaseException as exc:  # noqa: BLE001 - wynik trafia do czekajacego
                fut.set_exception(exc)

    # -- uzycie --------------------------------------------------------------
    def call(self, timeout: float, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """fn(*args) z limitem czasu. Rzuca FutureTimeout / queue.Full; zadanie, ktore jeszcze
        nie ruszylo, jest anulowane (nie zajmuje pozniej watku)."""
        fut = self.submit(fn, *args, **kwargs)
        if fut is None:
            raise queue.Full
        try:
            return fut.result(timeout)
        except FutureTimeout:
            fut.cancel()
            raise

    def run_once(self, key: Hashable, timeout: float, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Jedno wykonanie na klucz: rownolegle wywolania dolaczaja do tego samego Future.
        Timeout czekajacego NIE zabija pracy (zdazy sie, zeby nastepne zapytanie trafilo w cache);
        gdy nikt juz nie czeka, a praca jeszcze nie ruszyla - jest anulowana."""
        with self._lock:
            ent = self._inflight.get(key)
            if ent is None:
                fut = self.submit(fn, *args, **kwargs)
                if fut is None:
                    raise queue.Full
                ent = self._inflight[key] = [fut, 0]
                fut.add_done_callback(lambda f, k=key: self._forget(k, f))
            ent[1] += 1
            fut = ent[0]
        timed_out = False
        try:
            return fut.result(timeout)
        except FutureTimeout:
            timed_out = True
            raise
        finally:
            with self._lock:
                ent[1] -= 1
                if timed_out and ent[1] <= 0:
                    fut.cancel()

    def fire_once(self, key: Hashable, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> bool:
        """Bez czekania: uruchom fn, o ile nie leci juz zadanie o tym kluczu i jest miejsce."""
        with self._lock:
            if key in self._inflight:
                return False
            fut = self.submit(fn, *args, **kwargs)
            if fut is None:
                return False
            self._inflight[key] = [fut, 0]
            fut.add_done_callback(lambda f, k=key: self._forget(k, f))
            return True

    def _forget(self, key: Hashable, fut: Future) -> None:
        with self._lock:
            ent = self._inflight.get(key)
            if ent is not None and ent[0] is fut:
                del self._inflight[key]

    def stats(self) -> dict:
        with self._lock:
            return {"workers": self._started, "queued": self._q.qsize(), "inflight": len(self._inflight)}
