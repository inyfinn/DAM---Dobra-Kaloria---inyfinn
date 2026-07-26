/**
 * DAM - wspolny renderer tagow (explorer + wizualizacje).
 * Klikalne, kontekstowe: filtr w biezacym widoku.
 */
(function (global) {
  "use strict";

  /* Global +5% badge scale — late <style> wins over dam-branding.css load order. */
  function ensureBadgeScale5() {
    if (typeof document === "undefined" || document.getElementById("damBadgeScale5")) return;
    var s = document.createElement("style");
    s.id = "damBadgeScale5";
    s.textContent =
      ".dam-viz-badge,button.dam-viz-badge,.dam-badge-tag," +
      ".dam-viz-card .dam-viz-badge,.dam-viz-card button.dam-viz-badge," +
      ".dam-viz-modal__body #damVizModalBadges .dam-viz-badge," +
      ".dam-viz-modal__body #damVizModalBadges button.dam-viz-badge," +
      ".dam-viz-modal__body #damMediaPreviewBadges .dam-viz-badge," +
      ".dam-viz-modal__body #damMediaPreviewBadges button.dam-viz-badge," +
      ".dam-assoc-edit-popover__tags .dam-viz-badge," +
      ".dam-project-card__badges .dam-viz-badge,.dam-project-card__badges button.dam-viz-badge," +
      ".dam-project-card__index-corner .dam-viz-badge,.dam-project-card__index-corner button.dam-viz-badge," +
      ".dam-project-header-badges .dam-viz-badge,.dam-project-header-badges button.dam-viz-badge," +
      ".dam-inbox-item__tags .dam-viz-badge,.dam-inbox-item__product-badges .dam-viz-badge," +
      ".dam-widget__viz-badges .dam-viz-badge," +
      ".dam-branding-tag-filters .dam-tag-group-pills .dam-viz-badge," +
      ".dam-branding-tag-filters .dam-tag-group-pills .dam-viz-badge.is-active," +
      ".dam-branding-tag-filters .dam-branding-tag-group--przeznaczenie-tiles .dam-tag-group-pills .dam-viz-badge{" +
      "font-size:calc((var(--dam-tag-fs-pill,10.5px) + 1px) * var(--dam-badge-scale,1.05));}" +
      ".dam-viz-badge,button.dam-viz-badge,.dam-badge-tag," +
      ".dam-assoc-edit-popover__tags .dam-viz-badge," +
      ".dam-branding-tag-filters .dam-tag-group-pills .dam-viz-badge," +
      ".dam-branding-tag-filters .dam-tag-group-pills .dam-viz-badge.is-active," +
      ".dam-branding-tag-filters .dam-branding-tag-group--przeznaczenie-tiles .dam-tag-group-pills .dam-viz-badge{" +
      "padding:calc(2px * var(--dam-badge-scale,1.05)) calc(8px * var(--dam-badge-scale,1.05));}" +
      ".dam-viz-card .dam-viz-badge,.dam-viz-card button.dam-viz-badge," +
      ".dam-viz-modal__body #damVizModalBadges .dam-viz-badge," +
      ".dam-viz-modal__body #damVizModalBadges button.dam-viz-badge," +
      ".dam-viz-modal__body #damMediaPreviewBadges .dam-viz-badge," +
      ".dam-viz-modal__body #damMediaPreviewBadges button.dam-viz-badge{" +
      "padding:calc(5px * var(--dam-badge-scale,1.05)) calc(11px * var(--dam-badge-scale,1.05));}" +
      ".dam-project-card__badges .dam-viz-badge,.dam-project-card__badges button.dam-viz-badge," +
      ".dam-project-card__index-corner .dam-viz-badge,.dam-project-card__index-corner button.dam-viz-badge," +
      ".dam-project-header-badges .dam-viz-badge,.dam-project-header-badges button.dam-viz-badge{" +
      "padding:calc(4px * var(--dam-badge-scale,1.05)) calc(10px * var(--dam-badge-scale,1.05));}" +
      ".dam-carrier-toggle__chips .dam-viz-badge,.dam-carrier-toggle__chips button.dam-viz-badge{" +
      "height:calc(22px * var(--dam-badge-scale,1.05));" +
      "min-height:calc(22px * var(--dam-badge-scale,1.05));" +
      "max-height:calc(22px * var(--dam-badge-scale,1.05));" +
      "line-height:calc(22px * var(--dam-badge-scale,1.05));" +
      "padding:0 calc(10px * var(--dam-badge-scale,1.05));" +
      "font-size:calc((var(--dam-tag-fs-pill,10.5px) + 1px) * var(--dam-badge-scale,1.05));}";
    (document.head || document.documentElement).appendChild(s);
  }
  ensureBadgeScale5();

  var MAX_PER_KIND = 4;
  var FORBIDDEN_CARRIER_RE = /^(OTHER|UNKNOWN|WARIANT)$/i;
  var EDITABLE_TAG_KINDS = {
    brand: 1,
    category: 1,
    subcategory: 1,
    carrier: 1,
    lang: 1,
    status: 1,
    index: 1,
    asset_role: 1,
    appearance: 1,
  };

  /** Wspolne data-* dla edycji tagow (Shift+klik / dblclick w viz + branding preview). */
  function revisionBadgeData(opts) {
    opts = opts || {};
    return {
      "revision-path": opts.revisionFullPath || opts.revision_path || "",
      "revision-index": opts.revisionIndex || opts.index || "",
      "product-id": opts.productId || "",
      "product-name": opts.productName || "",
    };
  }

  function brandingBadgeData(asset) {
    asset = asset || {};
    return {
      "revision-path": asset.path || asset.revision_path || "",
      "product-id": asset.product_id || asset.linked_product_id || "",
      "product-name": asset.product_name || "",
    };
  }

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
    if (c === "en" || c === "uk") c = "gb";
    if (c === "ukr") c = "ua";
    return c ? c.toUpperCase() : "";
  }

  function langFull(code) {
    if (global.DamLabels && typeof global.DamLabels.langLabel === "function") {
      return global.DamLabels.langLabel(code);
    }
    return langShort(code);
  }

  /** Globalny casing tagow - DamLabels.formatTagLabel (kody vs zdanie). */
  function tagText(label, kind) {
    if (global.DamLabels && typeof global.DamLabels.formatTagLabel === "function") {
      return global.DamLabels.formatTagLabel(label, kind);
    }
    return String(label == null ? "" : label);
  }

  function detectContext() {
    var path = (global.location && global.location.pathname) || "";
    var page = path.split("/").pop() || "";
    if (page.indexOf("visualizations") === 0) return "viz";
    if (page.indexOf("explorer") === 0) return "explorer";
    if (page.indexOf("branding") === 0) return "branding";
    /* Lista projektow = index.html; szczegoly = project.html */
    if (page.indexOf("project") === 0 || page === "index.html" || page === "index") {
      return "project";
    }
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
    /* Tip edit: Shift+klik gdy admin/power_user (DamTagEdit) */
    var adminOn = isAdminEditMode();
    var editHint = canEditTags();
    var brand = opts.brand || "";
    if (brand) {
      var brandTip =
        "Marka " +
        tagText(brand, "brand") +
        ". Klik: filtr. Ctrl+klik: dodaj do wyszukiwania.";
      if (editHint) brandTip += " Shift+klik: edytuj.";
      items.push({
        kind: "brand",
        value: brand,
        label: tagText(brand, "brand"),
        cls: "dam-viz-badge--brand",
        tip: brandTip,
        data: revisionBadgeData(opts),
      });
    }
    if (opts.category) {
      var catTitle =
        global.DamLabels && typeof global.DamLabels.categoryTitle === "function"
          ? global.DamLabels.categoryTitle(opts.category)
          : opts.category;
      catTitle = tagText(catTitle, "category");
      var catTip = "Kategoria: " + catTitle + ". Klik: filtr. Ctrl+klik: dodaj do wyszukiwania.";
      if (editHint) catTip += " Shift+klik: edytuj.";
      items.push({
        kind: "category",
        value: opts.category,
        label: catTitle,
        cls: "dam-viz-badge--cat",
        tip: catTip,
        data: revisionBadgeData(opts),
      });
    }
    if (opts.subcategory) {
      var subLbl = tagText(opts.subcategoryLabel || opts.subcategory, "subcategory");
      var subTip = "Podkategoria: " + subLbl + ". Klik: filtr. Ctrl+klik: dodaj do wyszukiwania.";
      if (editHint) subTip += " Shift+klik: edytuj.";
      items.push({
        kind: "subcategory",
        value: opts.subcategory,
        label: subLbl,
        cls: "dam-viz-badge--subcat",
        tip: subTip,
        data: revisionBadgeData(opts),
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
    // Znormalizuj do pelnej nazwy UI (DOYPACK); skrot DOY tylko na dysku
    if (carrierLbl && global.DamLabels && typeof global.DamLabels.carrierLabel === "function") {
      var norm = global.DamLabels.carrierLabel(opts.carrier || carrierLbl, opts.revisionFolder || carrierLbl, {
        isMix: opts.mix,
        productName: opts.productName,
        tags: opts.tags,
      });
      if (norm) carrierLbl = norm;
    }
    if (carrierLbl && FORBIDDEN_CARRIER_RE.test(String(carrierLbl).trim())) carrierLbl = "";
    var carrierDisk =
      (global.DamLabels && typeof global.DamLabels.carrierShort === "function"
        ? global.DamLabels.carrierShort(opts.carrier || carrierLbl, opts.revisionFolder || carrierLbl)
        : "") || "";
    /* Tooltip: baza dla kazdego; dopisek Admin tylko gdy tryb admina wlaczony. */
    if (carrierLbl) {
      var carrierTip =
        (opts.carrierGuessed ? "Nosnik (zgadniety). " : "Nosnik. ") +
        carrierLbl +
        (carrierDisk && carrierDisk !== carrierLbl ? " (na dysku: " + carrierDisk + "). " : ". ") +
        "Klik: filtr. Ctrl+klik: dodaj do wyszukiwania.";
      if (opts.carrierPrevious) {
        carrierTip += " Wczesniej zatwierdzono: " + opts.carrierPrevious + ".";
      }
      if (editHint) carrierTip += " Shift+klik: edytuj typ.";
      carrierLbl = tagText(carrierLbl, "carrier");
      items.push({
        kind: "carrier",
        value: carrierLbl,
        label: carrierLbl,
        cls: "dam-viz-badge--carrier dam-tag-editable" + (opts.carrierGuessed ? " dam-viz-badge--guessed" : ""),
        tip: carrierTip,
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
      var noCarrierTip = "Brak typu. Klik: zaproponuj typ.";
      if (adminOn) noCarrierTip += " Shift+klik: wybierz z listy.";
      items.push({
        kind: "carrier",
        value: "",
        label: ui("no_carrier_label", "Dodaj typ"),
        cls: "dam-viz-badge--index-miss dam-tag-editable",
        tip: noCarrierTip,
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
        label: tagText(ui("multi_index_label", "Warianty"), "flag"),
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
        /* Compact (karty / pasek carrier): krotka etykieta, pelna w tipie. */
        label: tagText(
          opts.compact ? ui("multi_lang_short", "Multi") : ui("multi_lang_label", "Multijęzyczny"),
          "flag"
        ),
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
            data: revisionBadgeData(opts),
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
        data: revisionBadgeData(opts),
      });
    } else if (opts.langUnknown || opts.lang === "?" || opts.langLabel === "?") {
      items.push({
        kind: "lang",
        value: "unknown",
        label: "?",
        cls: "dam-viz-badge--lang dam-viz-badge--lang-unknown",
        tip: "Jezyk nieznany - brak kodu w nazwie folderu/pliku (ustaw recznie)",
        data: revisionBadgeData(opts),
      });
    } else if (opts.langLabel && !opts.compact) {
      items.push({
        kind: "lang",
        value: String(opts.lang || opts.langLabel).toLowerCase(),
        label: langShort(opts.lang) || opts.langLabel,
        cls: "dam-viz-badge--lang",
        tip: opts.langLabel,
        data: revisionBadgeData(opts),
      });
    }

    if (opts.index) {
      items.push({
        kind: "index",
        value: String(opts.index),
        label: String(opts.index),
        cls: "dam-viz-badge--index",
        tip: "Indeks produktu",
        data: revisionBadgeData(opts),
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
      var demoTip = "Demo (zolta obwodka) - wizualizacja prototypowa.";
      if (adminOn) demoTip += " Admin: kliknij, aby odkliknac.";
      items.push({
        kind: "flag",
        value: "demo",
        label: tagText(ui("demo_label", "Demo"), "flag"),
        cls: "dam-viz-badge--demo",
        tip: demoTip,
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

    if (opts.isArchive) {
      items.push({
        kind: "flag",
        value: "archive",
        label: "ARCHIWUM",
        cls: "dam-viz-badge--archive",
        tip: "Plik z folderu ARCHIWUM — nie jest aktualną rewizją produktu",
        style: "background:rgba(120,120,128,0.14);color:#5C5C66",
      });
    }

    var packagingTags = opts.packagingTags;
    if (!Array.isArray(packagingTags)) packagingTags = packagingTags ? [packagingTags] : [];
    packagingTags.filter(Boolean).forEach(function (tag) {
      items.push({
        kind: "pakowanie",
        value: String(tag),
        label: String(tag),
        cls: "dam-viz-badge--pakowanie dam-badge-tag--tier-low",
        tier: "low",
        tip: "Pakowanie zbiorcze: " + tag,
      });
    });

    return items;
  }

  function filterByTagTiers(items, tiers) {
    if (!tiers || !tiers.length) return items;
    var allowed = {};
    tiers.forEach(function (t) {
      allowed[t] = true;
    });
    return items.filter(function (it) {
      var tier = it.tier || "primary";
      if (it.kind === "pakowanie") tier = "low";
      return !!allowed[tier];
    });
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
    if (it.kind === "more") clickable = true;
    var tag = clickable ? "button" : "span";
    var typeAttr = tag === "button" ? ' type="button"' : "";
    var editableCls =
      clickable && it.kind !== "more" && EDITABLE_TAG_KINDS[it.kind]
        ? " dam-tag-editable"
        : "";
    var extraData = "";
    if (it.data) {
      Object.keys(it.data).forEach(function (k) {
        extraData += ' data-' + k + '="' + esc(it.data[k]) + '"';
      });
    }
    if (it.brandingAssetId) {
      extraData += ' data-branding-asset-id="' + esc(it.brandingAssetId) + '"';
    }
    if (it.kind === "more" && it.moreItems && it.moreItems.length) {
      try {
        extraData +=
          ' data-more-items="' +
          esc(JSON.stringify(it.moreItems.map(function (m) {
            return {
              kind: m.kind || "",
              value: m.value || "",
              label: m.label || "",
              cls: m.cls || "",
              tip: m.tip || "",
            };
          }))) +
          '"';
      } catch (eMore) { /* ignore */ }
    }
    if (isAdminEditMode() && editableCls) {
      tip += " Admin: Shift+klik lub podwojny klik - wybierz z listy.";
    }
    return (
      "<" +
      tag +
      typeAttr +
      ' class="dam-viz-badge dam-badge-tag ' +
      esc(it.cls || "") +
      editableCls +
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
    items = filterByTagTiers(items, opts.includeTagTiers);
    var max = opts.maxPerKind == null ? MAX_PER_KIND : opts.maxPerKind;
    if (opts.overflow !== false) items = renderOverflow(items, max);
    /* Karty (compact): maxTotal trzyma 2 rzedy - bez ucinania overflow:hidden.
       Flag (UKRYTE)/Demo zawsze zostaja widoczne dla admina. */
    var maxTotal = opts.maxTotal;
    if (maxTotal && items.length > maxTotal) {
      var priority = items.filter(function (it) {
        return it.kind === "flag" && (it.value === "hidden" || it.value === "demo" || it.value === "variants");
      });
      var rest = items.filter(function (it) {
        return !(it.kind === "flag" && (it.value === "hidden" || it.value === "demo" || it.value === "variants"));
      });
      var keep = Math.max(1, maxTotal - 1 - priority.length);
      var head = rest.slice(0, keep);
      var hidden = rest.slice(keep);
      var restN = hidden.length;
      items = head.concat(priority);
      if (restN > 0) {
        items.push({
          kind: "more",
          value: String(restN),
          label: "+" + restN,
          cls: "dam-viz-badge--more",
          tip: "Pokaz pozostale (" + restN + ")",
          moreItems: hidden,
        });
      }
    }
    return items.map(badgeHtml).join("");
  }

  /**
   * Token do wyszukiwarki: widoczna etykieta (Batony), nie surowy kod (01 - BATONY).
   * Usuwa same myslniki, zeby AND-split nie wymagal "-" w haystack.
   */
  function normalizeSearchToken(raw) {
    return String(raw || "")
      .replace(/[\u2013\u2014]/g, "-")
      .split(/[\s/|]+/)
      .map(function (p) {
        return String(p || "")
          .replace(/^-+|-+$/g, "")
          .trim();
      })
      .filter(function (p) {
        return p && p !== "-";
      })
      .join(" ");
  }

  function searchTokenForBadge(btn, kind, value) {
    var label = String((btn && btn.textContent) || "").trim();
    if (label && label.charAt(0) !== "+") {
      return normalizeSearchToken(label);
    }
    var v = String(value || "").trim();
    if (kind === "category") {
      v = v.replace(/^\d+\s*[-.]\s*/i, "").trim();
    }
    return normalizeSearchToken(v);
  }

  function resolveSearchInput(context) {
    if (context === "viz") {
      return document.getElementById("vizSearch");
    }
    if (context === "explorer") {
      return document.getElementById("damFileSearch");
    }
    if (context === "branding") {
      return document.getElementById("damBrandingSearch");
    }
    if (context === "project") {
      return (
        document.getElementById("damProjectsSearch") ||
        document.getElementById("damProjectSearch") ||
        document.querySelector("[data-dam-project-search]")
      );
    }
    return (
      document.getElementById("damProjectsSearch") ||
      document.getElementById("vizSearch") ||
      document.getElementById("damFileSearch")
    );
  }

  /**
   * @param {string} kind
   * @param {string} value
   * @param {string} [context]
   * @param {{ append?: boolean, token?: string, btn?: Element }} [opts]
   */
  function applyTagFilter(kind, value, context, opts) {
    opts = opts || {};
    context = context || detectContext();
    var token =
      opts.token != null
        ? normalizeSearchToken(opts.token)
        : searchTokenForBadge(opts.btn || null, kind, value);
    if (!token && kind !== "index") return;

    if (context === "viz") {
      var langSel = document.getElementById("vizLangFilter");
      if (kind === "lang" && langSel && !opts.append) {
        langSel.value = String(value || token).trim();
        langSel.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (kind === "brand" && !opts.append) {
        if (typeof global.damVizApplyBrandTag === "function") {
          global.damVizApplyBrandTag(String(value || token).trim());
          return;
        }
      }
    }

    if (context === "branding" && global.DamBranding && typeof global.DamBranding.applyBadgeFilter === "function") {
      global.DamBranding.applyBadgeFilter(kind, value, opts);
      return;
    }

    var input = resolveSearchInput(context);
    if (!input) return;

    if (opts.append) {
      var cur = String(input.value || "").trim();
      var parts = cur ? cur.split(/\s+/).filter(Boolean) : [];
      var lower = parts.map(function (p) {
        return p.toLowerCase();
      });
      token.split(/\s+/).forEach(function (part) {
        if (!part) return;
        if (lower.indexOf(part.toLowerCase()) === -1) {
          parts.push(part);
          lower.push(part.toLowerCase());
        }
      });
      input.value = parts.join(" ");
    } else {
      input.value = token;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      input.focus({ preventScroll: true });
    } catch (errFocus) {
      /* ignore */
    }
  }

  function openTagEdit(btn) {
    if (!global.DamTagEdit) return;
    /* Soft cleanup only - never dam:panic-reset / closePicker (re-entry freeze). */
    if (global.DamTagEdit.closePopover && typeof global.DamTagEdit.closePopover === "function") {
      global.DamTagEdit.closePopover();
    }
    var card = btn.closest("[data-id]");
    var brandingId =
      btn.getAttribute("data-branding-asset-id") ||
      (card && card.getAttribute("data-id")) ||
      "";
    if (typeof global.DamTagEdit.openTagPicker === "function") {
      global.DamTagEdit.openTagPicker(btn, {
        kind: btn.getAttribute("data-tag-kind") || "",
        value: btn.getAttribute("data-tag-value") || "",
        revisionPath: btn.getAttribute("data-revision-path") || "",
        revisionIndex: btn.getAttribute("data-revision-index") || "",
        currentCode: btn.getAttribute("data-current-code") || btn.getAttribute("data-tag-value") || "",
        productId: btn.getAttribute("data-product-id") || "",
        productName: btn.getAttribute("data-product-name") || "",
        brandingAssetId: brandingId,
      });
      return;
    }
    if (typeof global.DamTagEdit.openCarrierPicker === "function") {
      global.DamTagEdit.openCarrierPicker(btn, {
        revisionPath: btn.getAttribute("data-revision-path") || "",
        currentCode: btn.getAttribute("data-current-code") || "",
        productId: btn.getAttribute("data-product-id") || "",
        productName: btn.getAttribute("data-product-name") || "",
      });
    }
  }

  function openCarrierEdit(btn) {
    openTagEdit(btn);
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

  /** Edycja tagow: admin/power_user (Shift/Alt/dblclick). Tryb ADMIN nie jest wymagany do otwarcia pickera. */
  function canEditTags() {
    return (
      !!global.DamTagEdit &&
      typeof global.DamTagEdit.isPrivileged === "function" &&
      global.DamTagEdit.isPrivileged()
    );
  }

  function resolveCopyText(btn) {
    if (!btn) return "";
    if (btn.closest && btn.closest(".dam-index-action")) return "";
    /* Chip ID marketingowego: kopiuj ZAWSZE widoczne id (M-.../V-...),
       nigdy wewnetrzne br-xxxxx (brief 2026-07-20 pkt 5). */
    var marketingId = btn.getAttribute("data-marketing-id");
    if (marketingId) return String(marketingId).trim();
    var chip = btn.closest ? btn.closest(".dam-index-chip") : null;
    if (chip) {
      var inp = chip.querySelector(".dam-index-edit");
      if (inp) {
        var fromIdx =
          inp.getAttribute("data-from-index") ||
          inp.value ||
          inp.getAttribute("value") ||
          "";
        fromIdx = String(fromIdx).trim();
        if (fromIdx) return fromIdx;
      }
      var dataIdx = chip.getAttribute("data-from-index") || chip.getAttribute("data-tag-value");
      if (dataIdx) return String(dataIdx).trim();
    }
    var explicit =
      btn.getAttribute("data-tag-value") ||
      btn.getAttribute("data-from-index") ||
      "";
    if (explicit) return String(explicit).trim();
    return String(btn.textContent || "").trim();
  }

  function copyTagText(btn) {
    var text = resolveCopyText(btn);
    if (!text) return Promise.reject(new Error("pusty tag"));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function toastCopied(msg) {
    if (typeof global.damShowToast === "function") {
      global.damShowToast(msg);
      return;
    }
    var el = document.getElementById("damGlobalToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damGlobalToast";
      el.className = "dam-global-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-on");
    }, 1600);
  }

  function bindCopyOnRightClick(root) {
    var el = typeof root === "string" ? document.querySelector(root) : root || document;
    if (!el || el._damBadgeCopyBound) return;
    el._damBadgeCopyBound = true;
    el.addEventListener("contextmenu", function (e) {
      if (e.target.closest && e.target.closest(".dam-index-action")) return;
      var btn = e.target.closest(
        ".dam-index-chip, .dam-viz-badge, .dam-badge-tag, button.dam-viz-badge, span.dam-viz-badge"
      );
      if (!btn || (el !== document && !el.contains(btn))) return;
      var text = resolveCopyText(btn);
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      copyTagText(btn)
        .then(function () {
          toastCopied("Skopiowano: " + text);
        })
        .catch(function () {
          toastCopied("Nie udalo sie skopiowac");
        });
    });
  }

  function bindClicks(root, context) {
    var el = typeof root === "string" ? document.querySelector(root) : root;
    if (!el || el._damBadgesBound) return;
    el._damBadgesBound = true;
    var lastClick = { t: 0, btn: null };
    bindCopyOnRightClick(el);

    el.addEventListener("click", function (e) {
      var btn = e.target.closest(".dam-badge-tag[data-tag-kind]");
      if (!btn || !el.contains(btn)) return;
      var kind = btn.getAttribute("data-tag-kind") || "";
      var value = btn.getAttribute("data-tag-value") || "";
      if (kind === "more") {
        e.preventDefault();
        e.stopPropagation();
        var host =
          btn.closest(".dam-widget__viz-badges") ||
          btn.closest(".dam-badges") ||
          btn.parentElement;
        var raw = btn.getAttribute("data-more-items") || "[]";
        var extras = [];
        try {
          extras = JSON.parse(raw);
        } catch (eParse) {
          extras = [];
        }
        if (host && extras.length) {
          var html = extras
            .map(function (it) {
              return badgeHtml({
                kind: it.kind,
                value: it.value,
                label: it.label,
                cls: it.cls,
                tip: it.tip,
              });
            })
            .join("");
          btn.insertAdjacentHTML("beforebegin", html);
          btn.remove();
        }
        return;
      }

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

      var editable =
        btn.classList.contains("dam-tag-editable") || !!EDITABLE_TAG_KINDS[kind];
      var isPlaceholder = editable && !value && kind === "carrier";
      var adminEdit = isAdminEditMode();
      var ctx = context || detectContext();
      var now = Date.now();
      var dblClick = lastClick.btn === btn && now - lastClick.t <= 420;
      var shiftLatch =
        !!(
          global.document &&
          global.document.documentElement &&
          global.document.documentElement.classList.contains("is-shift-revealed")
        );
      var wantEdit = e.shiftKey || e.altKey || dblClick || (shiftLatch && editable);
      var wantAppend = e.ctrlKey || e.metaKey;

      /* Shift / Alt / podwojny klik / latch Shift+Admin: edycja tagu */
      if (wantEdit && editable && global.DamTagEdit && (canEditTags() || isPlaceholder)) {
        e.preventDefault();
        e.stopPropagation();
        lastClick = { t: 0, btn: null };
        clearTimeout(btn._damFilterTimer);
        /* Macrotask: never build picker in same tick as click. */
        setTimeout(function () {
          try {
            openTagEdit(btn);
          } catch (errTag) {
            console.error("[DamBadges] openTagEdit failed", errTag);
            if (global.DamTagEdit && typeof global.DamTagEdit.closePopover === "function") {
              global.DamTagEdit.closePopover();
            }
          }
        }, 0);
        return;
      }

      /* Status bez Shift: nie blokuj rozwiniecia wiersza / karty */
      if (kind === "status" && adminEdit && !wantEdit) {
        lastClick = { t: now, btn: btn };
        return;
      }

      /* Placeholder "Dodaj typ" - pojedynczy klik otwiera picker (wszyscy) */
      if (isPlaceholder && global.DamTagEdit) {
        e.preventDefault();
        e.stopPropagation();
        openTagEdit(btn);
        return;
      }

      /* Zwykly user na zgadnietym: Shift/Alt = propozycja; zwykly klik = filtr */
      if (
        editable &&
        global.DamTagEdit &&
        !adminEdit &&
        wantEdit &&
        btn.classList.contains("dam-viz-badge--guessed")
      ) {
        e.preventDefault();
        e.stopPropagation();
        openTagEdit(btn);
        return;
      }

      if (btn.tagName === "BUTTON" || btn.classList.contains("dam-badge-tag")) {
        e.preventDefault();
        e.stopPropagation();
        lastClick = { t: now, btn: btn };
        /* HARD: tags in preview/viz modal must NOT drive page search/filters behind the modal. */
        if (btn.closest && (btn.closest("#damMediaPreview") || btn.closest("#damVizModal"))) {
          return;
        }
        /* Natychmiastowy filtr (AJAX-like). Ctrl/Meta = dolacz token po spacji. */
        applyTagFilter(kind, value, ctx, {
          append: wantAppend,
          btn: btn,
          token: searchTokenForBadge(btn, kind, value),
        });
      }
    });
  }

  /* Globalnie: PPM na dowolnym tagu = kopiuj tekst do schowka */
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        bindCopyOnRightClick(document);
      });
    } else {
      bindCopyOnRightClick(document);
    }
  }

  var TAG_TIER_REVEAL_KEY = "dam_reveal_low_tags";

  var BRANDING_MEDIA_LABELS = {
    image: "Obraz",
    raster: "Obraz",
    vector: "Wektor",
    video: "Wideo",
    document: "Dokument",
    source: "Źródło",
  };

  function taxonomy() {
    return global.DamAssetTaxonomy || null;
  }

  function brandingMediaLabel(mt) {
    if (taxonomy() && typeof taxonomy().mediaTypeLabel === "function") {
      return taxonomy().mediaTypeLabel(mt);
    }
    return BRANDING_MEDIA_LABELS[mt] || mt;
  }

  function brandingRoleLabel(code) {
    if (taxonomy() && typeof taxonomy().assetRoleLabel === "function") {
      return taxonomy().assetRoleLabel(code);
    }
    return code;
  }

  function brandingFormatLabel(code) {
    if (taxonomy() && typeof taxonomy().formatTechLabel === "function") {
      return taxonomy().formatTechLabel(code);
    }
    return code;
  }

  function folderLabelFromPath(path) {
    var p = String(path || "").toUpperCase();
    if (p.indexOf("08 - KAMAPANIE") !== -1) return "Kampania";
    if (p.indexOf("05 - SOCIAL") !== -1) return "Social media";
    if (p.indexOf("06 - STRONY") !== -1) return "Strony WWW";
    if (p.indexOf("07 - E-COMMERCE") !== -1) return "E-commerce";
    if (p.indexOf("BRANDING I MARKA") !== -1) return "Brandbook";
    if (p.indexOf("03 - MATERIA") !== -1) return "Materiały graficzne";
    return "";
  }

  function inferBrandingChannels(asset) {
    if (asset.channels && asset.channels.length) return asset.channels;
    var p = String(asset.path || "").toUpperCase();
    var ch = [];
    if (p.indexOf("SOCIAL") !== -1) {
      ch.push("meta", "instagram");
    }
    if (p.indexOf("STRONY WWW") !== -1 || p.indexOf("E-COMMERCE") !== -1) {
      ch.push("www");
    }
    if (p.indexOf("GOOGLE") !== -1) {
      ch.push("google");
    }
    return ch;
  }

  function brandingFileExt(asset) {
    var n = String((asset && (asset.name || asset.path)) || "");
    var m = /\.([a-z0-9]+)$/i.exec(n);
    return m ? m[1].toLowerCase() : "";
  }

  function isSourceEditableFile(asset) {
    if (!asset) return false;
    var ext = brandingFileExt(asset);
    if (ext === "psd" || ext === "psb" || ext === "ai" || ext === "eps" || ext === "indd") return true;
    if (ext === "tif" || ext === "tiff") {
      if (asset.media_type === "source") return true;
      return (asset.format_technical || []).indexOf("editable") !== -1;
    }
    return false;
  }

  function shouldShowEditableBadge(asset) {
    if (isSourceEditableFile(asset)) return true;
    return !!(asset && asset.folder_has_editable);
  }

  function campaignBadgeLabel(asset) {
    var raw = String(asset.campaign_id || asset.campaign_name || "");
    if (!raw) return "";
    var short = raw.split(/[\\/]/).pop();
    if (short.length > 28) return short.slice(0, 26) + "…";
    return short;
  }

  /** Normalizacja PL do deduplikacji tagów (Kampania ≈ Kampanie). */
  function brandingTagStem(label) {
    var s = String(label || "")
      .toLowerCase()
      .replace(/ą/g, "a")
      .replace(/ć/g, "c")
      .replace(/ę/g, "e")
      .replace(/ł/g, "l")
      .replace(/ń/g, "n")
      .replace(/ó/g, "o")
      .replace(/ś/g, "s")
      .replace(/ź|ż/g, "z")
      .replace(/[^a-z0-9]/g, "");
    if (!s) return "";
    if (s === "kampanie" || s === "kampanii") return "kampania";
    if (s.endsWith("ie") && s.length > 4) return s.slice(0, -2) + "ia";
    if (s.endsWith("y") && s.length > 4) return s.slice(0, -1) + "a";
    return s;
  }

  function hasSimilarBrandingTag(items, label) {
    var stem = brandingTagStem(label);
    if (!stem) return false;
    return (items || []).some(function (it) {
      return brandingTagStem(it.label || it.value) === stem;
    });
  }

  function brandingSearchSynonymsForLabel(label) {
    var stem = brandingTagStem(label);
    if (stem === "kampania") return "kampanie kampanie reklamowe reklama";
    if (stem === "baner") return "banery banner";
    if (stem === "slider") return "slidery slajd";
    return "";
  }

  function buildBrandingBadgeItems(asset) {
    asset = asset || {};
    var assetId = asset.id || "";
    var items = [];
    var seen = {};
    function pushItem(it) {
      var key = (it.kind || "") + ":" + (it.value || it.label || "");
      if (seen[key]) return;
      seen[key] = true;
      it.brandingAssetId = assetId;
      items.push(it);
    }

    if (asset.brand) {
      pushItem({
        kind: "brand",
        value: asset.brand,
        label: asset.brand,
        cls: "dam-viz-badge--brand",
        tip: "Marka materiału",
      });
    }

    if (asset.asset_role) {
      pushItem({
        kind: "asset_role",
        value: asset.asset_role,
        label: brandingRoleLabel(asset.asset_role),
        cls: "dam-viz-badge--cat",
        tip: "Przeznaczenie biznesowe (rola assetu). Shift+klik: edytuj.",
        tier: "primary",
        data: brandingBadgeData(asset),
      });
    }

    if (asset.media_type) {
      pushItem({
        kind: "media",
        value: asset.media_type,
        label: brandingMediaLabel(asset.media_type),
        cls: "dam-viz-badge--carrier",
        tip: "Format pliku (wyliczany automatycznie z rozszerzenia)",
        tier: "primary",
      });
    }

    var hasEditableBadge = shouldShowEditableBadge(asset);
    var effTransparent =
      window.DamAssetTaxonomy &&
      DamAssetTaxonomy.isEffectiveTransparent &&
      DamAssetTaxonomy.isEffectiveTransparent(asset);
    var formatTech = (asset.format_technical || []).slice();

    if (effTransparent && formatTech.indexOf("transparent") === -1) {
      formatTech.push("transparent");
    }

    formatTech.forEach(function (ft) {
      if (!ft) return;
      if (ft === "editable") return;
      pushItem({
        kind: "format",
        value: ft,
        label: brandingFormatLabel(ft),
        cls: "dam-viz-badge--lang",
        tip:
          ft === "transparent" && !(asset.format_technical || []).includes("transparent")
            ? "PNG/WebP — domyślnie bez tła (do weryfikacji pikseli)"
            : "Cecha techniczna pliku",
        tier: "low",
      });
    });

    if (hasEditableBadge) {
      pushItem({
        kind: "format",
        value: "editable",
        label: "Edytowalny",
        cls: "dam-viz-badge--editable",
        tip: isSourceEditableFile(asset)
          ? "Plik zrodlowy Adobe (PSD/AI) z warstwami"
          : "W folderze jest plik zrodlowy do edycji",
        tier: "primary",
      });
    }

    if (asset.perspective) {
      pushItem({
        kind: "perspective",
        value: asset.perspective,
        label: String(asset.perspective).replace(/_/g, "-"),
        cls: "dam-viz-badge--subcat",
        tip: "Perspektywa wizualizacji (packshot)",
        tier: "primary",
      });
    }
    if (asset.size) {
      pushItem({
        kind: "size",
        value: asset.size,
        label: String(asset.size).replace(/_/g, "-"),
        cls: "dam-viz-badge--subcat",
        tip: "Rozmiar wizualizacji",
        tier: "low",
      });
    }

    var blob = String((asset.name || "") + " " + (asset.path || "") + " " + (asset.search_blob || "")).toLowerCase();
    var hasLogoTag = (asset.appearance_tags || []).some(function (t) {
      return String(t || "").toLowerCase() === "logo";
    });
    if (!hasLogoTag && /\blogo\b|logotyp|brandbook|favicon|znak firmowy/.test(blob)) {
      pushItem({
        kind: "appearance",
        value: "Logo",
        label: "Logo",
        cls: "dam-viz-badge--meta",
        tip: "Znak / logotyp marki",
        tier: "primary",
      });
    }

    (asset.appearance_tags || []).forEach(function (t) {
      if (!t) return;
      if (String(t).toLowerCase() === "edytowalny") return;
      pushItem({
        kind: "appearance",
        value: t,
        label: String(t),
        cls: "dam-viz-badge--mix",
        tip: "Skojarzenie produktu / OCR. Shift+klik: edytuj.",
        tier: "primary",
        data: brandingBadgeData(asset),
      });
    });

    var folderLbl = folderLabelFromPath(asset.path);
    if (folderLbl && !hasSimilarBrandingTag(items, folderLbl)) {
      pushItem({
        kind: "folder",
        value: folderLbl,
        label: folderLbl,
        cls: "dam-viz-badge--cat",
        tip: "Obszar na dysku Marketing (synonimy w wyszukiwaniu)",
        tier: "minimal",
      });
    }

    var ext = brandingFileExt(asset);
    if (ext === "tif" || ext === "tiff") {
      pushItem({
        kind: "format",
        value: "tiff",
        label: "TIFF",
        cls: "dam-viz-badge--source",
        tip: "Raster zrodlowy wysokiej jakosci",
        tier: "primary",
      });
    } else if ((ext === "ai" || ext === "eps") && !hasEditableBadge) {
      pushItem({
        kind: "format",
        value: ext,
        label: ext.toUpperCase(),
        cls: "dam-viz-badge--editable",
        tip: "Plik wektorowy zrodlowy",
        tier: "low",
      });
    }

    inferBrandingChannels(asset).forEach(function (ch) {
      pushItem({
        kind: "channel",
        value: ch,
        label: String(ch).toUpperCase(),
        cls: "dam-viz-badge--cat",
        tip: "Kanał dystrybucji",
      });
    });

    if (asset.sku) {
      pushItem({
        kind: "index",
        value: asset.sku,
        label: String(asset.sku),
        cls: "dam-viz-badge--index",
        tip: "SKU / indeks produktu",
      });
    }

    if (asset.campaign_id) {
      var campLbl = campaignBadgeLabel(asset) || "Kampania";
      if (!hasSimilarBrandingTag(items, campLbl) && !hasSimilarBrandingTag(items, "Kampania")) {
        pushItem({
          kind: "campaign",
          value: asset.campaign_id,
          label: campLbl,
          cls: "dam-viz-badge--mix",
          tip: "Kampania: " + asset.campaign_id,
          tier: "primary",
        });
      }
    }

    if (asset.is_archive || (asset.tags || []).indexOf("ARCHIWUM") !== -1) {
      pushItem({
        kind: "flag",
        value: "archive",
        label: "ARCHIWUM",
        cls: "dam-viz-badge--hidden",
        tip: "Materiał archiwalny",
      });
    }

    (asset.tags || []).forEach(function (t) {
      if (!t || t === "ARCHIWUM") return;
      pushItem({
        kind: "tag",
        value: t,
        label: String(t),
        cls: "dam-viz-badge--subcat",
        tip: "Tag z indeksu branding",
      });
    });

    return items;
  }

  function brandingGradientTileClass(asset) {
    if (isSourceEditableFile(asset)) {
      return "dam-gradient-tile dam-gradient-tile--editable";
    }
    var ext = brandingFileExt(asset);
    if (ext === "pdf") {
      return "dam-gradient-tile dam-gradient-tile--vector";
    }
    return "";
  }

  function brandingGradientTileClassForAssets(assets) {
    if (!assets || !assets.length) return "";
    return brandingGradientTileClass(assets[0]);
  }

  function renderBranding(asset, opts) {
    opts = opts || {};
    var items = buildBrandingBadgeItems(asset);
    items = filterByTagTiers(items, opts.includeTagTiers || ["primary", "low", "minimal"]);
    var max = opts.maxPerKind == null ? 4 : opts.maxPerKind;
    if (opts.overflow !== false) items = renderOverflow(items, max);
    var maxTotal = opts.maxTotal || 10;
    if (maxTotal && items.length > maxTotal) {
      var head = items.slice(0, maxTotal - 1);
      var restN = items.length - head.length;
      head.push({
        kind: "more",
        value: String(restN),
        label: "+" + restN,
        cls: "dam-viz-badge--more",
        tip: "Pozostałe tagi (" + restN + ")",
        moreItems: items.slice(maxTotal - 1),
      });
      items = head;
    }
    return items.map(badgeHtml).join("");
  }

  function getIncludeTagTiers() {
    try {
      if (
        (window.DamUserPrefs &&
          typeof DamUserPrefs.getSync === "function" &&
          DamUserPrefs.getSync().reveal_low_tags) ||
        localStorage.getItem(TAG_TIER_REVEAL_KEY) === "1"
      ) {
        return ["primary", "low", "minimal"];
      }
    } catch (eReveal) { /* ignore */ }
    return ["primary"];
  }

  function setRevealLowTags(on) {
    try {
      localStorage.setItem(TAG_TIER_REVEAL_KEY, on ? "1" : "0");
    } catch (eSet) { /* ignore */ }
    if (window.DamUserPrefs && typeof DamUserPrefs.set === "function") {
      DamUserPrefs.set({ reveal_low_tags: !!on }).catch(function () {});
    }
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("dam-tag-tiers-changed"));
    }
  }

  global.DamBadges = {
    render: render,
    renderBranding: renderBranding,
    buildBadgeItems: buildBadgeItems,
    buildBrandingBadgeItems: buildBrandingBadgeItems,
    brandingGradientTileClass: brandingGradientTileClass,
    brandingGradientTileClassForAssets: brandingGradientTileClassForAssets,
    brandingTagStem: brandingTagStem,
    brandingSearchSynonymsForLabel: brandingSearchSynonymsForLabel,
    bindClicks: bindClicks,
    bindCopyOnRightClick: bindCopyOnRightClick,
    copyTagText: copyTagText,
    applyTagFilter: applyTagFilter,
    detectContext: detectContext,
    getIncludeTagTiers: getIncludeTagTiers,
    setRevealLowTags: setRevealLowTags,
    MAX_PER_KIND: MAX_PER_KIND,
  };
})(typeof window !== "undefined" ? window : globalThis);
