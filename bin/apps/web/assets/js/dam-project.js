(function () {
  "use strict";

  var ROLE_LABEL = {
    artwork: "Plik źródłowy projektu graficznego",
    prev: "Podgląd PDF projektu",
    viz_3d: "Wizualizacje",
    print_pdf: "Pliki do druku",
    tech: "Elementy / składniki",
    marketing: "Materiały marketingowe",
    karta: "Karta wprowadzenia",
    presentation: "Prezentacja",
    photo: "Fotografia produktówa",
    packaging_text: "Teksty na opakowanie",
  };

  var ROLE_ICON = {
    artwork: "uil-palette",
    prev: "uil-eye",
    viz_3d: "uil-cube",
    print_pdf: "uil-file-alt",
    tech: "uil-clipboard-notes",
    marketing: "uil-megaphone",
    karta: "uil-file-bookmark-alt",
    presentation: "uil-presentation",
    photo: "uil-camera",
    packaging_text: "uil-text",
  };

  var REQUIRED = [
    "artwork", "prev", "print_pdf", "viz_3d", "tech", "marketing", "karta", "presentation",
  ];

  // Status rynkowy wariantu: teczki projektow + karty zalozenia indeksow
  // (data/market-index.json, budowane przez scripts/build-market-index.py).
  // Trzymane modulowo, bo variantPanelHtml jest wolane z kilku miejsc.
  var MARKET_DOC = null;

  // Osobna rodzina chipow: status RYNKOWY ma obrys, kompletnosc plikow ma wypelnienie.
  // Bez tego "W obrocie" i "Kompletny" byly dwiema identycznymi zielonymi pigulkami
  // obok siebie, mimo ze mowia o zupelnie innych rzeczach.
  var MARKET_STAGE_CHIP = {
    wdrozony: { cls: "live", label: "W obrocie" },
    w_toku: { cls: "wip", label: "Projekt w toku" },
    zawieszony: { cls: "hold", label: "Zawieszony" },
  };

  var ASANA_BY_INDEX = {
    "6300728.00":
      "https://app.asana.com/1/1143952495030509/project/1212679241997947/list/1212717099105923",
  };

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function humanizeRole(role) {
    return ROLE_LABEL[role] || role;
  }

  function humanizeMissing(roles) {
    if (!roles || !roles.length) return "brak";
    return roles.map(function (r) { return ROLE_LABEL[r] || r; }).join(", ");
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function variantRevisions(raw, p) {
    if (window.DamApi && typeof window.DamApi.listVariantRevisions === "function" && raw) {
      return window.DamApi.listVariantRevisions(raw);
    }
    if (p && p.variants && p.variants.length) {
      return p.variants.map(function (v) {
        return {
          index: v.revision_index || "",
          carrier: v.carrier || "",
          folder: v.folder || "",
          path: v.path || p.path || "",
          langs: v.langs || [],
        };
      });
    }
    return [];
  }

  function variantCarrierLabel(rev, productTitle) {
    if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
      return (
        window.DamLabels.carrierLabel(rev.carrier || "", rev.path || rev.folder || "", {
          productName: productTitle,
        }) ||
        rev.carrier ||
        rev.folder ||
        "Wariant"
      );
    }
    return rev.carrier || rev.folder || "Wariant";
  }

  function revisionRoles(rev, raw, marketingAssets) {
    if (window.DamApi && typeof window.DamApi.revisionRoles === "function") {
      return window.DamApi.revisionRoles(rev, raw, {
        marketingAssets: marketingAssets || [],
      });
    }
    return {};
  }

  function revisionRolePaths(rev, raw) {
    if (window.DamApi && typeof window.DamApi.revisionRolePaths === "function") {
      return window.DamApi.revisionRolePaths(rev, raw);
    }
    return { artwork: rev.path || "" };
  }

  function variantStatusFromRoles(roles) {
    var missing = [];
    ["artwork", "viz_3d", "print_pdf"].forEach(function (r) {
      if (!roles[r]) missing.push(r);
    });
    return {
      status: missing.length ? "incomplete" : "complete",
      missing_roles: missing,
    };
  }

  function assetMatchesRevision(a, rev, allRevs) {
    if (!a || !rev) return false;
    var hay = (
      (a.path || "") +
      " " +
      (a.name || "") +
      " " +
      (a.search_blob || "") +
      " " +
      (a.sku || "")
    ).toLowerCase();
    var rp = String(rev.path || "").replace(/\\/g, "/").toLowerCase();
    if (rp.length > 12 && hay.indexOf(rp) >= 0) return true;
    var idx = String(rev.index || "").toLowerCase();
    if (idx && hay.indexOf(idx) >= 0) return true;
    var d = digitsOnly(rev.index);
    if (d.length >= 6 && hay.indexOf(d) >= 0) return true;
    var folder = String(rev.folder || "").toLowerCase();
    if (folder.length >= 4 && hay.indexOf(folder) >= 0) return true;
    var carrier = String(rev.carrier || "").toLowerCase();
    if (carrier.length >= 3 && hay.indexOf(carrier) >= 0) return true;
    if (/kar6x|karton|6xmini|6x mini/.test(folder + " " + carrier)) {
      if (/kar6x|6300783|nerk-cynamonka-6300783/.test(hay)) return true;
    }
    if (/mini/.test(folder + " " + carrier)) {
      if (/6300782|mini baton|mini-baton/.test(hay) && !/kar6x|6300783/.test(hay)) return true;
    }
    if (allRevs && allRevs.length === 2) {
      var other = allRevs.find(function (r) {
        return String(r.index) !== String(rev.index);
      });
      if (other && !assetMatchesRevision(a, other, allRevs)) {
        if (/\.tif(f)?$/i.test(a.name || "") && !/kar6x|6300783/.test(hay)) return true;
      }
    }
    return false;
  }

  function partitionMarketingAssets(assets, revs) {
    var buckets = {};
    var shared = [];
    revs.forEach(function (r) {
      buckets[String(r.index)] = [];
    });
    (assets || []).forEach(function (a) {
      var hits = revs.filter(function (r) {
        return assetMatchesRevision(a, r, revs);
      });
      if (hits.length === 1) {
        buckets[String(hits[0].index)].push(a);
      } else if (hits.length > 1) {
        shared.push(a);
      } else {
        shared.push(a);
      }
    });
    return { buckets: buckets, shared: shared };
  }

  function variantStatusChip(status) {
    if (status === "complete") {
      return '<span class="dam-variant-panel__chip dam-variant-panel__chip--ok">Kompletny</span>';
    }
    return '<span class="dam-variant-panel__chip dam-variant-panel__chip--gap">Niekompletny</span>';
  }

  // Baza indeksu opakowania: "6300744.01" -> "6300744". Indeks handlowy i GTIN
  // sa przypisane do opakowania, nie do rewizji grafiki.
  function packIndexBase(index) {
    var digits = String(index || "").split(".")[0];
    return /^6\d{6}$/.test(digits) ? digits : "";
  }

  function marketEntryFor(rev) {
    if (!MARKET_DOC || !MARKET_DOC.packages) return null;
    var base = packIndexBase(rev && rev.index);
    return base ? MARKET_DOC.packages[base] || null : null;
  }

  // Chip statusu rynkowego + osobny chip EAN, gdy karta zalozenia indeksu go zna.
  function marketChipsHtml(rev) {
    var e = marketEntryFor(rev);
    if (!e) return "";
    var out = "";
    var chip = MARKET_STAGE_CHIP[e.stage];
    if (chip) {
      var tipParts = [];
      if (e.project) tipParts.push("Projekt: " + e.project);
      if (e.year) tipParts.push("Rok: " + e.year);
      if (e.trade_index) tipParts.push("Indeks handlowy: " + e.trade_index);
      if (e.client) tipParts.push("Klient: " + e.client);
      out +=
        '<span class="dam-market-chip dam-market-chip--' +
        chip.cls +
        '" title="' +
        esc(tipParts.join(" · ")) +
        '">' +
        esc(chip.label) +
        "</span>";
    }
    if (e.gtin_unit) {
      out +=
        '<span class="dam-market-chip dam-market-chip--ean" title="GTIN jednostkowy z karty założenia indeksu">EAN ' +
        esc(e.gtin_unit) +
        "</span>";
    }
    return out;
  }

  function variantPanelHtml(rev, raw, p, marketingAssets) {
    var roles = revisionRoles(rev, raw, marketingAssets);
    var paths = revisionRolePaths(rev, raw);
    var st = variantStatusFromRoles(roles);
    var carrierLbl = variantCarrierLabel(rev, p.title);
    var panelCls =
      "dam-variant-panel" +
      (st.status === "complete" ? " dam-variant-panel--complete" : " dam-variant-panel--incomplete");
    var rows = REQUIRED.map(function (r) {
      return rowHtml(r, !!roles[r], paths[r] || rev.path || p.path, p.id, rev.index);
    }).join("");
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    return (
      '<section class="' +
      panelCls +
      '" data-variant-index="' +
      esc(rev.index || "") +
      '">' +
      '<header class="dam-variant-panel__head">' +
      '<div class="dam-variant-panel__titles">' +
      '<h4 class="dam-variant-panel__title">' +
      esc(carrierLbl) +
      "</h4>" +
      '<p class="dam-variant-panel__meta">' +
      '<span class="dam-variant-index-chip">' +
      esc(rev.index || "") +
      "</span>" +
      (rev.folder ? " · " + esc(rev.folder) : "") +
      "</p></div>" +
      '<div class="dam-variant-panel__actions">' +
      marketChipsHtml(rev) +
      variantStatusChip(st.status) +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-win-btn dam-variant-panel__folder" data-path="' +
      esc(rev.path || p.path || "") +
      '" title="Folder Windows wariantu">' +
      winIcon +
      '<span>Folder</span></button>' +
      '<a class="geex-btn geex-btn--sm geex-btn--primary-transparent" href="explorer.html?product=' +
      encodeURIComponent(p.id) +
      "&index=" +
      encodeURIComponent(rev.index || "") +
      '" title="Eksplorer tego wariantu"><i class="uil uil-sitemap" aria-hidden="true"></i><span>Eksplorer</span></a>' +
      "</div></header>" +
      '<div class="dam-slot-checklist">' +
      rows +
      "</div></section>"
    );
  }

  function summarizeVariantStatuses(revs, raw, marketingPartition, productTitle) {
    return revs.map(function (rev) {
      var mkt = (marketingPartition.buckets[String(rev.index)] || []).slice();
      var roles = revisionRoles(rev, raw, mkt);
      var st = variantStatusFromRoles(roles);
      return {
        rev: rev,
        label: variantCarrierLabel(rev, productTitle || ""),
        status: st.status,
        missing: st.missing_roles,
      };
    });
  }

  function openWin(path) {
    if (!path) return;
    if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
      window.DamPaths.openFolderInExplorer(path);
      return;
    }
    if (window.DamPaths) window.DamPaths.revealInExplorer(path);
  }

  function rowHtml(role, ok, path, productId, indexOpt) {
    var label = humanizeRole(role);
    var cls = ok ? "dam-check-ok" : "dam-check-brak";
    var mark = ok ? "uil-check-circle" : "uil-times-circle";
    var explorerHref =
      "explorer.html?product=" + encodeURIComponent(productId || "");
    if (indexOpt) {
      explorerHref += "&index=" + encodeURIComponent(indexOpt);
    }
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var actions = "";
    if (ok) {
      actions =
        '<span class="dam-slot-row__actions" hidden>' +
        '<a class="geex-btn geex-btn--sm dam-btn-icon dam-slot-go" href="' +
        esc(explorerHref) +
        '" title="Przejdź do Eksplorera" data-dam-tip="Otwórz slot w Eksplorerze">' +
        '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdź</span></a>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-btn-icon-only dam-slot-win dam-win-btn" data-path="' +
        esc(path || "") +
        '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwórz folder w Eksploratorze plików Windows">' +
        winIcon +
        "</button>" +
        "</span>";
    }
    return (
      '<div class="dam-slot-row ' + cls + (ok ? " dam-slot-row--interactive" : "") +
      '" data-role="' + esc(role) + '" data-ok="' + (ok ? "1" : "0") +
      '" data-path="' + esc(path || "") + '" tabindex="' + (ok ? "0" : "-1") +
      '" role="' + (ok ? "button" : "listitem") + '">' +
      '<i class="uil ' + mark + ' dam-check-icon" aria-hidden="true"></i>' +
      '<span class="dam-check-label">' + esc(label) + "</span>" +
      actions +
      "</div>"
    );
  }

  function renderHeaderBadges(p, catalogExtra) {
    var host = document.getElementById("damProjectBadges");
    if (!host) return;
    if (!window.DamBadges || typeof window.DamBadges.render !== "function") {
      host.innerHTML = "";
      return;
    }
    /* TYLKO surowe langs. Zakaz domyslu market=PL -> pl. */
    var langs = p.langs || [];
    var carrierLbl = "";
    if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
      carrierLbl = window.DamLabels.carrierLabel(p.carrier || "", p.path || "", {
        productName: p.title,
      }) || "";
    }
    var packaging = (catalogExtra && catalogExtra.packLabel) || "";
    host.innerHTML = window.DamBadges.render({
      brand: p.brand || (p.market === "GC" ? "GC" : "DK"),
      category: p.category || "",
      subcategory: p.subcategory_slug || "",
      subcategoryLabel: p.subcategory_label || "",
      carrier: p.carrier || "",
      carrierLabel: carrierLbl,
      langs: langs,
      index: p.product_index || "",
      packagingTags: packaging ? [packaging] : [],
      includeTagTiers: ["primary", "low"],
      compact: false,
      maxPerKind: 3,
      maxTotal: 12,
      productName: p.title,
      productId: p.id,
      showCarrierPlaceholder: false,
    });
    if (typeof window.DamBadges.bindClicks === "function") {
      host._damBadgesBound = false;
      window.DamBadges.bindClicks(host, "project");
    }
  }

  function bindSlotRows(listEl) {
    if (!listEl) return;
    if (window.DamIcons && typeof window.DamIcons.bindChecklistRows === "function") {
      window.DamIcons.bindChecklistRows(listEl);
      return;
    }
    listEl.querySelectorAll(".dam-slot-win").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openWin(this.getAttribute("data-path") || "");
      });
    });
  }

  function dash(val, hint) {
    if (val == null || val === "") {
      return '<p class="dam-catalog-card__value">—</p><p class="dam-catalog-card__hint">' + esc(hint || "Uzupełnij w katalogu") + "</p>";
    }
    return '<p class="dam-catalog-card__value">' + esc(String(val)) + "</p>";
  }

  function bridgeUrl() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  async function fetchJsonLocal(path) {
    var r = await fetch(path + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(path);
    return r.json();
  }

  function bridgeUrl() {
    return window.DamRuntime && DamRuntime.bridgeUrl ? DamRuntime.bridgeUrl() : "http://127.0.0.1:8766";
  }

  function mediaUrl(path) {
    return bridgeUrl() + "/media?path=" + encodeURIComponent(path || "");
  }

  function productIndexTokens(p) {
    if (window.DamProductCorrelation) return DamProductCorrelation.productIndexTokens(p);
    var out = [];
    function add(v) {
      v = String(v || "").trim();
      if (!v) return;
      if (out.indexOf(v) === -1) out.push(v);
      var base = v.split(".")[0];
      if (base && out.indexOf(base) === -1) out.push(base);
    }
    add(p.product_index);
    (p.indexes || []).forEach(add);
    return out;
  }

  function isArchivedBranding(a) {
    if (window.DamProductCorrelation) return DamProductCorrelation.isArchivedBranding(a);
    if ((a.tags || []).indexOf("ARCHIWUM") !== -1 || a.is_archive) return true;
    return String(a.path || "").toUpperCase().indexOf("ARCHIWUM") !== -1;
  }

  function brandingAssetMatches(a, productId, tokens) {
    if (window.DamProductCorrelation) {
      return DamProductCorrelation.brandingAssetMatches(a, productId, tokens);
    }
    var ids = (a.linked_product_ids || []).concat(a.product_ids || []);
    if (ids.indexOf(productId) !== -1) return true;
    return false;
  }

  function brandingLinkForProduct(prod) {
    if (window.DamProductCorrelation) return DamProductCorrelation.brandingUrlForProduct(prod);
    var q = prod.product_index || prod.id || "";
    return "branding.html?q=" + encodeURIComponent(q);
  }

  function marketingThumbHtml(a) {
    if (a.media_type === "video") {
      return (
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-play-circle" aria-hidden="true"></i><span>Wideo</span></div>'
      );
    }
    if (a.media_type === "vector") {
      return (
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-vector-square" aria-hidden="true"></i><span>Wektor</span></div>'
      );
    }
    if (/\.(png|jpe?g|webp)$/i.test(a.name || "")) {
      return (
        '<img class="dam-viz-thumb__img" src="' +
        esc(mediaUrl(a.path)) +
        '" alt="" loading="lazy" onerror="this.classList.add(\'dam-viz-thumb__img--placeholder\')">'
      );
    }
    return (
      '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
      '<i class="uil uil-file" aria-hidden="true"></i><span>' +
      esc((a.media_type || "plik").toUpperCase()) +
      "</span></div>"
    );
  }

  function marketingBadgesHtml(a) {
    if (!window.DamBadges || typeof window.DamBadges.renderBranding !== "function") {
      return (
        '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(a.brand || "DK") + "</span>"
      );
    }
    return window.DamBadges.renderBranding(a, {
      includeTagTiers: ["primary", "low"],
      maxPerKind: 3,
      maxTotal: 6,
    });
  }

  function marketingCardHtml(a) {
    return (
      '<a class="dam-catalog-marketing-card" href="branding.html?asset=' +
      encodeURIComponent(a.id || "") +
      '" title="' +
      esc(a.name) +
      '">' +
      '<div class="dam-viz-thumb dam-catalog-marketing-card__thumb">' +
      marketingThumbHtml(a) +
      "</div>" +
      '<div class="dam-catalog-marketing-card__badges">' +
      marketingBadgesHtml(a) +
      "</div>" +
      '<p class="dam-catalog-marketing-card__title">' +
      esc(a.name) +
      "</p></a>"
    );
  }

  async function renderWykrojnikiShort(productId) {
    var host = document.getElementById("damWykrojnikShortBody");
    if (!host) return;
    try {
      var reg = await fetchJsonLocal("data/wykrojniki-registry.json");
      var entries = reg.entries || {};
      var linked = Object.keys(entries)
        .map(function (k) {
          return entries[k];
        })
        .filter(function (e) {
          return (e.linked_product_ids || []).indexOf(productId) !== -1;
        });
      if (!linked.length) {
        host.innerHTML = '<p class="dam-catalog-marketing__empty">Brak powiązanych wykrojników w rejestrze.</p>';
        return;
      }
      host.innerHTML =
        '<ul class="dam-catalog-wykrojnik-list">' +
        linked
          .slice(0, 6)
          .map(function (e) {
            var label = e.nazwa || e.kod || "Wykrojnik";
            var path = e.pdf_path || "";
            return (
              '<li><span class="dam-catalog-wykrojnik-list__label">' +
              esc(label) +
              "</span>" +
              (path
                ? ' <button type="button" class="geex-btn geex-btn--sm dam-win-btn" data-path="' +
                  esc(path) +
                  '">PDF</button>'
                : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
      host.querySelectorAll(".dam-win-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          openWin(btn.getAttribute("data-path") || "");
        });
      });
    } catch (eWyk) {
      host.innerHTML = '<p class="dam-catalog-marketing__empty">Rejestr wykrojników niedostępny.</p>';
    }
  }

  async function loadCatalogBundle(productId) {
    var catalog = null;
    var bulk = null;
    var lifecycle = null;
    var price = null;
    try {
      catalog = await fetchJsonLocal("data/product-catalog.json");
    } catch (e) { /* optional */ }
    try {
      bulk = await fetchJsonLocal("data/bulk-packaging.json");
    } catch (e2) { /* optional */ }
    try {
      lifecycle = await fetchJsonLocal("data/product-lifecycle.json");
    } catch (eLc) { /* optional */ }
    try {
      MARKET_DOC = await fetchJsonLocal("data/market-index.json");
    } catch (eMk) { /* brak teczek projektow - chipy rynkowe po prostu nie pokaza sie */ }
    try {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () {
            ctrl.abort();
          }, 4000)
        : null;
      var pr = await fetch(bridgeUrl() + "/product-price?product_id=" + encodeURIComponent(productId), {
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      if (pr.ok) price = await pr.json();
    } catch (e3) { /* bridge offline / timeout */ }
    var entry = catalog && catalog.products ? catalog.products[productId] : null;
    var packLabel = "";
    if (entry && entry.bulk_packaging_ref && bulk && bulk.packs) {
      var pack = bulk.packs[entry.bulk_packaging_ref];
      if (pack && pack.label) packLabel = pack.label;
    }
    return { entry: entry, bulk: bulk, lifecycle: lifecycle, price: price, packLabel: packLabel };
  }

  function catalogLabel(key, fb) {
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fb;
  }

  var catalogRenderCtx = null;

  function isFinanceAdmin() {
    return (
      window.DamProductFinance &&
      typeof DamProductFinance.isAdminMode === "function" &&
      DamProductFinance.isAdminMode()
    );
  }

  function fmcgRowKey(row, idx) {
    return String((row && row.key) || "row_" + idx);
  }

  var FMCG_GROUP_ORDER = ["prepress", "print", "pack", "logistics", "other"];

  var FMCG_GROUP_BY_KEY = {
    prepress: "prepress",
    proof: "prepress",
    print_doy: "print",
    foil: "print",
    label: "print",
    carton_unit: "pack",
    carton_bulk: "pack",
    tape: "pack",
    pack_labor: "pack",
    warehouse: "pack",
    pallet: "logistics",
    palletize: "logistics",
    trip: "logistics",
    freight: "logistics",
    gs1: "logistics",
    lab: "logistics",
  };

  function fmcgGroupId(row, idx) {
    if (row && row.adhoc) return "other";
    var key = fmcgRowKey(row, idx);
    if (key.indexOf("adhoc_") === 0) return "other";
    if (FMCG_GROUP_BY_KEY[key]) return FMCG_GROUP_BY_KEY[key];
    var dep = String((row && row.department) || "").toLowerCase();
    if (dep === "dtp") return "prepress";
    if (dep === "zakupy" || dep === "produkcja") return "print";
    if (dep === "magazyn") return "pack";
    if (dep === "logistyka" || dep === "regulacje" || dep === "qa") {
      return "logistics";
    }
    return "other";
  }

  function fmcgGroupTitle(id) {
    var keys = {
      prepress: ["project.fmcg_group_prepress", "Prepress"],
      print: ["project.fmcg_group_print", "Druk i surowiec"],
      pack: ["project.fmcg_group_pack", "Konfekcja"],
      logistics: ["project.fmcg_group_logistics", "Logistyka"],
      other: ["project.fmcg_group_other", "Pozostałe"],
    };
    var pair = keys[id] || keys.other;
    return catalogLabel(pair[0], pair[1]);
  }

  function fmcgStepHint() {
    return catalogLabel(
      "project.fmcg_step_hint",
      "Strzałki: 1, Ctrl: 0,01, Shift: 10, Ctrl+Shift: 100"
    );
  }

  function fmcgAmountInputHtml(row, rk, extraClass, extraId) {
    var hint = fmcgStepHint();
    return (
      '<input type="number" step="1" min="0" inputmode="decimal" class="form-control form-control-sm dam-catalog-fmcg__amount-input text-end' +
      (extraClass ? " " + extraClass : "") +
      '" data-row-key="' +
      esc(rk) +
      '"' +
      (extraId ? ' id="' + extraId + '"' : "") +
      ' value="' +
      esc(String(row.amount != null ? row.amount : "")) +
      '" aria-label="' +
      esc(row.label) +
      '" aria-describedby="damCatalogFmcgStepHint" aria-description="' +
      esc(hint) +
      '" title="' +
      esc(hint) +
      '" />'
    );
  }

  function buildFmcgRowHtml(row, idx, PF, admin) {
    var meta = PF && typeof PF.directRowMeta === "function" ? PF.directRowMeta(row) : "";
    var rk = fmcgRowKey(row, idx);
    var amountCell = admin
      ? fmcgAmountInputHtml(row, rk, "", "")
      : '<span class="dam-catalog-fmcg__amount-text">' +
        esc(PF ? PF.formatPLN(row.amount) : String(row.amount)) +
        "</span>";
    return (
      '<div class="dam-catalog-fmcg__row" data-row-key="' +
      esc(rk) +
      '">' +
      '<div class="dam-catalog-fmcg__row-text">' +
      '<span class="dam-catalog-fmcg__row-label">' +
      esc(row.label) +
      "</span>" +
      (meta ? '<div class="dam-catalog-fmcg__meta">' + esc(meta) + "</div>" : "") +
      "</div>" +
      '<div class="dam-catalog-fmcg__row-amount">' +
      amountCell +
      "</div></div>"
    );
  }

  function buildFmcgBentoHtml(direct, PF, admin, sumHtml) {
    var rows = direct || [];
    if (!rows.length) {
      return (
        '<p class="dam-catalog-fmcg__empty">' +
        esc(catalogLabel("project.fmcg_empty", "Brak pozycji — dodaj w trybie ADMIN.")) +
        "</p>" +
        (sumHtml || "")
      );
    }
    var buckets = {};
    rows.forEach(function (row, idx) {
      var gid = fmcgGroupId(row, idx);
      if (!buckets[gid]) buckets[gid] = [];
      buckets[gid].push({ row: row, idx: idx });
    });
    var groups = FMCG_GROUP_ORDER.map(function (gid) {
      var items = buckets[gid];
      if (!items || !items.length) return "";
      return (
        '<article class="dam-catalog-fmcg__tile" data-fmcg-group="' +
        esc(gid) +
        '">' +
        '<h6 class="dam-catalog-fmcg__tile-title">' +
        esc(fmcgGroupTitle(gid)) +
        "</h6>" +
        items
          .map(function (item) {
            return buildFmcgRowHtml(item.row, item.idx, PF, admin);
          })
          .join("") +
        "</article>"
      );
    }).join("");
    return groups + (sumHtml || "");
  }

  function readDirectFromDom(host) {
    var PF = window.DamProductFinance;
    var base = (catalogRenderCtx && catalogRenderCtx.financeProject && catalogRenderCtx.financeProject.direct) || [];
    var byKey = {};
    base.forEach(function (row, idx) {
      byKey[fmcgRowKey(row, idx)] = row;
    });
    var rows = [];
    host.querySelectorAll(".dam-catalog-fmcg__row[data-row-key]").forEach(function (el) {
      var key = el.getAttribute("data-row-key");
      var src = byKey[key] || {};
      var inp = el.querySelector(".dam-catalog-fmcg__amount-input");
      var labEl = el.querySelector(".dam-catalog-fmcg__row-label");
      var amount = inp ? Number(inp.value) : Number(src.amount) || 0;
      rows.push({
        key: src.key || key,
        label:
          src.label ||
          (labEl ? String(labEl.textContent || "").trim() : "") ||
          key,
        department: src.department,
        unit: src.unit,
        qty: src.qty,
        rate: src.rate,
        amount: amount,
        isTest: src.isTest !== false,
        source: src.source || "manual",
        adhoc: !!src.adhoc,
      });
    });
    return rows;
  }

  function fmcgModifierStep(ev) {
    var ctrl = !!(ev && (ev.ctrlKey || ev.metaKey));
    var shift = !!(ev && ev.shiftKey);
    if (ctrl && shift) return 100;
    if (shift) return 10;
    if (ctrl) return 0.01;
    return 1;
  }

  function fmcgRoundMoney(v) {
    return Math.round(v * 100) / 100;
  }

  function fmcgApplyAmountDelta(inp, direction, ev) {
    if (!inp) return;
    var cur = Number(inp.value);
    if (!isFinite(cur)) cur = 0;
    var next = fmcgRoundMoney(cur + direction * fmcgModifierStep(ev));
    if (next < 0) next = 0;
    inp.value = String(next);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isFmcgAmountInput(el) {
    if (!el || el.tagName !== "INPUT") return false;
    if (el.id === "damCatalogFmcgAdhocAmount") return true;
    return !!(el.classList && el.classList.contains("dam-catalog-fmcg__amount-input"));
  }

  function bindFmcgAmountSteppers() {
    if (window.__damFmcgStepDelegated) return;
    window.__damFmcgStepDelegated = true;
    document.addEventListener(
      "keydown",
      function (ev) {
        if (!isFmcgAmountInput(ev.target)) return;
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
        ev.preventDefault();
        fmcgApplyAmountDelta(ev.target, ev.key === "ArrowUp" ? 1 : -1, ev);
      },
      true
    );
    document.addEventListener(
      "wheel",
      function (ev) {
        if (!isFmcgAmountInput(ev.target)) return;
        if (document.activeElement !== ev.target) return;
        ev.preventDefault();
        fmcgApplyAmountDelta(ev.target, ev.deltaY < 0 ? 1 : -1, ev);
      },
      { passive: false, capture: true }
    );
  }

  function bindCatalogFmcgEvents(p, financeProject) {
    var host = document.getElementById("damCatalogBody");
    if (!host) return;
    var section = host.querySelector(".dam-catalog-fmcg");
    if (!section) return;
    var PF = window.DamProductFinance;
    var projectId = financeProject && financeProject.id;

    var saveBtn = section.querySelector("#damCatalogFmcgSave");
    if (saveBtn && !saveBtn._damBound) {
      saveBtn._damBound = true;
      saveBtn.addEventListener("click", function () {
        if (!isFinanceAdmin() || !PF || !projectId) return;
        var direct = readDirectFromDom(host);
        PF.saveProjectDirect(projectId, direct)
          .then(function (res) {
            if (!res || !res.ok) {
              alert((res && res.error) || "Nie udało się zapisać kwot.");
              return;
            }
            if (catalogRenderCtx) {
              catalogRenderCtx.financeProject = res.project;
              renderCatalog(catalogRenderCtx.p, catalogRenderCtx.bundle, res.project);
            }
          })
          .catch(function () {
            alert("Bridge offline — zapis kwot wymaga mostu lokalnego.");
          });
      });
    }

    var addBtn = section.querySelector("#damCatalogFmcgAdd");
    if (addBtn && !addBtn._damBound) {
      addBtn._damBound = true;
      addBtn.addEventListener("click", function () {
        if (!isFinanceAdmin() || !PF || !projectId) return;
        var labelInp = section.querySelector("#damCatalogFmcgAdhocLabel");
        var amountInp = section.querySelector("#damCatalogFmcgAdhocAmount");
        var label = labelInp ? String(labelInp.value || "").trim() : "";
        var amount = amountInp ? Number(amountInp.value) : 0;
        if (!label) {
          if (labelInp) labelInp.focus();
          return;
        }
        var direct = readDirectFromDom(host);
        direct.push({
          key: "adhoc_" + Date.now(),
          label: label,
          department: "Ad-hoc",
          unit: "szt",
          amount: amount,
          isTest: true,
          source: "manual",
          adhoc: true,
        });
        PF.saveProjectDirect(projectId, direct)
          .then(function (res) {
            if (!res || !res.ok) {
              alert((res && res.error) || "Nie udało się dodać pozycji.");
              return;
            }
            if (labelInp) labelInp.value = "";
            if (amountInp) amountInp.value = "";
            if (catalogRenderCtx) {
              catalogRenderCtx.financeProject = res.project;
              renderCatalog(catalogRenderCtx.p, catalogRenderCtx.bundle, res.project);
            }
          })
          .catch(function () {
            alert("Bridge offline.");
          });
      });
    }

    section.querySelectorAll(".dam-catalog-fmcg__amount-input").forEach(function (inp) {
      if (inp._damSumBound) return;
      inp._damSumBound = true;
      inp.addEventListener("input", function () {
        var sumEl = section.querySelector("#damCatalogFmcgSum");
        if (!sumEl) return;
        var direct = readDirectFromDom(host);
        var sum = direct.reduce(function (a, r) {
          return a + (Number(r.amount) || 0);
        }, 0);
        sumEl.textContent = PF ? PF.formatPLN(sum) : String(sum);
      });
    });
    bindFmcgAmountSteppers();
  }

  if (!window.__damProjectAdminListen) {
    window.__damProjectAdminListen = true;
    document.addEventListener("dam:admin-mode", function () {
      if (catalogRenderCtx) {
        renderCatalog(catalogRenderCtx.p, catalogRenderCtx.bundle, catalogRenderCtx.financeProject);
      }
    });
  }

  function renderCatalog(p, bundle, financeProject) {
    catalogRenderCtx = { p: p, bundle: bundle, financeProject: financeProject };
    var host = document.getElementById("damCatalogBody");
    if (!host) return;
    var PF = window.DamProductFinance;
    var entry = bundle.entry || {};
    var dims = entry.dimensions_mm || {};
    var weight = entry.weight_g || {};
    var pal = entry.palletization || {};
    var dimStr =
      dims.w || dims.h || dims.d
        ? [dims.w, dims.h, dims.d].filter(Boolean).join(" × ") + " mm"
        : null;

    var lifecycleDoc = bundle.lifecycle || {};
    var lifecycleStages = lifecycleDoc.stages || [];
    var lifecycleProduct =
      lifecycleDoc.products && p.id ? lifecycleDoc.products[p.id] : null;
    var stageId = lifecycleProduct && lifecycleProduct.stage ? lifecycleProduct.stage : null;
    var shopLive =
      entry &&
      entry.shop_live === true &&
      PF &&
      typeof PF.isShopLiveStage === "function" &&
      PF.isShopLiveStage(stageId);
    if (entry && entry.shop_live === true && !stageId) shopLive = true;

    var priceVal = null;
    var priceHint = catalogLabel("project.price_hint", "Cena ze sklepu (odświeżanie 1×/dobę)");
    if (shopLive) {
      if (bundle.price && bundle.price.ok && bundle.price.price_pln != null) {
        priceVal = String(bundle.price.price_pln).replace(".", ",") + " zł";
      } else if (entry && entry.price_pln != null) {
        priceVal = String(entry.price_pln).replace(".", ",") + " zł";
      }
      if (bundle.price && bundle.price.fetched_at) {
        priceHint = "Sklep · " + String(bundle.price.fetched_at).slice(0, 10);
      }
    }

    var shopLink = "";
    if (shopLive && entry && entry.shop_url) {
      shopLink =
        '<a class="dam-catalog-shop-link" href="' +
        esc(entry.shop_url) +
        '" target="_blank" rel="noopener noreferrer"><i class="uil uil-external-link-alt"></i> ' +
        esc(catalogLabel("project.shop_link", "Zobacz w sklepie")) +
        "</a>";
    }

    var priceHeroHtml = "";
    if (shopLive && priceVal) {
      priceHeroHtml =
        '<div class="dam-cost-total dam-catalog-price-hero">' +
        '<div class="dam-cost-total__label">' +
        esc(catalogLabel("project.kpi_price", "Cena")) +
        "</div>" +
        '<div class="dam-cost-total__value">' +
        esc(priceVal) +
        "</div>" +
        '<p class="dam-catalog-price-hero__hint">' +
        esc(priceHint) +
        "</p>" +
        shopLink +
        "</div>";
    } else if (entry && entry.reference_price_pln != null) {
      var refVal = String(entry.reference_price_pln).replace(".", ",") + " zł";
      var refNote =
        entry.reference_price_note_pl ||
        catalogLabel(
          "project.reference_price_hint",
          "Porównanie kategorii (TESTOWE, nie cena ze sklepu)"
        );
      var refLink = entry.reference_price_url
        ? ' <a class="dam-catalog-ref-link" href="' +
          esc(entry.reference_price_url) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(catalogLabel("project.reference_price_link", "Produkt referencyjny")) +
          "</a>"
        : "";
      priceHeroHtml =
        '<div class="dam-cost-total dam-catalog-price-hero dam-catalog-price-hero--reference">' +
        '<div class="dam-cost-total__label">' +
        esc(catalogLabel("project.reference_price_label", "Cena referencyjna kategorii")) +
        " " +
        (PF && typeof PF.testBadgeHtml === "function" ? PF.testBadgeHtml() : "") +
        "</div>" +
        '<div class="dam-cost-total__value">' +
        esc(refVal) +
        "</div>" +
        '<p class="dam-catalog-price-hero__hint">' +
        esc(refNote) +
        refLink +
        "</p></div>";
    } else {
      var stageLbl =
        PF && typeof PF.lifecycleStageLabel === "function"
          ? PF.lifecycleStageLabel(stageId, lifecycleStages)
          : stageId || "—";
      priceHeroHtml =
        '<div class="dam-cost-total dam-catalog-price-hero dam-catalog-price-hero--unavailable">' +
        '<div class="dam-cost-total__label">' +
        esc(catalogLabel("project.not_in_shop", "Brak w sklepie")) +
        "</div>" +
        '<div class="dam-cost-total__value dam-catalog-price-hero__status">' +
        esc(catalogLabel("project.lifecycle_stage", "Etap")) +
        ": " +
        esc(stageLbl) +
        "</div></div>";
    }

    var lifecycleHtml =
      PF && typeof PF.lifecycleStepperHtml === "function"
        ? PF.lifecycleStepperHtml(stageId, lifecycleStages)
        : "";

    var packLayout =
      PF && typeof PF.computeCasePackLayout === "function"
        ? PF.computeCasePackLayout(
            entry && entry.units_per_bulk_case,
            entry && entry.case_pack_layout
          )
        : null;
    var packVizHtml =
      PF && typeof PF.casePackGridHtml === "function" ? PF.casePackGridHtml(packLayout) : "";

    var palMain =
      pal.cases_per_pallet != null
        ? pal.cases_per_pallet + " kart. × " + (pal.layers || pal.layers_per_pallet || "?") + " warstw"
        : pal.units_per_pallet != null
          ? pal.units_per_pallet + " szt./paleta"
          : null;
    var palSub = pal.formula_pl || "";
    if (!palSub && pal.cases_per_layer) {
      palSub =
        pal.cases_per_layer +
        " kart./warstwa · " +
        (pal.net_weight_kg != null ? pal.net_weight_kg + " kg netto" : "");
    }

    var testBadge =
      PF && typeof PF.testBadgeHtml === "function" &&
      (PF.isTestEntity(entry) || PF.isTestEntity(financeProject))
        ? PF.testBadgeHtml()
        : "";

    var links = PF && typeof PF.financeLinks === "function"
      ? PF.financeLinks(p.id, financeProject && financeProject.id)
      : { invoices: "invoices.html", calculator: "costs.html" };

    var kpi =
      '<div class="geex-card dam-cost-panel dam-catalog-kpi-panel">' +
      '<h5 class="dam-cost-card__title">' +
      esc(catalogLabel("project.catalog_kpi_title", "KPI produktu")) +
      "</h5>" +
      '<p class="dam-cost-card__sub">' +
      esc(
        catalogLabel(
          "project.catalog_kpi_sub",
          "Wymiary, pakowanie zbiorcze i status cyklu życia."
        )
      ) +
      "</p>" +
      lifecycleHtml +
      priceHeroHtml +
      '<div class="dam-catalog-kpi" role="list">' +
      '<div class="dam-catalog-kpi__tile dam-catalog-kpi__tile--dims" role="listitem">' +
      '<span class="dam-catalog-kpi__label">' +
      esc(catalogLabel("project.kpi_dims", "Wymiary")) +
      "</span>" +
      '<span class="dam-catalog-kpi__value">' +
      esc(dimStr || "—") +
      "</span></div>" +
      '<div class="dam-catalog-kpi__tile" role="listitem">' +
      '<span class="dam-catalog-kpi__label">' +
      esc(catalogLabel("project.kpi_weight", "Waga netto")) +
      "</span>" +
      '<span class="dam-catalog-kpi__value">' +
      esc(weight.net != null ? weight.net + " g" : "—") +
      "</span></div>" +
      '<div class="dam-catalog-kpi__tile dam-catalog-kpi__tile--case" role="listitem">' +
      '<span class="dam-catalog-kpi__label">' +
      esc(catalogLabel("project.kpi_case", "Szt. w kartonie")) +
      "</span>" +
      '<span class="dam-catalog-kpi__value">' +
      esc(entry.units_per_bulk_case != null ? String(entry.units_per_bulk_case) : "—") +
      "</span>" +
      packVizHtml +
      "</div>" +
      '<div class="dam-catalog-kpi__tile dam-catalog-kpi__tile--pallet" role="listitem">' +
      '<span class="dam-catalog-kpi__label">' +
      esc(catalogLabel("project.kpi_pallet", "Paletyzacja")) +
      "</span>" +
      '<span class="dam-catalog-kpi__value">' +
      esc(palMain || "—") +
      "</span>" +
      (palSub ? '<span class="dam-catalog-kpi__hint">' + esc(palSub) + "</span>" : "") +
      "</div>" +
      "</div></div>";

    var fmcgHtml = "";
    var admin = isFinanceAdmin();
    var stepHint = fmcgStepHint();
    if (financeProject) {
      var directLines = financeProject.direct || [];
      var adminTools = admin
        ? '<div class="dam-catalog-fmcg__admin">' +
          '<div class="dam-catalog-fmcg__adhoc">' +
          '<label class="visually-hidden" for="damCatalogFmcgAdhocLabel">' +
          esc(catalogLabel("project.fmcg_adhoc_label", "Nazwa pozycji")) +
          "</label>" +
          '<input type="text" id="damCatalogFmcgAdhocLabel" class="form-control form-control-sm dam-catalog-fmcg__adhoc-label" placeholder="' +
          esc(catalogLabel("project.fmcg_adhoc_ph", "np. Badanie marketingowe")) +
          '" />' +
          '<label class="visually-hidden" for="damCatalogFmcgAdhocAmount">' +
          esc(catalogLabel("project.fmcg_adhoc_amount", "Kwota PLN")) +
          "</label>" +
          '<input type="number" step="1" min="0" id="damCatalogFmcgAdhocAmount" class="form-control form-control-sm dam-catalog-fmcg__adhoc-amount dam-catalog-fmcg__amount-input" placeholder="0,00" aria-describedby="damCatalogFmcgStepHint" title="' +
          esc(stepHint) +
          '" />' +
          '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary" id="damCatalogFmcgAdd">' +
          esc(catalogLabel("project.fmcg_add_line", "Dodaj pozycję")) +
          "</button>" +
          "</div>" +
          '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary" id="damCatalogFmcgSave">' +
          esc(catalogLabel("project.fmcg_save", "Zapisz kwoty")) +
          "</button>" +
          '<p class="dam-catalog-kpi__hint">' +
          esc(catalogLabel("project.fmcg_admin_hint", "Wymaga ADMIN i mostu lokalnego (8766).")) +
          "</p></div>"
        : "";
      var sumHtml =
        '<div class="dam-catalog-fmcg__tile dam-catalog-fmcg__tile--sum">' +
        '<span class="dam-catalog-fmcg__sum-label">' +
        esc(catalogLabel("project.fmcg_sum", "Suma opakowań")) +
        "</span>" +
        '<strong id="damCatalogFmcgSum" class="dam-catalog-fmcg__sum-value">' +
        esc(PF ? PF.formatPLN(financeProject.direct_total) : "") +
        "</strong></div>";
      var fmcgBody = buildFmcgBentoHtml(directLines, PF, admin, sumHtml);
      fmcgHtml =
        '<section class="dam-catalog-fmcg geex-card dam-cost-panel dam-catalog-fmcg--panel">' +
        '<div class="dam-catalog-fmcg__inner">' +
        '<div class="dam-catalog-fmcg__head">' +
        '<h5 class="dam-cost-card__title">' +
        esc(catalogLabel("project.fmcg_title", "Kalkulacja opakowań (FMCG)")) +
        "</h5>" +
        testBadge +
        "</div>" +
        '<p class="dam-cost-card__sub dam-catalog-fmcg__lede">' +
        esc(catalogLabel("project.fmcg_sub", "Ten sam łańcuch co w Kalkulatorze kosztów.")) +
        "</p>" +
        fmcgBody +
        '<p id="damCatalogFmcgStepHint" class="dam-catalog-fmcg__step-hint">' +
        esc(stepHint) +
        "</p>" +
        adminTools +
        '<div class="dam-catalog-fmcg__links">' +
        '<a class="geex-btn geex-btn--sm geex-btn--secondary" href="' +
        esc(links.invoices) +
        '"><i class="uil uil-invoice" aria-hidden="true"></i> ' +
        esc(catalogLabel("project.link_invoices", "Faktury tego produktu")) +
        "</a>" +
        '<a class="geex-btn geex-btn--sm geex-btn--primary" href="' +
        esc(links.calculator) +
        '"><i class="uil uil-calculator-alt" aria-hidden="true"></i> ' +
        esc(catalogLabel("project.link_base_rates", "Kwoty bazowe")) +
        "</a></div></div></section>";
    } else {
      fmcgHtml =
        '<div class="dam-catalog-fmcg__links">' +
        '<a class="geex-btn geex-btn--sm geex-btn--secondary" href="' +
        esc(links.invoices) +
        '">' +
        esc(catalogLabel("project.link_invoices", "Faktury tego produktu")) +
        "</a>" +
        '<a class="geex-btn geex-btn--sm geex-btn--primary" href="' +
        esc(links.calculator) +
        '">' +
        esc(catalogLabel("project.link_calculator", "Kalkulator kosztów")) +
        "</a></div>";
    }

    host.innerHTML =
      '<div class="dam-catalog-panel__head">' +
      testBadge +
      (bundle.packLabel
        ? '<span class="dam-viz-badge dam-badge-tag dam-badge-tag--pakowanie dam-badge-tag--tier-low">' +
          esc(bundle.packLabel) +
          "</span>"
        : "") +
      "</div>" +
      kpi +
      fmcgHtml;
    if (window.DamI18n && typeof window.DamI18n.apply === "function") {
      window.DamI18n.apply(host);
    }
    bindCatalogFmcgEvents(p, financeProject);
  }

  function marketingTilePreviewHtml(assets, limit) {
    limit = limit || 4;
    return (
      '<div class="dam-marketing-tile__grid">' +
      assets
        .slice(0, limit)
        .map(marketingCardHtml)
        .join("") +
      "</div>"
    );
  }

  function marketingTileHtml(tile, index) {
    var count = tile.assets.length;
    var previewLimit = tile.kind === "viz" ? 6 : 4;
    var canExpand = count > previewLimit;
    var preview = marketingTilePreviewHtml(tile.assets, previewLimit);
    return (
      '<article class="dam-marketing-tile" data-tile-id="' +
      esc(tile.id) +
      '" data-tile-index="' +
      index +
      '" style="--tile-order:' +
      index +
      '">' +
      '<header class="dam-marketing-tile__head">' +
      '<div class="dam-marketing-tile__titles">' +
      '<h5 class="dam-marketing-tile__title">' +
      esc(tile.title) +
      "</h5>" +
      '<p class="dam-marketing-tile__meta">' +
      count +
      (count === 1 ? " asset" : " assetów") +
      "</p></div>" +
      (canExpand
        ? '<button type="button" class="dam-marketing-tile__toggle geex-btn geex-btn--sm geex-btn--primary-transparent" data-action="expand" aria-expanded="false">' +
          "Pokaż wszystko</button>"
        : "") +
      "</header>" +
      '<div class="dam-marketing-tile__body">' +
      preview +
      (canExpand
        ? '<div class="dam-marketing-tile__full" hidden>' +
          '<div class="dam-marketing-tile__grid dam-marketing-tile__grid--full">' +
          tile.assets.map(marketingCardHtml).join("") +
          "</div></div>"
        : "") +
      "</div></article>"
    );
  }

  function bindMarketingTiles(host) {
    if (!host) return;
    host.querySelectorAll(".dam-marketing-tiles").forEach(function (wrap) {
      wrap.querySelectorAll(".dam-marketing-tile__toggle").forEach(function (btn) {
        if (btn._damMarketingToggleBound) return;
        btn._damMarketingToggleBound = true;
        btn.addEventListener("click", function () {
          var tile = btn.closest(".dam-marketing-tile");
          if (!tile) return;
          var expanded = wrap.getAttribute("data-expanded");
          var tileId = tile.getAttribute("data-tile-id");
          if (expanded === tileId) {
            wrap.removeAttribute("data-expanded");
            tile.classList.remove("is-expanded");
            btn.setAttribute("aria-expanded", "false");
            btn.textContent = "Pokaż wszystko";
            var full = tile.querySelector(".dam-marketing-tile__full");
            if (full) full.hidden = true;
            return;
          }
          wrap.querySelectorAll(".dam-marketing-tile").forEach(function (el) {
            el.classList.remove("is-expanded");
            var fullEl = el.querySelector(".dam-marketing-tile__full");
            if (fullEl) fullEl.hidden = true;
            var tg = el.querySelector(".dam-marketing-tile__toggle");
            if (tg) {
              tg.setAttribute("aria-expanded", "false");
              tg.textContent = "Pokaż wszystko";
            }
          });
          wrap.setAttribute("data-expanded", tileId);
          tile.classList.add("is-expanded");
          btn.setAttribute("aria-expanded", "true");
          btn.textContent = "Zwiń";
          var fullPanel = tile.querySelector(".dam-marketing-tile__full");
          if (fullPanel) fullPanel.hidden = false;
          var idx = parseInt(tile.getAttribute("data-tile-index") || "0", 10);
          wrap.querySelectorAll(".dam-marketing-tile").forEach(function (el) {
            var elIdx = parseInt(el.getAttribute("data-tile-index") || "0", 10);
            if (el === tile) {
              el.style.order = String(idx);
            } else if (elIdx < idx) {
              el.style.order = String(elIdx);
            } else {
              el.style.order = String(elIdx + 1);
            }
          });
        });
      });
    });
  }

  /*
   * HARD freeze fix (2026-07-23): NIGDY nie fetch/parse data/branding-index.json
   * (~388MB) w watku UI — to zamraza cala aplikacje (nawet F5/ESC nie dziala,
   * bo JSON.parse blokuje petle zdarzen). Filtrowanie robi bridge
   * (/branding-for-product), UI dostaje tylko dopasowane assety (KB, nie MB).
   */
  var _brandingAssetsCache = {};
  async function fetchBrandingAssetsForProduct(prod) {
    var productId = typeof prod === "string" ? prod : prod && prod.id;
    if (!productId) return [];
    if (_brandingAssetsCache[productId]) return _brandingAssetsCache[productId];
    var tokens = productIndexTokens(typeof prod === "object" ? prod : { id: productId });
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl
      ? setTimeout(function () {
          try {
            ctrl.abort();
          } catch (eAb) {
            /* ignore */
          }
        }, 8000)
      : null;
    if (ctrl && window.__damRegisterAbort) window.__damRegisterAbort(ctrl);
    try {
      var url =
        bridgeUrl() +
        "/branding-for-product?product_id=" +
        encodeURIComponent(productId) +
        "&tokens=" +
        encodeURIComponent(tokens.join(",")) +
        "&limit=400&v=" +
        encodeURIComponent(String(window.DAM_APP_VERSION || "1"));
      var r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!r.ok) throw new Error("branding_for_product_http_" + r.status);
      var data = await r.json();
      var assets = data && Array.isArray(data.assets) ? data.assets : [];
      _brandingAssetsCache[productId] = assets;
      return assets;
    } catch (e) {
      return [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function renderMarketingShort(p, revs, marketingPartition, preloadedAssets) {
    var host = document.getElementById("damMarketingShortBody");
    if (!host) return;
    var productId = typeof p === "string" ? p : p && p.id;
    if (!productId) return;
    var prod = typeof p === "object" && p ? p : { id: productId };
    try {
      var assets = Array.isArray(preloadedAssets)
        ? preloadedAssets
        : await fetchBrandingAssetsForProduct(prod);
      if (!assets.length) {
        host.innerHTML =
          '<p class="dam-catalog-marketing__empty">Brak powiązanych assetów w indeksie Branding (SKU, ścieżka lub linked_product_ids).</p>';
        return;
      }
      var brandHref = brandingLinkForProduct(prod);
      var partition =
        marketingPartition ||
        (revs && revs.length > 1 ? partitionMarketingAssets(assets, revs) : null);
      var bodyHtml = "";
      if (partition && revs && revs.length > 1) {
        revs.forEach(function (rev) {
          var revAssets = partition.buckets[String(rev.index)] || [];
          if (!revAssets.length) return;
          var tiles = window.DamProductCorrelation
            ? DamProductCorrelation.groupMarketingTiles(revAssets)
            : [{ id: "all", title: "Materiały", assets: revAssets, kind: "graphics" }];
          bodyHtml +=
            '<section class="dam-variant-marketing-block" data-variant-index="' +
            esc(rev.index || "") +
            '">' +
            '<h5 class="dam-variant-marketing-block__title">' +
            esc(variantCarrierLabel(rev, prod.title || "")) +
            ' <span class="dam-variant-index-chip">' +
            esc(rev.index || "") +
            "</span></h5>" +
            '<div class="dam-marketing-tiles" data-expanded="">' +
            tiles.map(marketingTileHtml).join("") +
            "</div></section>";
        });
        if (partition.shared && partition.shared.length) {
          var sharedTiles = window.DamProductCorrelation
            ? DamProductCorrelation.groupMarketingTiles(partition.shared)
            : [{ id: "shared", title: "Materiały", assets: partition.shared, kind: "graphics" }];
          bodyHtml +=
            '<section class="dam-variant-marketing-block dam-variant-marketing-block--shared">' +
            '<h5 class="dam-variant-marketing-block__title">Materiały wspólne</h5>' +
            '<div class="dam-marketing-tiles" data-expanded="">' +
            sharedTiles.map(marketingTileHtml).join("") +
            "</div></section>";
        }
      } else {
        var tiles = window.DamProductCorrelation
          ? DamProductCorrelation.groupMarketingTiles(assets)
          : [{ id: "all", title: "Materiały", assets: assets, kind: "graphics" }];
        bodyHtml =
          '<div class="dam-marketing-tiles" data-expanded="">' +
          tiles.map(marketingTileHtml).join("") +
          "</div>";
      }
      host.innerHTML =
        '<p class="dam-catalog-marketing__summary">' +
        assets.length +
        ' assetów · <a href="' +
        esc(brandHref) +
        '">Otwórz Branding</a></p>' +
        bodyHtml;
      bindMarketingTiles(host);
    } catch (e) {
      host.innerHTML =
        '<p class="dam-catalog-marketing__empty">Brak powiązanych assetów — zbuduj indeks Branding.</p>';
    }
  }

  function fillActions(p, variant, canWrite) {
    var stack = document.getElementById("damActionStack");
    if (!stack) return;
    var asanaUrl = ASANA_BY_INDEX[String(p.product_index || "").trim()] || "";
    var folderPath = p.path || "";
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var asanaIcon =
      window.DamIcons && typeof window.DamIcons.asanaSvg === "function"
        ? window.DamIcons.asanaSvg()
        : '<i class="uil uil-external-link-alt" aria-hidden="true"></i>';
    var finLinks =
      window.DamProductFinance && typeof DamProductFinance.financeLinks === "function"
        ? DamProductFinance.financeLinks(p.id, p.id)
        : { invoices: "invoices.html?project=" + encodeURIComponent(p.id), calculator: "costs.html?project=" + encodeURIComponent(p.id) };
    stack.innerHTML =
      '<a class="dam-action-tile" href="' +
      esc(finLinks.calculator) +
      '" title="Kalkulator kosztów tego produktu">' +
      '<i class="uil uil-calculator-alt" aria-hidden="true"></i>' +
      "<span>Kalkulator</span>" +
      "<small>Koszty FMCG i godziny</small></a>" +
      '<a class="dam-action-tile" href="' +
      esc(finLinks.invoices) +
      '" title="Faktury powiązane z produktem">' +
      '<i class="uil uil-invoice" aria-hidden="true"></i>' +
      "<span>Faktury</span>" +
      "<small>Filtr na ten SKU</small></a>" +
      '<button type="button" class="dam-action-tile dam-action-tile--primary" id="damRecomputeBtn"' +
      (!canWrite || !variant ? " disabled" : "") +
      ' title="Przelicz status kompletności">' +
      '<i class="uil uil-sync" aria-hidden="true"></i>' +
      "<span>Przelicz</span>" +
      "<small>Odśwież checklistę z dysku</small></button>" +
      '<button type="button" class="dam-action-tile" id="damNotifyBtn"' +
      (!canWrite || !variant ? " disabled" : "") +
      ' title="Zgłoś zapotrzebowanie">' +
      '<i class="uil uil-bell-plus" aria-hidden="true"></i>' +
      "<span>Zgłoś</span>" +
      "<small>Coś brakuje albo jest nie tak</small></button>" +
      '<a class="dam-action-tile" href="explorer.html?product=' +
      encodeURIComponent(p.id) +
      '" title="Eksplorer">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i>' +
      "<span>Eksplorer</span>" +
      "<small>Hub plików DAM</small></a>" +
      '<button type="button" class="dam-action-tile dam-win-btn" id="damWinExplorerBtn" data-path="' +
      esc(folderPath) +
      '" title="Folder Windows">' +
      winIcon +
      "<span>Folder</span>" +
      "<small>Otwórz w Windows</small></button>" +
      (asanaUrl
        ? '<a class="dam-action-tile" href="' +
          esc(asanaUrl) +
          '" target="_blank" rel="noopener noreferrer" title="Asana">' +
          asanaIcon +
          "<span>Asana</span>" +
          "<small>Zadanie w Asanie</small></a>"
        : "");
  }

  async function boot() {
    if (!window.DamApi || !DamApi.requireAuth()) return;
    var id = qs("id") || "1";
    var titleEl = document.getElementById("damProjectTitle");
    var subEl = document.getElementById("damProjectSub");
    var listEl = document.getElementById("damChecklistRows");
    var statusEl = document.getElementById("damProjectStatus");
    var actionDescEl = document.getElementById("damActionDesc");

    if (actionDescEl) {
      actionDescEl.textContent =
        "Przelicz status, zgłoś potrzebę albo otwórz hub / folder / Asanę.";
    }
    var slotHint = document.getElementById("damSlotChecklistHint");

    try {
      if (window.DamApi && typeof window.DamApi.loadLocalIndex === "function") {
        await window.DamApi.loadLocalIndex();
      }
      var res = await DamApi.project(id);
      var p = res.data;
      var raw =
        (window.DamApi && typeof window.DamApi.rawProductById === "function"
          ? window.DamApi.rawProductById(p.id)
          : null) || null;
      var revs = variantRevisions(raw, p);
      var variant = (p.variants && p.variants[0]) || null;

      if (titleEl) {
        titleEl.textContent = p.title || "Projekt";
        titleEl.classList.add("dam-project-title--light");
        if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
          var trailIdx =
            revs.length > 1
              ? revs.length + " warianty"
              : p.product_index
                ? p.product_index + " - "
                : "";
          window.DamShell.setTrailLeaf(
            trailIdx + (p.title || "Projekt")
          );
        }
      }

      /* Jeden lekki fetch (bridge filtruje 388MB serwerowo) — nigdy pelny indeks w UI. */
      var marketingAssets = await fetchBrandingAssetsForProduct(p);
      var marketingPartition = null;
      if (revs.length > 1) {
        marketingPartition = partitionMarketingAssets(marketingAssets, revs);
      }

      var variantSummaries = revs.length
        ? summarizeVariantStatuses(
            revs,
            raw,
            marketingPartition || { buckets: {}, shared: [] },
            p.title
          )
        : [];

      if (subEl) {
        if (variantSummaries.length > 1) {
          subEl.textContent = variantSummaries
            .map(function (s) {
              var stH = s.status === "complete" ? "kompletny" : "niekompletny";
              return s.label + ": " + stH;
            })
            .join(" · ");
        } else {
          var st = variant && variant.checklist_status ? variant.checklist_status.status : "";
          var stHuman =
            st === "complete" ? "kompletny" : st === "incomplete" ? "niekompletny" : "do sprawdzenia";
          subEl.textContent = "Status: " + stHuman;
        }
      }
      var catalogBundle = await loadCatalogBundle(p.id);
      var financeProject = null;
      if (window.DamProductFinance && typeof DamProductFinance.loadProjectCosts === "function") {
        try {
          var pcData = await DamProductFinance.loadProjectCosts();
          financeProject = DamProductFinance.findProjectByProductId(p.id, pcData);
        } catch (eFin) {
          financeProject = null;
        }
      }
      renderCatalog(p, catalogBundle, financeProject);
      renderMarketingShort(p, revs, marketingPartition, marketingAssets);
      renderWykrojnikiShort(p.id);
      renderHeaderBadges(p, catalogBundle);

      if (listEl) {
        if (revs.length > 1 && raw) {
          listEl.className = "dam-variant-checklists";
          listEl.innerHTML = revs
            .map(function (rev) {
              var mkt = marketingPartition
                ? marketingPartition.buckets[String(rev.index)] || []
                : [];
              return variantPanelHtml(rev, raw, p, mkt);
            })
            .join("");
        } else {
          listEl.className = "dam-slot-checklist";
          var present = {};
          var paths = {};
          if (variant && variant.assets) {
            variant.assets.forEach(function (a) {
              if (a.current_revision_id) present[a.asset_role] = true;
              if (a.path) paths[a.asset_role] = a.path;
            });
          }
          var basePath = p.path || "";
          var idxOne = revs.length === 1 && revs[0] ? revs[0].index : p.product_index;
          // Jeden wariant nie ma naglowka panelu, wiec chipy rynkowe ida nad checkliste.
          var soloChips = marketChipsHtml({ index: idxOne });
          listEl.innerHTML =
            (soloChips ? '<div class="dam-slot-market-bar">' + soloChips + "</div>" : "") +
            REQUIRED.map(function (r) {
              return rowHtml(r, !!present[r], paths[r] || basePath, p.id, idxOne);
            }).join("");
        }
        bindSlotRows(listEl);
      }

      if (slotHint) {
        slotHint.textContent =
          revs.length > 1
            ? "Produkt ma " +
              revs.length +
              " warianty. Każdy panel ma osobną checklistę slotów. Kliknij zielony wiersz, aby pokazać Przejdź i Folder Windows."
            : "Kliknij zielony wiersz, aby pokazać Przejdź i Folder Windows.";
      }

      if (statusEl) {
        if (variantSummaries.length > 1) {
          var parts = variantSummaries.map(function (s) {
            if (s.status === "complete") {
              return s.label + " kompletny";
            }
            var miss = humanizeMissing(s.missing);
            return s.label + ": brakuje " + miss;
          });
          statusEl.textContent = parts.join(" · ");
        } else {
          var completeness = variant && variant.checklist_status;
          if (completeness) {
            var missingHuman = humanizeMissing(completeness.missing_roles);
            statusEl.textContent =
              missingHuman !== "brak"
                ? "Brakuje: " + missingHuman
                : "Wszystkie wymagane pliki kompletne";
          }
        }
      }

      var role = DamApi.role();
      var canWrite = role === "admin" || role === "power_user";
      var basePath = p.path || "";
      fillActions(p, variant, canWrite);

      var recomputeBtn = document.getElementById("damRecomputeBtn");
      var notifyBtn = document.getElementById("damNotifyBtn");
      var winBtn = document.getElementById("damWinExplorerBtn");

      if (winBtn) {
        winBtn.addEventListener("click", function () {
          openWin(this.getAttribute("data-path") || basePath);
        });
      }
      if (listEl) {
        listEl.querySelectorAll(".dam-variant-panel__folder").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            openWin(this.getAttribute("data-path") || basePath);
          });
        });
      }

      if (recomputeBtn && canWrite && variant) {
        recomputeBtn.addEventListener("click", async function () {
          recomputeBtn.disabled = true;
          var span = recomputeBtn.querySelector("span");
          if (span) span.textContent = "Licze...";
          try {
            var c = await DamApi.recompute(variant.id);
            if (statusEl) {
              var missingH = humanizeMissing(c.missing_roles);
              statusEl.textContent =
                missingH !== "brak" ? "Brakuje: " + missingH : "Wszystkie pliki kompletne";
            }
            location.reload();
          } catch (e) {
            if (statusEl) statusEl.textContent = "Błąd: " + e.message;
          } finally {
            recomputeBtn.disabled = false;
            if (span) span.textContent = "Przelicz";
          }
        });
      }

      if (notifyBtn && canWrite && variant) {
        notifyBtn.addEventListener("click", function () {
          if (window.DamVizRequest && typeof window.DamVizRequest.open === "function") {
            window.DamVizRequest.open({
              title: "Zgłoś zapotrzebowanie",
              sub:
                "Cos jest nie tak albo ktos potrzebuje materialow do tego projektu. " +
                "Wybierz kanaly - jak przy Zgłoś w Wizualizacjach.",
              productId: p.id,
              productName: p.title || "",
              index: p.product_index || "",
              brand: p.brand || (p.market === "GC" ? "GC" : "DK"),
              category: p.category || "",
              path: p.path || "",
              kind: "project_gap",
            });
          }
        });
      }
    } catch (e) {
      if (titleEl) titleEl.textContent = "Błąd ładowania projektu";
      if (subEl) subEl.textContent = e.message;
      /* bez wiecznego "Ładowanie…" w sekcjach, gdy projekt sie nie wczytal */
      document.querySelectorAll(".dam-catalog-marketing__empty").forEach(function (el) {
        if (/adowanie/i.test(el.textContent || "")) el.textContent = "Brak danych - projekt nie został wczytany.";
      });
      var rowsEl = document.getElementById("damChecklistRows");
      if (rowsEl && !rowsEl.children.length) {
        var none = document.createElement("p");
        none.className = "dam-catalog-marketing__empty";
        none.textContent = "Brak danych - projekt nie został wczytany.";
        rowsEl.appendChild(none);
      }
    }
  }

  function indexReportPickName(it) {
    if (!it) return "";
    if (typeof it === "string") return it;
    return String(it.name || it.label || it.id || it.path || "").trim();
  }

  function indexReportMetrics(data) {
    data = data || {};
    var counts = data.counts && typeof data.counts === "object" ? data.counts : {};
    var added = Number(
      counts.new != null ? counts.new : counts.added != null ? counts.added : data.added || 0
    );
    var changed = Number(
      counts.updated != null
        ? counts.updated
        : counts.changed != null
          ? counts.changed
          : data.changed || 0
    );
    var scanned = Number(
      counts.elements_scanned != null
        ? counts.elements_scanned
        : counts.scanned != null
          ? counts.scanned
          : data.scanned || data.product_count_after || data.product_count_before || 0
    );
    var unchanged = Number(
      counts.unchanged != null
        ? counts.unchanged
        : data.unchanged != null
          ? data.unchanged
          : Math.max(0, scanned - added - changed)
    );
    var files = Number(
      counts.files_scanned != null
        ? counts.files_scanned
        : counts.files != null
          ? counts.files
          : data.files_after || data.files_before || 0
    );
    var branding = Number(
      counts.branding_materials != null
        ? counts.branding_materials
        : counts.branding != null
          ? counts.branding
          : data.branding_scanned || 0
    );
    if (!scanned && !added && !changed && data.items && data.items.length) {
      scanned = data.items.length;
    }
    return {
      added: added,
      changed: changed,
      unchanged: unchanged,
      scanned: scanned,
      files: files,
      branding: branding,
    };
  }

  function indexReportItemLists(data) {
    data = data || {};
    var news = [];
    var updated = [];
    var hasNamed =
      Object.prototype.hasOwnProperty.call(data, "new_items") ||
      Object.prototype.hasOwnProperty.call(data, "updated_items");
    if (hasNamed) {
      (data.new_items || []).forEach(function (it) {
        var n = indexReportPickName(it);
        if (n) news.push(n);
      });
      (data.updated_items || []).forEach(function (it) {
        var n = indexReportPickName(it);
        if (n) updated.push(n);
      });
      return { news: news, updated: updated };
    }
    (data.items || []).forEach(function (it) {
      var n = indexReportPickName(it);
      if (!n) return;
      if (it && (it.kind === "changed" || it.kind === "updated")) updated.push(n);
      else news.push(n);
    });
    return { news: news, updated: updated };
  }

  function indexReportLoadData(rep) {
    if (rep && typeof rep === "object") return rep;
    try {
      var raw = localStorage.getItem("dam_index_last_report");
      if (raw) return JSON.parse(raw);
    } catch (eR) { /* ignore */ }
    return {};
  }

  window.__damPaintIndexReport = paintIndexReportCard;

  function ensureIndexReportHost() {
    var el = document.getElementById("damIndexReport");
    if (el) return el;
    el = document.createElement("aside");
    el.id = "damIndexReport";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "damIndexReportTitle");
    document.body.appendChild(el);
    return el;
  }

  function paintIndexReportCard(rep) {
    var el = ensureIndexReportHost();
    if (!el) return;
    var data = indexReportLoadData(rep);
    var m = indexReportMetrics(data);
    var lists = indexReportItemLists(data);
    var rows = [
      ["index.report_metric_new", "Nowe", m.added],
      ["index.report_metric_updated", "Zaktualizowane", m.changed],
      ["index.report_metric_unchanged", "Bez zmian", m.unchanged],
      ["index.report_metric_scanned", "Przeskanowane elementy", m.scanned],
      ["index.report_metric_files", "Pliki", m.files],
      ["index.report_metric_branding", "Materiały branding", m.branding],
    ];
    var table =
      '<table class="dam-index-report__table"><tbody>' +
      rows
        .map(function (row) {
          return (
            "<tr><th scope=\"row\">" +
            esc(catalogLabel(row[0], row[1])) +
            '</th><td class="dam-index-report__num">' +
            esc(String(row[2])) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
    var zero =
      m.added === 0
        ? '<p class="dam-index-report__zero">' +
          esc(
            catalogLabel(
              "index.report_none_new",
              "Brak nowych elementów w tym przebiegu."
            )
          ) +
          "</p>"
        : "";
    var compareNote = "";
    if (data.comparison_ok === true) {
      compareNote =
        '<p class="dam-index-report__compare">' +
        esc(catalogLabel("index.report_compare_ok", "Porównanie ze snapshotem: OK")) +
        "</p>";
    } else if (data.comparison_ok === false) {
      compareNote =
        '<p class="dam-index-report__compare dam-index-report__compare--fail">' +
        esc(
          catalogLabel(
            "index.report_compare_fail",
            "Porównanie ze snapshotem nie powiodło się."
          )
        ) +
        "</p>";
    }
    var warnList = Array.isArray(data.warnings) ? data.warnings : [];
    var warnHtml = "";
    if (warnList.length) {
      warnHtml =
        '<ul class="dam-index-report__warnings">' +
        warnList
          .map(function (w) {
            return w ? "<li>" + esc(String(w)) + "</li>" : "";
          })
          .join("") +
        "</ul>";
    }
    function itemBlock(titleKey, titleFb, names) {
      if (!names.length) return "";
      return (
        '<details class="dam-index-report__details">' +
        "<summary>" +
        esc(catalogLabel(titleKey, titleFb)) +
        " (" +
        names.length +
        ")</summary>" +
        "<ul>" +
        names
          .map(function (n) {
            return "<li>" + esc(n) + "</li>";
          })
          .join("") +
        "</ul></details>"
      );
    }
    el.classList.add("dam-index-report--docked");
    el.innerHTML =
      '<div class="dam-index-report__card">' +
      '<h2 id="damIndexReportTitle">' +
      esc(catalogLabel("index.report_title", "Raport indeksowania")) +
      "</h2>" +
      table +
      compareNote +
      warnHtml +
      zero +
      itemBlock("index.report_show_new", "Pokaż nowe", lists.news) +
      itemBlock("index.report_show_updated", "Pokaż zaktualizowane", lists.updated) +
      '<div class="dam-index-report__actions">' +
      '<button type="button" class="geex-btn geex-btn--sm geex-btn--secondary" id="damIndexReportClose">' +
      esc(catalogLabel("index.close", "Zamknij")) +
      "</button></div></div>";
    el.hidden = false;
    var closer = el.querySelector("#damIndexReportClose");
    if (closer) {
      closer.addEventListener("click", function () {
        el.hidden = true;
      });
    }
  }

  function hookIndexReportFromCatalog() {
    var api = window.DamCacheSync;
    if (!api || typeof api.openReport !== "function") {
      setTimeout(hookIndexReportFromCatalog, 250);
      return;
    }
    if (api.__damCatalogReportHook) return;
    api.__damCatalogReportHook = true;
    var orig = api.openReport.bind(api);
    api.openReport = function (rep) {
      orig(rep);
      paintIndexReportCard(rep);
    };
    var el = document.getElementById("damIndexReport");
    if (el && !el.hidden) paintIndexReportCard(null);
  }

  document.addEventListener("DOMContentLoaded", function () {
    hookIndexReportFromCatalog();
    boot();
  });
})();