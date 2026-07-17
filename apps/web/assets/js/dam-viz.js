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

  function openProductModal(group) {
    var existing = document.getElementById("damVizModal");
    if (existing) existing.remove();

    var items = group.items;
    var first = items[0];
    var productName = first.product_name || first.product_id || "Produkt";
    var brand = first.brand || "DK";

    var syEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");

    // Language variants
    var langBadges = items.map(function (v) {
      var ll = v.lang_label || labelForLang(v.lang);
      var thumb = v.thumb_url || "";
      return (
        '<div class="dam-viz-modal__variant" data-path="' + esc(v.path || "") + '">' +
          (thumb
            ? '<img class="dam-viz-modal__variant-thumb" src="' + esc(thumb) + '" alt="' + esc(ll) + '" onerror="this.src=\'' + PLACEHOLDER_SVG.replace(/'/g, "%27") + '\'">'
            : '<div class="dam-viz-modal__variant-placeholder"><i class="uil uil-image"></i></div>') +
          '<span class="dam-viz-badge dam-viz-badge--lang" style="font-size:10px">' + esc(ll) + '</span>' +
        '</div>'
      );
    }).join("");

    var shareBtnTitle = syEnabled ? "Udostepnij przez Synology Drive" : "Wlacz Synology Drive w Ustawieniach";
    var shareBtnDisabled = syEnabled ? "" : " disabled";

    var html =
      '<div class="dam-viz-modal-overlay" id="damVizModal" role="dialog" aria-modal="true" aria-label="Podglad wizualizacji">' +
        '<div class="dam-viz-modal-box">' +
          '<button type="button" class="dam-viz-modal-close" id="damVizModalClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
          '<div class="dam-viz-modal__thumb">' +
            (first.thumb_url
              ? '<img src="' + esc(first.thumb_url) + '" alt="' + esc(productName) + '" onerror="this.src=\'' + PLACEHOLDER_SVG.replace(/'/g, "%27") + '\'">'
              : '<div class="dam-viz-modal__nothumb"><i class="uil uil-image"></i></div>') +
          '</div>' +
          '<div class="dam-viz-modal__body">' +
            '<div class="dam-viz-card__badges" style="margin-bottom:8px">' +
              '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + '</span>' +
              (items.length > 1
                ? '<span class="dam-viz-badge" style="background:rgba(255,159,67,0.12);color:#C96A12">Multijezyczny</span>'
                : '') +
            '</div>' +
            '<h4 class="dam-viz-modal__title">' + esc(productName) + '</h4>' +
            '<p class="dam-viz-modal__carrier" style="font-size:12px;color:#8b8d97;margin:0 0 12px">' +
              esc(carrierHuman(first.carrier || "")) +
            '</p>' +
            '<div class="dam-viz-modal__variants">' + langBadges + '</div>' +
            '<div class="dam-viz-modal__actions">' +
              '<button type="button" class="geex-btn geex-btn--primary dam-btn-icon" id="damVizModalGoProduct" data-pid="' + esc(first.product_id || "") + '" data-dam-tip="Otwiera karte produktu w hubie DAM (Explorer HTML)">' +
                '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz do produktu</span></button>' +
              '<button type="button" class="geex-btn dam-btn-icon" id="damVizModalWinExplorer" data-path="' + esc(first.path || "") + '" data-dam-tip="Otwiera folder produktu w Eksploratorze Windows (sciezka folderu, nie plik)">' +
                '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Eksplorator produktu</span></button>' +
              '<button type="button" class="geex-btn dam-btn-icon" id="damVizModalCopyPath" data-path="' + esc(first.path || "") + '" data-dam-tip="Kopiuje lokalna sciezke pliku">' +
                '<i class="uil uil-copy" aria-hidden="true"></i><span>Kopiuj sciezke</span></button>' +
              '<button type="button" class="geex-btn dam-btn-icon' + (syEnabled ? '' : ' disabled') + '" id="damVizModalShare"' + shareBtnDisabled + ' title="' + esc(shareBtnTitle) + '" data-dam-tip="' + esc(shareBtnTitle) + '">' +
                '<i class="uil uil-share-alt" aria-hidden="true"></i><span>Udostepnij</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", html);

    var modal = document.getElementById("damVizModal");

    // Warianty - klikniecie zmienia miniature
    modal.querySelectorAll(".dam-viz-modal__variant").forEach(function (el) {
      el.style.cursor = "pointer";
      el.addEventListener("click", function () {
        var path = this.getAttribute("data-path");
        if (path) {
          var thumbImg = modal.querySelector(".dam-viz-modal__thumb img");
          if (thumbImg) {
            thumbImg.src = path; // lokalny plik - przegladarka moze nie zaladowac, ok
          }
          copyToClipboard(path).then(function () { showToast("Skopiowano sciezke"); });
          if (window.DamPaths) {
            window.DamPaths.logAction("copy_path", { path: path, detail: "Wariant wizualizacji" });
          }
        }
      });
    });

    // Przejdz do produktu (hub DAM / explorer.html) - dawniej mylnie "Eksplorator produktu"
    var goProductBtn = document.getElementById("damVizModalGoProduct");
    if (goProductBtn) {
      goProductBtn.addEventListener("click", function () {
        var pid = this.getAttribute("data-pid");
        window.location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    }

    // Eksplorator produktu = Windows Explorer, folder sciezki (nie plik)
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

    // Kopiuj sciezke
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
        }).catch(function () {
          showToast("Blad kopiowania - skopiuj recznie: " + path);
        });
      });
    }

    // Udostepnij -> okno Synology Drive (Uzyskaj lacze)
    var shareBtn = document.getElementById("damVizModalShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!syEnabled) return;
        modal.remove();
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(first.path || "");
        } else {
          showToast("DamPaths niedostepne - odswiez strone");
        }
      });
    }

    // Zamknij
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
    var items = group.items;
    var first = items[0];
    var thumb = first.thumb_url || "";
    var brand = first.brand || "DK";
    var isMultiLang = items.length > 1;
    var carrierLbl = carrierHuman(first.carrier || "");
    var productName = first.product_name || group.pid || "Produkt";

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
            (isMultiLang
              ? '<span class="dam-viz-badge" style="background:rgba(255,159,67,0.12);color:#C96A12">Multijezyczny</span>'
              : '<span class="dam-viz-badge dam-viz-badge--lang">' + esc(first.lang_label || labelForLang(first.lang)) + '</span>') +
          '</div>' +
          '<h5 class="dam-viz-card__title">' + esc(productName) + '</h5>' +
          (carrierLbl ? '<p class="dam-viz-card__meta">' + esc(carrierLbl) + '</p>' : '') +
          '<div class="dam-viz-card__actions">' +
            '<a class="geex-btn geex-btn--primary dam-btn-icon" href="explorer.html?product=' + encodeURIComponent(first.product_id || "") + '" title="Przejdz do produktu" data-dam-tip="Otwiera karte produktu w hubie DAM">' +
              '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdz do produktu</span></a>' +
            '<button type="button" class="geex-btn dam-btn-icon dam-viz-win-explorer-btn" data-path="' + esc(first.path || "") + '" title="Eksplorator produktu" data-dam-tip="Otwiera folder w Eksploratorze Windows">' +
              '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Eksplorator</span></button>' +
            '<button type="button" class="geex-btn dam-btn-icon dam-viz-share-btn" data-group-pid="' + esc(group.pid) + '" title="Udostepnij" data-dam-tip="Udostepnij plik przez Synology Drive">' +
              '<i class="uil uil-share-alt" aria-hidden="true"></i><span>Udostepnij</span></button>' +
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

  function applyFilters() {
    var lang = (document.getElementById("vizLangFilter") || {}).value || "";
    var q = ((document.getElementById("vizSearch") || {}).value || "").trim().toLowerCase();

    filtered = all.filter(function (v) {
      var brand = v.brand || "DK";
      if (!brandFilter[brand]) return false;
      if (lang && (v.lang || "") !== lang) return false;
      if (!q) return true;
      var blob = [
        v.product_name || "",
        v.index || "",
        v.index_base || "",
        v.carrier || "",
        v.file || "",
        v.lang_label || "",
        v.brand || ""
      ].join(" ").toLowerCase();
      // indexOf("") === 0 zawsze - nie matchuj pustych cyfr z tekstowego query
      var digits = q.replace(/\D/g, "");
      if (blob.indexOf(q) !== -1) return true;
      if (digits.length >= 4 && (v.index_base || "").indexOf(digits) !== -1) return true;
      return false;
    });
    render();
  }

  function init() {
    var grid = document.getElementById("vizGrid");
    if (!grid) return;

    // Synology enabled?
    synologyEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");

    // Brand filter - inicjuj trigger lub fallback
    brandFilter = window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true };

    var brandTrigger = document.getElementById("vizBrandFilterTrigger");
    if (brandTrigger && window.DamBrandFilter) {
      window.DamBrandFilter.init(brandTrigger, function (brands) {
        brandFilter = brands;
        applyFilters();
      });
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
      langLabels = data.lang_labels || {};
      all = (data.viz_latest || []).slice();
      if (wantProduct) {
        all = all.filter(function (v) { return v.product_id === wantProduct; });
      }
      populateLangFilter(all);
      if (wantLang) {
        var sel = document.getElementById("vizLangFilter");
        if (sel) sel.value = wantLang;
      }
      applyFilters();
      if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
        window.DamShell.setTrailLeaf("Wizualizacje");
      }
    }

    var p = window.DamSearch
      ? window.DamSearch.load().then(function () { return window._DAM_FILE_INDEX; })
      : fetch("data/file-index.json?v=20260717ux6").then(function (r) { return r.json(); });

    p.then(boot).catch(function (err) {
      grid.innerHTML = '<p style="color:#FF5653">Blad indeksu: ' + esc(err.message) + "</p>";
    });

    var langSel = document.getElementById("vizLangFilter");
    var search = document.getElementById("vizSearch");
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
