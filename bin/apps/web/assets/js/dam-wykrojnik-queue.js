(function () {
  "use strict";

  var STYLE_ID = "dam-wyk-map-inject";
  var state = {
    registry: null,
    queue: null,
    productLabels: {},
    filter: "",
    tab: "mapped",
    busy: "",
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridge() {
    if (window.DamPaths && typeof DamPaths.bridgeUrl === "function") {
      return DamPaths.bridgeUrl();
    }
    if (window.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    if (window.DamApi && typeof DamApi.authHeaders === "function") {
      return DamApi.authHeaders();
    }
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
    };
  }

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "dam-int-toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  function isPlaceholderKod(kod) {
    return /^row[-_]?\d+$/i.test(String(kod || "").trim());
  }

  function ensureInjectedCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      ".dam-wyk-map.dam-int-card{padding:18px 20px 20px;display:flex;flex-direction:column;gap:14px}" +
      ".dam-wyk-map__title{margin:0;font-size:1.15rem;font-weight:650;letter-spacing:-.01em}" +
      ".dam-wyk-map__purpose{margin:4px 0 0;font-size:13px;line-height:1.4;color:#5c5c6a;max-width:62ch}";
    document.head.appendChild(st);
  }

  async function loadQueue(force) {
    if (state.queue && !force) return state.queue;
    try {
      var r = await fetch(bridge() + "/wykrojnik-mapping-queue", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) {
        state.queue = await r.json();
        return state.queue;
      }
    } catch (eBridge) {
      /* fallback */
    }
    try {
      var r2 = await fetch("data/wykrojnik-mapping-queue.json?v=" + Date.now(), {
        cache: "no-store",
      });
      if (r2.ok) {
        state.queue = await r2.json();
        return state.queue;
      }
    } catch (eFile) {
      /* ignore */
    }
    state.queue = { version: 1, pending: [], resolved: [] };
    return state.queue;
  }

  async function loadRegistry(force) {
    if (state.registry && !force) return state.registry;
    try {
      var r = await fetch(bridge() + "/wykrojniki-registry", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) {
        state.registry = await r.json();
        return state.registry;
      }
    } catch (eBridge) {
      /* fallback */
    }
    try {
      var r2 = await fetch("data/wykrojniki-registry.json?v=" + Date.now(), {
        cache: "no-store",
      });
      if (r2.ok) {
        state.registry = await r2.json();
        return state.registry;
      }
    } catch (eFile) {
      /* ignore */
    }
    state.registry = { entries: {}, entry_count: 0 };
    return state.registry;
  }

  async function loadProductLabels() {
    if (Object.keys(state.productLabels).length) return;
    try {
      var idx;
      if (window.DamFileIndex && typeof window.DamFileIndex.get === "function") {
        /* Wspolne Promise strony (dam-file-index.js). */
        idx = await window.DamFileIndex.get();
      } else {
        var r = await fetch("data/file-index.json?v=" + Date.now(), { cache: "force-cache" });
        if (!r.ok) return;
        idx = await r.json();
      }
      if (!idx) return;
      var map = {};
      (idx.products || []).forEach(function (p) {
        if (!p || !p.id) return;
        map[p.id] = p.display_name || p.name || p.id;
      });
      state.productLabels = map;
    } catch (eIdx) {
      /* optional */
    }
  }

  async function postQueue(payload) {
    var r = await fetch(bridge() + "/wykrojnik-mapping-queue", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    var data = {};
    try {
      data = await r.json();
    } catch (eParse) {
      /* ignore */
    }
    if (!r.ok || data.ok === false) {
      throw new Error(data.error || data.hint || "Zapis nie powiodl sie");
    }
    return data;
  }

  async function postBridge(path, payload) {
    var r = await fetch(bridge() + path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload || {}),
    });
    var data = {};
    try {
      data = await r.json();
    } catch (eParse) {
      /* ignore */
    }
    if (!r.ok || data.ok === false) {
      throw new Error(data.error || data.hint || "Operacja nie powiodla sie");
    }
    return data;
  }

  function registryEntries() {
    var entries = (state.registry && state.registry.entries) || {};
    return Object.keys(entries)
      .map(function (k) {
        var e = entries[k] || {};
        return {
          key: k,
          kod: e.kod || k,
          nazwa: e.nazwa || "",
          section: e.section || "",
          product_index: e.product_index || "",
          linked: e.linked_product_ids || [],
          uwagi: e.uwagi || "",
        };
      })
      .filter(function (e) {
        if (isPlaceholderKod(e.kod) && !e.nazwa) return false;
        return !!(e.kod || e.nazwa);
      });
  }

  function matchesFilter(row) {
    var q = String(state.filter || "")
      .trim()
      .toLowerCase();
    if (!q) return true;
    var linkedTxt = (row.linked || [])
      .map(function (id) {
        return id + " " + (state.productLabels[id] || "");
      })
      .join(" ");
    var blob = [row.kod, row.nazwa, row.section, row.product_index, linkedTxt, row.uwagi]
      .join(" ")
      .toLowerCase();
    return blob.indexOf(q) !== -1;
  }

  function stats() {
    var rows = registryEntries();
    var linked = rows.filter(function (r) {
      return (r.linked || []).length;
    }).length;
    var pending = ((state.queue && state.queue.pending) || []).length;
    return {
      total: rows.length,
      linked: linked,
      open: rows.length - linked,
      pending: pending,
      source: (state.registry && state.registry.source_xlsx) || "",
    };
  }

  function productCell(ids) {
    if (!ids || !ids.length) {
      return '<span class="dam-int-chip dam-int-st dam-int-st--wait dam-wyk-map__badge dam-wyk-map__badge--open">brak powiązania</span>';
    }
    return ids
      .map(function (id) {
        var label = state.productLabels[id] || id;
        return (
          '<div class="dam-wyk-map__prod"><span>' +
          esc(label) +
          '</span><span class="dam-wyk-map__prod-id">' +
          esc(id) +
          "</span></div>"
        );
      })
      .join("");
  }

  function mappedHostId() {
    if (state.tab === "linked") return "damWykMappedLinked";
    if (state.tab === "open") return "damWykMappedOpen";
    return "damWykMappedAll";
  }

  function renderMappedTable(host) {
    if (!host) return;
    var rows = registryEntries().filter(matchesFilter);
    if (state.tab === "linked") {
      rows = rows.filter(function (r) {
        return (r.linked || []).length;
      });
    } else if (state.tab === "open") {
      rows = rows.filter(function (r) {
        return !(r.linked || []).length;
      });
    }
    var st = stats();
    if (!rows.length) {
      var emptyMsg =
        st.total === 0
          ? "Brak wykrojników w rejestrze. Kliknij „Wczytaj z pliku Kubara”, żeby zaimportować XLSX z folderu WYKROJNIKI."
          : state.filter
            ? "Brak wyników dla „" + esc(state.filter) + "”."
            : state.tab === "open"
              ? "Wszystkie wykrojniki z mapowania mają już powiązanie produktu."
              : state.tab === "linked"
                ? "Jeszcze brak powiązań wykrojnik↔produkt. Użyj „Powiąż z produktami” albo dopisz ręcznie poniżej."
                : "Brak wierszy do pokazania.";
      host.innerHTML = '<p class="dam-wyk-map__empty">' + emptyMsg + "</p>";
      return;
    }
    host.innerHTML =
      '<div class="dam-wyk-map__table-wrap"><table class="dam-wyk-map__table"><thead><tr>' +
      "<th>Kod Kubara</th><th>Asortyment / nazwa</th><th>Indeks</th><th>Produkt DAM</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          var has = (r.linked || []).length > 0;
          return (
            '<tr><td class="dam-wyk-map__kod">' +
            esc(r.kod) +
            "</td><td>" +
            esc(r.nazwa || "—") +
            (r.section
              ? '<div class="dam-wyk-map__prod-id">' + esc(r.section) + "</div>"
              : "") +
            "</td><td>" +
            esc(r.product_index || "—") +
            "</td><td>" +
            productCell(r.linked) +
            "</td><td>" +
            (has
              ? '<span class="dam-int-chip dam-int-st dam-int-st--ok dam-wyk-map__badge dam-wyk-map__badge--linked">powiązany</span>'
              : '<span class="dam-int-chip dam-int-st dam-int-st--wait dam-wyk-map__badge dam-wyk-map__badge--open">do uzupełnienia</span>') +
            '</td><td class="dam-wyk-map__row-actions">' +
            '<button type="button" class="dam-int-cta" data-fill-kod="' +
            esc(r.kod) +
            '">Uzupełnij</button>' +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";

    host.querySelectorAll("[data-fill-kod]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kodEl = document.getElementById("damWykrojnikQueueKod");
        if (kodEl) {
          kodEl.value = btn.getAttribute("data-fill-kod") || "";
          kodEl.focus();
        }
      });
    });
  }

  function renderPending(host) {
    if (!host) return;
    var pending = (state.queue && state.queue.pending) || [];
    var st = stats();
    if (!pending.length) {
      host.innerHTML =
        '<p class="dam-wyk-map__empty">' +
        (st.total
          ? "Brak pozycji do zatwierdzenia. Wszystkie wpisy z mapowania Kubara są w rejestrze (" +
            st.total +
            "). Powiązania produktów: " +
            st.linked +
            " / " +
            st.total +
            "."
          : "Kolejka pusta - najpierw wczytaj plik Kubara.") +
        "</p>";
      return;
    }
    host.innerHTML =
      '<p class="dam-wyk-map__hint">Po zatwierdzeniu wpis trafia od razu do rejestru (bez terminala).</p>' +
      '<div class="dam-wyk-map__table-wrap"><table class="dam-wyk-map__table"><thead><tr>' +
      "<th>Kod</th><th>Produkt</th><th>Notatka</th><th></th></tr></thead><tbody>" +
      pending
        .map(function (it) {
          var pid = it.product_id || "";
          return (
            '<tr><td class="dam-wyk-map__kod">' +
            esc(it.wykrojnik_kod || it.kod || "—") +
            "</td><td>" +
            productCell(pid ? [pid] : []) +
            "</td><td>" +
            esc(it.note || "") +
            '</td><td class="dam-wyk-map__row-actions">' +
            '<button type="button" class="dam-int-cta" data-resolve="' +
            esc(it.id) +
            '">Zatwierdz</button>' +
            '<button type="button" class="dam-int-cta" data-remove="' +
            esc(it.id) +
            '">Usun</button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";

    host.querySelectorAll("[data-resolve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        resolveItem(btn.getAttribute("data-resolve"));
      });
    });
    host.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        removeItem(btn.getAttribute("data-remove"));
      });
    });
  }

  function setMsg(text, ok) {
    var el = document.getElementById("damWykrojnikQueueMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-ok", !!ok && !!text);
    el.classList.toggle("is-err", ok === false);
  }

  function setBusy(kind) {
    state.busy = kind || "";
    ["damWykReimportBtn", "damWykLinkBtn", "damWykSaveBtn"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.disabled = !!state.busy;
    });
  }

  function paint() {
    var root = document.getElementById("damWykrojnikQueue");
    if (!root) return;
    root.querySelectorAll("[data-wyk-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-wyk-tab") === state.tab);
    });
    root.querySelectorAll("[data-wyk-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-wyk-panel") !== state.tab;
    });
    renderMappedTable(document.getElementById(mappedHostId()));
    renderPending(document.getElementById("damWykrojnikQueuePending"));
    var st = stats();
    var chipTotal = document.getElementById("damWykChipTotal");
    var chipLinked = document.getElementById("damWykChipLinked");
    var chipOpen = document.getElementById("damWykChipOpen");
    var chipPending = document.getElementById("damWykChipPending");
    if (chipTotal) chipTotal.textContent = st.total + " w rejestrze";
    if (chipLinked) chipLinked.textContent = st.linked + " powiązanych";
    if (chipOpen) chipOpen.textContent = st.open + " bez produktu";
    if (chipPending) {
      chipPending.textContent = st.pending + " do zatwierdzenia";
      chipPending.hidden = st.pending === 0;
    }
    var src = document.getElementById("damWykrojnikSource");
    if (src) {
      src.textContent = st.source
        ? "Źródło: " + st.source
        : "Źródło: brak (wczytaj XLSX Kubara z folderu WYKROJNIKI).";
    }
  }

  function setTab(tab) {
    state.tab = tab || "mapped";
    paint();
  }

  function mountShell(root) {
    root.innerHTML =
      '<article class="dam-int-card dam-wyk-map" data-wyk-map>' +
      '<div class="dam-wyk-map__head">' +
      "<div>" +
      '<h3 class="dam-wyk-map__title">Wykrojniki ↔ produkty</h3>' +
      '<p class="dam-wyk-map__purpose">Pokazuje mapowanie z bazy Kubara (XLSX) i łączy kod wykrojnika z produktem w DAM - bez otwierania terminala.</p>' +
      "</div>" +
      '<div class="dam-wyk-map__stats" aria-live="polite">' +
      '<span class="dam-int-chip dam-int-st dam-int-st--wait dam-wyk-map__chip" id="damWykChipTotal">…</span>' +
      '<span class="dam-int-chip dam-int-st dam-int-st--ok dam-wyk-map__chip dam-wyk-map__chip--ok" id="damWykChipLinked">…</span>' +
      '<span class="dam-int-chip dam-int-st dam-int-st--wait dam-wyk-map__chip dam-wyk-map__chip--warn" id="damWykChipOpen">…</span>' +
      '<span class="dam-int-chip dam-int-st dam-int-st--wait dam-wyk-map__chip dam-wyk-map__chip--warn" id="damWykChipPending" hidden>…</span>' +
      "</div></div>" +
      '<div class="dam-wyk-map__toolbar">' +
      '<input type="search" class="dam-wyk-map__search" id="damWykrojnikSearch" placeholder="Szukaj: kod, asortyment, produkt…" autocomplete="off">' +
      '<button type="button" class="dam-int-cta" id="damWykReimportBtn">Wczytaj z pliku Kubara</button>' +
      '<button type="button" class="dam-int-cta" id="damWykLinkBtn">Powiąż z produktami</button>' +
      "</div>" +
      '<p class="dam-wyk-map__source" id="damWykrojnikSource"></p>' +
      '<p class="dam-wyk-map__msg" id="damWykrojnikQueueMsg" role="status"></p>' +
      '<div class="dam-wyk-map__tabs" role="tablist">' +
      '<button type="button" class="dam-wyk-map__tab is-active" data-wyk-tab="mapped" role="tab">Wszystkie</button>' +
      '<button type="button" class="dam-wyk-map__tab" data-wyk-tab="linked" role="tab">Powiązane</button>' +
      '<button type="button" class="dam-wyk-map__tab" data-wyk-tab="open" role="tab">Bez produktu</button>' +
      '<button type="button" class="dam-wyk-map__tab" data-wyk-tab="pending" role="tab">Do zatwierdzenia</button>' +
      "</div>" +
      '<div class="dam-wyk-map__panel" data-wyk-panel="mapped" role="tabpanel">' +
      '<div id="damWykMappedAll"></div></div>' +
      '<div class="dam-wyk-map__panel" data-wyk-panel="linked" role="tabpanel" hidden>' +
      '<div id="damWykMappedLinked"></div></div>' +
      '<div class="dam-wyk-map__panel" data-wyk-panel="open" role="tabpanel" hidden>' +
      '<div id="damWykMappedOpen"></div></div>' +
      '<div class="dam-wyk-map__panel" data-wyk-panel="pending" role="tabpanel" hidden>' +
      '<div id="damWykrojnikQueuePending"></div></div>' +
      '<form class="dam-wyk-map__form" id="damWykrojnikQueueForm">' +
      "<label>Kod wykrojnika" +
      '<input type="text" id="damWykrojnikQueueKod" placeholder="np. owijka_0003" required>' +
      "</label>" +
      "<label>ID produktu DAM" +
      '<input type="text" id="damWykrojnikQueueProduct" placeholder="np. kielbaska-wegierska-niemiesne" required>' +
      "</label>" +
      "<label>Notatka" +
      '<input type="text" id="damWykrojnikQueueNote" placeholder="opcjonalnie">' +
      "</label>" +
      '<div class="dam-wyk-map__form-actions">' +
      '<button type="submit" class="dam-int-cta" id="damWykSaveBtn">Zapisz powiązanie</button>' +
      "</div></form>" +
      '<p class="dam-wyk-map__hint">Zapis trafia od razu do rejestru wykrojników. Zakładka „Do zatwierdzenia” pokazuje tylko osobne pozycje oczekujące (jeśli są).</p>' +
      "</article>";
  }

  function wire(root) {
    root.querySelectorAll("[data-wyk-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-wyk-tab"));
      });
    });

    var search = document.getElementById("damWykrojnikSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.filter = search.value || "";
        paint();
      });
    }

    var reimportBtn = document.getElementById("damWykReimportBtn");
    if (reimportBtn) {
      reimportBtn.addEventListener("click", function () {
        setBusy("reimport");
        setMsg("Wczytywanie XLSX Kubara…", true);
        postBridge("/wykrojniki/reimport", {})
          .then(function (data) {
            setMsg(
              "Wczytano rejestr: " + (data.entry_count != null ? data.entry_count : "?") + " wpisow.",
              true
            );
            toast("Rejestr wykrojnikow odświeżony");
            return reloadAll();
          })
          .catch(function (err) {
            setMsg(err.message || "Import nie powiodl sie", false);
          })
          .finally(function () {
            setBusy("");
          });
      });
    }

    var linkBtn = document.getElementById("damWykLinkBtn");
    if (linkBtn) {
      linkBtn.addEventListener("click", function () {
        setBusy("link");
        setMsg("Laczenie z produktami DAM…", true);
        postBridge("/wykrojniki/link-products", {})
          .then(function (data) {
            var ls = data.link_stats || {};
            setMsg(
              "Powiazano: " +
                (ls.linked_entries != null ? ls.linked_entries : "?") +
                " / " +
                (ls.total_entries != null ? ls.total_entries : "?") +
                " wpisow.",
              true
            );
            toast("Powiazania zaktualizowane");
            return reloadAll();
          })
          .catch(function (err) {
            setMsg(err.message || "Powiazanie nie powiodlo sie", false);
          })
          .finally(function () {
            setBusy("");
          });
      });
    }

    var form = document.getElementById("damWykrojnikQueueForm");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var kod = ((document.getElementById("damWykrojnikQueueKod") || {}).value || "").trim();
        var pid = ((document.getElementById("damWykrojnikQueueProduct") || {}).value || "").trim();
        if (!kod || !pid) return;
        setBusy("save");
        postBridge("/wykrojniki/set-link", { action: "set", kod: kod, product_id: pid })
          .then(function () {
            form.reset();
            toast("Powiazanie zapisane");
            setMsg("Zapisano powiazanie " + kod + " → " + pid, true);
            return reloadAll();
          })
          .catch(function (err) {
            setMsg(err.message || "Blad zapisu", false);
          })
          .finally(function () {
            setBusy("");
          });
      });
    }
  }

  async function resolveItem(id) {
    if (!id) return;
    try {
      await postQueue({ action: "resolve", id: id });
      toast("Zatwierdzono");
      await reloadAll();
    } catch (err) {
      setMsg(err.message || "Blad zatwierdzenia", false);
    }
  }

  async function removeItem(id) {
    if (!id) return;
    try {
      await postQueue({ action: "remove", id: id });
      toast("Usunieto z kolejki");
      await reloadAll();
    } catch (err) {
      setMsg(err.message || "Blad usuwania", false);
    }
  }

  async function reloadAll() {
    await Promise.all([loadRegistry(true), loadQueue(true)]);
    paint();
  }

  async function boot() {
    var root = document.getElementById("damWykrojnikQueue");
    if (!root) return;
    ensureInjectedCss();
    mountShell(root);
    wire(root);
    setMsg("Ladowanie…", true);
    await Promise.all([loadRegistry(true), loadQueue(true), loadProductLabels()]);
    setTab("mapped");
    setMsg("", true);
  }

  window.DamWykrojnikQueue = {
    boot: boot,
    reload: reloadAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
