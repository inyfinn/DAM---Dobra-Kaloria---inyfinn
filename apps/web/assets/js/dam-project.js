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
    photo: "Fotografia produktowa",
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
    var price = null;
    try {
      catalog = await fetchJsonLocal("data/product-catalog.json");
    } catch (e) { /* optional */ }
    try {
      bulk = await fetchJsonLocal("data/bulk-packaging.json");
    } catch (e2) { /* optional */ }
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
    return { entry: entry, bulk: bulk, price: price, packLabel: packLabel };
  }

  function renderCatalog(p, bundle) {
    var host = document.getElementById("damCatalogBody");
    if (!host) return;
    var entry = bundle.entry || {};
    var dims = entry.dimensions_mm || {};
    var weight = entry.weight_g || {};
    var pal = entry.palletization || {};
    var dimStr =
      dims.w || dims.h || dims.d
        ? [dims.w, dims.h, dims.d].filter(Boolean).join(" × ") + " mm"
        : null;
    var priceHtml = "—";
    var priceHint = "Cena ze sklepu (odświeżanie 1×/dobę)";
    if (bundle.price && bundle.price.ok && bundle.price.price_pln != null) {
      priceHtml = String(bundle.price.price_pln).replace(".", ",") + " zł";
      if (bundle.price.fetched_at) {
        priceHint = "Sklep · " + String(bundle.price.fetched_at).slice(0, 10);
      }
    }
    var shopLink = entry.shop_url
      ? '<a class="dam-catalog-shop-link" href="' +
        esc(entry.shop_url) +
        '" target="_blank" rel="noopener noreferrer"><i class="uil uil-external-link-alt"></i> Zobacz w sklepie</a>'
      : "";
    host.innerHTML =
      '<div class="dam-catalog-grid">' +
      '<div class="dam-catalog-card dam-catalog-card--price"><p class="dam-catalog-card__label">Cena</p>' +
      '<p class="dam-catalog-card__value">' +
      esc(priceHtml) +
      "</p><p class=\"dam-catalog-card__hint\">" +
      esc(priceHint) +
      "</p>" +
      shopLink +
      "</div>" +
      '<div class="dam-catalog-card"><p class="dam-catalog-card__label">Wymiary</p>' +
      dash(dimStr) +
      "</div>" +
      '<div class="dam-catalog-card"><p class="dam-catalog-card__label">Waga netto</p>' +
      dash(weight.net != null ? weight.net + " g" : null) +
      "</div>" +
      '<div class="dam-catalog-card"><p class="dam-catalog-card__label">Szt. w kartonie</p>' +
      dash(entry.units_per_bulk_case != null ? String(entry.units_per_bulk_case) : null) +
      "</div>" +
      '<div class="dam-catalog-card"><p class="dam-catalog-card__label">Paletyzacja</p>' +
      dash(
        pal.units_per_pallet != null
          ? pal.units_per_pallet + " szt./paleta"
          : pal.units_per_layer
            ? pal.units_per_layer + " × " + (pal.layers_per_pallet || "?") + " warstw"
            : null
      ) +
      "</div>" +
      (bundle.packLabel
        ? '<div class="dam-catalog-card"><p class="dam-catalog-card__label">Pakowanie zbiorcze</p><div class="dam-catalog-pack-badge"><span class="dam-viz-badge dam-badge-tag dam-badge-tag--pakowanie dam-badge-tag--tier-low">' +
          esc(bundle.packLabel) +
          "</span></div></div>"
        : "") +
      "</div>";
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
    var preview = marketingTilePreviewHtml(tile.assets, tile.kind === "viz" ? 6 : 4);
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
      '<button type="button" class="dam-marketing-tile__toggle geex-btn geex-btn--sm geex-btn--primary-transparent" data-action="expand" aria-expanded="false">' +
      "Pokaż wszystko</button></header>" +
      '<div class="dam-marketing-tile__body">' +
      preview +
      (count > 4
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
    var wrap = host.querySelector(".dam-marketing-tiles");
    if (!wrap) return;
    wrap.querySelectorAll(".dam-marketing-tile__toggle").forEach(function (btn) {
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
    stack.innerHTML =
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
      renderCatalog(p, catalogBundle);
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
          listEl.innerHTML = REQUIRED.map(function (r) {
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
      if (titleEl) titleEl.textContent = "Błąd ladowania projektu";
      if (subEl) subEl.textContent = e.message;
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
