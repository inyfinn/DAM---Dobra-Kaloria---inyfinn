/* DAM page cache ~1h. Respects ?v= cache-bust (network-first for versioned assets). */
/* eslint-disable no-restricted-globals */
var CACHE = "dam-page-1h-v1";
var MAX_AGE_MS = 60 * 60 * 1000;

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k.indexOf("dam-page-") === 0 && k !== CACHE;
          })
          .map(function (k) {
            return caches.delete(k);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function hasVersionQuery(url) {
  try {
    var u = new URL(url);
    return u.searchParams.has("v") || /[?&]v=/.test(u.search);
  } catch (e) {
    return false;
  }
}

function isCacheableGet(request) {
  if (request.method !== "GET") return false;
  var url = request.url;
  if (url.indexOf("chrome-extension") !== -1) return false;
  if (url.indexOf("/api/") !== -1 || url.indexOf(":8766") !== -1) return false;
  return true;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (!isCacheableGet(request)) return;

  // Versioned JS/CSS (?v=): network-first so active development cache-bust works.
  if (hasVersionQuery(request.url)) {
    event.respondWith(
      fetch(request)
        .then(function (res) {
          return res;
        })
        .catch(function () {
          return caches.match(request);
        })
    );
    return;
  }

  // HTML / static without ?v=: stale-while-revalidate, max 1h in cache meta.
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(request).then(function (cached) {
        var fetchPromise = fetch(request)
          .then(function (res) {
            if (res && res.ok) {
              try {
                var headers = new Headers(res.headers);
                headers.set("x-dam-cached-at", String(Date.now()));
                var copy = res.clone();
                cache.put(
                  request,
                  new Response(copy.body, {
                    status: copy.status,
                    statusText: copy.statusText,
                    headers: headers
                  })
                );
              } catch (e) {
                cache.put(request, res.clone());
              }
            }
            return res;
          })
          .catch(function () {
            return cached || Response.error();
          });

        if (cached) {
          var cachedAt = parseInt(cached.headers.get("x-dam-cached-at") || "0", 10) || 0;
          if (cachedAt && Date.now() - cachedAt < MAX_AGE_MS) {
            return cached;
          }
        }
        return fetchPromise;
      });
    })
  );
});
