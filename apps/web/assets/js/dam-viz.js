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
  var latestOnly = true;
  var indexData = null;
  var LATEST_KEY = "dam_viz_latest_only";

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

  function carrierHuman(carrier) {
    if (!carrier) return "";
    // Usun daty / indeksy z etykiety prezentacyjnej (nie: BATON (20.09.2024))
    var clean = String(carrier)
      .replace(/\s*\(?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\)?/g, "")
      .replace(/\s*\d{6,7}(?:\.\d{2})?\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
      var code = window.DamLabels.parseCarrierCode ? window.DamLabels.parseCarrierCode(clean || carrier) : clean;
      var label = window.DamLabels.carrierLabel(code, clean);
      if (label && label !== code) return label;
    }
    // Usun redundantne (BAR)/(BAT) gdy nazwa juz mowi to samo
    clean = clean.replace(/\s*\((?:BAR|BAT|FOIL|DOYPACK|MINI)\)\s*$/i, "").trim();
    return clean || carrier;
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

  function readLatestOnly() {
    var stored = localStorage.getItem(LATEST_KEY);
    if (stored === null || stored === undefined || stored === "") return true;
    return stored !== "0" && stored !== "false";
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
        if (!wizki.length && !(r.wizki_count > 0)) return;
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
            index: r.index || (indexBase ? indexBase + ".00" : ""),
            index_base: indexBase,
            revision_folder: r.folder,
            langs: langs,
            lang: lang,
            lang_label: labels[lang] || String(lang).toUpperCase(),
            path: firstWizkiPath(r) || r.path || "",
            thumb_url: thumbStem(pid, indexBase, lang),
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
    all = expandVizFromProducts(indexData, latestOnly);
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

  function variantChipLabel(v, ctx) {
    var lang = v.lang_label || labelForLang(v.lang) || "";
    var idx = displayIndex(v);
    if (ctx.multiLang && ctx.multiIndex) return (lang || "?") + (idx ? " · " + idx : "");
    if (ctx.multiIndex) return idx || lang || "Wariant";
    if (ctx.multiLang) return lang || idx || "Wariant";
    /* 1 wariant: i tak pokazuj indeks (ten sam chip co przy wielu) */
    return idx || lang || "Aktualna";
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

  function isAdminMode() {
    return localStorage.getItem(ADMIN_KEY) === "1";
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
    var all = loadThumbOverrides();
    all[productId] = payload;
    localStorage.setItem(THUMB_OVERRIDES_KEY, JSON.stringify(all));
    /* Persist w apps/web/data (repo) przez most - NIE na Marketing */
    var bridge =
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766";
    fetch(bridge + "/thumb-override", {
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

    var items = uniqueModalVariants(group.items).map(applyOverrideToItem);
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
          esc(label + (v.revision_folder ? " · " + v.revision_folder : "")) +
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

    var badgeExtra = "";
    if (ctx.multiLang) {
      badgeExtra =
        '<span class="dam-viz-badge" style="background:rgba(255,159,67,0.12);color:#C96A12">Multijezyczny</span>';
    } else if (ctx.multiIndex) {
      badgeExtra =
        '<span class="dam-viz-badge" style="background:rgba(171,84,219,0.12);color:#7A3AA8">Wiele rewizji</span>';
    }

    var shareBtnTitle = syEnabled
      ? "Udostepnij przez Synology Drive"
      : "Wlacz Synology Drive w Ustawieniach";

    var html =
      '<div class="dam-viz-modal-overlay" id="damVizModal" role="dialog" aria-modal="true" aria-label="Podglad wizualizacji">' +
      '<div class="dam-viz-modal-box">' +
      '<button type="button" class="dam-viz-modal-close" id="damVizModalClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      '<div class="dam-viz-modal__thumb">' +
      '<div class="dam-viz-modal__zoom" role="group" aria-label="Przyblizenie">' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomOut" aria-label="Pomniejsz" title="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damVizZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomIn" aria-label="Powieksz" title="Powieksz"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomReset" aria-label="Reset" title="100%"><i class="uil uil-search"></i></button>' +
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
      '<div class="dam-viz-card__badges" style="margin-bottom:8px">' +
      '<span class="dam-viz-badge dam-viz-badge--brand">' +
      esc(brand) +
      "</span>" +
      badgeExtra +
      "</div>" +
      '<h4 class="dam-viz-modal__title">' +
      esc(productName) +
      "</h4>" +
      '<p class="dam-viz-modal__carrier" id="damVizModalMeta">' +
      esc(
        (carrierHuman(first.carrier || "") || "Nosnik") +
          (displayIndex(first) ? " · Indeks " + displayIndex(first) : "")
      ) +
      "</p>" +
      '<div class="dam-viz-modal__variants" role="listbox" aria-label="Warianty">' +
      chips +
      "</div>" +
      '<div class="dam-viz-modal__actions">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon" id="damVizModalGoProduct" data-pid="' +
      esc(first.product_id || "") +
      '" data-dam-tip="Otwiera karte produktu w Eksploratorze DAM">' +
      '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz</span></button>' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-btn-icon-only" id="damVizModalWinExplorer" data-path="' +
      esc(first.path || "") +
      '" aria-label="Eksplorator" title="Eksplorator Windows" data-dam-tip="Otwiera folder w Eksploratorze Windows">' +
      '<i class="uil uil-folder-open" aria-hidden="true"></i></button>' +
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
      (admin
        ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon" id="damVizModalSetThumb" data-dam-tip="Ustaw biezaca wizualke jako miniature karty (FRONT-S preferowany domyslnie)">' +
          '<i class="uil uil-image" aria-hidden="true"></i><span>Miniatura</span></button>'
        : "") +
      "</div></div></div></div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damVizModal");

    function paintZoom() {
      var hero = document.getElementById("damVizModalHero");
      var label = document.getElementById("damVizZoomLabel");
      if (hero) hero.style.transform = "scale(" + zoom + ")";
      if (label) label.textContent = Math.round(zoom * 100) + "%";
    }

    function selectVariant(idx) {
      activeIdx = idx;
      var v = items[idx];
      if (!v) return;
      zoom = 1;
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
          (carrierHuman(v.carrier || "") || "Nosnik") +
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
        zoom = Math.min(3, +(zoom + 0.2).toFixed(2));
        paintZoom();
      });
    }
    if (zout) {
      zout.addEventListener("click", function (e) {
        e.stopPropagation();
        zoom = Math.max(0.4, +(zoom - 0.2).toFixed(2));
        paintZoom();
      });
    }
    if (zreset) {
      zreset.addEventListener("click", function (e) {
        e.stopPropagation();
        zoom = 1;
        paintZoom();
      });
    }
    paintZoom();

    var setThumbBtn = document.getElementById("damVizModalSetThumb");
    if (setThumbBtn) {
      setThumbBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        if (!v || !v.product_id) {
          showToast("Brak produktu");
          return;
        }
        var thumbUrl = v.thumb_url || mediaPreviewUrl(v.path) || "";
        saveThumbOverride(v.product_id, {
          path: v.path || "",
          file: v.file || "",
          thumb_url: thumbUrl,
          updated_at: new Date().toISOString(),
        });
        /* Natychmiast odswiez karte w siatce */
        var card = document.querySelector(
          '.dam-viz-card[data-group-pid="' +
            String(group.pid).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
            '"] .dam-viz-thumb__img'
        );
        if (card && thumbUrl) card.src = thumbUrl.split("?")[0] + "?v=" + Date.now();
        showToast("Ustawiono miniature dla " + (v.product_name || v.product_id));
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
    var carrierLbl = carrierHuman(first.carrier || "");
    var productName = first.product_name || group.pid || "Produkt";
    var indexLbl = displayIndex(first);
    // Preferuj miniaturke z poprawnym indeksem (po naprawie noid -> 6300xxx)
    if (indexLbl && thumb && thumb.indexOf("__noid_") !== -1) {
      thumb = thumbStem(first.product_id || group.pid, indexLbl, first.lang || "pl");
    }

    return (
      '<article class="dam-viz-card dam-viz-card--clickable" data-group-pid="' + esc(group.pid) + '">' +
        '<div class="dam-viz-thumb">' +
          (thumb
            ? '<img class="dam-viz-thumb__img" src="' + esc(thumb) + '" alt="" loading="lazy" onerror="window.damVizThumbError(this)">'
            : '<img class="dam-viz-thumb__img dam-viz-thumb__img--placeholder" src="' + PLACEHOLDER_SVG.replace(/"/g, "&quot;") + '" alt="">') +
        '</div>' +
        '<div class="dam-viz-card__body">' +
          '<div class="dam-viz-card__badges">' +
            '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + '</span>' +
            (indexLbl
              ? '<span class="dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(indexLbl) + "</span>"
              : '<span class="dam-viz-badge dam-viz-badge--index-miss" title="Brak numeru indeksu w nazwie folderu">Bez indeksu</span>') +
            (isMultiLang
              ? '<span class="dam-viz-badge" style="background:rgba(255,159,67,0.12);color:#C96A12">Multijezyczny</span>'
              : isMultiIndex
                ? '<span class="dam-viz-badge" style="background:rgba(171,84,219,0.12);color:#7A3AA8">Wiele rewizji</span>'
                : '<span class="dam-viz-badge dam-viz-badge--lang">' + esc(first.lang_label || labelForLang(first.lang)) + '</span>') +
          '</div>' +
          '<h5 class="dam-viz-card__title">' + esc(productName) + '</h5>' +
          (carrierLbl ? '<p class="dam-viz-card__meta">' + esc(carrierLbl) + '</p>' : '') +
          '<div class="dam-viz-card__actions">' +
            '<a class="geex-btn geex-btn--primary dam-btn-icon" href="explorer.html?product=' + encodeURIComponent(first.product_id || "") + '" title="Przejdz do produktu" data-dam-tip="Otwiera karte produktu w hubie DAM">' +
              '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz</span></a>' +
            '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-win-explorer-btn" data-path="' + esc(first.path || "") + '" aria-label="Eksplorator" title="Eksplorator Windows" data-dam-tip="Otwiera folder w Eksploratorze Windows">' +
              '<i class="uil uil-folder-open" aria-hidden="true"></i></button>' +
            '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-share-btn" data-group-pid="' + esc(group.pid) + '" aria-label="Udostepnij" title="Udostepnij" data-dam-tip="Udostepnij plik przez Synology Drive">' +
              '<i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
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
    if (adminToggle) {
      adminToggle.checked = isAdminMode();
      adminToggle.addEventListener("change", function () {
        localStorage.setItem(ADMIN_KEY, this.checked ? "1" : "0");
      });
    }

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
      latestOnly = readLatestOnly();
      var latestToggleEl = document.getElementById("vizLatestOnly");
      if (latestToggleEl) {
        latestToggleEl.checked = latestOnly;
        var sw = latestToggleEl.closest(".dam-switch");
        if (sw) sw.classList.toggle("is-off", !latestOnly);
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
    var latestToggle = document.getElementById("vizLatestOnly");
    function syncLatestSwitchUi() {
      if (!latestToggle) return;
      var wrap = latestToggle.closest(".dam-switch");
      if (wrap) wrap.classList.toggle("is-off", !latestToggle.checked);
    }
    if (latestToggle) {
      latestToggle.checked = readLatestOnly();
      syncLatestSwitchUi();
      latestToggle.addEventListener("change", function () {
        latestOnly = !!latestToggle.checked;
        localStorage.setItem(LATEST_KEY, latestOnly ? "1" : "0");
        syncLatestSwitchUi();
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
