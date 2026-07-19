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

  function openWin(path) {
    if (!path) return;
    if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
      window.DamPaths.openFolderInExplorer(path);
      return;
    }
    if (window.DamPaths) window.DamPaths.revealInExplorer(path);
  }

  function rowHtml(role, ok, path, productId) {
    var label = humanizeRole(role);
    var cls = ok ? "dam-check-ok" : "dam-check-brak";
    var mark = ok ? "uil-check-circle" : "uil-times-circle";
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var actions = "";
    if (ok) {
      actions =
        '<span class="dam-slot-row__actions" hidden>' +
        '<a class="geex-btn geex-btn--sm dam-btn-icon dam-slot-go" href="explorer.html?product=' +
        encodeURIComponent(productId || "") +
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

  async function renderMarketingShort(productId) {
    var host = document.getElementById("damMarketingShortBody");
    if (!host) return;
    try {
      var idx = await fetchJsonLocal("data/branding-index.json");
      var assets = (idx.assets || []).filter(function (a) {
        return (a.linked_product_ids || []).indexOf(productId) !== -1;
      });
      if (!assets.length) {
        host.innerHTML =
          '<p class="dam-catalog-marketing__empty">Brak powiązanych assetów — zbuduj indeks Branding.</p>';
        return;
      }
      host.innerHTML =
        '<p class="dam-catalog-marketing__empty">' +
        assets.length +
        ' assetów marketingowych · <a href="branding.html?q=' +
        encodeURIComponent(productId) +
        '">Otwórz Branding</a></p>';
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

    try {
      var res = await DamApi.project(id);
      var p = res.data;
      var variant = (p.variants && p.variants[0]) || null;

      if (titleEl) {
        titleEl.textContent = p.title || "Projekt";
        titleEl.classList.add("dam-project-title--light");
        if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
          window.DamShell.setTrailLeaf(
            (p.product_index ? p.product_index + " - " : "") + (p.title || "Projekt")
          );
        }
      }
      if (subEl) {
        var st = variant && variant.checklist_status ? variant.checklist_status.status : "";
        var stHuman =
          st === "complete" ? "kompletny" : st === "incomplete" ? "niekompletny" : "do sprawdzenia";
        subEl.textContent = "Status: " + stHuman;
      }
      var catalogBundle = await loadCatalogBundle(p.id);
      renderCatalog(p, catalogBundle);
      renderMarketingShort(p.id);
      renderHeaderBadges(p, catalogBundle);

      var present = {};
      var paths = {};
      if (variant && variant.assets) {
        variant.assets.forEach(function (a) {
          if (a.current_revision_id) present[a.asset_role] = true;
          if (a.path) paths[a.asset_role] = a.path;
        });
      }
      var basePath = p.path || "";

      if (listEl) {
        listEl.innerHTML = REQUIRED.map(function (r) {
          return rowHtml(r, !!present[r], paths[r] || basePath, p.id);
        }).join("");
        bindSlotRows(listEl);
      }

      var completeness = variant && variant.checklist_status;
      if (statusEl && completeness) {
        var missingHuman = humanizeMissing(completeness.missing_roles);
        var stH = completeness.status === "complete" ? "kompletny" : "niekompletny";
        statusEl.textContent =
          missingHuman !== "brak"
            ? "Brakuje: " + missingHuman
            : "Wszystkie wymagane pliki kompletne";
      }

      var role = DamApi.role();
      var canWrite = role === "admin" || role === "power_user";
      fillActions(p, variant, canWrite);

      var recomputeBtn = document.getElementById("damRecomputeBtn");
      var notifyBtn = document.getElementById("damNotifyBtn");
      var winBtn = document.getElementById("damWinExplorerBtn");

      if (winBtn) {
        winBtn.addEventListener("click", function () {
          openWin(this.getAttribute("data-path") || basePath);
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
