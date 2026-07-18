/**
 * DAM ETA - wspolny renderer tagow (explorer + wizualizacje).
 * Klikalne, kontekstowe: filtr w biezacym widoku.
 */
(function (global) {
  "use strict";

  var MAX_PER_KIND = 4;
  var FORBIDDEN_CARRIER_RE = /^(OTHER|UNKNOWN|WARIANT)$/i;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ui(key, fallback) {
    var strings = (global.DamLabels && global.DamLabels.UI_STRINGS) || {};
    return strings[key] || fallback;
  }

  function langShort(code) {
    if (global.DamLabels && typeof global.DamLabels.langShort === "function") {
      return global.DamLabels.langShort(code);
    }
    var c = String(code || "").toLowerCase();
    if (c === "en") c = "gb";
    if (c === "ua") c = "uk";
    return c ? c.toUpperCase() : "";
  }

  function langFull(code) {
    if (global.DamLabels && typeof global.DamLabels.langLabel === "function") {
      return global.DamLabels.langLabel(code);
    }
    return langShort(code);
  }

  function detectContext() {
    var path = (global.location && global.location.pathname) || "";
    var page = path.split("/").pop() || "";
    if (page.indexOf("visualizations") === 0) return "viz";
    if (page.indexOf("explorer") === 0) return "explorer";
    if (page.indexOf("project") === 0) return "project";
    return "viz";
  }

  /**
   * @param {object} opts
   * brand, category, subcategory, carrier, carrierLabel, langs (array|string),
   * index, multiLang, multiIndex, demo, mix, hidden,
   * maxPerKind (default 4), compact (card vs modal)
   *
   * Kolejnosc tagow ZAWSZE: Marka -> Kategoria -> Podkategoria -> Typ ->
   * Warianty -> Jezyk -> Indeks (2026-07-18, wymog uzytkownika - nie zmieniac).
   */
  function buildBadgeItems(opts) {
    opts = opts || {};
    var items = [];
    var brand = opts.brand || "";
    if (brand) {
      items.push({
        kind: "brand",
        value: brand,
        label: brand,
        cls: "dam-viz-badge--brand",
        tip: "Marka " + brand,
      });
    }
    if (opts.category) {
      var catTitle =
        global.DamLabels && typeof global.DamLabels.categoryTitle === "function"
          ? global.DamLabels.categoryTitle(opts.category)
          : opts.category;
      items.push({
        kind: "category",
        value: opts.category,
        label: catTitle,
        cls: "dam-viz-badge--cat",
        tip: "Kategoria: " + catTitle,
      });
    }
    if (opts.subcategory) {
      items.push({
        kind: "subcategory",
        value: opts.subcategory,
        label: opts.subcategoryLabel || opts.subcategory,
        cls: "dam-viz-badge--subcat",
        tip: "Podkategoria: " + (opts.subcategoryLabel || opts.subcategory),
      });
    }

    var carrierLbl =
      opts.carrierLabel ||
      (global.DamLabels && typeof global.DamLabels.carrierLabel === "function"
        ? global.DamLabels.carrierLabel(opts.carrier, opts.revisionFolder || opts.carrier, {
            isMix: opts.mix,
            productName: opts.productName,
            tags: opts.tags,
          })
        : opts.carrier);
    if (carrierLbl && FORBIDDEN_CARRIER_RE.test(String(carrierLbl).trim())) carrierLbl = "";
    if (carrierLbl) {
      items.push({
        kind: "carrier",
        value: carrierLbl,
        label: carrierLbl,
        cls: "dam-viz-badge--carrier dam-tag-editable" + (opts.carrierGuessed ? " dam-viz-badge--guessed" : ""),
        tip: (opts.carrierGuessed
          ? "Nosnik (zgadniety). Klik: filtr. Admin: podwojny klik lub Shift+klik = zmiana typu: "
          : "Nosnik. Klik: filtr. Admin: podwojny klik lub Shift+klik = zmiana typu: ") + carrierLbl,
        guessed: !!opts.carrierGuessed,
        data: {
          "revision-path": opts.revisionFullPath || "",
          "current-code": opts.carrier || "",
          "product-id": opts.productId || "",
          "product-name": opts.productName || "",
        },
      });
    } else if (opts.showCarrierPlaceholder) {
      /* Brak typu i brak zgadniecia - user moze wciaz proponowac (Faza 4, P5). */
      items.push({
        kind: "carrier",
        value: "",
        label: ui("no_carrier_label", "Dodaj typ"),
        cls: "dam-viz-badge--index-miss dam-tag-editable",
        tip: "Brak typu - kliknij, aby zaproponowac/ustawic (admin: tez Shift+klik)",
        data: {
          "revision-path": opts.revisionFullPath || "",
          "current-code": "",
          "product-id": opts.productId || "",
          "product-name": opts.productName || "",
        },
      });
    }

    if (opts.multiIndex) {
      items.push({
        kind: "flag",
        value: "variants",
        label: ui("multi_index_label", "Warianty"),
        cls: "dam-viz-badge--variants",
        tip: "Wiele wariantow / indeksow",
      });
    }

    var langs = opts.langs;
    if (!langs && opts.lang) langs = [opts.lang];
    if (!Array.isArray(langs)) langs = langs ? [langs] : [];
    langs = langs.filter(Boolean);

    if (opts.multiLang || langs.length > 1) {
      items.push({
        kind: "flag",
        value: "multilang",
        label: ui("multi_lang_label", "Multijezyczny"),
        cls: "dam-viz-badge--multilang",
        tip: "Wiele wersji jezykowych",
      });
      /* Kafelek glowny (compact): TYLKO flaga Multijezyczny, bez wyliczania
         wszystkich kodow GB/EE/LT/... - to bylo za gesto (2026-07-18). */
      if (!opts.compact) {
        langs.forEach(function (lg) {
          var short = langShort(lg);
          if (!short) return;
          items.push({
            kind: "lang",
            value: String(lg).toLowerCase(),
            label: short,
            cls: "dam-viz-badge--lang",
            tip: langFull(lg) || short,
          });
        });
      }
    } else if (langs.length === 1) {
      var lg1 = langs[0];
      var short1 = langShort(lg1);
      items.push({
        kind: "lang",
        value: String(lg1).toLowerCase(),
        label: short1,
        cls: "dam-viz-badge--lang",
        tip: langFull(lg1) || short1,
      });
    } else if (opts.langLabel && !opts.compact) {
      items.push({
        kind: "lang",
        value: String(opts.lang || opts.langLabel).toLowerCase(),
        label: langShort(opts.lang) || opts.langLabel,
        cls: "dam-viz-badge--lang",
        tip: opts.langLabel,
      });
    }

    if (opts.index) {
      items.push({
        kind: "index",
        value: String(opts.index),
        label: String(opts.index),
        cls: "dam-viz-badge--index",
        tip: "Indeks produktu",
      });
    } else if (opts.showNoIndex) {
      items.push({
        kind: "index",
        value: "",
        label: ui("no_index_label", "Bez indeksu"),
        cls: "dam-viz-badge--index-miss",
        tip: "Brak numeru indeksu w nazwie folderu",
      });
    }

    if (opts.demo) {
      items.push({
        kind: "flag",
        value: "demo",
        label: ui("demo_label", "Demo"),
        cls: "dam-viz-badge--demo",
        tip: "Demo (zolta obwodka). Admin: kliknij, aby odkliknac",
        style: "background:rgba(240,180,0,0.16);color:#8A6A00",
        data: {
          "product-id": opts.productId || "",
          "flag-key": opts.flagKey || "",
        },
      });
    }
    if (opts.mix) {
      items.push({
        kind: "flag",
        value: "mix",
        label: "MIX",
        cls: "dam-viz-badge--mix",
        tip: "Produkt MIX",
        style: "background:rgba(46,134,193,0.12);color:#1B6CA8",
      });
    }
    if (opts.hidden) {
      items.push({
        kind: "flag",
        value: "hidden",
        label: "(UKRYTE)",
        cls: "dam-viz-badge--hidden",
        tip: "Tylko admin: kliknij, aby pokazac kafelek znowu",
        data: {
          "product-id": opts.productId || "",
          "flag-key": opts.flagKey || "",
        },
      });
    }
    return items;
  }

  function renderOverflow(items, maxPerKind) {
    maxPerKind = maxPerKind == null ? MAX_PER_KIND : maxPerKind;
    var byKind = {};
    var ordered = [];
    items.forEach(function (it) {
      var k = it.kind || "other";
      if (!byKind[k]) byKind[k] = [];
      byKind[k].push(it);
    });
    Object.keys(byKind).forEach(function (k) {
      var group = byKind[k];
      if (group.length <= maxPerKind) {
        group.forEach(function (it) {
          ordered.push(it);
        });
        return;
      }
      group.slice(0, maxPerKind).forEach(function (it) {
        ordered.push(it);
      });
      var rest = group.length - maxPerKind;
      ordered.push({
        kind: "more",
        value: String(rest),
        label: "+" + rest,
        cls: "dam-viz-badge--more",
        tip: "Pokaz pozostale (" + rest + ")",
        moreKind: k,
        moreItems: group.slice(maxPerKind),
      });
    });
    return ordered;
  }

  function badgeHtml(it) {
    var style = it.style ? ' style="' + esc(it.style) + '"' : "";
    var tip = it.tip || it.label || "";
    var clickable =
      (it.kind !== "more" && it.kind !== "flag") ||
      it.value === "mix" ||
      it.value === "demo" ||
      it.value === "hidden";
    if (it.kind === "flag" && it.value !== "mix" && it.value !== "demo" && it.value !== "variants" && it.value !== "multilang" && it.value !== "hidden") {
      clickable = false;
    }
    if (it.kind === "more") clickable = false;
    var tag = clickable ? "button" : "span";
    var typeAttr = tag === "button" ? ' type="button"' : "";
    var extraData = "";
    if (it.data) {
      Object.keys(it.data).forEach(function (k) {
        extraData += ' data-' + k + '="' + esc(it.data[k]) + '"';
      });
    }
    return (
      "<" +
      tag +
      typeAttr +
      ' class="dam-viz-badge dam-badge-tag ' +
      esc(it.cls || "") +
      '"' +
      style +
      ' data-tag-kind="' +
      esc(it.kind || "") +
      '" data-tag-value="' +
      esc(it.value || "") +
      '" data-dam-tip="' +
      esc(tip) +
      '" title="' +
      esc(tip) +
      '"' +
      extraData +
      ">" +
      esc(it.label) +
      "</" +
      tag +
      ">"
    );
  }

  function render(opts) {
    opts = opts || {};
    var items = buildBadgeItems(opts);
    var max = opts.maxPerKind == null ? MAX_PER_KIND : opts.maxPerKind;
    if (opts.overflow !== false) items = renderOverflow(items, max);
    /* Karty (compact): maxTotal trzyma 2 rzedy - bez ucinania overflow:hidden.
       Flag (UKRYTE)/Demo zawsze zostaja widoczne dla admina. */
    var maxTotal = opts.maxTotal;
    if (maxTotal && items.length > maxTotal) {
      var priority = items.filter(function (it) {
        return it.kind === "flag" && (it.value === "hidden" || it.value === "demo");
      });
      var rest = items.filter(function (it) {
        return !(it.kind === "flag" && (it.value === "hidden" || it.value === "demo"));
      });
      var keep = Math.max(1, maxTotal - 1 - priority.length);
      var head = rest.slice(0, keep);
      var restN = rest.length - head.length;
      items = head.concat(priority);
      if (restN > 0) {
        items.push({
          kind: "more",
          value: String(restN),
          label: "+" + restN,
          cls: "dam-viz-badge--more",
          tip: "Pokaz pozostale (" + restN + ")",
        });
      }
    }
    return items.map(badgeHtml).join("");
  }

  function applyTagFilter(kind, value, context) {
    context = context || detectContext();
    var v = String(value || "").trim();
    if (!v && kind !== "index") return;

    if (context === "viz") {
      var search = document.getElementById("vizSearch");
      var langSel = document.getElementById("vizLangFilter");
      if (kind === "lang" && langSel) {
        langSel.value = v;
        langSel.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (kind === "brand") {
        /* brand toggle handled by dam-viz brandFilter if present */
        if (typeof global.damVizApplyBrandTag === "function") {
          global.damVizApplyBrandTag(v);
          return;
        }
      }
      if (search) {
        search.value = v;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    if (context === "explorer") {
      var input = document.getElementById("damFileSearch");
      if (input) {
        input.value = v;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    if (context === "project") {
      var pInput =
        document.getElementById("damProjectSearch") ||
        document.querySelector("[data-dam-project-search]");
      if (pInput) {
        pInput.value = v;
        pInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  function openCarrierEdit(btn) {
    if (!global.DamTagEdit || typeof global.DamTagEdit.openCarrierPicker !== "function") return;
    global.DamTagEdit.openCarrierPicker(btn, {
      revisionPath: btn.getAttribute("data-revision-path") || "",
      currentCode: btn.getAttribute("data-current-code") || "",
      productId: btn.getAttribute("data-product-id") || "",
      productName: btn.getAttribute("data-product-name") || "",
    });
  }

  function isAdminEditMode() {
    return (
      global.DamTagEdit &&
      typeof global.DamTagEdit.isPrivileged === "function" &&
      global.DamTagEdit.isPrivileged() &&
      typeof global.DamTagEdit.adminModeOn === "function" &&
      global.DamTagEdit.adminModeOn()
    );
  }

  function bindClicks(root, context) {
    var el = typeof root === "string" ? document.querySelector(root) : root;
    if (!el || el._damBadgesBound) return;
    el._damBadgesBound = true;
    var lastClick = { t: 0, btn: null };

    el.addEventListener("click", function (e) {
      var btn = e.target.closest(".dam-badge-tag[data-tag-kind]");
      if (!btn || !el.contains(btn)) return;
      var kind = btn.getAttribute("data-tag-kind") || "";
      var value = btn.getAttribute("data-tag-value") || "";
      if (kind === "more") return;

      /* Tag (UKRYTE) - tylko admin: odklikuje ukrycie */
      if (kind === "flag" && value === "hidden") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof global.damVizToggleHidden === "function") {
          global.damVizToggleHidden({
            productId: btn.getAttribute("data-product-id") || "",
            flagKey: btn.getAttribute("data-flag-key") || "",
            fromBadge: true,
          });
        }
        return;
      }

      /* Tag Demo - admin: toggle demo */
      if (kind === "flag" && value === "demo" && isAdminEditMode()) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof global.damVizToggleDemo === "function") {
          global.damVizToggleDemo({
            productId: btn.getAttribute("data-product-id") || "",
            flagKey: btn.getAttribute("data-flag-key") || "",
          });
        }
        return;
      }

      var editable = btn.classList.contains("dam-tag-editable");
      var isPlaceholder = editable && !value;
      var adminEdit = isAdminEditMode();
      var ctx = context || detectContext();
      var now = Date.now();

      /* Placeholder "Dodaj typ" - pojedynczy klik otwiera picker (wszystkie role) */
      if (isPlaceholder && global.DamTagEdit) {
        e.preventDefault();
        e.stopPropagation();
        openCarrierEdit(btn);
        return;
      }

      /* Admin + typ: Shift+klik od razu, podwojny klik <=500ms (bez filtra na 1. klik) */
      if (adminEdit && editable && global.DamTagEdit) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          clearTimeout(btn._damFilterTimer);
          openCarrierEdit(btn);
          lastClick = { t: 0, btn: null };
          return;
        }
        if (lastClick.btn === btn && now - lastClick.t <= 500) {
          clearTimeout(btn._damFilterTimer);
          openCarrierEdit(btn);
          lastClick = { t: 0, btn: null };
          return;
        }
        lastClick = { t: now, btn: btn };
        clearTimeout(btn._damFilterTimer);
        btn._damFilterTimer = setTimeout(function () {
          applyTagFilter(kind, value, ctx);
        }, 520);
        return;
      }

      /* Zwykly user na zgadnietym: pojedynczy klik = propozycja */
      if (
        editable &&
        global.DamTagEdit &&
        !adminEdit &&
        btn.classList.contains("dam-viz-badge--guessed")
      ) {
        e.preventDefault();
        e.stopPropagation();
        openCarrierEdit(btn);
        return;
      }

      /* Brand w trybie admina: Shift lub dbl -> confirm DK/GC vs sciezka */
      if (
        adminEdit &&
        kind === "brand" &&
        global.DamTagEdit &&
        typeof global.DamTagEdit.confirmBrandTagChange === "function"
      ) {
        e.preventDefault();
        e.stopPropagation();
        var rev =
          btn.getAttribute("data-revision-path") ||
          (btn.closest("[data-path]") && btn.closest("[data-path]").getAttribute("data-path")) ||
          "";
        var other = value === "GC" ? "DK" : value === "DK" ? "GC" : "";
        if (e.shiftKey || (lastClick.btn === btn && now - lastClick.t <= 500)) {
          lastClick = { t: 0, btn: null };
          if (other && global.DamTagEdit.confirmBrandTagChange(rev, other)) {
            applyTagFilter(kind, other, ctx);
          }
          return;
        }
        lastClick = { t: now, btn: btn };
        clearTimeout(btn._damFilterTimer);
        btn._damFilterTimer = setTimeout(function () {
          applyTagFilter(kind, value, ctx);
        }, 520);
        return;
      }

      if (btn.tagName === "BUTTON" || btn.classList.contains("dam-badge-tag")) {
        e.preventDefault();
        e.stopPropagation();
        applyTagFilter(kind, value, ctx);
      }
    });
  }

  global.DamBadges = {
    render: render,
    buildBadgeItems: buildBadgeItems,
    bindClicks: bindClicks,
    applyTagFilter: applyTagFilter,
    detectContext: detectContext,
    MAX_PER_KIND: MAX_PER_KIND,
  };
})(typeof window !== "undefined" ? window : globalThis);
