/**
 * DAM ETA - Visualizations gallery v4
 * Grupy po product_id, badge Multijezyczny, modal podgladu, Synology share.
 * Wymaga: dam-brand-filter.js zaladowanego PRZED tym plikiem.
 */
(function () {
  "use strict";

  var all = [];
  var filtered = [];
  var langLabels = {};
  var brandFilter = { DK: true, GC: true };
  var synologyEnabled = true;
  var showAll = false;
  var indexData = null;
  var SHOW_ALL_KEY = "dam_viz_show_all";
  var LATEST_KEY_LEGACY = "dam_viz_latest_only";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">' +
        '<rect fill="#f4f4f6" width="320" height="200"/>' +
        '<text x="160" y="108" text-anchor="middle" fill="#AB54DB" font-family="sans-serif" font-size="14">Brak miniatury</text>' +
      "</svg>"
    );

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function labelForLang(code) {
    if (!code) return "";
    return langLabels[code] || String(code).toUpperCase();
  }

  function carrierHuman(carrier, item) {
    if (item && item.carrier_label) return item.carrier_label;
    if (!carrier || /^(OTHER|UNKNOWN|WARIANT)$/i.test(String(carrier))) return "";
    // Usun daty / indeksy z etykiety prezentacyjnej (nie: BATON (20.09.2024))
    var clean = String(carrier)
      .replace(/\s*\(?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\)?/g, "")
      .replace(/\s*\d{6,7}(?:\.\d{2})?\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^(OTHER|UNKNOWN|WARIANT)$/i.test(clean)) return "";
    if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
      var code = window.DamLabels.parseCarrierCode
        ? window.DamLabels.parseCarrierCode(clean || carrier)
        : clean;
      if (code === "UNKNOWN" && /^[A-Z0-9\-]+$/i.test(clean)) {
        code = window.DamLabels.matchCarrierInText
          ? window.DamLabels.matchCarrierInText(clean) || clean.toUpperCase()
          : clean.toUpperCase();
      }
      var label = window.DamLabels.carrierLabel(code, clean, {
        isMix: item && (item.is_mix || item.mix),
        productName: item && item.product_name,
        tags: item && item.tags,
      });
      if (label && label !== code && !/^(OTHER|UNKNOWN|WARIANT)$/i.test(label)) return label;
    }
    clean = clean.replace(/\s*\((?:BAR|BAT|FOIL|DOYPACK|MINI)\)\s*$/i, "").trim();
    if (/^(OTHER|UNKNOWN|WARIANT)$/i.test(clean)) return "";
    return clean || "";
  }

  function showToast(msg) {
    var el = document.getElementById("damVizToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damVizToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Group items by product_id                                           */
  /* ------------------------------------------------------------------ */

  function groupByProduct(items) {
    var map = {};
    var order = [];
    items.forEach(function (v) {
      var pid = v.product_id || v.index_base || v.index || v.product_name || "_";
      if (!map[pid]) {
        map[pid] = { pid: pid, items: [] };
        order.push(pid);
      }
      map[pid].items.push(v);
    });
    return order.map(function (pid) { return map[pid]; });
  }

  /* ------------------------------------------------------------------ */
  /* Populuj filtr jezykow                                                */
  /* ------------------------------------------------------------------ */

  /** OFF (domyslnie) = tylko aktualne; ON = wszystkie (stare, nieaktualne, demo). */
  function readShowAll() {
    var stored = localStorage.getItem(SHOW_ALL_KEY);
    if (stored !== null && stored !== undefined && stored !== "") {
      return stored === "1" || stored === "true";
    }
    /* migracja ze starego "Tylko najnowsze" (odwrocona logika) */
    var legacy = localStorage.getItem(LATEST_KEY_LEGACY);
    if (legacy !== null && legacy !== undefined && legacy !== "") {
      return legacy === "0" || legacy === "false";
    }
    return false;
  }

  function isRealIndex(base) {
    var s = String(base || "").trim();
    if (!s) return false;
    var low = s.toLowerCase();
    if (low === "noid" || low === "pending" || low === "unknown") return false;
    if (/x/i.test(s)) return false;
    return /^\d{5,9}(?:\.\d{2})?$/.test(s);
  }

  /** Indeks z pola, folderu lub sciezki - nigdy "noid" w UI. */
  function resolveIndexBase(row) {
    if (!row) return "";
    var candidates = [
      row.index_base,
      row.index && String(row.index).split(".")[0],
      row.revision_folder,
      row.folder,
      row.path,
      row.file,
      row.rel,
    ];
    var extract =
      window.DamLabels && typeof window.DamLabels.extractIndexFromString === "function"
        ? window.DamLabels.extractIndexFromString
        : null;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      if (isRealIndex(c)) return String(c).split(".")[0];
      if (extract) {
        var got = extract(String(c));
        if (got) return String(got).split(".")[0];
      }
      var plain = String(c).match(/(\d{6,8})/g);
      if (plain && plain.length) {
        var pick = plain[plain.length - 1];
        if (isRealIndex(pick)) return pick;
      }
    }
    return "";
  }

  function displayIndex(row) {
    var base = resolveIndexBase(row);
    return base || "";
  }

  function thumbStem(pid, indexBase, lang) {
    var p = String(pid || "p").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96).toLowerCase();
    var raw = isRealIndex(indexBase) ? String(indexBase) : "pending";
    var base = raw.replace(/[^0-9A-Za-z]+/g, "") || "pending";
    var lg = String(lang || "xx").toLowerCase().replace(/[^a-z0-9]+/g, "") || "xx";
    return "data/thumbs/" + p + "__" + base + "_" + lg + ".jpg";
  }

  function firstWizkiPath(rev) {
    var wizki = rev && rev.wizki ? rev.wizki : [];
    for (var i = 0; i < wizki.length; i++) {
      var f = wizki[i];
      var ext = String((f && f.ext) || "").toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].indexOf(ext) !== -1) {
        return f.path || f.rel || "";
      }
    }
    return (wizki[0] && (wizki[0].path || wizki[0].rel)) || (rev && rev.path) || "";
  }

  function normalizeVizRow(v) {
    if (!v) return v;
    var base = resolveIndexBase(v);
    if (base) {
      v.index_base = base;
      if (!v.index || String(v.index).toLowerCase().indexOf("noid") !== -1) {
        v.index = base + ".00";
      }
      if (v.thumb_url && String(v.thumb_url).indexOf("__noid_") !== -1) {
        v.thumb_url = thumbStem(v.product_id, base, v.lang || "pl");
      }
    } else if (v.index_base && !isRealIndex(v.index_base)) {
      v.index_base = "";
    }
    return v;
  }

  function expandVizFromProducts(data, onlyLatest) {
    if (onlyLatest) {
      return (data.viz_latest || []).map(function (v) {
        return normalizeVizRow(Object.assign({}, v));
      });
    }
    if (data.viz_all && data.viz_all.length) {
      return data.viz_all.map(function (v) {
        return normalizeVizRow(Object.assign({}, v));
      });
    }

    var labels = data.lang_labels || langLabels || {};
    var out = [];
    (data.products || []).forEach(function (p) {
      var brand = p.brand || "DK";
      var defaultLang = brand === "DK" ? "pl" : "gb";
      var pid = p.id || "p";
      var name = p.display_name || p.name || pid;
      (p.revisions || []).forEach(function (r) {
        var wizki = r.wizki || [];
        var hasViz = wizki.length > 0 || r.wizki_count > 0;
        /* Faza 5/P2: "Pokaz wszystko" (showAll=true, onlyLatest=false) odslania
           TEZ rewizje bez wizki - plik/folder istnieje, ale brak wizualizacji.
           Domyslnie (onlyLatest=true) - jak dawniej, calkowicie pominiete. */
        if (!hasViz && onlyLatest) return;
        var langs = (r.langs && r.langs.length) ? r.langs.slice() : [defaultLang];
        var indexBase = resolveIndexBase({
          index_base: r.index_base,
          index: r.index,
          revision_folder: r.folder,
          folder: r.folder,
          path: r.path || firstWizkiPath(r),
          file: (r.wizki && r.wizki[0] && r.wizki[0].name) || "",
        });
        langs.forEach(function (lang) {
          out.push({
            product_id: pid,
            product_name: name,
            category: p.category,
            brand: brand,
            carrier: r.carrier,
            carrier_guessed: !!r.carrier_guessed,
            subcategory_slug: p.subcategory_slug,
            subcategory_label: p.subcategory_label,
            linked_products: p.linked_products,
            alias_langs: p.alias_langs,
            index: r.index || (indexBase ? indexBase + ".00" : ""),
            index_base: indexBase,
            revision_folder: r.folder,
            revision_path: r.path,
            langs: langs,
            lang: lang,
            lang_label: labels[lang] || String(lang).toUpperCase(),
            path: hasViz ? (firstWizkiPath(r) || r.path || "") : (r.path || ""),
            thumb_url: hasViz ? thumbStem(pid, indexBase, lang) : "",
            has_viz: hasViz,
            is_latest: !!r.is_latest,
            tags: p.tags || []
          });
        });
      });
    });
    return out.length ? out : (data.viz_latest || []).slice();
  }

  function rebuildAllFromIndex() {
    if (!indexData) return;
    /* showAll OFF => tylko najnowsze/aktualne; ON => wszystkie rewizje */
    all = expandVizFromProducts(indexData, !showAll);
    if (Array.isArray(vizFlags.manual)) {
      vizFlags.manual.forEach(function (m) {
        if (m && m.path) all.push(m);
      });
    }
    populateLangFilter(all);
  }

  function populateLangFilter(items) {
    var sel = document.getElementById("vizLangFilter");
    if (!sel) return;
    var codes = {};
    items.forEach(function (v) {
      if (v.lang) codes[v.lang] = labelForLang(v.lang);
    });
    var sorted = Object.keys(codes).sort(function (a, b) {
      return codes[a].localeCompare(codes[b], "pl");
    });
    var html = '<option value="">Wszystkie jezyki</option>';
    sorted.forEach(function (code) {
      html += '<option value="' + esc(code) + '">' + esc(codes[code]) + "</option>";
    });
    sel.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /* Render modal podgladu                                                */
  /* ------------------------------------------------------------------ */

  /** Unikalne warianty w modalu: klucz = indeks + jezyk (nie powielaj tego samego). */
  /**
   * Faza 5 / P9: pasek wariantow w modalu pokazuje WSZYSTKIE powiazane warianty,
   * w tym z aliasowanego produktu DK/GC (product-aliases.json - patrz build-file-index.py
   * apply_product_aliases). "linked_products" jest juz na kazdym viz_latest wierszu.
   */
  function withAliasItems(items) {
    var first = items && items[0];
    var linked = (first && first.linked_products) || [];
    if (!linked.length) return items;
    var linkedIds = {};
    linked.forEach(function (l) {
      if (l && l.product_id) linkedIds[l.product_id] = true;
    });
    var extra = all.filter(function (v) {
      return v.product_id && linkedIds[v.product_id] && v.product_id !== first.product_id;
    });
    return extra.length ? items.concat(extra) : items;
  }

  function uniqueModalVariants(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (v) {
      var key = [v.index_base || v.index || "", v.lang || "", v.thumb_url || v.path || ""].join("|");
      if (seen[key]) return;
      seen[key] = true;
      out.push(v);
    });
    return out;
  }

  /**
   * Podpis chipa wariantu w modalu: ZAWSZE skrot jezyka + indeks (nie pelna
   * nazwa jak "Wielka Brytania" - 2026-07-18). Pelna nazwa + sciezka -> tooltip,
   * patrz variantChipTip().
   */
  function variantChipLabel(v, ctx) {
    var short = (window.DamLabels && typeof window.DamLabels.langShort === "function"
      ? window.DamLabels.langShort(v.lang)
      : String(v.lang || "").toUpperCase()) || "";
    var idx = displayIndex(v);
    if (short && idx) return short + " · " + idx;
    return short || idx || "Aktualna";
  }

  /** Pelny tooltip chipa wariantu: pelna nazwa jezyka + sciezka folderu. */
  function variantChipTip(v) {
    var langFull = v.lang_label || labelForLang(v.lang) || "";
    var parts = [];
    if (langFull) parts.push(langFull);
    if (v.revision_folder) parts.push(v.revision_folder);
    if (v.path) parts.push(v.path);
    return parts.join(" · ");
  }

  function mediaPreviewUrl(indexPath) {
    if (!indexPath) return "";
    var local =
      window.DamPaths && typeof window.DamPaths.toLocal === "function"
        ? window.DamPaths.toLocal(indexPath)
        : indexPath;
    var bridge =
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766";
    return bridge + "/media?path=" + encodeURIComponent(local);
  }

  var THUMB_OVERRIDES_KEY = "dam_thumb_overrides";
  var ADMIN_KEY = "dam_admin_mode";
  var VIZ_FLAGS_KEY = "dam_viz_flags";
  var vizFlags = { demo: {}, hidden: {}, manual: [] };

  function isAdminRole() {
    var role =
      (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function isAdminMode() {
    return isAdminRole() && localStorage.getItem(ADMIN_KEY) === "1";
  }

  function bridgeBase() {
    return (
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function loadVizFlags() {
    try {
      var local = JSON.parse(localStorage.getItem(VIZ_FLAGS_KEY) || "{}") || {};
      vizFlags = {
        demo: local.demo || {},
        hidden: local.hidden || {},
        manual: Array.isArray(local.manual) ? local.manual : [],
      };
    } catch (e) {
      vizFlags = { demo: {}, hidden: {}, manual: [] };
    }
  }

  function persistVizFlags() {
    localStorage.setItem(VIZ_FLAGS_KEY, JSON.stringify(vizFlags));
  }

  function flagKey(v) {
    return [v.product_id || "", v.index_base || v.index || "", v.lang || ""].join("|");
  }

  function isDemo(v) {
    return !!(vizFlags.demo && vizFlags.demo[flagKey(v)]);
  }

  function hideKey(v) {
    /* Ukrycie dotyczy calego kafelka produktu, nie pojedynczego jezyka */
    return (v && v.product_id) || flagKey(v);
  }

  function isHidden(v) {
    if (!vizFlags.hidden || !v) return false;
    var pid = v.product_id || "";
    if (pid && vizFlags.hidden[pid]) return true;
    if (vizFlags.hidden[flagKey(v)]) return true;
    if (pid) {
      return Object.keys(vizFlags.hidden).some(function (k) {
        return k.indexOf(pid + "|") === 0;
      });
    }
    return false;
  }

  function setHidden(v, on) {
    if (!v) return;
    var pid = hideKey(v);
    if (v.product_id && vizFlags.hidden) {
      Object.keys(vizFlags.hidden).forEach(function (k) {
        if (k.indexOf(v.product_id + "|") === 0) delete vizFlags.hidden[k];
      });
    }
    setFlag("hidden", pid, on);
  }

  function postVizFlag(payload) {
    return fetch(bridgeBase() + "/viz-flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function setFlag(kind, key, on) {
    if (!vizFlags[kind] || Array.isArray(vizFlags[kind])) return;
    if (on) vizFlags[kind][key] = true;
    else delete vizFlags[kind][key];
    persistVizFlags();
    postVizFlag({ action: kind, key: key, value: !!on, flags: vizFlags });
  }

  function loadThumbOverrides() {
    try {
      return JSON.parse(localStorage.getItem(THUMB_OVERRIDES_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveThumbOverride(productId, payload) {
    if (!productId) return;
    var allOv = loadThumbOverrides();
    allOv[productId] = payload;
    localStorage.setItem(THUMB_OVERRIDES_KEY, JSON.stringify(allOv));
    /* Persist w apps/web/data (repo) przez most - NIE na Marketing */
    fetch(bridgeBase() + "/thumb-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        path: payload.path || "",
        file: payload.file || "",
        thumb_url: payload.thumb_url || "",
      }),
    }).catch(function () {
      /* localStorage zostaje */
    });
  }

  function hasThumbOverride(productId) {
    if (!productId) return false;
    var allOv = loadThumbOverrides();
    return !!(allOv && allOv[productId] && (allOv[productId].path || allOv[productId].thumb_url));
  }

  function clearThumbOverride(productId) {
    if (!productId) return;
    var allOv = loadThumbOverrides();
    delete allOv[productId];
    localStorage.setItem(THUMB_OVERRIDES_KEY, JSON.stringify(allOv));
    fetch(bridgeBase() + "/thumb-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, clear: true }),
    }).catch(function () {
      /* localStorage wyczyszczony lokalnie */
    });
  }

  function countManualForProduct(productId) {
    return (vizFlags.manual || []).filter(function (m) {
      return m && m.product_id === productId;
    }).length;
  }

  function removeLastManual(productId) {
    var arr = vizFlags.manual || [];
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] && arr[i].product_id === productId) {
        var removed = arr.splice(i, 1)[0];
        persistVizFlags();
        postVizFlag({ action: "manual_remove", entry: removed, flags: vizFlags });
        all = all.filter(function (x) {
          return !(x.manual && x.product_id === productId && x.path === removed.path);
        });
        return removed;
      }
    }
    return null;
  }

  function folderDirFromPath(filePath) {
    var p = String(filePath || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i > 0 ? p.slice(0, i) : p;
  }

  function openThumbPicker(v, onPicked) {
    var dir = folderDirFromPath(v.path || "");
    var api = window.pywebview && window.pywebview.api;
    if (api && typeof api.pick_thumb === "function") {
      Promise.resolve(api.pick_thumb(dir))
        .then(function (res) {
          if (res && res.ok && res.path) onPicked(res);
          else if (res && res.cancelled) showToast("Anulowano wybor miniatury");
          else openThumbGridPicker(dir, onPicked);
        })
        .catch(function () {
          openThumbGridPicker(dir, onPicked);
        });
      return;
    }
    openThumbGridPicker(dir, onPicked);
  }

  function openThumbGridPicker(dir, onPicked) {
    var existing = document.getElementById("damThumbPicker");
    if (existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "damThumbPicker";
    overlay.className = "dam-thumb-picker-overlay";
    overlay.innerHTML =
      '<div class="dam-thumb-picker-box">' +
      '<div class="dam-thumb-picker__head"><strong>Wybierz miniature</strong>' +
      '<button type="button" class="dam-admin-control" id="damThumbPickerClose" aria-label="Zamknij">×</button></div>' +
      '<p class="dam-thumb-picker__path"></p>' +
      '<div class="dam-thumb-picker__grid" id="damThumbPickerGrid">Ladowanie…</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector(".dam-thumb-picker__path").textContent = dir || "";
    document.getElementById("damThumbPickerClose").onclick = function () {
      overlay.remove();
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
    fetch(bridgeBase() + "/folder-images?path=" + encodeURIComponent(dir))
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var grid = document.getElementById("damThumbPickerGrid");
        if (!grid) return;
        var files = (data && data.files) || [];
        if (!files.length) {
          grid.innerHTML = "<p>Brak obrazow w folderze.</p>";
          return;
        }
        grid.innerHTML = files
          .map(function (f) {
            var prev = mediaPreviewUrl(f.path);
            return (
              '<button type="button" class="dam-thumb-picker__item dam-admin-control" data-path="' +
              esc(f.path) +
              '" data-file="' +
              esc(f.name) +
              '">' +
              (prev
                ? '<img src="' + esc(prev) + '" alt="">'
                : '<span>' + esc(f.name) + "</span>") +
              '<span class="dam-thumb-picker__name">' +
              esc(f.name) +
              "</span></button>"
            );
          })
          .join("");
        grid.querySelectorAll(".dam-thumb-picker__item").forEach(function (btn) {
          btn.addEventListener("click", function () {
            onPicked({
              ok: true,
              path: btn.getAttribute("data-path"),
              file: btn.getAttribute("data-file"),
            });
            overlay.remove();
          });
        });
      })
      .catch(function () {
        var grid = document.getElementById("damThumbPickerGrid");
        if (grid) grid.innerHTML = "<p>Nie udalo sie wczytac listy obrazow (most lokalny?).</p>";
      });
  }

  function applyOverrideToItem(v) {
    if (!v) return v;
    var ov = loadThumbOverrides()[v.product_id];
    if (!ov) return v;
    var copy = Object.assign({}, v);
    if (ov.path) copy.path = ov.path;
    if (ov.thumb_url) copy.thumb_url = ov.thumb_url;
    if (ov.file) copy.file = ov.file;
    return copy;
  }

  function openProductModal(group) {
    var existing = document.getElementById("damVizModal");
    if (existing) existing.remove();

    var items = uniqueModalVariants(withAliasItems(group.items)).map(applyOverrideToItem);
    var first = items[0];
    if (!first) return;
    var productName = first.product_name || first.product_id || "Produkt";
    var brand = first.brand || "DK";
    var syEnabled = localStorage.getItem("dam_synology_enabled") !== "false";
    var admin = isAdminMode();

    var langs = {};
    var indexes = {};
    items.forEach(function (v) {
      if (v.lang) langs[v.lang] = true;
      if (v.index_base || v.index) indexes[v.index_base || String(v.index).split(".")[0]] = true;
    });
    var ctx = {
      multiLang: Object.keys(langs).length > 1,
      multiIndex: Object.keys(indexes).length > 1,
    };

    var activeIdx = 0;
    var zoom = 1;
    var panX = 0;
    var panY = 0;
    var dragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var panAtDragStartX = 0;
    var panAtDragStartY = 0;
    /* Zawsze pokazuj chip wariantu (nawet przy 1 indeksie) - ten sam design */
    var chips = items
      .map(function (v, i) {
        var label = variantChipLabel(v, ctx);
        var thumb = v.thumb_url || "";
        return (
          '<button type="button" class="dam-viz-modal__variant' +
          (i === 0 ? " is-active" : "") +
          '" data-vidx="' +
          i +
          '" data-path="' +
          esc(v.path || "") +
          '" data-thumb="' +
          esc(thumb) +
          '" title="' +
          esc(variantChipTip(v)) +
          '" data-dam-tip="' +
          esc(variantChipTip(v)) +
          '">' +
          (thumb
            ? '<img class="dam-viz-modal__variant-thumb" src="' +
              esc(thumb) +
              '" alt="' +
              esc(label) +
              '" onerror="this.src=\'' +
              PLACEHOLDER_SVG.replace(/'/g, "%27") +
              '\'">'
            : '<div class="dam-viz-modal__variant-placeholder"><i class="uil uil-image"></i></div>') +
          '<span class="dam-viz-modal__variant-label">' +
          esc(label) +
          "</span></button>"
        );
      })
      .join("");

    var modalBadges =
      window.DamBadges && typeof window.DamBadges.render === "function"
        ? window.DamBadges.render({
            brand: brand,
            category: first.category,
            subcategory: first.subcategory_slug,
            subcategoryLabel: first.subcategory_label,
            carrier: first.carrier,
            carrierLabel: carrierHuman(first.carrier || "", first),
            carrierGuessed: !!first.carrier_guessed,
            langs: first.langs || (first.lang ? [first.lang] : []),
            lang: first.lang,
            langLabel: first.lang_label || labelForLang(first.lang),
            index: displayIndex(first),
            showNoIndex: !displayIndex(first),
            multiLang: ctx.multiLang,
            multiIndex: ctx.multiIndex,
            demo: isDemo(first),
            mix: !!(first.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, first.tags))),
            hidden: isHidden(first) && admin,
            productName: productName,
            productId: first.product_id,
            flagKey: hideKey(first),
            tags: first.tags,
            revisionFolder: first.revision_folder,
            revisionFullPath: first.revision_path,
            showCarrierPlaceholder: true,
            maxPerKind: 4,
            overflow: true,
          })
        : '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + "</span>";

    var shareBtnTitle = syEnabled
      ? "Udostepnij przez Synology Drive"
      : "Wlacz Synology Drive w Ustawieniach";

    /* Faza 5 / P2: jezyki bez realnej wizki - wyszarzone + "Zglos zapotrzebowanie". */
    var fullLangSet = (first.alias_langs && first.alias_langs.length ? first.alias_langs : first.langs || []).slice();
    var presentLangs = {};
    items.forEach(function (v) {
      if (v.lang) presentLangs[v.lang] = true;
    });
    var missingLangs = fullLangSet.filter(function (lg) {
      return lg && !presentLangs[lg];
    });
    var missingLangHtml = "";
    if (missingLangs.length) {
      missingLangHtml =
        '<div class="dam-viz-modal__missing-langs">' +
        '<span class="dam-viz-modal__missing-langs-label">Brak wizualizacji:</span>' +
        missingLangs
          .map(function (lg) {
            var short = (window.DamLabels && typeof window.DamLabels.langShort === "function" && DamLabels.langShort(lg)) || String(lg).toUpperCase();
            var full = labelForLang(lg);
            return (
              '<span class="dam-viz-badge dam-viz-badge--lang-missing" title="' +
              esc(full) +
              '">' +
              esc(short) +
              '<button type="button" class="dam-viz-missing-lang-request" data-request-lang="' +
              esc(lg) +
              '" data-request-lang-full="' +
              esc(full) +
              '" aria-label="Zglos zapotrzebowanie na ' +
              esc(full) +
              '" data-dam-tip="Zglos zapotrzebowanie na wizualizacje: ' +
              esc(full) +
              '"><i class="uil uil-bell-plus"></i></button></span>'
            );
          })
          .join("") +
        "</div>";
    }

    var adminActions = "";
    if (admin) {
      adminActions =
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalSetThumb" data-dam-tip="Wybierz plik miniatury z folderu produktu">' +
        '<i class="uil uil-image" aria-hidden="true"></i><span>Miniatura</span></button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalDemo" data-dam-tip="Oznacz jako Demo (zolta obwodka)">' +
        '<i class="uil uil-star" aria-hidden="true"></i><span>Demo</span></button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalHide" data-dam-tip="Ukryj kafelek dla zwyklego uzytkownika">' +
        '<i class="uil uil-eye-slash" aria-hidden="true"></i><span>Ukryj</span></button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalAddManual" data-dam-tip="Dodaj kafelek recznie z pliku">' +
        '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj</span></button>';
    }

    var html =
      '<div class="dam-viz-modal-overlay" id="damVizModal" role="dialog" aria-modal="true" aria-label="Podglad wizualizacji">' +
      '<div class="dam-viz-modal-box">' +
      '<button type="button" class="dam-viz-modal-close" id="damVizModalClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      '<div class="dam-viz-modal__thumb">' +
      '<div class="dam-viz-modal__zoom" role="group" aria-label="Przyblizenie" data-dam-tip="CTRL+scroll lub ALT+scroll: zoom. Przy przyblizeniu: przeciagnij, zeby przesunac.">' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomOut" aria-label="Pomniejsz" title="Pomniejsz" data-dam-tip="Pomniejsz (CTRL/ALT+scroll)"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damVizZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomIn" aria-label="Powieksz" title="Powieksz" data-dam-tip="Powieksz (CTRL/ALT+scroll)"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomReset" aria-label="Reset" title="100%" data-dam-tip="Reset zoom i pozycji"><i class="uil uil-search"></i></button>' +
      "</div>" +
      (first.thumb_url
        ? '<img id="damVizModalHero" src="' +
          esc(first.thumb_url) +
          '" alt="' +
          esc(productName) +
          '" onerror="this.src=\'' +
          PLACEHOLDER_SVG.replace(/'/g, "%27") +
          '\'">'
        : '<div class="dam-viz-modal__nothumb"><i class="uil uil-image"></i></div>') +
      "</div>" +
      '<div class="dam-viz-modal__body">' +
      '<div class="dam-viz-card__badges" id="damVizModalBadges" style="margin-bottom:8px">' +
      modalBadges +
      "</div>" +
      '<h4 class="dam-viz-modal__title">' +
      esc(productName) +
      "</h4>" +
      '<p class="dam-viz-modal__carrier' +
      (admin ? " dam-viz-modal__carrier--editable" : "") +
      '" id="damVizModalMeta" data-dam-tip="' +
      (admin
        ? "Nosnik. Podwojny klik lub Shift+klik: zmiana typu"
        : "Nosnik / indeks biezacego wariantu") +
      '">' +
      esc(
        (carrierHuman(first.carrier || "", first) || "BRAK TYPU") +
          (displayIndex(first) ? " · Indeks " + displayIndex(first) : "")
      ) +
      "</p>" +
      '<div class="dam-viz-modal__variants" role="listbox" aria-label="Warianty">' +
      chips +
      "</div>" +
      missingLangHtml +
      '<div class="dam-viz-modal__actions">' +
      '<div class="dam-viz-modal__actions-main">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damVizModalGoProduct" data-pid="' +
      esc(first.product_id || "") +
      '" data-dam-tip="Otwiera karte produktu w Eksploratorze DAM">' +
      '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz</span></button>' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damVizModalWinExplorer" data-path="' +
      esc(first.path || "") +
      '" aria-label="Otworz w Eksploratorze Windows" title="Otworz w Eksploratorze Windows" data-dam-tip="Otwiera folder w Eksploratorze Windows">' +
      '<i class="uil uil-folder-open" aria-hidden="true"></i><span>otwórz</span></button>' +
      '<button type="button" class="dam-viz-icon-btn" id="damVizModalCopyPath" data-path="' +
      esc(first.path || "") +
      '" aria-label="Kopiuj sciezke" title="Kopiuj sciezke" data-dam-tip="Kopiuje lokalna sciezke pliku">' +
      '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn' +
      (syEnabled ? "" : " is-disabled") +
      '" id="damVizModalShare" data-path="' +
      esc(first.path || "") +
      '" aria-label="Udostepnij" title="' +
      esc(shareBtnTitle) +
      '" data-dam-tip="' +
      esc(shareBtnTitle) +
      '"' +
      (syEnabled ? "" : " disabled") +
      ">" +
      '<i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div>" +
      (adminActions
        ? '<div class="dam-viz-modal__actions-admin" data-dam-tip="Kontrolki administratora">' +
          adminActions +
          "</div>"
        : "") +
      "</div></div></div></div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damVizModal");
    var thumbStage = modal.querySelector(".dam-viz-modal__thumb");

    modal.querySelectorAll("[data-request-lang]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.DamVizRequest && typeof window.DamVizRequest.open === "function") {
          window.DamVizRequest.open({
            productId: first.product_id,
            productName: productName,
            lang: btn.getAttribute("data-request-lang"),
            langFull: btn.getAttribute("data-request-lang-full"),
            path: first.path,
            brand: brand,
            category: first.category,
            carrierLabel: carrierHuman(first.carrier || "", first),
            index: displayIndex(first),
          });
        }
      });
    });

    function clampZoom(z) {
      return Math.min(4, Math.max(0.4, +Number(z).toFixed(2)));
    }

    function resetView() {
      zoom = 1;
      panX = 0;
      panY = 0;
      dragging = false;
      paintZoom();
    }

    function paintZoom() {
      var hero = document.getElementById("damVizModalHero");
      var label = document.getElementById("damVizZoomLabel");
      if (hero) {
        hero.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
        hero.classList.toggle("is-zoomed", zoom > 1.01);
      }
      if (thumbStage) {
        thumbStage.classList.toggle("is-zoomed", zoom > 1.01);
        thumbStage.classList.toggle("is-panning", dragging);
      }
      if (label) label.textContent = Math.round(zoom * 100) + "%";
    }

    function setZoom(next) {
      var prev = zoom;
      zoom = clampZoom(next);
      if (zoom <= 1.01) {
        panX = 0;
        panY = 0;
      } else if (prev <= 1.01 && zoom > 1.01) {
        /* start pan from center */
        panX = 0;
        panY = 0;
      }
      paintZoom();
    }

    function selectVariant(idx) {
      activeIdx = idx;
      var v = items[idx];
      if (!v) return;
      resetView();
      var hero = document.getElementById("damVizModalHero");
      if (hero) {
        var preview = v.thumb_url || mediaPreviewUrl(v.path) || "";
        if (preview) {
          hero.onerror = function () {
            var fallback = mediaPreviewUrl(v.path);
            if (fallback && hero.src.indexOf("/media?") < 0) hero.src = fallback;
            else hero.src = PLACEHOLDER_SVG;
          };
          hero.src = preview;
        }
      }
      paintZoom();
      var meta = document.getElementById("damVizModalMeta");
      if (meta) {
        var idxShow = displayIndex(v);
        meta.textContent =
          (carrierHuman(v.carrier || "", v) || "Nosnik") +
          (idxShow ? " · Indeks " + idxShow : "") +
          (v.lang ? " · " + (v.lang_label || labelForLang(v.lang)) : "");
      }
      ["damVizModalWinExplorer", "damVizModalCopyPath", "damVizModalShare"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute("data-path", v.path || "");
      });
      modal.querySelectorAll(".dam-viz-modal__variant").forEach(function (el) {
        el.classList.toggle("is-active", String(el.getAttribute("data-vidx")) === String(idx));
      });
      if (typeof refreshModalBadgesAndAdmin === "function") {
        refreshModalBadgesAndAdmin();
      }
    }

    modal.querySelectorAll(".dam-viz-modal__variant").forEach(function (el) {
      el.addEventListener("click", function () {
        selectVariant(parseInt(this.getAttribute("data-vidx"), 10) || 0);
      });
    });

    var zin = document.getElementById("damVizZoomIn");
    var zout = document.getElementById("damVizZoomOut");
    var zreset = document.getElementById("damVizZoomReset");
    if (zin) {
      zin.addEventListener("click", function (e) {
        e.stopPropagation();
        setZoom(zoom + 0.2);
      });
    }
    if (zout) {
      zout.addEventListener("click", function (e) {
        e.stopPropagation();
        setZoom(zoom - 0.2);
      });
    }
    if (zreset) {
      zreset.addEventListener("click", function (e) {
        e.stopPropagation();
        resetView();
      });
    }

    /* CTRL+scroll albo ALT+scroll = zoom; przy zoom > 1 drag = pan */
    if (thumbStage) {
      thumbStage.addEventListener(
        "wheel",
        function (e) {
          if (!(e.ctrlKey || e.altKey || e.metaKey)) return;
          e.preventDefault();
          e.stopPropagation();
          var step = e.deltaY > 0 ? -0.15 : 0.15;
          setZoom(zoom + step);
        },
        { passive: false }
      );

      thumbStage.addEventListener("pointerdown", function (e) {
        if (zoom <= 1.01) return;
        if (e.target.closest(".dam-viz-modal__zoom")) return;
        if (e.button !== 0) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panAtDragStartX = panX;
        panAtDragStartY = panY;
        thumbStage.classList.add("is-panning");
        try {
          thumbStage.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
        e.preventDefault();
      });

      thumbStage.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        panX = panAtDragStartX + (e.clientX - dragStartX);
        panY = panAtDragStartY + (e.clientY - dragStartY);
        paintZoom();
      });

      function endPan(e) {
        if (!dragging) return;
        dragging = false;
        thumbStage.classList.remove("is-panning");
        if (e && e.pointerId != null) {
          try {
            thumbStage.releasePointerCapture(e.pointerId);
          } catch (err) {
            /* ignore */
          }
        }
        paintZoom();
      }
      thumbStage.addEventListener("pointerup", endPan);
      thumbStage.addEventListener("pointercancel", endPan);
    }
    paintZoom();

    function refreshCardThumb(pid, thumbUrl) {
      var card = document.querySelector(
        '.dam-viz-card[data-group-pid="' +
          String(pid).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
          '"] .dam-viz-thumb__img'
      );
      if (card && thumbUrl) card.src = thumbUrl.split("?")[0] + "?v=" + Date.now();
    }

    function setBtnLabel(btn, iconClass, label, tip, on) {
      if (!btn) return;
      btn.classList.toggle("is-on", !!on);
      var icon = btn.querySelector("i");
      var span = btn.querySelector("span");
      if (icon && iconClass) icon.className = iconClass;
      if (span) span.textContent = label;
      if (tip) btn.setAttribute("data-dam-tip", tip);
    }

    function refreshModalBadgesAndAdmin() {
      var v = items[activeIdx] || first;
      var badgesEl = document.getElementById("damVizModalBadges");
      if (badgesEl && window.DamBadges && typeof window.DamBadges.render === "function") {
        badgesEl.innerHTML = window.DamBadges.render({
          brand: brand,
          category: v.category,
          subcategory: v.subcategory_slug,
          subcategoryLabel: v.subcategory_label,
          carrier: v.carrier,
          carrierLabel: carrierHuman(v.carrier || "", v),
          carrierGuessed: !!v.carrier_guessed,
          langs: v.langs || (v.lang ? [v.lang] : []),
          lang: v.lang,
          langLabel: v.lang_label || labelForLang(v.lang),
          index: displayIndex(v),
          showNoIndex: !displayIndex(v),
          multiLang: ctx.multiLang,
          multiIndex: ctx.multiIndex,
          demo: isDemo(v),
          mix: !!(v.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, v.tags))),
          hidden: isHidden(v) && admin,
          productName: productName,
          productId: v.product_id,
          flagKey: hideKey(v),
          tags: v.tags,
          revisionFolder: v.revision_folder,
          revisionFullPath: v.revision_path,
          showCarrierPlaceholder: true,
          maxPerKind: 4,
          overflow: true,
        });
      }
      syncAdminControls(v);
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(modal);
      }
    }

    function syncAdminControls(v) {
      if (!admin || !v) return;
      var pid = v.product_id || "";
      var thumbOn = hasThumbOverride(pid);
      var demoOn = isDemo(v);
      var hideOn = isHidden(v);
      var manualN = countManualForProduct(pid);

      setBtnLabel(
        document.getElementById("damVizModalSetThumb"),
        thumbOn ? "uil uil-redo" : "uil uil-image",
        thumbOn ? "Reset" : "Miniatura",
        thumbOn
          ? "Cofnij wybor miniatury (przywroc domyslna)"
          : "Wybierz plik miniatury z folderu produktu",
        thumbOn
      );
      setBtnLabel(
        document.getElementById("damVizModalDemo"),
        "uil uil-star",
        demoOn ? "Demo off" : "Demo",
        demoOn
          ? "Usun oznaczenie Demo (zolta obwodka)"
          : "Oznacz jako Demo (zolta obwodka)",
        demoOn
      );
      setBtnLabel(
        document.getElementById("damVizModalHide"),
        hideOn ? "uil uil-eye" : "uil uil-eye-slash",
        hideOn ? "Pokaz" : "Ukryj",
        hideOn
          ? "Pokaz kafelek znowu (odklikaj ukrycie). Tag (UKRYTE) tez to robi."
          : "Ukryj kafelek dla zwyklego uzytkownika. Admin zobaczy go przy Pokaz wszystko.",
        hideOn
      );
      setBtnLabel(
        document.getElementById("damVizModalAddManual"),
        manualN > 0 ? "uil uil-minus" : "uil uil-plus",
        manualN > 0 ? "Usun" : "Dodaj",
        manualN > 0
          ? "Usun ostatni recznie dodany kafelek (cofnie). Shift+klik: dodaj kolejny."
          : "Dodaj kafelek recznie z pliku",
        manualN > 0
      );
    }

    var setThumbBtn = document.getElementById("damVizModalSetThumb");
    if (setThumbBtn) {
      setThumbBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        if (!v || !v.product_id) {
          showToast("Brak produktu");
          return;
        }
        if (hasThumbOverride(v.product_id)) {
          clearThumbOverride(v.product_id);
          items = uniqueModalVariants(withAliasItems(group.items)).map(applyOverrideToItem);
          first = items[0] || first;
          var hero = document.getElementById("damVizModalHero");
          var fresh = items[activeIdx] || first;
          if (hero) hero.src = (fresh && fresh.thumb_url) || PLACEHOLDER_SVG;
          refreshCardThumb(group.pid, (items[0] && items[0].thumb_url) || "");
          showToast("Przywrocono domyslna miniature");
          refreshModalBadgesAndAdmin();
          applyFilters();
          return;
        }
        openThumbPicker(v, function (picked) {
          var thumbUrl = mediaPreviewUrl(picked.path) || "";
          saveThumbOverride(v.product_id, {
            path: picked.path || "",
            file: picked.file || "",
            thumb_url: thumbUrl,
            updated_at: new Date().toISOString(),
          });
          refreshCardThumb(group.pid, thumbUrl);
          var heroEl = document.getElementById("damVizModalHero");
          if (heroEl && thumbUrl) heroEl.src = thumbUrl;
          showToast("Ustawiono miniature dla " + (v.product_name || v.product_id));
          refreshModalBadgesAndAdmin();
          applyFilters();
        });
      });
    }

    var demoBtn = document.getElementById("damVizModalDemo");
    if (demoBtn) {
      demoBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var key = flagKey(v);
        var on = !isDemo(v);
        setFlag("demo", key, on);
        showToast(on ? "Oznaczono jako Demo" : "Usunieto Demo");
        refreshModalBadgesAndAdmin();
        applyFilters();
      });
    }

    var hideBtn = document.getElementById("damVizModalHide");
    if (hideBtn) {
      hideBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var on = !isHidden(v);
        setHidden(v, on);
        showToast(on ? "Ukryto - odklikaj tag (UKRYTE) lub Pokaz" : "Pokazano kafelek");
        /* Nie zamykaj modala - da sie cofnac od razu */
        refreshModalBadgesAndAdmin();
        applyFilters();
      });
    }

    var addManualBtn = document.getElementById("damVizModalAddManual");
    if (addManualBtn) {
      addManualBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var manualN = countManualForProduct(v.product_id);
        if (manualN > 0 && !e.shiftKey) {
          var removed = removeLastManual(v.product_id);
          showToast(removed ? "Usunieto reczny kafelek" : "Brak recznego kafelka");
          refreshModalBadgesAndAdmin();
          applyFilters();
          return;
        }
        openThumbPicker(v, function (picked) {
          var entry = {
            product_id: v.product_id,
            product_name: v.product_name,
            brand: v.brand,
            category: v.category,
            carrier: v.carrier,
            carrier_label: v.carrier_label,
            index: v.index,
            index_base: v.index_base || "manual",
            lang: v.lang || "pl",
            lang_label: v.lang_label || "Polska",
            langs: v.langs || [v.lang || "pl"],
            path: picked.path,
            file: picked.file,
            thumb_url: mediaPreviewUrl(picked.path),
            tags: v.tags || [],
            manual: true,
            mtime: new Date().toISOString(),
          };
          vizFlags.manual = vizFlags.manual || [];
          vizFlags.manual.push(entry);
          persistVizFlags();
          postVizFlag({ action: "manual", entry: entry, flags: vizFlags });
          all.push(entry);
          showToast("Dodano kafelek recznie");
          refreshModalBadgesAndAdmin();
          applyFilters();
        });
      });
    }

    syncAdminControls(first);

    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(document.getElementById("damVizModalBadges"), "viz");
    }
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(modal);
    }

    var metaEl = document.getElementById("damVizModalMeta");
    if (metaEl && admin && window.DamTagEdit) {
      var metaLast = 0;
      metaEl.addEventListener("click", function (e) {
        var now = Date.now();
        var open =
          e.shiftKey || (metaLast && now - metaLast <= 500);
        metaLast = now;
        if (!open) return;
        e.preventDefault();
        e.stopPropagation();
        window.DamTagEdit.openCarrierPicker(metaEl, {
          revisionPath: first.revision_path || "",
          currentCode: first.carrier || "",
          productId: first.product_id || "",
          productName: productName || "",
        });
      });
    }

    var goProductBtn = document.getElementById("damVizModalGoProduct");
    if (goProductBtn) {
      goProductBtn.addEventListener("click", function () {
        window.location.href =
          "explorer.html?product=" + encodeURIComponent(this.getAttribute("data-pid") || "");
      });
    }

    var winExpBtn = document.getElementById("damVizModalWinExplorer");
    if (winExpBtn) {
      winExpBtn.addEventListener("click", function () {
        var path = this.getAttribute("data-path") || "";
        if (!path) {
          showToast("Brak sciezki produktu");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
          return;
        }
        if (window.DamPaths) window.DamPaths.revealInExplorer(path);
      });
    }

    var copyBtn = document.getElementById("damVizModalCopyPath");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var path = this.getAttribute("data-path");
        if (window.DamPaths) {
          window.DamPaths.copyPath(path);
          return;
        }
        copyToClipboard(path).then(function () {
          showToast("Skopiowano sciezke do schowka");
        });
      });
    }

    var shareBtn = document.getElementById("damVizModalShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!syEnabled) return;
        var path = this.getAttribute("data-path") || first.path || "";
        modal.remove();
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(path);
        } else {
          showToast("DamPaths niedostepne - odswiez strone");
        }
      });
    }

    document.getElementById("damVizModalClose").addEventListener("click", function () {
      modal.remove();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.remove();
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", onEsc);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Synology Share: okno klienta przez local_bridge (/synology-share)    */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Render card galerii                                                  */
  /* ------------------------------------------------------------------ */

  function onThumbError(img) {
    img.onerror = null;
    img.src = PLACEHOLDER_SVG;
    img.classList.add("dam-viz-thumb__img--placeholder");
  }
  window.damVizThumbError = onThumbError;

  function renderGroup(group) {
    var items = group.items.map(applyOverrideToItem);
    var first = items[0];
    var thumb = first.thumb_url || "";
    var brand = first.brand || "DK";
    var uniq = uniqueModalVariants(items);
    var langs = {};
    var indexes = {};
    uniq.forEach(function (v) {
      if (v.lang) langs[v.lang] = true;
      if (v.index_base || v.index) indexes[v.index_base || String(v.index).split(".")[0]] = true;
    });
    var isMultiLang = Object.keys(langs).length > 1;
    var isMultiIndex = Object.keys(indexes).length > 1;
    var carrierLbl = carrierHuman(first.carrier || "", first);
    var productName = first.product_name || group.pid || "Produkt";
    var indexLbl = displayIndex(first);
    var demo = isDemo(first);
    var hidden = isHidden(first);
    // Preferuj miniaturke z poprawnym indeksem (po naprawie noid -> 6300xxx)
    if (indexLbl && thumb && thumb.indexOf("__noid_") !== -1) {
      thumb = thumbStem(first.product_id || group.pid, indexLbl, first.lang || "pl");
    }

    var badgesHtml =
      window.DamBadges && typeof window.DamBadges.render === "function"
        ? window.DamBadges.render({
            brand: brand,
            category: first.category,
            subcategory: first.subcategory_slug,
            subcategoryLabel: first.subcategory_label,
            carrier: first.carrier,
            carrierLabel: carrierLbl,
            carrierGuessed: !!first.carrier_guessed,
            langs: Object.keys(langs).length ? Object.keys(langs) : first.langs || (first.lang ? [first.lang] : []),
            lang: first.lang,
            langLabel: first.lang_label || labelForLang(first.lang),
            index: indexLbl,
            showNoIndex: !indexLbl,
            multiLang: isMultiLang,
            multiIndex: isMultiIndex,
            demo: demo,
            mix: !!(first.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, first.tags))),
            hidden: hidden && isAdminMode(),
            productName: productName,
            productId: first.product_id,
            flagKey: hideKey(first),
            tags: first.tags,
            revisionFolder: first.revision_folder,
            revisionFullPath: first.revision_path,
            showCarrierPlaceholder: true,
            compact: true,
            maxPerKind: 2,
            /* 2026-07-18: Marka+Kategoria+Podkategoria+Typ+Warianty+Multijezyczny+Indeks
               to typowo 7 tagow - maxTotal musi je wszystkie objac (bylo 6, ucinalo
               Multijezyczny w "+N" po dodaniu Kategorii/Podkategorii do karty). */
            maxTotal: 9,
          })
        : '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + "</span>";

    /* Faza 5/P2: "Pokaz wszystko" - folder istnieje, brak realnej wizki -> wyraznie
       wyszarzony placeholder (nie pelnoprawny kafelek). Nigdy w widoku domyslnym. */
    var noViz = first.has_viz === false;

    return (
      '<article class="dam-viz-card dam-viz-card--clickable' +
        (demo ? " dam-viz-card--demo" : "") +
        (noViz ? " dam-viz-card--no-viz" : "") +
        (hidden && isAdminMode() ? " dam-viz-card--hidden" : "") +
        '" data-group-pid="' +
        esc(group.pid) +
        '">' +
        '<div class="dam-viz-thumb">' +
          (noViz
            ? '<div class="dam-viz-thumb__noviz"><i class="uil uil-image-slash"></i><span>Brak wizualizacji</span></div>'
            : thumb
            ? '<img class="dam-viz-thumb__img" src="' + esc(thumb) + '" alt="" loading="lazy" onerror="window.damVizThumbError(this)">'
            : '<img class="dam-viz-thumb__img dam-viz-thumb__img--placeholder" src="' + PLACEHOLDER_SVG.replace(/"/g, "&quot;") + '" alt="">') +
        '</div>' +
        '<div class="dam-viz-card__body">' +
          '<div class="dam-viz-card__badges">' +
            badgesHtml +
          '</div>' +
          '<h5 class="dam-viz-card__title">' + esc(productName) + '</h5>' +
          '<p class="dam-viz-card__meta' +
            (carrierLbl ? "" : " dam-viz-card__meta--empty") +
            '">' +
            esc(carrierLbl || "BRAK TYPU") +
            "</p>" +
          '<div class="dam-viz-card__actions">' +
            (noViz
              ? '<button type="button" class="geex-btn geex-btn--primary dam-btn-icon dam-viz-request-btn" data-group-pid="' + esc(group.pid) + '" title="Zglos zapotrzebowanie" data-dam-tip="Zglos zapotrzebowanie na wizualizacje dla tego wariantu">' +
                '<i class="uil uil-bell-plus" aria-hidden="true"></i><span>Zglos</span></button>'
              : '<a class="geex-btn geex-btn--primary dam-btn-icon" href="explorer.html?product=' + encodeURIComponent(first.product_id || "") + '" title="Przejdz do produktu" data-dam-tip="Otwiera karte produktu w hubie DAM">' +
                '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz</span></a>') +
            '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-win-explorer-btn" data-path="' + esc(first.path || "") + '" aria-label="Eksplorator" title="Eksplorator Windows" data-dam-tip="Otwiera folder w Eksploratorze Windows">' +
              '<i class="uil uil-folder-open" aria-hidden="true"></i></button>' +
            (noViz
              ? ""
              : '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-share-btn" data-group-pid="' + esc(group.pid) + '" aria-label="Udostepnij" title="Udostepnij" data-dam-tip="Udostepnij plik przez Synology Drive">' +
                '<i class="uil uil-share-alt" aria-hidden="true"></i></button>') +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function render() {
    var grid = document.getElementById("vizGrid");
    var status = document.getElementById("vizStatus");
    if (!grid) return;

    var groups = groupByProduct(filtered);

    if (status) {
      status.textContent =
        groups.length + " produktow (" + filtered.length + " wariantow)" +
        (all.length !== filtered.length ? " / z " + all.length + " wszystkich" : "");
    }

    if (!groups.length) {
      grid.innerHTML = '<p style="color:#888;padding:12px">Brak wynikow dla filtra.</p>';
      return;
    }

    grid.innerHTML = groups.map(renderGroup).join("");
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(grid, "viz");
    }

    // Klik miniatury / karty
    grid.querySelectorAll(".dam-viz-card--clickable").forEach(function (card) {
      var pid = card.getAttribute("data-group-pid");
      var group = groups.find(function (g) { return g.pid === pid; });
      if (!group) return;
      card.querySelector(".dam-viz-thumb").addEventListener("click", function (e) {
        e.preventDefault();
        openProductModal(group);
      });
    });

    // Przycisk Eksplorator Windows (folder)
    grid.querySelectorAll(".dam-viz-win-explorer-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var path = this.getAttribute("data-path") || "";
        if (!path) {
          showToast("Brak sciezki produktu");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
          return;
        }
        if (window.DamPaths) window.DamPaths.revealInExplorer(path);
      });
    });

    // Przycisk Zglos zapotrzebowanie (kafelek bez wizki, "Pokaz wszystko")
    grid.querySelectorAll(".dam-viz-request-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = this.getAttribute("data-group-pid");
        var group = groups.find(function (g) { return g.pid === pid; });
        var v = group && group.items[0];
        if (!v || !window.DamVizRequest) return;
        window.DamVizRequest.open({
          productId: v.product_id,
          productName: v.product_name,
          lang: v.lang,
          langFull: v.lang_label || labelForLang(v.lang),
          brand: v.brand,
          category: v.category,
          carrierLabel: carrierHuman(v.carrier || "", v),
          index: displayIndex(v),
          path: v.path,
        });
      });
    });

    // Przycisk Udostepnij
    grid.querySelectorAll(".dam-viz-share-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = this.getAttribute("data-group-pid");
        var group = groups.find(function (g) { return g.pid === pid; });
        if (!group) return;
        var syEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");
        if (!syEnabled) {
          showToast("Wlacz Synology Drive w Ustawieniach");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(group.items[0].path || "");
        } else {
          showToast("DamPaths niedostepne - odswiez strone");
        }
      });
    });
  }

  function productMeta(pid) {
    var fi = window._DAM_FILE_INDEX;
    if (!fi || !fi.products) return null;
    for (var i = 0; i < fi.products.length; i++) {
      if (fi.products[i].id === pid) return fi.products[i];
    }
    return null;
  }

  function applyFilters() {
    var lang = (document.getElementById("vizLangFilter") || {}).value || "";
    var q = ((document.getElementById("vizSearch") || {}).value || "").trim().toLowerCase();
    var parts = q ? q.split(/\s+/).filter(Boolean) : [];

    filtered = all.filter(function (v) {
      var brand = v.brand || "DK";
      if (!brandFilter[brand]) return false;
      /* Ukryte: zwykle uzytkownicy nigdy. Admin tylko przy "Pokaz wszystko". */
      if (isHidden(v)) {
        if (!isAdminMode()) return false;
        if (!showAll) return false;
      }
      /* Bez "Pokaz wszystkie": ukryj Demo (prototypy) */
      if (!showAll && isDemo(v)) return false;
      if (lang && (v.lang || "") !== lang) return false;
      if (!parts.length) return true;
      var meta = productMeta(v.product_id) || {};
      var tg = meta.tag_groups || {};
      var blob = [
        v.product_name || "",
        v.index || "",
        v.index_base || "",
        v.carrier || "",
        v.file || "",
        v.lang_label || "",
        v.brand || "",
        (meta.tags || []).join(" "),
        (meta.authors || []).join(" "),
        (tg.smak || []).join(" "),
        (tg.typ || []).join(" "),
        (tg.opakowanie || []).join(" "),
        (tg.autor || tg.osoba || []).join(" "),
        meta.search_blob || "",
      ]
        .join(" ")
        .toLowerCase();
      var digits = q.replace(/\D/g, "");
      if (digits.length >= 4 && (v.index_base || "").indexOf(digits) !== -1) return true;
      return parts.every(function (part) {
        return blob.indexOf(part) !== -1;
      });
    });
    render();
  }

  function init() {
    var grid = document.getElementById("vizGrid");
    if (!grid) return;

    // Synology enabled?
    synologyEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");

    var adminToggle = document.getElementById("vizAdminToggle");
    var adminToggleWrap = adminToggle && adminToggle.closest(".dam-admin-toggle");
    if (adminToggle) {
      if (!isAdminRole()) {
        if (adminToggleWrap) adminToggleWrap.style.display = "none";
        else adminToggle.style.display = "none";
        localStorage.setItem(ADMIN_KEY, "0");
      } else {
        if (adminToggleWrap) adminToggleWrap.style.display = "";
        adminToggle.checked = isAdminMode();
        function syncAdminOutline() {
          if (!adminToggleWrap) return;
          adminToggleWrap.classList.toggle("dam-admin-control", !!adminToggle.checked);
        }
        syncAdminOutline();
        adminToggle.addEventListener("change", function () {
          localStorage.setItem(ADMIN_KEY, this.checked ? "1" : "0");
          syncAdminOutline();
          applyFilters();
        });
      }
    }

    window.damVizApplyBrandTag = function (brand) {
      var b = String(brand || "").toUpperCase();
      if (b !== "DK" && b !== "GC") return;
      brandFilter = { DK: b === "DK", GC: b === "GC" };
      applyFilters();
    };

    function findVizByFlagKey(key, productId) {
      var k = String(key || "");
      if (k) {
        for (var i = 0; i < all.length; i++) {
          if (flagKey(all[i]) === k) return all[i];
        }
      }
      var pid = String(productId || "");
      if (pid) {
        for (var j = 0; j < all.length; j++) {
          if (all[j].product_id === pid) return all[j];
        }
      }
      return null;
    }

    function refreshOpenModalAfterFlag() {
      var badgesEl = document.getElementById("damVizModalBadges");
      var modalEl = document.getElementById("damVizModal");
      if (!modalEl || !badgesEl) {
        applyFilters();
        return;
      }
      var hideBtn = document.getElementById("damVizModalHide");
      var demoBtn = document.getElementById("damVizModalDemo");
      if (hideBtn) {
        var goBtn = document.getElementById("damVizModalGoProduct");
        var pidAttr = goBtn ? goBtn.getAttribute("data-pid") || "" : "";
        var v = findVizByFlagKey("", pidAttr);
        if (v && window.DamBadges) {
          var adminOn = isAdminMode();
          badgesEl.innerHTML = window.DamBadges.render({
            brand: v.brand || "DK",
            category: v.category,
            subcategory: v.subcategory_slug,
            subcategoryLabel: v.subcategory_label,
            carrier: v.carrier,
            carrierLabel: carrierHuman(v.carrier || "", v),
            carrierGuessed: !!v.carrier_guessed,
            langs: v.langs || (v.lang ? [v.lang] : []),
            lang: v.lang,
            langLabel: v.lang_label || labelForLang(v.lang),
            index: displayIndex(v),
            showNoIndex: !displayIndex(v),
            demo: isDemo(v),
            mix: !!(v.is_mix || (window.DamLabels && DamLabels.isMixProduct(v.product_name, v.tags))),
            hidden: isHidden(v) && adminOn,
            productName: v.product_name || v.product_id,
            productId: v.product_id,
            flagKey: hideKey(v),
            tags: v.tags,
            revisionFolder: v.revision_folder,
            revisionFullPath: v.revision_path,
            showCarrierPlaceholder: true,
            maxPerKind: 4,
            overflow: true,
          });
          var setOn = function (btn, on, label, tip, icon) {
            if (!btn) return;
            btn.classList.toggle("is-on", !!on);
            var span = btn.querySelector("span");
            var iEl = btn.querySelector("i");
            if (span) span.textContent = label;
            if (tip) btn.setAttribute("data-dam-tip", tip);
            if (iEl && icon) iEl.className = icon;
          };
          setOn(
            hideBtn,
            isHidden(v),
            isHidden(v) ? "Pokaz" : "Ukryj",
            isHidden(v)
              ? "Pokaz kafelek znowu (odklikaj ukrycie). Tag (UKRYTE) tez to robi."
              : "Ukryj kafelek dla zwyklego uzytkownika. Admin zobaczy go przy Pokaz wszystko.",
            isHidden(v) ? "uil uil-eye" : "uil uil-eye-slash"
          );
          setOn(
            demoBtn,
            isDemo(v),
            isDemo(v) ? "Demo off" : "Demo",
            isDemo(v)
              ? "Usun oznaczenie Demo (zolta obwodka)"
              : "Oznacz jako Demo (zolta obwodka)",
            "uil uil-star"
          );
        }
      }
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(modalEl);
      }
      applyFilters();
    }

    window.damVizToggleHidden = function (opts) {
      opts = opts || {};
      var v = findVizByFlagKey(opts.flagKey, opts.productId);
      if (!v && opts.productId) {
        v = { product_id: opts.productId };
      }
      var key = (v && hideKey(v)) || opts.productId || opts.flagKey || "";
      if (!key) {
        showToast("Brak klucza ukrycia");
        return;
      }
      var currently = v ? isHidden(v) : !!(vizFlags.hidden && vizFlags.hidden[key]);
      if (v && v.product_id) setHidden(v, !currently);
      else setFlag("hidden", key, !currently);
      showToast(!currently ? "Ukryto kafelek" : "Pokazano kafelek");
      refreshOpenModalAfterFlag();
    };

    window.damVizToggleDemo = function (opts) {
      opts = opts || {};
      var v = findVizByFlagKey(opts.flagKey, opts.productId);
      var key = opts.flagKey || (v ? flagKey(v) : "");
      if (!key) {
        showToast("Brak klucza Demo");
        return;
      }
      var on = !(vizFlags.demo && vizFlags.demo[key]);
      setFlag("demo", key, on);
      showToast(on ? "Oznaczono jako Demo" : "Usunieto Demo");
      refreshOpenModalAfterFlag();
    };

    loadVizFlags();
    fetch("data/viz-flags.json?_=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (fileFlags) {
        if (!fileFlags || typeof fileFlags !== "object") return;
        vizFlags = {
          demo: Object.assign({}, fileFlags.demo || {}, vizFlags.demo || {}),
          hidden: Object.assign({}, fileFlags.hidden || {}, vizFlags.hidden || {}),
          manual: [].concat(fileFlags.manual || [], vizFlags.manual || []),
        };
        persistVizFlags();
        if (indexData) {
          rebuildAllFromIndex();
          applyFilters();
        }
      })
      .catch(function () {});

    /* Scal overrides z pliku repo do localStorage */
    fetch("data/thumb-overrides.json?_=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (fileOv) {
        if (!fileOv || typeof fileOv !== "object") return;
        var local = loadThumbOverrides();
        localStorage.setItem(
          THUMB_OVERRIDES_KEY,
          JSON.stringify(Object.assign({}, fileOv, local))
        );
      })
      .catch(function () {});

    // Brand filter - inicjuj trigger lub fallback
    brandFilter = window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true };

    var brandTrigger = document.getElementById("vizBrandFilterTrigger");
    if (window.DamBrandFilter) {
      window.DamBrandFilter.addListener(function (brands) {
        brandFilter = brands;
        applyFilters();
      });
      if (brandTrigger) {
        window.DamBrandFilter.init(brandTrigger);
      }
    }

    var params = new URLSearchParams(location.search);
    var wantProduct = params.get("product");
    var wantLang = params.get("lang");
    var wantBrand = params.get("brand");
    if (wantBrand && window.DamBrandFilter) {
      // Single brand from URL param
      brandFilter = { DK: wantBrand === "DK", GC: wantBrand === "GC" };
    }

    function boot(data) {
      indexData = data;
      langLabels = data.lang_labels || {};
      window._DAM_FILE_INDEX = data;
      showAll = readShowAll();
      var showAllEl = document.getElementById("vizShowAll") || document.getElementById("vizLatestOnly");
      if (showAllEl) {
        showAllEl.checked = showAll;
        var sw = showAllEl.closest(".dam-switch");
        if (sw) sw.classList.toggle("is-off", !showAll);
      }
      rebuildAllFromIndex();
      if (wantProduct) {
        all = all.filter(function (v) { return v.product_id === wantProduct; });
      }
      if (wantLang) {
        var sel = document.getElementById("vizLangFilter");
        if (sel) sel.value = wantLang;
      }
      applyFilters();
      if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
        window.DamShell.setTrailLeaf("Wizualizacje");
      }
    }

    var lastIndexMtime = 0;

    function loadIndex() {
      if (window.DamSearch && typeof window.DamSearch.reload === "function") {
        return window.DamSearch.reload().then(function () { return window._DAM_FILE_INDEX; });
      }
      return fetch("data/file-index.json?_=" + Date.now()).then(function (r) {
        if (!r.ok) throw new Error("file-index.json");
        return r.json();
      });
    }

    loadIndex().then(boot).catch(function (err) {
      grid.innerHTML = '<p style="color:#FF5653">Blad indeksu: ' + esc(err.message) + "</p>";
    });

    /* Near-instant: poll mtime indeksu (watcher / POST /index/rebuild) */
    function pollIndexFresh() {
      var bridge = (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function")
        ? window.DamRuntime.bridgeUrl()
        : ((window.DamRuntime && window.DamRuntime.bridge) || "http://127.0.0.1:8766");
      fetch(bridge + "/index/status", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (st) {
          if (!st || !st.mtime) return;
          if (lastIndexMtime && st.mtime > lastIndexMtime) {
            loadIndex().then(boot).catch(function () {});
          }
          lastIndexMtime = st.mtime;
        })
        .catch(function () {});
    }
    setInterval(pollIndexFresh, 4000);
    setTimeout(pollIndexFresh, 800);

    var langSel = document.getElementById("vizLangFilter");
    var search = document.getElementById("vizSearch");
    var showAllToggle = document.getElementById("vizShowAll") || document.getElementById("vizLatestOnly");
    function syncShowAllSwitchUi() {
      if (!showAllToggle) return;
      var wrap = showAllToggle.closest(".dam-switch");
      if (wrap) wrap.classList.toggle("is-off", !showAllToggle.checked);
    }
    if (showAllToggle) {
      showAll = readShowAll();
      showAllToggle.checked = showAll;
      syncShowAllSwitchUi();
      showAllToggle.addEventListener("change", function () {
        showAll = !!showAllToggle.checked;
        localStorage.setItem(SHOW_ALL_KEY, showAll ? "1" : "0");
        localStorage.removeItem(LATEST_KEY_LEGACY);
        syncShowAllSwitchUi();
        rebuildAllFromIndex();
        if (wantProduct) {
          all = all.filter(function (v) { return v.product_id === wantProduct; });
        }
        applyFilters();
      });
    }
    if (langSel) langSel.addEventListener("change", applyFilters);
    if (search) {
      var t = null;
      function onSearch() {
        clearTimeout(t);
        t = setTimeout(applyFilters, 120);
      }
      search.addEventListener("input", onSearch);
      search.addEventListener("keyup", onSearch);
      search.addEventListener("search", onSearch);
    }

    if (window.DamTagBar) {
      window.DamTagBar.bind({
        tagsEl: "vizSearchTags",
        inputEl: "vizSearch",
        onTag: function () {
          applyFilters();
        },
      });
    }

    window.DamViz = {
      applyFilters: applyFilters,
      getAll: function () { return all; },
      getFiltered: function () { return filtered; }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
