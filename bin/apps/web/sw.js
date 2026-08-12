/* DAM service worker - SELF-DESTRUCT (decyzja usera 2026-07-22).
 * Cache przegladarki wylaczony calkowicie: brak przechwytywania fetch,
 * kasujemy wszystkie cache i wyrejestrowujemy SW. Kazda strona laduje sie z sieci.
 * Aby wrocic do cache: przywroc poprzednia wersje z gita.
 * Uwaga: brak markera "dam-page-1h-v4", wiec dam-tutorial.js NIE zarejestruje SW ponownie. */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: "window" });
      })
      .then(function (clients) {
        clients.forEach(function (client) {
          try {
            client.navigate(client.url);
          } catch (e) {
            /* ignore */
          }
        });
      })
      .catch(function () {
        /* ignore */
      })
  );
});

/* Brak handlera "fetch" = przegladarka idzie prosto do sieci (network default). */
