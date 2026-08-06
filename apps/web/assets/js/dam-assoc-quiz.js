/**
 * DamAssocQuiz — Branding admin: kolejka pending skojarzen (lewo material, prawo DamSearch).
 * Przycisk widoczny TYLKO przy roli admin + wlaczonym trybie Admin.
 * Dirty-close: DamModalShared.confirmUnsavedClose.
 */
(function (global) {
  "use strict";

  var STATE = {
    items: [],
    idx: 0,
    selected: [],
    lastProductIds: [],
    dirty: false,
    open: false,
    source: "sqlite",
  };

  function bridge() {
    return (
      (global.DamApi && DamApi.bridgeBase && DamApi.bridgeBase()) ||
      "http://127.0.0.1:8766"
    );
  }

  function authHeaders() {
    if (global.DamApi && DamApi.authHeaders) return DamApi.authHeaders();
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
    };
  }

  function isAdminRole() {
    var role =
      (global.DamApi && typeof DamApi.role === "function" && DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function isAdminMode() {
    return isAdminRole() && localStorage.getItem("dam_admin_mode") === "1";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentItem() {
    return STATE.items[STATE.idx] || null;
  }

  function thumbUrl(item) {
    if (!item) return "";
    var path = item.path || "";
    if (!path) return "";
    return bridge() + "/thumb?path=" + encodeURIComponent(path) + "&w=480";
  }

  function assetHasLinks(a) {
    var links = (a && a.linked_product_ids) || [];
    return Array.isArray(links) && links.length > 0;
  }

  function isGraphicAsset(a) {
    if (!a) return false;
    var mt = String(a.media_type || "").toLowerCase();
    if (mt === "image" || mt === "raster" || mt === "vector") return true;
    var nm = String(a.name || a.path || "").toLowerCase();
    return /\.(png|jpe?g|webp|gif|svg)$/.test(nm);
  }

  /** Gdy SQLite nie ma pending — kandydaci z siatki Branding bez skojarzen. */
  function fallbackQueueFromGrid() {
    var idx =
      global.__damBrandingGridIndex ||
      global.__damBrandingIndex ||
      null;
    var assets = (idx && idx.assets) || [];
    var out = [];
    var seen = {};
    for (var i = 0; i < assets.length && out.length < 40; i++) {
      var a = assets[i];
      if (!a || !a.id || seen[a.id]) continue;
      if (!isGraphicAsset(a)) continue;
      if (assetHasLinks(a)) continue;
      seen[a.id] = 1;
      out.push({
        asset_id: a.id,
        name: a.name || a.id,
        path: a.path || "",
        suggestions: [],
        source: "grid_fallback",
      });
    }
    return out;
  }

  async function loadQueue() {
    STATE.source = "sqlite";
    try {
      var r = await fetch(bridge() + "/assoc/queue", { headers: authHeaders() });
      var j = await r.json();
      STATE.items = (j && j.items) || [];
    } catch (e) {
      STATE.items = [];
    }
    if (!STATE.items.length) {
      STATE.items = fallbackQueueFromGrid();
      STATE.source = STATE.items.length ? "grid_fallback" : "empty";
    }
    STATE.idx = 0;
    STATE.selected = [];
    STATE.dirty = false;
    return STATE.items;
  }

  async function decide(action, productIds) {
    var item = currentItem();
    if (!item) return;
    if (STATE.source === "grid_fallback" && action !== "confirm") {
      STATE.items.splice(STATE.idx, 1);
      if (STATE.idx >= STATE.items.length) STATE.idx = Math.max(0, STATE.items.length - 1);
      STATE.selected = [];
      STATE.dirty = false;
      renderBody();
      return;
    }
    if (STATE.source === "grid_fallback" && action === "confirm") {
      /* Brak wiersza pending w SQLite — zapis przez decide i tak wstawia confirmed. */
    }
    var body = {
      asset_id: item.asset_id,
      action: action,
      product_ids: productIds || STATE.selected.slice(),
      user: "quiz",
    };
    var r = await fetch(bridge() + "/assoc/decide", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    var j = await r.json();
    if (!j || !j.ok) throw new Error((j && j.error) || "decide_failed");
    if (action === "confirm" && body.product_ids.length) {
      STATE.lastProductIds = body.product_ids.slice();
    }
    STATE.items.splice(STATE.idx, 1);
    if (STATE.idx >= STATE.items.length) STATE.idx = Math.max(0, STATE.items.length - 1);
    STATE.selected = [];
    STATE.dirty = false;
    renderBody();
  }

  function requestClose() {
    if (!STATE.open) return;
    var doClose = function () {
      var el = document.getElementById("damAssocQuiz");
      if (el) el.remove();
      STATE.open = false;
      STATE.dirty = false;
    };
    if (!STATE.dirty) {
      doClose();
      return;
    }
    if (
      global.DamModalShared &&
      typeof global.DamModalShared.confirmUnsavedClose === "function"
    ) {
      global.DamModalShared.confirmUnsavedClose({
        onDiscard: doClose,
        onSave: function () {
          decide("confirm", STATE.selected).then(doClose).catch(function () {});
        },
      });
      return;
    }
    if (global.confirm("Odrzucic niezapisane zmiany?")) doClose();
  }

  function bindSearch(root) {
    var input = root.querySelector("#damAssocQuizSearch");
    var results = root.querySelector("#damAssocQuizResults");
    if (!input || !results) return;
    var t = null;
    function run() {
      var q = String(input.value || "").trim();
      results.innerHTML = "";
      if (q.length < 2) {
        results.innerHTML = '<p class="dam-assoc-quiz__hint">Wpisz min. 2 znaki (np. kulki, baton, indeks)…</p>';
        return;
      }
      var searchFn = global.DamSearch && global.DamSearch.search;
      if (!searchFn) {
        results.innerHTML = '<p class="dam-assoc-quiz__hint">DamSearch niedostepny — odswiez Branding po zaladowaniu indeksu.</p>';
        return;
      }
      Promise.resolve(searchFn(q, { limit: 24 }))
        .then(function (hits) {
          hits = hits || [];
          if (!hits.length) {
            results.innerHTML = '<p class="dam-assoc-quiz__hint">Brak wynikow</p>';
            return;
          }
          results.innerHTML = hits
            .map(function (h) {
              var id = h.id || h.product_id || "";
              var name = h.display_name || h.name || id;
              var on = STATE.selected.indexOf(id) >= 0 ? " is-on" : "";
              return (
                '<button type="button" class="dam-assoc-quiz__hit' +
                on +
                '" data-pid="' +
                esc(id) +
                '"><span class="dam-assoc-quiz__hit-name">' +
                esc(name) +
                '</span><span class="dam-assoc-quiz__hit-id">' +
                esc(id) +
                "</span></button>"
              );
            })
            .join("");
          results.querySelectorAll("[data-pid]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var pid = btn.getAttribute("data-pid");
              var i = STATE.selected.indexOf(pid);
              if (i >= 0) STATE.selected.splice(i, 1);
              else STATE.selected.push(pid);
              STATE.dirty = true;
              btn.classList.toggle("is-on");
              renderSelected(root);
            });
          });
        })
        .catch(function () {
          results.innerHTML = '<p class="dam-assoc-quiz__hint">Blad wyszukiwania</p>';
        });
    }
    input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(run, 180);
    });
  }

  function renderSelected(root) {
    var box = root.querySelector("#damAssocQuizSelected");
    if (!box) return;
    if (!STATE.selected.length) {
      box.innerHTML = '<span class="dam-assoc-quiz__hint">Brak wybranych produktow</span>';
      return;
    }
    box.innerHTML = STATE.selected
      .map(function (pid) {
        return (
          '<span class="dam-assoc-quiz__chip">' +
          esc(pid) +
          ' <button type="button" data-rm="' +
          esc(pid) +
          '" aria-label="Usun">×</button></span>'
        );
      })
      .join("");
    box.querySelectorAll("[data-rm]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pid = btn.getAttribute("data-rm");
        STATE.selected = STATE.selected.filter(function (x) {
          return x !== pid;
        });
        STATE.dirty = true;
        renderSelected(root);
        var hit = root.querySelector('.damAssocQuiz__hit[data-pid="' + pid + '"]');
        if (hit) hit.classList.remove("is-on");
        var hit2 = root.querySelector('.dam-assoc-quiz__hit[data-pid="' + pid + '"]');
        if (hit2) hit2.classList.remove("is-on");
      });
    });
  }

  function emptyStateHtml() {
    return (
      '<div class="dam-assoc-quiz__empty">' +
      "<p><strong>Brak materialow do potwierdzenia.</strong></p>" +
      "<p>Quiz laczy grafike brandingowa z produktem. Kolejka bierze sie z pending w bazie " +
      "(asset_product_links) albo z kart Branding bez skojarzen.</p>" +
      "<p>Teraz: brak pending i brak wolnych grafik w zaladowanej siatce. " +
      "Zaladuj Branding (Ctrl+F5), wlacz „Tylko grafiki”, albo uruchom skan skojarzen.</p>" +
      "</div>"
    );
  }

  function renderBody() {
    var root = document.getElementById("damAssocQuiz");
    if (!root) return;
    var item = currentItem();
    var left = root.querySelector("#damAssocQuizLeft");
    var meta = root.querySelector("#damAssocQuizMeta");
    var sug = root.querySelector("#damAssocQuizSuggestions");
    var counter = root.querySelector("#damAssocQuizCounter");
    var banner = root.querySelector("#damAssocQuizBanner");
    if (counter) {
      counter.textContent = STATE.items.length
        ? STATE.idx + 1 + " / " + STATE.items.length
        : "0";
    }
    if (banner) {
      if (STATE.source === "grid_fallback") {
        banner.hidden = false;
        banner.textContent =
          "Brak pending w bazie — pokazuję grafiki Branding bez skojarzeń. Wyszukaj produkt po prawej i zatwierdź.";
      } else if (STATE.source === "sqlite" && STATE.items.length) {
        banner.hidden = false;
        banner.textContent =
          "Kolejka pending z bazy. Po lewej materiał, po prawej produkt — kliknij sugestię albo wyszukaj.";
      } else {
        banner.hidden = true;
        banner.textContent = "";
      }
    }
    if (!item) {
      if (left) left.innerHTML = emptyStateHtml();
      if (meta) meta.textContent = "";
      if (sug) sug.innerHTML = "";
      STATE.selected = [];
      renderSelected(root);
      return;
    }
    if (left) {
      left.innerHTML =
        '<img class="dam-assoc-quiz__thumb" src="' +
        esc(thumbUrl(item)) +
        '" alt="' +
        esc(item.name || "") +
        '" loading="lazy" />' +
        '<div class="dam-assoc-quiz__file"><strong>' +
        esc(item.name || item.asset_id) +
        "</strong><small>" +
        esc(item.path || "") +
        "</small></div>";
    }
    if (meta) meta.textContent = item.asset_id || "";
    var suggestions = item.suggestions || [];
    if (sug) {
      sug.innerHTML = suggestions.length
        ? '<p class="dam-assoc-quiz__label">Propozycje skojarzen</p>' +
          suggestions
            .map(function (s) {
              var pid = s.product_id || s.id || "";
              var on = STATE.selected.indexOf(pid) >= 0 ? " is-on" : "";
              return (
                '<button type="button" class="dam-assoc-quiz__sug' +
                on +
                '" data-pid="' +
                esc(pid) +
                '">' +
                esc(pid) +
                " <em>" +
                esc(String(s.score != null ? Math.round(s.score) : "")) +
                "</em></button>"
              );
            })
            .join("")
        : '<span class="dam-assoc-quiz__hint">Brak automatycznych sugestii — wyszukaj produkt po prawej (min. 2 znaki).</span>';
      sug.querySelectorAll("[data-pid]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var pid = btn.getAttribute("data-pid");
          var i = STATE.selected.indexOf(pid);
          if (i >= 0) STATE.selected.splice(i, 1);
          else STATE.selected.push(pid);
          STATE.dirty = true;
          btn.classList.toggle("is-on");
          renderSelected(root);
        });
      });
    }
    renderSelected(root);
  }

  function mountShell() {
    var existing = document.getElementById("damAssocQuiz");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = "damAssocQuiz";
    el.className = "dam-assoc-quiz";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Quiz skojarzen");
    el.innerHTML =
      '<div class="dam-assoc-quiz__panel">' +
      '<header class="dam-assoc-quiz__head">' +
      "<div><h2>Quiz skojarzen</h2>" +
      '<p class="dam-assoc-quiz__sub">Polacz grafike z produktem (tylko admin)</p></div>' +
      '<div class="dam-assoc-quiz__head-right">' +
      '<span id="damAssocQuizCounter" class="dam-assoc-quiz__counter">0</span>' +
      '<button type="button" class="geex-btn geex-btn--light" id="damAssocQuizClose" aria-label="Zamknij">Zamknij</button>' +
      "</div></header>" +
      '<p id="damAssocQuizBanner" class="dam-assoc-quiz__banner" hidden></p>' +
      '<div class="dam-assoc-quiz__grid">' +
      '<section class="dam-assoc-quiz__col dam-assoc-quiz__col--left" id="damAssocQuizLeft"></section>' +
      '<section class="dam-assoc-quiz__col dam-assoc-quiz__col--right">' +
      '<p id="damAssocQuizMeta" class="dam-assoc-quiz__meta"></p>' +
      '<div id="damAssocQuizSuggestions" class="dam-assoc-quiz__sugs"></div>' +
      '<label class="dam-assoc-quiz__label" for="damAssocQuizSearch">Szukaj produktu</label>' +
      '<input id="damAssocQuizSearch" class="dam-assoc-quiz__input" type="search" autocomplete="off" placeholder="Np. kulki malina, baton, 6300…" />' +
      '<div id="damAssocQuizResults" class="dam-assoc-quiz__results"></div>' +
      '<div id="damAssocQuizSelected" class="dam-assoc-quiz__selected"></div>' +
      "</section></div>" +
      '<footer class="dam-assoc-quiz__foot">' +
      '<button type="button" class="geex-btn geex-btn--light" id="damAssocQuizClear">Wyczysc</button>' +
      '<button type="button" class="geex-btn geex-btn--light" id="damAssocQuizSame">Jak poprzednio</button>' +
      '<button type="button" class="geex-btn geex-btn--light" id="damAssocQuizSkip">Pomin</button>' +
      '<button type="button" class="geex-btn geex-btn--primary" id="damAssocQuizConfirm">Zatwierdz</button>' +
      "</footer></div>";
    document.body.appendChild(el);
    STATE.open = true;
    el.querySelector("#damAssocQuizClose").addEventListener("click", requestClose);
    el.querySelector("#damAssocQuizClear").addEventListener("click", function () {
      STATE.selected = [];
      STATE.dirty = true;
      renderBody();
    });
    el.querySelector("#damAssocQuizSame").addEventListener("click", function () {
      STATE.selected = STATE.lastProductIds.slice();
      STATE.dirty = true;
      renderBody();
    });
    el.querySelector("#damAssocQuizSkip").addEventListener("click", function () {
      decide("skip").catch(function (e) {
        console.warn("quiz skip", e);
      });
    });
    el.querySelector("#damAssocQuizConfirm").addEventListener("click", function () {
      if (!STATE.selected.length) {
        global.alert("Wybierz przynajmniej jeden produkt.");
        return;
      }
      decide("confirm", STATE.selected).catch(function (e) {
        console.warn("quiz confirm", e);
        global.alert("Nie udalo sie zapisac: " + (e && e.message));
      });
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        requestClose();
      }
    });
    bindSearch(el);
    renderBody();
  }

  async function open() {
    if (!isAdminMode()) {
      global.alert("Quiz skojarzen jest tylko dla admina (wlacz przelacznik Admin).");
      syncEntryVisibility();
      return;
    }
    await loadQueue();
    mountShell();
  }

  function removeEntryButton() {
    var btn = document.getElementById("damAssocQuizOpen");
    if (btn) btn.remove();
  }

  function ensureEntryButton() {
    if (!isAdminMode()) {
      removeEntryButton();
      return;
    }
    if (document.getElementById("damAssocQuizOpen")) return;
    var host =
      document.querySelector(".dam-branding-toolbar") ||
      document.querySelector(".dam-hub-toolbar") ||
      document.querySelector("main .geex-content__header") ||
      document.querySelector("main");
    if (!host) return;
    var btn = document.createElement("button");
    btn.id = "damAssocQuizOpen";
    btn.type = "button";
    btn.className = "geex-btn geex-btn--primary dam-assoc-quiz-entry";
    btn.textContent = "Quiz skojarzen";
    btn.setAttribute("title", "Tylko admin: potwierdz skojarzenia grafiki z produktem");
    btn.addEventListener("click", function () {
      open().catch(function (e) {
        console.warn(e);
        global.alert("Nie udalo sie otworzyc quizu.");
      });
    });
    host.appendChild(btn);
  }

  function syncEntryVisibility() {
    if (isAdminMode()) ensureEntryButton();
    else removeEntryButton();
  }

  function boot() {
    syncEntryVisibility();
    global.addEventListener("storage", function (e) {
      if (e.key === "dam_admin_mode" || e.key === "dam_role") syncEntryVisibility();
    });
    global.addEventListener("dam:admin-mode", syncEntryVisibility);
    setTimeout(syncEntryVisibility, 400);
    setTimeout(syncEntryVisibility, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.DamAssocQuiz = {
    open: open,
    loadQueue: loadQueue,
    isAdminMode: isAdminMode,
    syncEntryVisibility: syncEntryVisibility,
  };
})(window);
